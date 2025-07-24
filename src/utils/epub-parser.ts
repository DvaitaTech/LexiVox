import ePub from "epubjs";

export interface EpubChapter {
  id: string;
  label: string;
  href: string;
  level: number; // Nesting level (0 = top level, 1 = sub-chapter, etc.)
  parent?: string; // Parent chapter ID if nested
}

export interface EpubMetadata {
  title: string;
  creator: string;
  chapters: EpubChapter[];
}

export class EpubParser {
  private book: any = null;

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

    const section = this.book.spine.get(href);
    if (!section) {
      throw new Error(`Chapter not found: ${href}`);
    }

    const doc = await section.load(this.book.load.bind(this.book));
    
    // Extract text content from the DOM, removing HTML tags
    const textContent = doc.body?.textContent || doc.textContent || "";
    
    // Clean up whitespace and return
    return textContent
      .replace(/\s+/g, " ")
      .trim();
  }

  destroy() {
    if (this.book) {
      this.book.destroy();
      this.book = null;
    }
  }
}