/**
 * PDF redaction using canvas rendering
 * Renders PDF pages to canvas, draws redaction boxes, and creates new PDF
 */

import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import type { RedactionRegion } from './types';

// Worker is already configured in pdfExtractor.ts, no need to set again

/**
 * Redaction options
 */
export interface RedactionOptions {
  /** Scale factor for rendering (higher = better quality, larger file) */
  scale?: number;
  /** Color for redaction boxes (default: black) */
  color?: { r: number; g: number; b: number };
  /** Whether to show progress updates */
  onProgress?: (current: number, total: number) => void;
}

/**
 * Apply image-based redaction to a PDF
 * @param pdfBytes - The original PDF file as bytes
 * @param regions - Array of regions to redact
 * @param options - Redaction options
 * @returns Promise resolving to the redacted PDF bytes
 */
export async function redactPDF(
  pdfBytes: Uint8Array,
  regions: RedactionRegion[],
  options: RedactionOptions = {}
): Promise<Uint8Array> {
  const { scale = 2.0, color = { r: 0, g: 0, b: 0 }, onProgress } = options;

  // Load the original PDF
  const originalPdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const totalPages = originalPdf.numPages;

  // Create a new PDF for the redacted version
  const newPdfDoc = await PDFDocument.create();

  // Group regions by page for efficient processing
  const regionsByPage = groupRegionsByPage(regions);

  // Process each page
  for (let i = 1; i <= totalPages; i++) {
    // Report progress
    onProgress?.(i, totalPages);

    const page = await originalPdf.getPage(i);
    const viewport = page.getViewport({ scale });

    // Create canvas and render the page
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true })!;

    if (!context) {
      throw new Error('Could not get canvas context');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Render the PDF page to canvas
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    // Draw redaction boxes over matched regions
    const pageRegions = regionsByPage[i] || [];
    for (const region of pageRegions) {
      drawRedactionBox(context, region, viewport, scale, color);
    }

    // Convert canvas to PNG and embed in new PDF
    const pngImageBytes = await canvasToBytes(canvas);
    const pngImage = await newPdfDoc.embedPng(pngImageBytes);

    // Add page to new PDF with image dimensions
    const pdfPage = newPdfDoc.addPage([viewport.width, viewport.height]);
    pdfPage.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    });
  }

  // Save and return the redacted PDF
  return await newPdfDoc.save();
}

/**
 * Draw a redaction box on the canvas context
 */
function drawRedactionBox(
  context: CanvasRenderingContext2D,
  region: RedactionRegion,
  viewport: pdfjsLib.PageViewport,
  scale: number,
  color: { r: number; g: number; b: number }
): void {
  // Convert PDF coordinates to canvas coordinates
  // PDF coordinates: origin at bottom-left, Y increases upward
  // Canvas coordinates: origin at top-left, Y increases downward
  const canvasX = region.x * scale;
  // Flip Y: canvasY from top = totalHeight - pdfY from bottom
  const canvasY = viewport.height - (region.y * scale);
  const canvasWidth = region.width * scale;
  const canvasHeight = region.height * scale;

  // Add a small padding to ensure full coverage
  const padding = 2;
  context.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
  // Draw from the top-left corner of the box (canvasY - canvasHeight)
  context.fillRect(
    canvasX - padding,
    canvasY - canvasHeight - padding,
    canvasWidth + (padding * 2),
    canvasHeight + (padding * 2)
  );
}

/**
 * Convert canvas to PNG bytes
 */
function canvasToBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to convert canvas to blob'));
        return;
      }
      const buffer = await blob.arrayBuffer();
      resolve(new Uint8Array(buffer));
    }, 'image/png');
  });
}

/**
 * Group redaction regions by page number
 */
function groupRegionsByPage(regions: RedactionRegion[]): Record<number, RedactionRegion[]> {
  const grouped: Record<number, RedactionRegion[]> = {};

  for (const region of regions) {
    const pageNum = region.pageNumber;
    if (!grouped[pageNum]) {
      grouped[pageNum] = [];
    }
    grouped[pageNum].push(region);
  }

  return grouped;
}
