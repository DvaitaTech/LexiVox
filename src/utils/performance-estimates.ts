// Performance estimation utilities for different backends

export type DeviceType = 'webgpu' | 'wasm';

export interface PerformanceEstimate {
  device: DeviceType;
  chunksPerSecond: number;
  averageChunkTime: number;
  modelLoadTime: number;
  description: string;
  optimizationTips: string[];
}

export const PERFORMANCE_PROFILES: Record<DeviceType, PerformanceEstimate> = {
  webgpu: {
    device: 'webgpu',
    chunksPerSecond: 0.8, // ~1.25 seconds per chunk
    averageChunkTime: 1250,
    modelLoadTime: 15000, // 15 seconds initial load
    description: 'WebGPU acceleration enabled - optimal performance',
    optimizationTips: [
      'You have the best possible performance',
      'Large texts will process quickly',
      'Background playback is smooth'
    ]
  },
  wasm: {
    device: 'wasm',
    chunksPerSecond: 0.25, // ~4 seconds per chunk
    averageChunkTime: 4000,
    modelLoadTime: 25000, // 25 seconds initial load
    description: 'WASM fallback - slower but still functional',
    optimizationTips: [
      'Processing is 3-4x slower than WebGPU',
      'Break long texts into smaller paragraphs',
      'Be patient during initial model loading',
      'Consider using a WebGPU-compatible browser'
    ]
  }
};

export function getPerformanceEstimate(device: DeviceType): PerformanceEstimate {
  return PERFORMANCE_PROFILES[device];
}

export function estimateGenerationTime(textLength: number, device: DeviceType): {
  estimatedChunks: number;
  estimatedTimeMs: number;
  estimatedTimeFormatted: string;
} {
  // Rough estimate: ~50-100 characters per chunk
  const estimatedChunks = Math.ceil(textLength / 75);
  const profile = getPerformanceEstimate(device);
  const estimatedTimeMs = estimatedChunks * profile.averageChunkTime;
  
  const estimatedTimeFormatted = formatDuration(estimatedTimeMs);
  
  return {
    estimatedChunks,
    estimatedTimeMs,
    estimatedTimeFormatted
  };
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return 'Less than 1 second';
  }
  
  const seconds = Math.ceil(ms / 1000);
  
  if (seconds < 60) {
    return `~${seconds} second${seconds === 1 ? '' : 's'}`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (remainingSeconds === 0) {
    return `~${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  
  return `~${minutes}m ${remainingSeconds}s`;
}

export function getDeviceCapabilityWarning(device: DeviceType): {
  level: 'info' | 'warning';
  message: string;
  details: string;
} {
  if (device === 'webgpu') {
    return {
      level: 'info',
      message: 'WebGPU Acceleration Active',
      details: 'Your browser supports WebGPU for optimal TTS performance.'
    };
  }
  
  return {
    level: 'warning',
    message: 'Using WASM Fallback',
    details: 'Audio generation will be slower. Consider using Chrome, Edge, or Firefox for WebGPU support.'
  };
}

export function shouldShowSlowWarning(textLength: number, device: DeviceType): boolean {
  if (device === 'webgpu') return false;
  
  const estimate = estimateGenerationTime(textLength, device);
  return estimate.estimatedTimeMs > 10000; // Show warning if > 10 seconds
}