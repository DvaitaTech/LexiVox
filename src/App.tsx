import { useState, useEffect, useRef } from "react";
import {
  Download,
  Pause,
  Play,
  Copy,
  Check,
  AudioWaveform,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Github,
  Cpu,
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
import { FileUploader } from "./components/file-uploader";
import { NavigationSelector } from "./components/navigation-selector";
import { InstallPrompt } from "./components/install-prompt";
import { InstallButton } from "./components/install-button";
import type { EpubMetadata } from "./utils/epub-parser";
import type { PdfMetadata } from "./utils/pdf-parser";
import { useNavigationSwipe } from "./hooks/useSwipeGesture";
import { isMobile } from "./utils/mobile-detection";
import { useMediaSession, useWakeLock } from "./hooks/useMediaSession";
import { useAudioFocus } from "./hooks/useAudioFocus";
import { ModelLoadingIndicator } from "./components/model-loading-indicator";
import { GenerationProgress } from "./components/generation-progress";
import { DevicePerformanceInfo } from "./components/device-performance-info";
import { shouldShowSlowWarning, estimateGenerationTime, type DeviceType } from "./utils/performance-estimates";

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
  
  // Enhanced loading states
  const [device, setDevice] = useState<DeviceType | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState<'downloading' | 'loading' | 'ready'>('downloading');
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const [showDeviceInfo, setShowDeviceInfo] = useState(false);

  const worker = useRef<Worker | null>(null);
  const [voices, setVoices] = useState<Voices | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<keyof Voices>("af_heart");
  const [chunks, setChunks] = useState<AudioChunkData[]>([]);
  const [result, setResult] = useState<Blob | null>(null);

  // File state
  const [fileType, setFileType] = useState<"epub" | "pdf" | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  
  // EPUB state
  const [epubParser, setEpubParser] = useState<any | null>(null);
  const [epubMetadata, setEpubMetadata] = useState<EpubMetadata | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  
  // PDF state
  const [pdfParser, setPdfParser] = useState<any | null>(null);
  const [pdfMetadata, setPdfMetadata] = useState<PdfMetadata | null>(null);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);

  useEffect(() => {
    worker.current ??= new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });

    // Create a callback function for messages from the worker thread.
    // @ts-expect-error - No need to define type for data
    const onMessageReceived = ({ data }) => {
      switch (data.status) {
        case "device":
          setDevice(data.device);
          setShowDeviceInfo(true);
          toast(`Device detected: ${data.device.toUpperCase()}`);
          break;
        case "loading":
          setStatus("loading");
          setLoadingProgress(data.progress || 0);
          setLoadingStage(data.stage || 'downloading');
          if (data.progress === 0) {
            toast(`Loading TTS model (${data.device?.toUpperCase() || 'Unknown'})...`);
          }
          break;
        case "ready":
          setStatus("ready");
          setVoices(data.voices);
          setLoadingProgress(100);
          setGenerationProgress({ current: 0, total: 0 });
          toast(`Model loaded successfully (${data.device?.toUpperCase()})`);
          
          // Show device info briefly for new users
          if (data.device === 'wasm') {
            setShowDeviceInfo(true);
          }
          break;
        case "model_unloaded":
          toast.info("Model unloaded to save memory");
          setLoadingProgress(0);
          break;
        case "error":
          setStatus("error");
          setError(data.error || data.data);
          setLoadingProgress(0);
          break;
        case "stream": {
          setChunks((prev) => [...prev, data.chunk]);
          
          // Update generation progress
          if (data.progress) {
            setGenerationProgress({
              current: data.progress.current,
              total: data.progress.estimatedTotal
            });
          }
          break;
        }
        case "complete": {
          setStatus("ready");
          setResult(data.audio);
          setGenerationProgress({ current: 0, total: 0 });
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

  // File handlers
  const handleFileSelect = async (file: File) => {
    setIsLoadingFile(true);
    
    try {
      if (file.type === "application/epub+zip") {
        await handleEpubFile(file);
      } else if (file.type === "application/pdf") {
        await handlePdfFile(file);
      } else {
        toast.error("Unsupported file type");
      }
    } catch (error) {
      console.error("Failed to load file:", error);
      toast.error("Failed to load file");
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleEpubFile = async (file: File) => {
    // Lazy load EPUB parser
    const { EpubParser } = await import("./utils/epub-parser");
    const parser = new EpubParser();
    const metadata = await parser.loadFromFile(file);
    
    setFileType("epub");
    setEpubParser(parser);
    setEpubMetadata(metadata);
    setCurrentFileName(file.name);
    
    // Clear PDF state
    setPdfParser(null);
    setPdfMetadata(null);
    setSelectedPage(null);
    
    // Auto-load first chapter
    if (metadata.chapters.length > 0) {
      const firstChapter = metadata.chapters[0];
      const chapterText = await parser.getChapterText(firstChapter.href);
      setText(chapterText);
      setSelectedChapter(firstChapter.id);
      toast.success(`Loaded "${metadata.title}" - Starting with: ${firstChapter.label}`);
    } else {
      setSelectedChapter(null);
      toast.success(`Loaded "${metadata.title}" with ${metadata.chapters.length} chapters`);
    }
  };

  const handlePdfFile = async (file: File) => {
    // Lazy load PDF parser
    const { PdfParser } = await import("./utils/pdf-parser");
    const parser = new PdfParser();
    const metadata = await parser.loadFromFile(file);
    
    setFileType("pdf");
    setPdfParser(parser);
    setPdfMetadata(metadata);
    setCurrentFileName(file.name);
    
    // Clear EPUB state
    setEpubParser(null);
    setEpubMetadata(null);
    setSelectedChapter(null);
    
    // Auto-load first page
    if (metadata.pages.length > 0) {
      const firstPage = metadata.pages[0];
      setText(firstPage.text);
      setSelectedPage(1);
      toast.success(`Loaded "${metadata.title}" - Starting with Page 1 of ${metadata.totalPages}`);
    } else {
      setSelectedPage(null);
      toast.success(`Loaded "${metadata.title}" with ${metadata.totalPages} pages`);
    }
  };

  const handleNavigationSelect = async (itemId: string | number) => {
    if (fileType === "epub") {
      await handleChapterSelect(itemId as string);
    } else if (fileType === "pdf") {
      await handlePageSelect(itemId as number);
    }
  };

  const handleChapterSelect = async (chapterId: string, autoAdvance = false) => {
    if (!epubParser || !epubMetadata) return;
    
    const chapter = epubMetadata.chapters.find(ch => ch.id === chapterId);
    if (!chapter) return;

    setIsLoadingContent(true);
    try {
      const chapterText = await epubParser.getChapterText(chapter.href);
      setText(chapterText);
      setSelectedChapter(chapterId);
      
      if (autoAdvance) {
        // Auto-generate and continue playing
        setStatus("generating");
        setChunks([]);
        setCurrentChunkIndex(0);
        const params = { text: chapterText, voice: selectedVoice, speed };
        setLastGeneration(params);
        worker.current?.postMessage(params);
        toast.success(`Auto-advanced to: ${chapter.label}`);
      } else {
        toast.success(`Loaded: ${chapter.label}`);
      }
    } catch (error) {
      console.error("Failed to load chapter:", error);
      toast.error("Failed to load chapter text");
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handlePageSelect = async (pageNumber: number, autoAdvance = false) => {
    if (!pdfParser || !pdfMetadata) return;
    
    const page = pdfMetadata.pages.find(p => p.pageNumber === pageNumber);
    if (!page) return;

    setIsLoadingContent(true);
    try {
      setText(page.text);
      setSelectedPage(pageNumber);
      
      if (autoAdvance) {
        // Auto-generate and continue playing
        setStatus("generating");
        setChunks([]);
        setCurrentChunkIndex(0);
        const params = { text: page.text, voice: selectedVoice, speed };
        setLastGeneration(params);
        worker.current?.postMessage(params);
        toast.success(`Auto-advanced to: Page ${pageNumber}`);
      } else {
        toast.success(`Loaded: Page ${pageNumber}`);
      }
    } catch (error) {
      console.error("Failed to load page:", error);
      toast.error("Failed to load page text");
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleClearFile = () => {
    epubParser?.destroy();
    pdfParser?.destroy();
    
    setFileType(null);
    setEpubParser(null);
    setEpubMetadata(null);
    setSelectedChapter(null);
    setPdfParser(null);
    setPdfMetadata(null);
    setSelectedPage(null);
    setCurrentFileName(null);
    
    toast.info("File cleared");
  };

  // Navigation functions
  const handlePreviousChunk = () => {
    if (currentChunkIndex > 0) {
      const wasPlaying = isPlaying;
      setIsPlaying(false); // Briefly stop to reset audio
      setCurrentChunkIndex(currentChunkIndex - 1);
      if (wasPlaying) {
        // Resume playing from new position
        setTimeout(() => setIsPlaying(true), 100);
      }
    }
  };

  const handleNextChunk = () => {
    if (currentChunkIndex < chunks.length - 1) {
      const wasPlaying = isPlaying;
      setIsPlaying(false); // Briefly stop to reset audio
      setCurrentChunkIndex(currentChunkIndex + 1);
      if (wasPlaying) {
        // Resume playing from new position
        setTimeout(() => setIsPlaying(true), 100);
      }
    }
  };

  const handlePreviousSection = async () => {
    if (fileType === "epub") {
      await handlePreviousChapter();
    } else if (fileType === "pdf") {
      await handlePreviousPage();
    }
  };

  const handleNextSection = async () => {
    if (fileType === "epub") {
      await handleNextChapter();
    } else if (fileType === "pdf") {
      await handleNextPage();
    }
  };

  const handlePreviousChapter = async () => {
    if (!epubMetadata || !selectedChapter || !epubParser) return;
    
    const currentChapterIndex = epubMetadata.chapters.findIndex(ch => ch.id === selectedChapter);
    if (currentChapterIndex > 0) {
      const wasPlaying = isPlaying;
      setIsPlaying(false);
      setChunks([]);
      setCurrentChunkIndex(-1);
      
      const prevChapter = epubMetadata.chapters[currentChapterIndex - 1];
      
      setIsLoadingContent(true);
      try {
        const chapterText = await epubParser.getChapterText(prevChapter.href);
        setText(chapterText);
        setSelectedChapter(prevChapter.id);
        toast.success(`Loaded: ${prevChapter.label}`);
        
        if (wasPlaying) {
          setTimeout(() => {
            setCurrentChunkIndex(0);
            setIsPlaying(true);
            const params = { text: chapterText, voice: selectedVoice, speed };
            setLastGeneration(params);
            setStatus("generating");
            worker.current?.postMessage(params);
          }, 200);
        }
      } catch (error) {
        console.error("Failed to load chapter:", error);
        toast.error("Failed to load chapter text");
      } finally {
        setIsLoadingContent(false);
      }
    }
  };

  const handleNextChapter = async () => {
    if (!epubMetadata || !selectedChapter || !epubParser) return;
    
    const currentChapterIndex = epubMetadata.chapters.findIndex(ch => ch.id === selectedChapter);
    if (currentChapterIndex < epubMetadata.chapters.length - 1) {
      const wasPlaying = isPlaying;
      setIsPlaying(false);
      setChunks([]);
      setCurrentChunkIndex(-1);
      
      const nextChapter = epubMetadata.chapters[currentChapterIndex + 1];
      
      setIsLoadingContent(true);
      try {
        const chapterText = await epubParser.getChapterText(nextChapter.href);
        setText(chapterText);
        setSelectedChapter(nextChapter.id);
        toast.success(`Loaded: ${nextChapter.label}`);
        
        if (wasPlaying) {
          setTimeout(() => {
            setCurrentChunkIndex(0);
            setIsPlaying(true);
            const params = { text: chapterText, voice: selectedVoice, speed };
            setLastGeneration(params);
            setStatus("generating");
            worker.current?.postMessage(params);
          }, 200);
        }
      } catch (error) {
        console.error("Failed to load chapter:", error);
        toast.error("Failed to load chapter text");
      } finally {
        setIsLoadingContent(false);
      }
    }
  };

  const handlePreviousPage = async () => {
    if (!pdfMetadata || !selectedPage) return;
    
    if (selectedPage > 1) {
      const wasPlaying = isPlaying;
      setIsPlaying(false);
      setChunks([]);
      setCurrentChunkIndex(-1);
      
      const prevPageNumber = selectedPage - 1;
      const prevPage = pdfMetadata.pages.find(p => p.pageNumber === prevPageNumber);
      
      if (prevPage) {
        setText(prevPage.text);
        setSelectedPage(prevPageNumber);
        toast.success(`Loaded: Page ${prevPageNumber}`);
        
        if (wasPlaying) {
          setTimeout(() => {
            setCurrentChunkIndex(0);
            setIsPlaying(true);
            const params = { text: prevPage.text, voice: selectedVoice, speed };
            setLastGeneration(params);
            setStatus("generating");
            worker.current?.postMessage(params);
          }, 200);
        }
      }
    }
  };

  const handleNextPage = async () => {
    if (!pdfMetadata || !selectedPage) return;
    
    if (selectedPage < pdfMetadata.totalPages) {
      const wasPlaying = isPlaying;
      setIsPlaying(false);
      setChunks([]);
      setCurrentChunkIndex(-1);
      
      const nextPageNumber = selectedPage + 1;
      const nextPage = pdfMetadata.pages.find(p => p.pageNumber === nextPageNumber);
      
      if (nextPage) {
        setText(nextPage.text);
        setSelectedPage(nextPageNumber);
        toast.success(`Loaded: Page ${nextPageNumber}`);
        
        if (wasPlaying) {
          setTimeout(() => {
            setCurrentChunkIndex(0);
            setIsPlaying(true);
            const params = { text: nextPage.text, voice: selectedVoice, speed };
            setLastGeneration(params);
            setStatus("generating");
            worker.current?.postMessage(params);
          }, 200);
        }
      }
    }
  };

  // Add swipe gesture support on mobile
  const swipeEnabled = isMobile() && (fileType === "epub" || fileType === "pdf");
  const { swiping } = useNavigationSwipe(
    handleNextSection,
    handlePreviousSection,
    swipeEnabled
  );

  // Get current document title for Media Session
  const getDocumentTitle = () => {
    if (fileType === "epub" && epubMetadata) {
      const chapter = epubMetadata.chapters.find(ch => ch.id === selectedChapter);
      return chapter ? chapter.label : epubMetadata.title;
    } else if (fileType === "pdf" && pdfMetadata) {
      return `Page ${selectedPage} - ${pdfMetadata.title}`;
    }
    return "Text to Speech";
  };

  const getAlbumTitle = () => {
    if (fileType === "epub" && epubMetadata) {
      return epubMetadata.title;
    } else if (fileType === "pdf" && pdfMetadata) {
      return pdfMetadata.title;
    }
    return "LexiVox";
  };

  // Media Session API for background playback
  useMediaSession(
    {
      title: getDocumentTitle(),
      artist: selectedVoice ? voices?.[selectedVoice]?.name || "LexiVox" : "LexiVox",
      album: getAlbumTitle(),
    },
    {
      onPlay: () => {
        if (currentChunkIndex === -1) {
          setCurrentChunkIndex(0);
        }
        setIsPlaying(true);
      },
      onPause: () => setIsPlaying(false),
      onPreviousTrack: () => {
        if (chunks.length > 0 && currentChunkIndex > 0) {
          handlePreviousChunk();
        } else if (fileType) {
          handlePreviousSection();
        }
      },
      onNextTrack: () => {
        if (chunks.length > 0 && currentChunkIndex < chunks.length - 1) {
          handleNextChunk();
        } else if (fileType) {
          handleNextSection();
        }
      },
      onSeekBackward: () => {
        if (currentChunkIndex > 0) {
          setCurrentChunkIndex(Math.max(0, currentChunkIndex - 5));
        }
      },
      onSeekForward: () => {
        if (currentChunkIndex < chunks.length - 1) {
          setCurrentChunkIndex(Math.min(chunks.length - 1, currentChunkIndex + 5));
        }
      },
    },
    isPlaying,
    chunks.length * 5, // Approximate duration (5 seconds per chunk)
    currentChunkIndex * 5 // Approximate current time
  );

  // Wake lock to prevent screen sleep during playback
  useWakeLock(isPlaying);

  // Audio focus handling for interruptions
  const { resumeAudioContext } = useAudioFocus(isPlaying, {
    onAudioFocusGain: () => {
      // Resume playback if it was playing before interruption
      if (!isPlaying && currentChunkIndex >= 0) {
        setIsPlaying(true);
      }
    },
    onAudioFocusLossTransient: () => {
      // Pause temporarily for phone calls, etc.
      if (isPlaying) {
        setIsPlaying(false);
      }
    },
    onAudioFocusLossTransientCanDuck: () => {
      // Lower volume but continue playing (not implemented yet)
      console.debug('Audio ducking requested');
    },
  });

  return (
    <>
      <div className="min-h-screen bg-gray-50/50 p-2 sm:p-4 md:p-12 safe-area-padding">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-2 sm:relative">
              {/* Desktop: Absolute positioned buttons on the right */}
              <div className="hidden sm:flex items-center gap-2 sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2">
                <Button
                  variant="outline"
                  size="icon"
                  asChild
                  className="h-8 w-8 sm:h-10 sm:w-10"
                >
                  <a
                    href="https://github.com/DvaitaTech/LexiVox"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View source on GitHub"
                  >
                    <Github className="h-4 w-4 sm:h-5 sm:w-5" />
                  </a>
                </Button>
                <InstallButton />
              </div>
              
              {/* Centered title */}
              <div className="flex items-center gap-2 sm:gap-3 sm:mx-auto">
                <AudioWaveform className="size-8 sm:size-10 md:size-12 text-blue-500" />
                <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-gray-900">LexiVox</h1>
              </div>
              
              {/* Mobile: Show buttons below title */}
              <div className="flex items-center gap-2 sm:hidden">
                <Button
                  variant="outline"
                  size="icon"
                  asChild
                  className="h-8 w-8"
                >
                  <a
                    href="https://github.com/DvaitaTech/LexiVox"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View source on GitHub"
                  >
                    <Github className="h-4 w-4" />
                  </a>
                </Button>
                <InstallButton />
              </div>
            </div>
            <p className="text-sm sm:text-base text-gray-500 px-4 sm:px-0">
              Transform EPUB books and PDF documents into natural speech
            </p>
          </div>

          {/* Model Loading Indicator */}
          {status === "loading" && (
            <div className="mb-6">
              <ModelLoadingIndicator
                isLoading={true}
                device={device || undefined}
                progress={loadingProgress}
                stage={loadingStage}
              />
            </div>
          )}

          {/* Device Performance Info */}
          {showDeviceInfo && device && status === "ready" && (
            <div className="mb-6">
              <DevicePerformanceInfo
                device={device}
                onDismiss={() => setShowDeviceInfo(false)}
                showOptimizationTips={device === 'wasm'}
              />
            </div>
          )}

          <FileUploader
            onFileSelect={handleFileSelect}
            isLoading={isLoadingFile}
            currentFile={currentFileName}
            onClear={handleClearFile}
          />

          {(epubMetadata || pdfMetadata) && (
            <NavigationSelector
              type={fileType!}
              items={fileType === "epub" ? epubMetadata!.chapters : pdfMetadata!.pages}
              selectedItem={fileType === "epub" ? selectedChapter : selectedPage}
              onItemSelect={handleNavigationSelect}
              isLoading={isLoadingContent}
            />
          )}

          <Card className="shadow-lg">
            <CardContent>
              {!epubMetadata && !pdfMetadata ? (
                <div className="relative">
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type or paste your text here..."
                    className={`transition-all min-h-[120px] sm:min-h-[180px] text-base sm:text-lg leading-relaxed ${processed && status === "ready" ? "bg-green-100" : ""} resize-y ${status === "loading" ? "text-gray-300" : ""}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2 h-8 w-8 touch-manipulation"
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
                  <div className="p-3 sm:p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <h3 className="font-semibold text-base sm:text-lg flex-1 min-w-0">
                        <span className="line-clamp-2 sm:line-clamp-none">
                          {fileType === "epub" ? epubMetadata!.title : pdfMetadata!.title}
                        </span>
                      </h3>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 touch-manipulation flex-shrink-0"
                        onClick={handleCopy}
                      >
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {fileType === "epub" && selectedChapter ? (
                      <div className="text-xs sm:text-sm text-gray-600 mb-3">
                        <span className="font-medium">Chapter:</span> <span className="line-clamp-1">{epubMetadata!.chapters.find(ch => ch.id === selectedChapter)?.label}</span>
                      </div>
                    ) : fileType === "pdf" && selectedPage ? (
                      <div className="text-xs sm:text-sm text-gray-600 mb-3">
                        <span className="font-medium">Current:</span> Page {selectedPage} of {pdfMetadata!.totalPages}
                      </div>
                    ) : (
                      <div className="text-xs sm:text-sm text-gray-500 mb-3">
                        Select a {fileType === "epub" ? "chapter" : "page"} to load text
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Generation Progress */}
              {status === "generating" && (
                <div className="mt-3 sm:mt-4">
                  <GenerationProgress
                    isGenerating={true}
                    currentChunk={generationProgress.current}
                    totalChunks={generationProgress.total}
                    device={device || undefined}
                    textLength={text.length}
                  />
                </div>
              )}

              {/* Performance Warning for Long Texts */}
              {device === 'wasm' && text.length > 500 && status === "ready" && shouldShowSlowWarning(text.length, device) && (
                <div className="mt-3 sm:mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Cpu className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800 mb-1">
                        Long text detected with WASM backend
                      </p>
                      <p className="text-yellow-700">
                        This will take approximately {estimateGenerationTime(text.length, device).estimatedTimeFormatted}. 
                        Consider breaking into smaller paragraphs for faster processing.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Currently Playing Text Display */}
              {chunks.length > 0 && currentChunkIndex >= 0 && currentChunkIndex < chunks.length && (
                <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-white rounded-lg border">
                  <div className="text-xs sm:text-sm font-medium text-gray-600 mb-2">Currently Reading:</div>
                  <div className="text-sm sm:text-lg text-gray-800 leading-relaxed">
                    {chunks[currentChunkIndex].text}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <TextStatistics text={text} />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 pb-3 sm:pb-4 min-h-12 sm:min-h-14 items-center justify-center">
                {voices ? (
                  <>
                    <VoiceSelector
                      voices={voices}
                      selectedVoice={selectedVoice}
                      onVoiceChange={setSelectedVoice}
                    />
                    <div className="flex items-center gap-4 w-full sm:w-44">
                      <SpeedControl speed={speed} onSpeedChange={setSpeed} />
                    </div>
                  </>
                ) : error ? (
                  <div className="text-red-400 font-semibold text-base sm:text-lg/6 text-center p-2">
                    {error}
                  </div>
                ) : (
                  <div className="animate-pulse text-center text-sm sm:text-base">
                    Loading model...
                  </div>
                )}
              </div>

              <Separator />

              {/* Media Player Controls */}
              <div className="py-4 sm:py-6">
                <div className="flex items-center justify-center gap-0.5 sm:gap-2 mb-4 px-2">
                  {/* Section Navigation */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handlePreviousSection}
                    disabled={
                      fileType === "epub" ? (
                        !epubMetadata || 
                        !selectedChapter || 
                        epubMetadata.chapters.findIndex(ch => ch.id === selectedChapter) === 0
                      ) : fileType === "pdf" ? (
                        !pdfMetadata || 
                        !selectedPage || 
                        selectedPage === 1
                      ) : true
                    }
                    className="h-8 w-8 sm:h-12 sm:w-12 touch-manipulation"
                  >
                    <ChevronLeft className="size-3 sm:size-6" />
                  </Button>

                  {/* Chunk Navigation */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handlePreviousChunk}
                    disabled={currentChunkIndex <= 0 || chunks.length === 0}
                    className="h-8 w-8 sm:h-12 sm:w-12 touch-manipulation"
                  >
                    <SkipBack className="size-3 sm:size-5" />
                  </Button>

                  {/* Play/Pause */}
                  <Button
                    size="lg"
                    onClick={handlePlayPause}
                    className={cn(
                      "h-12 w-12 sm:h-16 sm:w-16 rounded-full text-lg transition-all touch-manipulation",
                      isPlaying && "bg-orange-600 hover:bg-orange-700",
                    )}
                    disabled={
                      (status === "ready" && !isPlaying && !text) ||
                      (status !== "ready" && chunks.length === 0)
                    }
                  >
                    {isPlaying ? (
                      <Pause className="size-5 sm:size-8" />
                    ) : (
                      <Play className="size-5 sm:size-8 ml-0.5 sm:ml-1" />
                    )}
                  </Button>

                  {/* Chunk Navigation */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleNextChunk}
                    disabled={currentChunkIndex >= chunks.length - 1 || chunks.length === 0}
                    className="h-8 w-8 sm:h-12 sm:w-12 touch-manipulation"
                  >
                    <SkipForward className="size-3 sm:size-5" />
                  </Button>

                  {/* Section Navigation */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleNextSection}
                    disabled={
                      fileType === "epub" ? (
                        !epubMetadata || 
                        !selectedChapter || 
                        epubMetadata.chapters.findIndex(ch => ch.id === selectedChapter) === epubMetadata.chapters.length - 1
                      ) : fileType === "pdf" ? (
                        !pdfMetadata || 
                        !selectedPage || 
                        selectedPage === pdfMetadata.totalPages
                      ) : true
                    }
                    className="h-8 w-8 sm:h-12 sm:w-12 touch-manipulation"
                  >
                    <ChevronRight className="size-3 sm:size-6" />
                  </Button>
                </div>

                {/* Secondary Controls */}
                {/* <div className="flex items-center justify-center gap-2 sm:gap-4">
                  <Button
                    variant="outline"
                    size="sm"
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
                    className="touch-manipulation h-8 sm:h-9"
                  >
                    <Download className="mr-1 sm:mr-2 size-3 sm:size-4" />
                    <span className="text-xs sm:text-sm">Download</span>
                  </Button>
                </div> */}
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
                          // Check if we should auto-advance to next section
                          if (fileType === "epub" && epubMetadata && selectedChapter) {
                            const currentChapterIndex = epubMetadata.chapters.findIndex(ch => ch.id === selectedChapter);
                            const nextChapterIndex = currentChapterIndex + 1;
                            
                            if (nextChapterIndex < epubMetadata.chapters.length) {
                              // Auto-load next chapter
                              const nextChapter = epubMetadata.chapters[nextChapterIndex];
                              handleChapterSelect(nextChapter.id, true);
                              return; // Keep playing
                            }
                          } else if (fileType === "pdf" && pdfMetadata && selectedPage) {
                            const nextPageNumber = selectedPage + 1;
                            
                            if (nextPageNumber <= pdfMetadata.totalPages) {
                              // Auto-load next page
                              handlePageSelect(nextPageNumber, true);
                              return; // Keep playing
                            }
                          }
                          
                          // No next section or not using file, stop playing
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
      <Toaster
        toastOptions={{
          style: {
            fontSize: 16,
          },
        }}
      />
      <InstallPrompt />
    </>
  );
}
