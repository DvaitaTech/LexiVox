import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Cpu, Zap } from "lucide-react";
import { getPerformanceEstimate, formatDuration, type DeviceType } from "@/utils/performance-estimates";

interface ModelLoadingIndicatorProps {
  isLoading: boolean;
  device?: DeviceType;
  progress?: number;
  stage?: 'downloading' | 'loading' | 'ready';
}

export function ModelLoadingIndicator({ 
  isLoading, 
  device, 
  progress = 0,
  stage = 'downloading'
}: ModelLoadingIndicatorProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setElapsedTime(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  const performanceInfo = device ? getPerformanceEstimate(device) : null;
  const estimatedTotal = performanceInfo?.modelLoadTime || 20000;
  const displayProgress = Math.min(95, Math.max(progress, (elapsedTime / estimatedTotal) * 100));

  const getStageText = () => {
    switch (stage) {
      case 'downloading':
        return 'Downloading TTS model...';
      case 'loading':
        return 'Initializing model...';
      case 'ready':
        return 'Almost ready...';
      default:
        return 'Loading...';
    }
  };

  const getDeviceIcon = () => {
    if (!device) return <Loader2 className="h-4 w-4 animate-spin" />;
    return device === 'webgpu' ? (
      <Zap className="h-4 w-4 text-green-600" />
    ) : (
      <Cpu className="h-4 w-4 text-orange-600" />
    );
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getDeviceIcon()}
              <span className="font-medium text-sm">
                {device === 'webgpu' ? 'WebGPU' : device === 'wasm' ? 'WASM' : 'Loading'}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {Math.round(displayProgress)}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={displayProgress} className="h-2" />
            <p className="text-sm text-gray-600 text-center">
              {getStageText()}
            </p>
          </div>

          {/* Performance Info */}
          {device && (
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Estimated time:</span>
                <span>{formatDuration(estimatedTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Elapsed:</span>
                <span>{formatDuration(elapsedTime)}</span>
              </div>
            </div>
          )}

          {/* Device Performance Warning */}
          {device === 'wasm' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Cpu className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  <p className="font-medium text-orange-800 mb-1">
                    WASM Fallback Mode
                  </p>
                  <p className="text-orange-700">
                    Audio generation will be 3-4x slower than WebGPU. 
                    Consider using Chrome or Firefox for better performance.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Expandable Details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors w-full text-center"
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>

          {showDetails && (
            <div className="text-xs text-gray-500 space-y-1 pt-2 border-t">
              <div>Model: Kokoro TTS (82M parameters)</div>
              <div>Size: ~82MB download</div>
              <div>Backend: {device === 'webgpu' ? 'WebGPU acceleration' : 'WASM fallback'}</div>
              {performanceInfo && (
                <div>Expected speed: {performanceInfo.chunksPerSecond.toFixed(1)} chunks/sec</div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}