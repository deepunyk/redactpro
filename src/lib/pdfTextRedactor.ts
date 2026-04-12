/**
 * PDF redaction with text-layer preservation
 *
 * Strategy:
 *   1. Render each page to canvas with black redaction boxes (visual layer)
 *   2. In the new PDF, draw non-redacted text items FIRST using pdf-lib drawText
 *   3. Then draw the canvas image ON TOP of the text
 *
 * Result:
 *   - Visual: looks identical to the image-based approach (redacted areas are black)
 *   - Text layer: non-redacted text is in the content stream behind the image,
 *     fully extractable by AI tools that read the content stream
 *   - Redacted text is NEVER added to the text layer → not extractable
 */

import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { RedactionRegion, PageContent, TextItem } from './types';
import { groupRegionsByPage } from './utils';

export interface TextRedactionOptions {
  /** Scale factor for rendering (higher = better quality, larger file) */
  scale?: number;
  /** Color for redaction boxes (default: black) */
  color?: { r: number; g: number; b: number };
  /** Whether to show progress updates */
  onProgress?: (current: number, total: number) => void;
  /** Abort signal for cancelling the operation */
  signal?: AbortSignal;
}

/**
 * Apply text-layer-preserving redaction to a PDF.
 *
 * Non-redacted text remains as a selectable/extractable text layer.
 * Redacted text is replaced with black rectangles in the image and
 * is NOT present in the text layer at all.
 */
export async function redactPDFWithTextLayer(
  pdfBytes: Uint8Array,
  regions: RedactionRegion[],
  pages: PageContent[],
  options: TextRedactionOptions = {}
): Promise<Uint8Array> {
  const { scale = 2.0, color = { r: 0, g: 0, b: 0 }, onProgress, signal } = options;

  if (signal?.aborted) {
    throw new DOMException('Redaction operation was cancelled', 'AbortError');
  }

  // Load original PDF with PDF.js for rendering
  const originalPdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const totalPages = originalPdf.numPages;

  // Create new PDF with pdf-lib
  const newPdfDoc = await PDFDocument.create();
  const font = await newPdfDoc.embedFont(StandardFonts.Helvetica);

  const regionsByPage = groupRegionsByPage(regions);

  for (let i = 1; i <= totalPages; i++) {
    if (signal?.aborted) {
      throw new DOMException('Redaction operation was cancelled', 'AbortError');
    }

    onProgress?.(i, totalPages);

    const page = await originalPdf.getPage(i);
    const viewport = page.getViewport({ scale });

    // --- Step 1: Render page to canvas with redaction boxes ---
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true })!;

    if (!context) {
      throw new Error('Could not get canvas context');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Render the original PDF page to canvas
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    // Draw redaction boxes over matched regions
    const pageRegions = regionsByPage[i] || [];
    for (const region of pageRegions) {
      drawRedactionBox(context, region, viewport, scale, color);
    }

    // Convert canvas to PNG
    const pngImageBytes = await canvasToBytes(canvas);
    const pngImage = await newPdfDoc.embedPng(pngImageBytes);

    // --- Step 2: Create new PDF page ---
    const pdfPage = newPdfDoc.addPage([viewport.width, viewport.height]);

    // --- Step 3: Draw non-redacted text FIRST (behind the image) ---
    const pageContent = pages[i - 1]; // pages array is 0-indexed
    if (pageContent && pageContent.items.length > 0) {
      const textItems = pageContent.items;

      for (const item of textItems) {
        // Skip if this text item falls within a redaction region
        if (isInRedactionRegion(item, pageRegions)) continue;

        // Skip empty items
        if (!item.text.trim()) continue;

        try {
          // Filter to only encodable characters (WinAnsi / Latin-1)
          const encodableText = filterToEncodable(item.text);
          if (!encodableText) continue;

          pdfPage.drawText(encodableText, {
            x: item.x * scale,
            y: item.y * scale,
            size: item.height * scale,
            font,
            color: rgb(0, 0, 0),
          });
        } catch {
          // Skip text items that can't be rendered (font encoding issues)
        }
      }
    }

    // --- Step 4: Draw image ON TOP (covers text visually) ---
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
 * Check if a text item overlaps with any redaction region.
 * Uses axis-aligned bounding box overlap test.
 */
function isInRedactionRegion(item: TextItem, regions: RedactionRegion[]): boolean {
  for (const region of regions) {
    const overlapX = item.x < region.x + region.width && item.x + item.width > region.x;
    const overlapY = item.y < region.y + region.height && item.y + item.height > region.y;
    if (overlapX && overlapY) return true;
  }
  return false;
}

/**
 * Filter text to only include characters encodable in WinAnsi (Latin-1).
 * Standard fonts like Helvetica only support this character set.
 */
function filterToEncodable(text: string): string {
  let result = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    // ASCII printable (32-126) + Latin-1 supplement (160-255)
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) {
      result += ch;
    } else if (ch === '\t' || ch === '\n' || ch === '\r') {
      result += ' '; // Replace whitespace with spaces
    }
    // Skip other characters (non-Latin scripts, emojis, etc.)
  }
  return result;
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
  const canvasX = region.x * scale;
  const canvasWidth = region.width * scale;
  const canvasHeight = region.height * scale;

  // Flip Y: PDF origin bottom-left → Canvas origin top-left
  const baselineY = viewport.height - (region.y * scale);
  const canvasY = baselineY - canvasHeight;

  const padding = 2;
  context.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
  context.fillRect(
    canvasX - padding,
    canvasY - padding,
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
