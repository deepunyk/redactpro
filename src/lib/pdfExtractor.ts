/**
 * PDF text extraction using PDF.js
 * Extracts text content with coordinates from PDF files
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { TextItem, PageContent } from './types';
import { pdfCache } from './pdfCache';

// Set up PDF.js worker with Vite's ?url import to get the correct path
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Custom error class for PDF processing errors
 */
export class PDFProcessingError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'PDFProcessingError';
  }
}

/**
 * Extract text content with coordinates from a PDF file
 * @param file - The PDF file to extract text from
 * @returns Promise resolving to an array of page contents with text items and coordinates
 * @throws PDFProcessingError if PDF parsing fails
 */
export async function extractTextContent(file: File): Promise<PageContent[]> {
  try {
    // Validate file type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new PDFProcessingError(
        'Invalid file type. Please upload a PDF file.',
        'INVALID_FILE_TYPE'
      );
    }

    // Validate file size (prevent crashes on extremely large files)
    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
    if (file.size > MAX_FILE_SIZE) {
      throw new PDFProcessingError(
        'File is too large. Maximum size is 500MB.',
        'FILE_TOO_LARGE'
      );
    }

    const arrayBuffer = await file.arrayBuffer();

    // Validate that we got data
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new PDFProcessingError(
        'Failed to read file. The file may be corrupted.',
        'EMPTY_FILE'
      );
    }

    let pdf: pdfjsLib.PDFDocumentProxy;
    try {
      // Use the cache to get the PDF document
      pdf = await pdfCache.getDocument(file);
    } catch (error) {
      throw new PDFProcessingError(
        'Failed to parse PDF file. The file may be corrupted or password-protected.',
        'PARSE_ERROR',
        error
      );
    }

    const pages: PageContent[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1 }); // Get viewport at scale 1 for base dimensions

        console.log(`Page ${i} viewport at scale=1: ${viewport.width.toFixed(1)} x ${viewport.height.toFixed(1)}`);

        // Transform text items to our format
        const items: TextItem[] = textContent.items.map((item: any) => {
          // PDF.js uses a transformation matrix [a, b, c, d, e, f]
          // transform[0] = horizontal scaling (font size)
          // transform[4] = x translation (horizontal position)
          // transform[5] = y translation (vertical position, from bottom)
          const transform = item.transform || [0, 0, 0, 0, 0, 0];
          const x = transform[4] || 0;
          const y = transform[5] || 0;
          const width = item.width || 0;
          // Get font size from the transform matrix (scale factor)
          const fontSize = Math.abs(transform[0]) || 12;

          // Text height: use font size as baseline-to-top distance
          const height = fontSize;

          return {
            text: item.str || '',
            x,
            y,
            width: width || 0,
            height: height || 12,
          };
        });

        pages.push({
          pageNumber: i,
          items: items.filter(item => item.text.trim().length > 0),
          pageHeight: viewport.height,
          pageWidth: viewport.width,
        });
      } catch (error) {
        throw new PDFProcessingError(
          `Failed to extract text from page ${i}. The page may be corrupted.`,
          'PAGE_ERROR',
          error
        );
      }
    }

    return pages;
  } catch (error) {
    // Re-throw PDFProcessingError as-is
    if (error instanceof PDFProcessingError) {
      throw error;
    }
    // Wrap other errors
    throw new PDFProcessingError(
      'An unexpected error occurred while processing the PDF.',
      'UNKNOWN_ERROR',
      error
    );
  }
}

/**
 * Get total page count of a PDF file
 * @param file - The PDF file
 * @returns Promise resolving to the number of pages
 */
export async function getPageCount(file: File): Promise<number> {
  return pdfCache.getPageCount(file);
}

/**
 * Render a PDF page to canvas for preview
 * @param file - The PDF file
 * @param pageNumber - The page number to render (1-indexed)
 * @param scale - The scale factor for rendering (default: 1.5)
 * @returns Promise resolving to a canvas element with the rendered page
 */
export async function renderPageToCanvas(
  file: File,
  pageNumber: number,
  scale: number = 1.5
): Promise<HTMLCanvasElement> {
  const pdf = await pdfCache.getDocument(file);
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

  return canvas;
}
