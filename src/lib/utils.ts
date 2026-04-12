/**
 * Shared utility functions for PDF redaction
 */

import type { RedactionRegion } from './types';

/**
 * Group redaction regions by page number
 * @param regions - Array of redaction regions
 * @returns Object mapping page numbers to their regions
 */
export function groupRegionsByPage(regions: RedactionRegion[]): Record<number, RedactionRegion[]> {
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

/**
 * Format file size for display
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Create a delay promise
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
