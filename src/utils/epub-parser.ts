import ePub from "epubjs";

export interface EpubChapter {
  id: string;
  label: string;
  href: string;
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
    
    const chapters: EpubChapter[] = navigation.toc.map((item: { id: string; href: string; label: string }) => ({
      id: item.id || item.href,
      label: item.label,
      href: item.href,
    }));

    return {
      title: metadata.title || "Unknown Title",
      creator: metadata.creator || "Unknown Author",
      chapters,
    };
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