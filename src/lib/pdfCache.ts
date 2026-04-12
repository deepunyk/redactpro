/**
 * PDF Document Cache
 * Caches parsed PDF documents to avoid redundant parsing
 */

import * as pdfjsLib from 'pdfjs-dist';

interface CachedPDF {
  document: pdfjsLib.PDFDocumentProxy;
  timestamp: number;
  file: File;
}

class PDFCache {
  private cache: Map<string, CachedPDF> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 3; // Maximum number of cached PDFs

  /**
   * Generate a cache key for a file
   */
  private generateKey(file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }

  /**
   * Get a PDF document from cache or parse it if not cached
   */
  async getDocument(file: File): Promise<pdfjsLib.PDFDocumentProxy> {
    const key = this.generateKey(file);
    const cached = this.cache.get(key);

    // Check if cache is valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('Using cached PDF document');
      return cached.document;
    }

    // Parse the PDF
    console.log('Parsing PDF document...');
    const arrayBuffer = await file.arrayBuffer();
    const document = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Clean up old cache entries if needed
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.cleanup();
    }

    // Cache the document
    this.cache.set(key, {
      document,
      timestamp: Date.now(),
      file,
    });

    return document;
  }

  /**
   * Get page count without caching the full document
   */
  async getPageCount(file: File): Promise<number> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries from cache
   */
  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());

    // Remove expired entries
    entries.forEach(([key, value]) => {
      if (now - value.timestamp >= this.CACHE_TTL) {
        this.cache.delete(key);
      }
    });

    // If still too many, remove the oldest entry
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = entries.sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clear cache for a specific file
   */
  invalidate(file: File): void {
    const key = this.generateKey(file);
    this.cache.delete(key);
  }
}

// Export singleton instance
export const pdfCache = new PDFCache();
