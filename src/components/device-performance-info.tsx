import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Zap, 
  Cpu, 
  Info, 
  AlertTriangle, 
  CheckCircle, 
  X,
  ExternalLink 
} from "lucide-react";
import { 
  getPerformanceEstimate, 
  getDeviceCapabilityWarning,
  type DeviceType 
} from "@/utils/performance-estimates";
import { useState } from "react";

interface DevicePerformanceInfoProps {
  device: DeviceType;
  onDismiss?: () => void;
  showOptimizationTips?: boolean;
}

export function DevicePerformanceInfo({ 
  device, 
  onDismiss,
  showOptimizationTips = true 
}: DevicePerformanceInfoProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const performance = getPerformanceEstimate(device);
  const warning = getDeviceCapabilityWarning(device);

  const isOptimal = device === 'webgpu';

  return (
    <Card className={`w-full ${isOptimal ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isOptimal ? 'bg-green-100' : 'bg-orange-100'}`}>
                {isOptimal ? (
                  <Zap className="h-4 w-4 text-green-600" />
                ) : (
                  <Cpu className="h-4 w-4 text-orange-600" />
                )}
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">
                    {warning.message}
                  </h3>
                  <Badge variant={isOptimal ? "default" : "secondary"} className="text-xs">
                    {device.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {performance.description}
                </p>
              </div>
            </div>

            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white rounded p-2">
              <div className="text-gray-500">Generation Speed</div>
              <div className="font-medium">
                {performance.chunksPerSecond.toFixed(1)} chunks/sec
              </div>
            </div>
            <div className="bg-white rounded p-2">
              <div className="text-gray-500">Avg. Chunk Time</div>
              <div className="font-medium">
                {(performance.averageChunkTime / 1000).toFixed(1)}s
              </div>
            </div>
          </div>

          {/* Optimization Tips */}
          {showOptimizationTips && (
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-auto p-2 justify-start text-xs"
              >
                <Info className="h-3 w-3 mr-2" />
                {isExpanded ? 'Hide' : 'Show'} optimization tips
              </Button>

              {isExpanded && (
                <div className="space-y-2 pl-2 border-l-2 border-gray-200">
                  {performance.optimizationTips.map((tip, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs">
                      <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{tip}</span>
                    </div>
                  ))}
                  
                  {!isOptimal && (
                    <div className="mt-3 p-2 bg-white rounded border">
                      <div className="flex items-center gap-2 mb-2">
                        <ExternalLink className="h-3 w-3 text-blue-500" />
                        <span className="font-medium text-xs">Upgrade Browser Support</span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">
                        For optimal performance, use a WebGPU-compatible browser:
                      </p>
                      <ul className="text-xs text-gray-600 space-y-1">
                        <li>• Chrome 113+ (recommended)</li>
                        <li>• Firefox 110+ (with webgpu.enabled = true)</li>
                        <li>• Edge 113+</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Warning Message */}
          {!isOptimal && (
            <div className={`flex items-start gap-2 p-2 rounded ${warning.level === 'warning' ? 'bg-orange-100 border border-orange-200' : 'bg-blue-100 border border-blue-200'}`}>
              <AlertTriangle className={`h-3 w-3 mt-0.5 flex-shrink-0 ${warning.level === 'warning' ? 'text-orange-600' : 'text-blue-600'}`} />
              <p className={`text-xs ${warning.level === 'warning' ? 'text-orange-800' : 'text-blue-800'}`}>
                {warning.details}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}