# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LexiVox is a browser-based text-to-speech Progressive Web Application (PWA) built with React 19 + TypeScript + Vite. It uses the Kokoro TTS model (82M parameters) running entirely in the browser via Transformers.js, supporting both WebGPU and WASM backends for ML inference. The app transforms EPUB books and PDF documents into natural speech with chapter/page navigation, background playback, and offline capabilities.

## Development Commands

- `npm run dev` - Start development server (Vite)
- `npm run build` - Build for production (TypeScript compilation + Vite build)
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Architecture

### Core Components
- **App.tsx** - Main application component managing TTS state, worker communication, and UI
- **worker.ts** - Web Worker handling Kokoro TTS model loading and audio generation
- **components/** - Reusable UI components built on shadcn/ui and Radix UI

### Key Dependencies
- **kokoro-js** - Main TTS library providing KokoroTTS class and TextSplitterStream for final text chunking
- **shadcn/ui + Radix UI** - Component library for consistent UI (30+ components)
- **Tailwind CSS v4** - Styling with new Vite plugin
- **Lucide React** - Icons
- **epubjs** - EPUB document parsing and navigation
- **pdfjs-dist** - PDF document parsing and text extraction
- **vite-plugin-pwa** - Progressive Web App capabilities with Workbox caching

### Data Flow & Text Processing Pipeline
1. **Document Loading**: User uploads EPUB/PDF files via FileUploader component or enters text directly
2. **Document Parsing**: Document parsers extract metadata and structure (no bulk text loading)
3. **Segmentation**: Large documents split into 2000-character segments for memory efficiency
4. **TTS Generation**: App.tsx sends segment text/voice/speed to Web Worker via postMessage
5. **Text Chunking**: worker.ts processes text through TextSplitterStream (~75 chars per chunk)
6. **Audio Generation**: Kokoro model generates audio chunks with sliding window buffering (5 chunks ahead)
7. **Playback**: AudioChunk components handle individual audio playback with controls
8. **Navigation**: Auto-advancement to next segments/chapters when current segment completes

### File Structure
- `src/components/ui/` - shadcn/ui components (30+ reusable UI primitives)
- `src/components/` - App-specific components (audio-chunk, file-uploader, voice-selector, etc.)
- `src/utils/` - Utility modules (epub-parser, pdf-parser, mobile-detection, create-icons)
- `src/hooks/` - Custom React hooks (media session, audio focus, swipe gestures, memory cleanup)
- `src/types/` - TypeScript type definitions
- `src/lib/utils.ts` - Core utilities (cn for className merging)
- `public/` - PWA icons, social media images, and static assets

## Configuration
- **Vite config** - Tailwind v4 plugin, React plugin, PWA plugin, path aliases (@/ -> src/)
- **TypeScript** - Multiple configs (app, node) with strict mode and path mapping
- **PWA** - Installable with comprehensive caching strategies (fonts, audio, documents)
- **Worker format** - ES modules (`worker: { format: "es" }`)
- **Build target** - ESNext for latest JS features
- **Module system** - Pure ES modules throughout (package.json "type": "module")

## Document Processing Architecture
- **EPUB Support** - Nested chapter structure via epubjs with 2000-character segmentation
- **PDF Support** - Page-by-page text extraction via pdfjs-dist
- **Memory Management** - Pagination system prevents loading entire chapters/pages into memory
- **Segment-based Loading** - Text loaded on-demand with LRU cache (5 chapters max)
- **File Size Limit** - 50MB maximum for uploaded documents
- **Unified Interface** - Both parsers provide consistent metadata and segment structures

## Web Worker Architecture & Chunking Strategy
- **TTS Processing** - Isolated in worker.ts to prevent main thread blocking
- **Backend Detection** - Automatic WebGPU/WASM fallback based on browser capabilities
- **Sliding Window Generation** - Buffered chunk generation (5 chunks ahead, request more when ≤2 remain)
- **Text Chunking Pipeline**: 
  - Segment text (2000 chars) → TextSplitterStream (~75 chars) → Audio chunks
  - Final chunking logic handled by kokoro-js TextSplitterStream (not in codebase)
- **Model Loading** - Kokoro TTS model loaded on-demand with idle timer (5min timeout)
- **Memory Management** - Automatic model unloading and chunk buffer cleanup

## Mobile Optimizations
- **Memory Management** - Sliding window audio chunk cleanup and model idle unloading
- **Touch UI** - 44px minimum touch targets with optimized mobile controls
- **Gesture Support** - Swipe left/right for chapter/page navigation
- **Performance** - Lazy loading of EPUB/PDF parsers, reduced motion support
- **Device Detection** - Mobile-specific features via mobile-detection utility

## Background Playback Features
- **Media Session API** - Lock screen controls with chapter/page metadata
- **Audio Focus** - Handles interruptions (calls, other apps) gracefully
- **Wake Lock** - Prevents screen sleep during playback
- **Background Audio** - Continues playing when app is backgrounded

## PWA Caching Strategy (vite.config.ts)
- **TTS Model Cache** - Kokoro model files cached for 30 days (1GB cache limit)
- **Audio Cache** - Generated audio blobs cached for 1 week (100 entries max)
- **Document Cache** - EPUB/PDF files cached for 30 days (10 entries max)
- **Web Fonts** - Google Fonts cached with StaleWhileRevalidate strategy
- **Runtime Caching** - Workbox handles model downloads from HuggingFace CDN

## Testing & Performance
- **No formal testing framework configured** - Consider adding Vitest or Jest for future development
- **Performance Monitoring** - Device-specific estimation utilities (performance-estimates.ts)
- **Backend Performance** - WebGPU ~3-4x faster than WASM (0.8 vs 0.25 chunks/sec)
- Manual testing via `npm run dev` and browser testing tools
- Mobile testing recommended on actual devices for gesture and background features

## Important Implementation Notes
- **Version Management** - Current version tracked in package.json (1.2.0) and displayed via VersionBadge component
- **Toast Positioning** - Notifications positioned at top-right via Sonner library
- **State Management** - No external state library; uses React useState/useEffect with Web Worker communication
- **Responsive Design** - Mobile-first approach with swipe gestures and optimized touch targets
- **Error Handling** - Comprehensive error boundaries in worker.ts with device-specific error messages