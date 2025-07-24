import { useEffect, useRef } from 'react';
import type { AudioChunkData } from '@/components/audio-chunk';

interface UseAudioCleanupOptions {
  chunks: AudioChunkData[];
  currentChunkIndex: number;
  windowSize?: number; // Number of chunks to keep in memory around current
}

export function useAudioCleanup({ 
  chunks, 
  currentChunkIndex, 
  windowSize = 5 
}: UseAudioCleanupOptions) {
  const chunksRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    // Create URLs for chunks within the window
    const startIndex = Math.max(0, currentChunkIndex - windowSize);
    const endIndex = Math.min(chunks.length - 1, currentChunkIndex + windowSize);

    // Track which indices should have URLs
    const activeIndices = new Set<number>();
    for (let i = startIndex; i <= endIndex; i++) {
      activeIndices.add(i);
    }

    // Create new URLs for chunks that don't have them
    activeIndices.forEach(index => {
      if (!chunksRef.current.has(index) && chunks[index]) {
        const url = URL.createObjectURL(chunks[index].audio);
        chunksRef.current.set(index, url);
      }
    });

    // Revoke URLs for chunks outside the window
    chunksRef.current.forEach((url, index) => {
      if (!activeIndices.has(index)) {
        URL.revokeObjectURL(url);
        chunksRef.current.delete(index);
      }
    });

    // Cleanup function
    return () => {
      // When component unmounts, revoke all URLs
      chunksRef.current.forEach(url => URL.revokeObjectURL(url));
      chunksRef.current.clear();
    };
  }, [chunks, currentChunkIndex, windowSize]);

  // Return a function to get URL for a specific chunk
  const getChunkUrl = (index: number): string | undefined => {
    return chunksRef.current.get(index);
  };

  return { getChunkUrl };
}

// Hook for monitoring memory usage (optional, for debugging)
export function useMemoryMonitor() {
  useEffect(() => {
    if ('performance' in window && 'memory' in performance) {
      const logMemory = () => {
        const memory = (performance as any).memory;
        console.log('Memory usage:', {
          usedJSHeapSize: (memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
          totalJSHeapSize: (memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
          limit: (memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB'
        });
      };

      const interval = setInterval(logMemory, 5000);
      return () => clearInterval(interval);
    }
  }, []);
}