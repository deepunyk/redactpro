/**
 * Core TypeScript types for PDF redaction application
 */

/**
 * A single text item extracted from a PDF page with its position coordinates
 */
export interface TextItem {
  /** The actual text content */
  text: string;
  /** X coordinate in PDF page coordinates */
  x: number;
  /** Y coordinate in PDF page coordinates */
  y: number;
  /** Width of the text item */
  width: number;
  /** Height of the text item */
  height: number;
}

/**
 * Extracted content from a single PDF page
 */
export interface PageContent {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Array of text items with their coordinates */
  items: TextItem[];
  /** Page height in PDF coordinates (for coordinate conversion) */
  pageHeight?: number;
  /** Page width in PDF coordinates (for coordinate conversion) */
  pageWidth?: number;
}

/**
 * A region that should be redacted
 */
export interface RedactionRegion {
  /** Unique identifier for this region (stable across position changes) */
  id: string;
  /** Page number where this region exists (1-indexed) */
  pageNumber: number;
  /** X coordinate of the redaction region */
  x: number;
  /** Y coordinate of the redaction region */
  y: number;
  /** Width of the redaction region */
  width: number;
  /** Height of the redaction region */
  height: number;
  /** The text that was matched (for preview) */
  matchedText: string;
  /** The keyword that triggered this redaction */
  keyword: string;
}

/**
 * State of PDF processing
 */
export type ProcessingState = 'idle' | 'loading' | 'processing' | 'complete' | 'error';

/**
 * Result of PDF redaction
 */
export interface RedactionResult {
  /** The redacted PDF bytes */
  pdfBytes: Uint8Array;
  /** Number of regions redacted */
  regionsRedacted: number;
  /** Number of pages processed */
  pagesProcessed: number;
}
