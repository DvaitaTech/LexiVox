import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export interface PdfPage {
  pageNumber: number;
  text: string;
}

export interface PdfMetadata {
  title: string;
  creator: string;
  pages: PdfPage[];
  totalPages: number;
}

export class PdfParser {
  private pdfDocument: any = null;

  async loadFromFile(file: File): Promise<PdfMetadata> {
    const arrayBuffer = await file.arrayBuffer();
    
    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      cMapUrl: '/cmaps/',
      cMapPacked: true,
    });
    
    this.pdfDocument = await loadingTask.promise;
    
    // Extract metadata
    const metadata = await this.pdfDocument.getMetadata();
    const info = metadata.info || {};
    
    // Extract text from all pages
    const pages: PdfPage[] = [];
    for (let pageNum = 1; pageNum <= this.pdfDocument.numPages; pageNum++) {
      const page = await this.pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items into a single string
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      pages.push({
        pageNumber: pageNum,
        text: pageText,
      });
    }

    return {
      title: info.Title || file.name.replace('.pdf', ''),
      creator: info.Author || 'Unknown Author',
      pages,
      totalPages: this.pdfDocument.numPages,
    };
  }

  async getPageText(pageNumber: number): Promise<string> {
    if (!this.pdfDocument) {
      throw new Error("No PDF loaded");
    }

    if (pageNumber < 1 || pageNumber > this.pdfDocument.numPages) {
      throw new Error(`Page ${pageNumber} not found`);
    }

    const page = await this.pdfDocument.getPage(pageNumber);
    const textContent = await page.getTextContent();
    
    return textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  destroy() {
    if (this.pdfDocument) {
      this.pdfDocument.destroy();
      this.pdfDocument = null;
    }
  }
}