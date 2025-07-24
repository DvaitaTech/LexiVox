# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kokoro Web is a browser-based text-to-speech application built with React + TypeScript + Vite. It uses the Kokoro TTS model (82M parameters) running entirely in the browser via Transformers.js, supporting both WebGPU and WASM backends for ML inference.

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
- **shadcn/ui + Radix UI** - Component library for consistent UI
- **Tailwind CSS v4** - Styling with new Vite plugin
- **Lucide React** - Icons

### Data Flow
1. User input in App.tsx triggers worker message with text, voice, and speed
2. worker.ts loads Kokoro model, processes text through TextSplitterStream
3. Audio chunks streamed back to main thread via postMessage
4. AudioChunk components handle playback with individual audio controls

### File Structure
- `src/components/ui/` - shadcn/ui components (button, card, select, etc.)
- `src/components/` - App-specific components (voice-selector, audio-chunk, etc.)
- `src/lib/utils.ts` - Utility functions (cn for className merging)
- `src/utils.ts` - WebGPU detection utilities

## Configuration
- **Vite config** - Uses Tailwind v4 plugin, React plugin, path aliases (@/ -> src/)
- **TypeScript** - Configured with path mapping for @/* imports
- **Worker format** - ES modules (`worker: { format: "es" }`)
- **Build target** - ESNext for latest JS features