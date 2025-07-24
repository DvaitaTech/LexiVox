# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LexiVox (internally "Kokoro Web") is a Progressive Web Application (PWA) for browser-based text-to-speech built with React 19 + TypeScript + Vite. It uses the Kokoro TTS model (82M parameters) running entirely in the browser via Transformers.js, supporting both WebGPU and WASM backends for ML inference. The app supports document reading from EPUB and PDF files with chapter/page navigation.

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
- **kokoro-js** - Main TTS library providing KokoroTTS class and TextSplitterStream
- **@huggingface/transformers** - ML model execution (WebGPU/WASM backends)
- **shadcn/ui + Radix UI** - Component library for consistent UI (30+ components)
- **Tailwind CSS v4** - Styling with new Vite plugin
- **Lucide React** - Icons
- **epubjs** - EPUB document parsing and navigation
- **pdfjs-dist** - PDF document parsing and text extraction
- **vite-plugin-pwa** - Progressive Web App capabilities with Workbox caching

### Data Flow
1. User uploads EPUB/PDF files via FileUploader component or enters text directly
2. Document parsers (epub-parser.ts/pdf-parser.ts) extract text and structure
3. App.tsx manages TTS state and sends text/voice/speed to Web Worker
4. worker.ts loads Kokoro model, processes text through TextSplitterStream
5. Audio chunks streamed back to main thread via postMessage
6. AudioChunk components handle individual playback with audio controls

### File Structure
- `src/components/ui/` - shadcn/ui components (30+ reusable UI primitives)
- `src/components/` - App-specific components (audio-chunk, file-uploader, voice-selector, etc.)
- `src/utils/` - Utility modules (epub-parser, pdf-parser, create-icons)
- `src/hooks/` - Custom React hooks
- `src/types/` - TypeScript type definitions
- `src/lib/utils.ts` - Core utilities (cn for className merging)
- `public/` - PWA icons and static assets

## Configuration
- **Vite config** - Tailwind v4 plugin, React plugin, PWA plugin, path aliases (@/ -> src/)
- **TypeScript** - Multiple configs (app, node) with strict mode and path mapping
- **PWA** - Installable with comprehensive caching strategies (fonts, audio, documents)
- **Worker format** - ES modules (`worker: { format: "es" }`)
- **Build target** - ESNext for latest JS features
- **Module system** - Pure ES modules throughout (package.json "type": "module")

## Document Processing
- **EPUB Support** - Full chapter navigation with nested structure via epubjs
- **PDF Support** - Page-by-page text extraction via pdfjs-dist
- **File Size Limit** - 50MB maximum for uploaded documents
- **Unified Interface** - Both parsers provide consistent metadata structures

## Web Worker Architecture
- **TTS Processing** - Isolated in worker.ts to prevent main thread blocking
- **Backend Detection** - Automatic WebGPU/WASM fallback based on browser capabilities
- **Streaming Audio** - Real-time audio chunk generation and playback
- **Model Loading** - Kokoro TTS model loaded on-demand in worker context

## Testing
- **No formal testing framework configured** - Consider adding Vitest or Jest for future development
- Manual testing via `npm run dev` and browser testing tools