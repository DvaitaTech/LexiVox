import { KokoroTTS, TextSplitterStream } from "kokoro-js";
import { detectWebGPU } from "./utils";

// Model management variables
let tts: KokoroTTS | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const model_id = "onnx-community/Kokoro-82M-v1.0-ONNX";

// Device detection
const device = (await detectWebGPU()) ? "webgpu" : "wasm";
self.postMessage({ status: "device", device });

// Function to load the model
async function loadModel() {
  if (tts) return tts; // Model already loaded
  
  self.postMessage({ 
    status: "loading", 
    device,
    stage: "downloading",
    progress: 0
  });
  
  try {
    // Create progress tracking wrapper
    let lastProgress = 0;
    const progressInterval = setInterval(() => {
      // Simulate progress during download (rough estimate)
      lastProgress = Math.min(90, lastProgress + Math.random() * 10);
      self.postMessage({ 
        status: "loading", 
        device,
        stage: "downloading",
        progress: lastProgress
      });
    }, 500);

    tts = await KokoroTTS.from_pretrained(model_id, {
      dtype: device === "wasm" ? "q8" : "fp32",
      device,
    });
    
    clearInterval(progressInterval);
    
    // Final loading stage
    self.postMessage({ 
      status: "loading", 
      device,
      stage: "ready",
      progress: 100
    });
    
    // Brief delay to show completion
    await new Promise(resolve => setTimeout(resolve, 500));
    
    self.postMessage({ 
      status: "ready", 
      voices: tts.voices, 
      device,
      performance: {
        chunksPerSecond: device === "wasm" ? 0.25 : 0.8,
        averageChunkTime: device === "wasm" ? 4000 : 1250
      }
    });
    
    resetIdleTimer();
    return tts;
    
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    self.postMessage({ status: "error", error: errorMessage, device });
    throw e;
  }
}

// Function to unload the model
function unloadModel() {
  if (tts) {
    // Dispose of the model if dispose method exists
    if ('dispose' in tts && typeof tts.dispose === 'function') {
      tts.dispose();
    }
    tts = null;
    self.postMessage({ status: "model_unloaded" });
  }
}

// Reset the idle timer
function resetIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
  
  idleTimer = setTimeout(() => {
    unloadModel();
  }, IDLE_TIMEOUT);
}

// Initial model load
await loadModel();

// Buffered generation state
let currentGenerationId: string | null = null;
let generationStream: any = null;
let streamIterator: any = null;
let chunkBuffer: any[] = [];
let totalEstimatedChunks = 0;
let generationComplete = false;

// Listen for messages from the main thread
self.addEventListener("message", async (e) => {
  const { type, text, voice, speed, generationId, requestChunkIndex } = e.data;

  if (type === "generate") {
    // Start new generation
    await startGeneration(text, voice, speed, generationId);
  } else if (type === "request_chunk") {
    // Request specific chunk for playback
    await handleChunkRequest(requestChunkIndex, generationId);
  } else if (type === "stop") {
    // Stop current generation
    stopGeneration();
  }
});

async function startGeneration(text: string, voice: any, speed: number, generationId: string) {
  // Stop any existing generation
  stopGeneration();
  
  // Reset state
  currentGenerationId = generationId;
  chunkBuffer = [];
  generationComplete = false;
  totalEstimatedChunks = Math.ceil(text.length / 75);

  // Ensure model is loaded
  const model = await loadModel();
  resetIdleTimer();

  const streamer = new TextSplitterStream();
  streamer.push(text);
  streamer.close();

  generationStream = model.stream(streamer, { voice, speed });
  streamIterator = generationStream[Symbol.asyncIterator]();

  // Generate first 5 chunks immediately
  await generateChunksAhead(5);
}

async function generateChunksAhead(chunksToGenerate: number) {
  if (!streamIterator || generationComplete || currentGenerationId === null) return;

  let generated = 0;
  
  try {
    while (generated < chunksToGenerate && !generationComplete && currentGenerationId !== null) {
      const result = await streamIterator.next();
      
      if (result.done) {
        // Stream is complete
        generationComplete = true;
        break;
      }
      
      const { text: chunkText, audio } = result.value;
      const chunkIndex = chunkBuffer.length;
      
      chunkBuffer.push({
        text: chunkText,
        audio,
        index: chunkIndex
      });

      // Send chunk to main thread
      self.postMessage({
        status: "chunk_ready",
        generationId: currentGenerationId,
        chunk: {
          audio: audio.toBlob(),
          text: chunkText,
          index: chunkIndex
        },
        progress: {
          current: chunkIndex + 1,
          estimatedTotal: totalEstimatedChunks,
          device
        }
      });

      generated++;
      resetIdleTimer();
    }

    // Check if generation is complete
    if (generationComplete) {
      
      // Create final merged audio
      if (chunkBuffer.length > 0) {
        const chunks = chunkBuffer.map(c => c.audio);
        const sampling_rate = chunks[0].sampling_rate;
        const length = chunks.reduce((sum, chunk) => sum + chunk.audio.length, 0);
        const waveform = new Float32Array(length);
        let offset = 0;
        for (const { audio } of chunks) {
          waveform.set(audio, offset);
          offset += audio.length;
        }

        const mergedAudio = new (chunks[0] as any).constructor(waveform, sampling_rate);
        
        self.postMessage({ 
          status: "complete", 
          generationId: currentGenerationId,
          audio: mergedAudio.toBlob(),
          totalChunks: chunkBuffer.length
        });
      }
    }
  } catch (error) {
    if (currentGenerationId !== null) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      self.postMessage({ 
        status: "error", 
        error: errorMessage, 
        generationId: currentGenerationId,
        device 
      });
    }
  }
}

async function handleChunkRequest(requestedIndex: number, generationId: string) {
  // Ignore requests from old generations
  if (generationId !== currentGenerationId) return;

  // Only generate more chunks when we're getting close to the end of the buffer
  const currentBufferSize = chunkBuffer.length;
  const chunksRemaining = currentBufferSize - requestedIndex - 1;
  
  // Generate more chunks only when we have 2 or fewer chunks remaining ahead
  if (chunksRemaining <= 2 && !generationComplete) {
    const chunksToGenerate = Math.min(5, 5 - chunksRemaining);
    await generateChunksAhead(chunksToGenerate);
  }

  // Send current chunk if available
  if (requestedIndex < chunkBuffer.length) {
    const chunk = chunkBuffer[requestedIndex];
    self.postMessage({
      status: "chunk_available",
      generationId: currentGenerationId,
      chunk: {
        audio: chunk.audio.toBlob(),
        text: chunk.text,
        index: chunk.index
      }
    });
  }
}

function stopGeneration() {
  currentGenerationId = null;
  generationStream = null;
  streamIterator = null;
  // Keep buffer for potential resume, but mark as stopped
}
