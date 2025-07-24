import { useState, useEffect, useRef } from "react";
import {
  Download,
  Pause,
  Play,
  Copy,
  Check,
  AudioWaveform,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

import { TextStatistics } from "./components/text-statistics";
import { VoiceSelector } from "./components/voice-selector";
import type { Voices } from "./components/voice-selector";
import { SpeedControl } from "./components/speed-control";
import { AudioChunk } from "./components/audio-chunk";
import type { AudioChunkData } from "./components/audio-chunk";
import { EpubUploader } from "./components/epub-uploader";
import { ChapterSelector } from "./components/chapter-selector";
import { EpubParser, type EpubMetadata } from "./utils/epub-parser";

export default function AudioReader() {
  const [text, setText] = useState(
    "Kokoro is an open-weight TTS model with 82 million parameters. Despite its lightweight architecture, it delivers comparable quality to larger models while being significantly faster and more cost-efficient. With Apache-licensed weights, Kokoro can be deployed anywhere from production environments to personal projects. It can even run 100% locally in your browser, powered by Transformers.js!",
  );
  const [lastGeneration, setLastGeneration] = useState<{
    text: string;
    speed: number;
    voice: keyof Voices;
  } | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
  const [speed, setSpeed] = useState(1);
  const [copied, setCopied] = useState(false);

  const [status, setStatus] = useState<
    "loading" | "ready" | "generating" | "error"
  >("loading");
  const [error, setError] = useState<string | null>(null);

  const worker = useRef<Worker | null>(null);
  const [voices, setVoices] = useState<Voices | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<keyof Voices>("af_heart");
  const [chunks, setChunks] = useState<AudioChunkData[]>([]);
  const [result, setResult] = useState<Blob | null>(null);

  // EPUB state
  const [epubParser, setEpubParser] = useState<EpubParser | null>(null);
  const [epubMetadata, setEpubMetadata] = useState<EpubMetadata | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [isLoadingEpub, setIsLoadingEpub] = useState(false);
  const [isLoadingChapter, setIsLoadingChapter] = useState(false);

  useEffect(() => {
    worker.current ??= new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });

    // Create a callback function for messages from the worker thread.
    // @ts-expect-error - No need to define type for data
    const onMessageReceived = ({ data }) => {
      switch (data.status) {
        case "device":
          toast("Device detected: " + data.device);
          break;
        case "ready":
          toast("Model loaded successfully");
          setStatus("ready");
          setVoices(data.voices);
          break;
        case "error":
          setStatus("error");
          setError(data.data);
          break;
        case "stream": {
          setChunks((prev) => [...prev, data.chunk]);
          break;
        }
        case "complete": {
          setStatus("ready");
          setResult(data.audio);
          break;
        }
      }
    };

    const onErrorReceived = (e: ErrorEvent) => {
      console.error("Worker error:", e);
      setError(e.message);
    };

    // Attach the callback function as an event listener.
    worker.current?.addEventListener("message", onMessageReceived);
    worker.current?.addEventListener("error", onErrorReceived);

    // Define a cleanup function for when the component is unmounted.
    return () => {
      worker.current?.removeEventListener("message", onMessageReceived);
      worker.current?.removeEventListener("error", onErrorReceived);
    };
  }, []);

  const processed =
    lastGeneration &&
    lastGeneration.text === text &&
    lastGeneration.speed === speed &&
    lastGeneration.voice === selectedVoice;

  const handlePlayPause = () => {
    if (!isPlaying && status === "ready" && !processed) {
      setStatus("generating");
      setChunks([]);
      setCurrentChunkIndex(0);
      const params = { text, voice: selectedVoice, speed };
      setLastGeneration(params);
      worker.current?.postMessage(params);
    }
    if (currentChunkIndex === -1) {
      setCurrentChunkIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // EPUB handlers
  const handleEpubFileSelect = async (file: File) => {
    setIsLoadingEpub(true);
    try {
      const parser = new EpubParser();
      const metadata = await parser.loadFromFile(file);
      
      setEpubParser(parser);
      setEpubMetadata(metadata);
      setCurrentFileName(file.name);
      setSelectedChapter(null);
      
      toast.success(`Loaded "${metadata.title}" with ${metadata.chapters.length} chapters`);
    } catch (error) {
      console.error("Failed to load EPUB:", error);
      toast.error("Failed to load EPUB file");
    } finally {
      setIsLoadingEpub(false);
    }
  };

  const handleChapterSelect = async (chapterId: string) => {
    if (!epubParser || !epubMetadata) return;
    
    const chapter = epubMetadata.chapters.find(ch => ch.id === chapterId);
    if (!chapter) return;

    setIsLoadingChapter(true);
    try {
      const chapterText = await epubParser.getChapterText(chapter.href);
      setText(chapterText);
      setSelectedChapter(chapterId);
      toast.success(`Loaded: ${chapter.label}`);
    } catch (error) {
      console.error("Failed to load chapter:", error);
      toast.error("Failed to load chapter text");
    } finally {
      setIsLoadingChapter(false);
    }
  };

  const handleClearEpub = () => {
    epubParser?.destroy();
    setEpubParser(null);
    setEpubMetadata(null);
    setSelectedChapter(null);
    setCurrentFileName(null);
    toast.info("EPUB cleared");
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50/50 p-4 md:p-12">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2">
              <AudioWaveform className="size-12 text-blue-500" />
              <h1 className="text-5xl font-bold text-gray-900">LexiVox</h1>
            </div>
            <p className="text-gray-500">
              Transform EPUB books and text into natural speech
            </p>
          </div>

          <EpubUploader
            onFileSelect={handleEpubFileSelect}
            isLoading={isLoadingEpub}
            currentFile={currentFileName}
            onClear={handleClearEpub}
          />

          {epubMetadata && (
            <ChapterSelector
              chapters={epubMetadata.chapters}
              selectedChapter={selectedChapter}
              onChapterSelect={handleChapterSelect}
              isLoading={isLoadingChapter}
            />
          )}

          <Card className="shadow-lg">
            <CardContent>
              {!epubMetadata ? (
                <div className="relative">
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type or paste your text here..."
                    className={`transition-all min-h-[180px] text-lg leading-relaxed ${processed && status === "ready" ? "bg-green-100" : ""} resize-y ${status === "loading" ? "text-gray-300" : ""}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg">{epubMetadata.title}</h3>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={handleCopy}
                      >
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {selectedChapter ? (
                      <div className="text-sm text-gray-600 mb-3">
                        Current chapter: {epubMetadata.chapters.find(ch => ch.id === selectedChapter)?.label}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 mb-3">Select a chapter to load text</div>
                    )}
                  </div>
                </div>
              )}

              {/* Currently Playing Text Display */}
              {chunks.length > 0 && currentChunkIndex >= 0 && currentChunkIndex < chunks.length && (
                <div className="mt-4 p-4 bg-white rounded-lg border">
                  <div className="text-sm font-medium text-gray-600 mb-2">Currently Reading:</div>
                  <div className="text-lg text-gray-800 leading-relaxed">
                    {chunks[currentChunkIndex].text}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <TextStatistics text={text} />
              </div>
              <div className="flex gap-4 pb-4 min-h-14 items-center justify-center">
                {voices ? (
                  <>
                    <VoiceSelector
                      voices={voices}
                      selectedVoice={selectedVoice}
                      onVoiceChange={setSelectedVoice}
                    />
                    <div className="flex items-center gap-4 w-44">
                      <SpeedControl speed={speed} onSpeedChange={setSpeed} />
                    </div>
                  </>
                ) : error ? (
                  <div className="text-red-400 font-semibold text-lg/6 text-center p-2">
                    {error}
                  </div>
                ) : (
                  <div className="animate-pulse text-center">
                    Loading model...
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex py-4 gap-4">
                <Button
                  size="lg"
                  onClick={handlePlayPause}
                  className={cn(
                    "text-lg w-36 transition-all",
                    isPlaying && "bg-orange-600 hover:bg-orange-700",
                  )}
                  disabled={
                    (status === "ready" && !isPlaying && !text) ||
                    (status !== "ready" && chunks.length === 0)
                  }
                >
                  {isPlaying ? (
                    <>
                      <Pause className="mr-1 size-8" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="mr-1 size-8" />
                      {processed || status === "generating"
                        ? "Play"
                        : "Generate"}
                    </>
                  )}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    if (!result) return;
                    const url = URL.createObjectURL(result);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "audio.wav";
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                  disabled={!result || status !== "ready"}
                  className="ml-auto"
                >
                  <Download className="mr-2 size-6" />
                  Download Audio
                </Button>
              </div>

              {/* Hidden AudioChunk components for original streaming functionality */}
              {chunks.length > 0 && (
                <div className="hidden">
                  {chunks.map(({ text, audio }, index) => (
                    <AudioChunk
                      key={index}
                      text={text}
                      audio={audio}
                      onClick={() => {
                        setCurrentChunkIndex(index);
                      }}
                      active={currentChunkIndex === index}
                      playing={isPlaying}
                      onStart={() => {
                        setCurrentChunkIndex(index);
                        setIsPlaying(true);
                      }}
                      onPause={() => {
                        if (currentChunkIndex === index) {
                          setIsPlaying(false);
                        }
                      }}
                      onEnd={() => {
                        // No more chunks are still generating, and we have reached the end
                        if (
                          status !== "generating" &&
                          currentChunkIndex === chunks.length - 1
                        ) {
                          setIsPlaying(false);
                          setCurrentChunkIndex(-1);
                        } else {
                          setCurrentChunkIndex((prev) => prev + 1);
                        }
                      }}
                    />
                  ))}
                </div>
              )}

            </CardContent>
          </Card>
        </div>
      </div>
      <div className="fixed bottom-4 text-center w-full">
        Powered by{" "}
        <a
          href="https://huggingface.co/docs/transformers.js"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 underline"
        >
          🤗 Transformers.js
        </a>
      </div>
      <Toaster
        toastOptions={{
          style: {
            fontSize: 16,
          },
        }}
      />
    </>
  );
}
