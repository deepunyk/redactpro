/**
 * Region Text Extractor
 * Extracts text from PDF pages that falls within a drawn rectangular region.
 */

import type { PageContent, TextItem } from './types';
import { findMatches } from './keywordMatcher';

/**
 * Extract the text contained within a rectangular region of a PDF page.
 *
 * Groups text items into visual lines by Y-proximity, concatenates
 * left-to-right within each line, and joins lines with spaces.
 * Returns a cleaned, trimmed string or empty if nothing meaningful found.
 */
export function extractTextInRegion(
  pages: PageContent[],
  pageNumber: number,
  regionX: number,
  regionY: number,
  regionWidth: number,
  regionHeight: number,
): string {
  const page = pages.find(p => p.pageNumber === pageNumber);
  if (!page) return '';

  const regionRight = regionX + regionWidth;
  const regionTop = regionY + regionHeight; // PDF coords: Y up, so y+height is top

  // Collect items that substantially overlap the region (>= 40% of item width)
  const includedItems: TextItem[] = [];

  for (const item of page.items) {
    if (!item.text.trim()) continue;

    const itemRight = item.x + item.width;
    const itemTop = item.y + item.height;

    // Compute horizontal and vertical overlap
    const overlapX = Math.max(0, Math.min(itemRight, regionRight) - Math.max(item.x, regionX));
    const overlapY = Math.max(0, Math.min(itemTop, regionTop) - Math.max(item.y, regionY));

    if (item.width > 0 && overlapX >= item.width * 0.4 && overlapY > 0) {
      includedItems.push(item);
    }
  }

  if (includedItems.length === 0) return '';

  // Group items into visual lines by Y proximity
  const lines = groupIntoLines(includedItems);

  // Concatenate each line's text left-to-right, then join lines with space
  const lineTexts = lines.map(line => {
    const sorted = [...line].sort((a, b) => a.x - b.x);
    return sorted.map(item => item.text.trim()).join(' ');
  });

  const result = lineTexts.join(' ').replace(/\s+/g, ' ').trim();
  return result.length >= 2 ? result : '';
}

/**
 * Group text items into visual lines based on Y-coordinate proximity.
 * Items with similar Y values (within tolerance) are on the same line.
 * Lines are returned sorted top-to-bottom (highest Y first in PDF coords).
 */
function groupIntoLines(items: TextItem[]): TextItem[][] {
  if (items.length === 0) return [];

  // Sort by Y descending (top of page first in PDF coords)
  const sorted = [...items].sort((a, b) => b.y - a.y);

  const lines: TextItem[][] = [];
  let currentLine: TextItem[] = [sorted[0]];
  let currentY = sorted[0].y;
  const avgHeight = sorted.reduce((sum, item) => sum + item.height, 0) / sorted.length;
  const tolerance = avgHeight * 0.5;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentY) <= tolerance) {
      currentLine.push(item);
    } else {
      lines.push(currentLine);
      currentLine = [item];
      currentY = item.y;
    }
  }
  lines.push(currentLine);

  return lines;
}

/**
 * Count how many times the given text appears across all pages.
 * Uses the existing findMatches utility for consistency.
 */
export function countTextOccurrences(
  pages: PageContent[],
  searchText: string,
): number {
  if (!searchText || searchText.length < 2) return 0;
  const matches = findMatches(pages, [searchText]);
  return matches.length;
}
