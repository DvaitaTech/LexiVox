import { useRef } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  currentFile: string | null;
  onClear: () => void;
}

export function FileUploader({ onFileSelect, isLoading, currentFile, onClear }: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === "application/epub+zip" || file.type === "application/pdf")) {
      onFileSelect(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const getFileIcon = (fileName: string | null) => {
    if (!fileName) return <Upload className="mr-2 h-4 w-4" />;
    
    const extension = fileName.toLowerCase().split('.').pop();
    return <FileText className={`h-5 w-5 ${extension === 'pdf' ? 'text-red-500' : 'text-blue-500'}`} />;
  };

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".epub,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          
          {currentFile ? (
            <div className="flex items-center gap-2 flex-1">
              {getFileIcon(currentFile)}
              <span className="text-sm font-medium truncate">{currentFile}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClear}
                className="ml-auto"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleClick}
              disabled={isLoading}
              variant="outline"
              className="flex-1"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isLoading ? "Loading File..." : "Upload EPUB or PDF File"}
            </Button>
          )}
        </div>
        
        {!currentFile && (
          <p className="text-xs text-gray-500 mt-2">
            Select an EPUB or PDF file to load content for text-to-speech
          </p>
        )}
      </CardContent>
    </Card>
  );
}