import ePub from "epubjs";

export interface EpubChapter {
  id: string;
  label: string;
  href: string;
  level: number; // Nesting level (0 = top level, 1 = sub-chapter, etc.)
  parent?: string; // Parent chapter ID if nested
}

export interface EpubChapterSegment {
  chapterId: string;
  segmentIndex: number;
  text: string;
  totalSegments: number;
}

export interface EpubMetadata {
  title: string;
  creator: string;
  chapters: EpubChapter[];
}

export class EpubParser {
  private book: any = null;
  private chapterCache: Map<string, string> = new Map();
  private readonly SEGMENT_SIZE = 2000; // Characters per segment
  private readonly MAX_CACHE_SIZE = 5; // Maximum chapters to keep in cache

  async loadFromFile(file: File): Promise<EpubMetadata> {
    const arrayBuffer = await file.arrayBuffer();
    this.book = ePub(arrayBuffer);
    
    await this.book.ready;
    
    const metadata = await this.book.loaded.metadata;
    const navigation = await this.book.loaded.navigation;
    
    // Recursively extract all chapters including nested ones
    const chapters: EpubChapter[] = this.extractChaptersRecursively(navigation.toc, 0);

    return {
      title: metadata.title || "Unknown Title",
      creator: metadata.creator || "Unknown Author",
      chapters,
    };
  }

  private extractChaptersRecursively(tocItems: any[], level: number, parentId?: string): EpubChapter[] {
    const chapters: EpubChapter[] = [];
    
    for (const item of tocItems) {
      const chapterId = item.id || item.href;
      
      // Add current chapter
      chapters.push({
        id: chapterId,
        label: item.label,
        href: item.href,
        level,
        parent: parentId,
      });
      
      // Recursively add sub-chapters if they exist
      if (item.subitems && item.subitems.length > 0) {
        const subChapters = this.extractChaptersRecursively(item.subitems, level + 1, chapterId);
        chapters.push(...subChapters);
      }
    }
    
    return chapters;
  }

  async getChapterText(href: string): Promise<string> {
    if (!this.book) {
      throw new Error("No epub loaded");
    }

    // Check cache first
    if (this.chapterCache.has(href)) {
      return this.chapterCache.get(href)!;
    }

    const section = this.book.spine.get(href);
    if (!section) {
      throw new Error(`Chapter not found: ${href}`);
    }

    const doc = await section.load(this.book.load.bind(this.book));
    
    // Extract text content from the DOM, removing HTML tags
    const textContent = doc.body?.textContent || doc.textContent || "";
    
    // Clean up whitespace and cache
    const cleanText = textContent
      .replace(/\s+/g, " ")
      .trim();
    
    // Implement LRU cache cleanup
    if (this.chapterCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.chapterCache.keys().next().value;
      if (firstKey) {
        this.chapterCache.delete(firstKey);
      }
    }
    
    this.chapterCache.set(href, cleanText);
    return cleanText;
  }

  async getChapterSegment(href: string, segmentIndex: number): Promise<EpubChapterSegment> {
    const fullText = await this.getChapterText(href);
    const totalSegments = Math.ceil(fullText.length / this.SEGMENT_SIZE);
    
    if (segmentIndex < 0 || segmentIndex >= totalSegments) {
      throw new Error(`Segment ${segmentIndex} not found. Total segments: ${totalSegments}`);
    }

    const startIndex = segmentIndex * this.SEGMENT_SIZE;
    const endIndex = Math.min(startIndex + this.SEGMENT_SIZE, fullText.length);
    
    // Try to break at word boundaries
    let segmentText = fullText.substring(startIndex, endIndex);
    
    // If not the last segment and doesn't end with punctuation, try to break at word boundary
    if (segmentIndex < totalSegments - 1 && !/[.!?]\s*$/.test(segmentText)) {
      const lastSpaceIndex = segmentText.lastIndexOf(' ');
      if (lastSpaceIndex > segmentText.length * 0.8) { // Only if space is in last 20%
        segmentText = segmentText.substring(0, lastSpaceIndex);
      }
    }

    return {
      chapterId: href,
      segmentIndex,
      text: segmentText.trim(),
      totalSegments
    };
  }

  async getChapterSegmentCount(href: string): Promise<number> {
    const fullText = await this.getChapterText(href);
    return Math.ceil(fullText.length / this.SEGMENT_SIZE);
  }

  destroy() {
    if (this.book) {
      this.book.destroy();
      this.book = null;
    }
    this.chapterCache.clear();
  }
}