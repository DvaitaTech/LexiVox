import { BookOpen } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { EpubChapter } from "../utils/epub-parser";

interface ChapterSelectorProps {
  chapters: EpubChapter[];
  selectedChapter: string | null;
  onChapterSelect: (chapterId: string) => void;
  isLoading: boolean;
}

export function ChapterSelector({
  chapters,
  selectedChapter,
  onChapterSelect,
  isLoading,
}: ChapterSelectorProps) {
  if (chapters.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 mb-4">
      <BookOpen className="h-5 w-5 text-blue-500" />
      <Select
        value={selectedChapter || ""}
        onValueChange={onChapterSelect}
        disabled={isLoading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a chapter to load..." />
        </SelectTrigger>
        <SelectContent>
          {chapters.map((chapter, index) => (
            <SelectItem key={chapter.id} value={chapter.id}>
              {index + 1}. {chapter.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isLoading && (
        <span className="text-sm text-gray-500">Loading chapter...</span>
      )}
    </div>
  );
}