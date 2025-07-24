import { Progress } from "@/components/ui/progress";
import { Loader2, Zap, Cpu, Clock } from "lucide-react";
import { estimateGenerationTime, formatDuration, type DeviceType } from "@/utils/performance-estimates";
import { useEffect, useState } from "react";

interface GenerationProgressProps {
  isGenerating: boolean;
  currentChunk: number;
  totalChunks: number;
  device?: DeviceType;
  textLength?: number;
}

export function GenerationProgress({ 
  isGenerating, 
  currentChunk, 
  totalChunks, 
  device,
  textLength = 0
}: GenerationProgressProps) {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (isGenerating && !startTime) {
      setStartTime(Date.now());
    } else if (!isGenerating) {
      setStartTime(null);
      setElapsedTime(0);
    }
  }, [isGenerating, startTime]);

  useEffect(() => {
    if (!isGenerating || !startTime) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [isGenerating, startTime]);

  if (!isGenerating) return null;

  const progress = totalChunks > 0 ? (currentChunk / totalChunks) * 100 : 0;
  const estimate = device && textLength > 0 ? estimateGenerationTime(textLength, device) : null;
  
  // Calculate remaining time based on current progress
  const getRemainingTime = () => {
    if (!device || elapsedTime < 1000 || currentChunk === 0) return null;
    
    const avgTimePerChunk = elapsedTime / currentChunk;
    const remainingChunks = Math.max(0, totalChunks - currentChunk);
    const remainingMs = remainingChunks * avgTimePerChunk;
    
    return formatDuration(remainingMs);
  };

  const remainingTime = getRemainingTime();

  return (
    <div className="w-full space-y-3 p-4 bg-gray-50 rounded-lg border">
      {/* Header with device info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span className="font-medium text-sm">Generating Audio</span>
          {device && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              {device === 'webgpu' ? (
                <Zap className="h-3 w-3 text-green-600" />
              ) : (
                <Cpu className="h-3 w-3 text-orange-600" />
              )}
              <span>{device.toUpperCase()}</span>
            </div>
          )}
        </div>
        
        <span className="text-xs text-gray-500">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        
        <div className="flex justify-between text-xs text-gray-600">
          <span>
            {currentChunk} of {totalChunks > 0 ? totalChunks : '~' + (estimate?.estimatedChunks || '?')} chunks
          </span>
          {remainingTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {remainingTime} remaining
            </span>
          )}
        </div>
      </div>

      {/* Performance Warning for WASM */}
      {device === 'wasm' && currentChunk === 1 && (
        <div className="flex items-start gap-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
          <Cpu className="h-3 w-3 text-orange-600 mt-0.5 flex-shrink-0" />
          <div className="text-orange-700">
            <span className="font-medium">WASM mode: </span>
            Audio generation is slower but still processing. Please be patient.
          </div>
        </div>
      )}

      {/* Time estimates */}
      {estimate && currentChunk === 0 && (
        <div className="text-xs text-gray-500 flex justify-between">
          <span>Estimated time:</span>
          <span>{estimate.estimatedTimeFormatted}</span>
        </div>
      )}
    </div>
  );
}