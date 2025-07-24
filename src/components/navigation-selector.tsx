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
    return type === "epub" ? "Select a chapter to load..." : "Select a page to load...";
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
      {getIcon()}
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
        <SelectTrigger className="w-full">
          <SelectValue placeholder={getPlaceholder()} />
        </SelectTrigger>
        <SelectContent>
          {renderSelectItems()}
        </SelectContent>
      </Select>
      {isLoading && (
        <span className="text-sm text-gray-500">Loading...</span>
      )}
    </div>
  );
}