import { BookOpen, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { EpubChapter } from "../utils/epub-parser";
import type { PdfPage } from "../utils/pdf-parser";

interface NavigationSelectorProps {
  type: "epub" | "pdf";
  items: EpubChapter[] | PdfPage[];
  selectedItem: string | number | null;
  onItemSelect: (itemId: string | number) => void;
  isLoading: boolean;
}

export function NavigationSelector({
  type,
  items,
  selectedItem,
  onItemSelect,
  isLoading,
}: NavigationSelectorProps) {
  if (items.length === 0) {
    return null;
  }

  const getIcon = () => {
    return type === "epub" ? (
      <BookOpen className="h-5 w-5 text-blue-500" />
    ) : (
      <FileText className="h-5 w-5 text-red-500" />
    );
  };

  const getPlaceholder = () => {
    if (type === "epub") {
      return window.innerWidth < 640 ? "Select chapter..." : "Select a chapter to load...";
    } else {
      return window.innerWidth < 640 ? "Select page..." : "Select a page to load...";
    }
  };

  const renderSelectItems = () => {
    if (type === "epub") {
      const chapters = items as EpubChapter[];
      let topLevelCount = 1;
      
      return chapters.map((chapter) => {
        // Create indentation based on nesting level
        const indent = "  ".repeat(chapter.level);
        let prefix = "•";
        
        if (chapter.level === 0) {
          prefix = `${topLevelCount}.`;
          topLevelCount++;
        }
        
        return (
          <SelectItem key={chapter.id} value={chapter.id}>
            <span style={{ fontFamily: 'monospace' }}>
              {indent}{prefix} {chapter.label}
            </span>
          </SelectItem>
        );
      });
    } else {
      const pages = items as PdfPage[];
      return pages.map((page) => (
        <SelectItem key={page.pageNumber} value={page.pageNumber.toString()}>
          Page {page.pageNumber}
        </SelectItem>
      ));
    }
  };

  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="hidden sm:block">
        {getIcon()}
      </div>
      <Select
        value={selectedItem?.toString() || ""}
        onValueChange={(value) => {
          if (type === "epub") {
            onItemSelect(value);
          } else {
            onItemSelect(parseInt(value));
          }
        }}
        disabled={isLoading}
      >
        <SelectTrigger className="w-full h-10 sm:h-9 text-sm sm:text-base touch-manipulation">
          <div className="flex items-center gap-2 w-full min-w-0">
            <div className="sm:hidden flex-shrink-0">
              {getIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <SelectValue placeholder={getPlaceholder()} />
            </div>
          </div>
        </SelectTrigger>
        <SelectContent className="max-h-60 sm:max-h-80">
          {renderSelectItems()}
        </SelectContent>
      </Select>
      {isLoading && (
        <span className="text-xs sm:text-sm text-gray-500">Loading...</span>
      )}
    </div>
  );
}