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
    
  } catch (e: Error) {
    self.postMessage({ status: "error", error: e.message, device });
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

// Listen for messages from the main thread
self.addEventListener("message", async (e) => {
  const { text, voice, speed } = e.data;

  // Ensure model is loaded
  const model = await loadModel();
  resetIdleTimer(); // Reset timer on each use

  const streamer = new TextSplitterStream();
  streamer.push(text);
  streamer.close(); // Indicate we won't add more text

  const stream = model.stream(streamer, { voice, speed });

  const chunks = [];
  let chunkIndex = 0;
  
  for await (const { text, audio } of stream) {
    chunkIndex++;
    
    self.postMessage({
      status: "stream",
      chunk: {
        audio: audio.toBlob(),
        text,
      },
      progress: {
        current: chunkIndex,
        // We don't know total chunks ahead of time, so we'll estimate
        // based on text length (rough: 75 chars per chunk)
        estimatedTotal: Math.ceil(text.length / 75),
        device
      }
    });
    chunks.push(audio);
    resetIdleTimer(); // Keep resetting timer during generation
  }

  // Merge chunks
  let audio;
  if (chunks.length > 0) {
    const sampling_rate = chunks[0].sampling_rate;
    const length = chunks.reduce((sum, chunk) => sum + chunk.audio.length, 0);
    const waveform = new Float32Array(length);
    let offset = 0;
    for (const { audio } of chunks) {
      waveform.set(audio, offset);
      offset += audio.length;
    }

    // Create a new merged RawAudio
    // @ts-expect-error - So that we don't need to import RawAudio
    audio = new chunks[0].constructor(waveform, sampling_rate);
  }

  self.postMessage({ status: "complete", audio: audio.toBlob() });
});
