/**
 * Keyword matching logic for PDF redaction
 * Finds occurrences of keywords in extracted PDF text
 */

import type { PageContent, RedactionRegion } from './types';
import { measureSubstring, padRegion } from './textMeasurement';

/**
 * Configuration for keyword matching
 */
export interface MatcherConfig {
  /** Whether to match case-sensitively */
  caseSensitive?: boolean;
  /** Whether to match whole words only */
  wholeWordOnly?: boolean;
}

/**
 * Default matcher configuration
 */
const DEFAULT_CONFIG: MatcherConfig = {
  caseSensitive: false,
  wholeWordOnly: true, // Match whole words by default to avoid partial matches
};

/**
 * Check if a keyword contains characters that make word boundary matching unreliable
 * (e.g., keywords with digits adjacent to letters, or special characters)
 */
function needsWordBoundaryFallback(keyword: string): boolean {
  // Keywords starting/ending with non-word characters won't work well with \b
  return /^[^\w]|[^\w]$/.test(keyword);
}

/**
 * Find all occurrences of keywords in extracted PDF text.
 * Creates one redaction region per occurrence, covering only the matched text
 * (not the entire PDF.js text item).
 */
export function findMatches(
  pages: PageContent[],
  keywords: string[],
  config: MatcherConfig = DEFAULT_CONFIG
): RedactionRegion[] {
  if (keywords.length === 0) {
    return [];
  }

  const { caseSensitive, wholeWordOnly } = { ...DEFAULT_CONFIG, ...config };
  const matches: RedactionRegion[] = [];

  // Filter out empty/whitespace-only keywords
  const validKeywords = keywords.filter(kw => kw.trim().length > 0);

  // Pre-process keywords based on case sensitivity
  const processedKeywords = validKeywords.map(kw => ({
    original: kw,
    processed: caseSensitive ? kw : kw.toLowerCase(),
  }));

  for (const page of pages) {
    for (const item of page.items) {
      if (!item.text || item.text.trim().length === 0) continue;

      const textToCheck = caseSensitive ? item.text : item.text.toLowerCase();

      for (const { original, processed } of processedKeywords) {
        // Find all match positions within this text item
        const matchPositions = wholeWordOnly
          ? findWholeWordMatches(item.text, processed, !!caseSensitive)
          : findSubstringMatches(textToCheck, processed);

        for (const { index, length } of matchPositions) {
          // Use canvas-based measurement for proportional fonts
          const pos = measureSubstring(item.text, index, length, item.width, item.height);
          const padded = padRegion(item.x + pos.offsetX, item.y, pos.width, item.height);

          matches.push({
            id: crypto.randomUUID(),
            pageNumber: page.pageNumber,
            x: padded.x,
            y: padded.y,
            width: padded.width,
            height: padded.height,
            matchedText: item.text.substring(index, index + length),
            keyword: original,
          });
        }
      }
    }
  }

  return matches;
}

/**
 * Find all whole-word matches using regex with word boundaries.
 * Handles edge cases where \b doesn't work well with special characters.
 * Returns match positions (index + length) within the text.
 */
function findWholeWordMatches(
  text: string,
  keyword: string,
  caseSensitive: boolean
): Array<{ index: number; length: number }> {
  const results: Array<{ index: number; length: number }> = [];

  // For keywords with leading/trailing non-word characters, \b doesn't work properly.
  // Use whitespace/punctuation boundary check instead.
  if (needsWordBoundaryFallback(keyword)) {
    return findSubstringMatches(
      caseSensitive ? text : text.toLowerCase(),
      keyword
    ).filter(({ index, length }) => {
      // Check character before match
      if (index > 0) {
        const charBefore = text[index - 1];
        if (/\w/.test(charBefore)) return false;
      }
      // Check character after match
      const endIndex = index + length;
      if (endIndex < text.length) {
        const charAfter = text[endIndex];
        if (/\w/.test(charAfter)) return false;
      }
      return true;
    });
  }

  const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, caseSensitive ? 'g' : 'gi');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    results.push({ index: match.index, length: match[0].length });
  }

  return results;
}

/**
 * Find all substring matches.
 * Returns match positions (index + length) within the text.
 */
function findSubstringMatches(
  textToCheck: string,
  keyword: string
): Array<{ index: number; length: number }> {
  const results: Array<{ index: number; length: number }> = [];
  let searchFrom = 0;

  while (searchFrom < textToCheck.length) {
    const foundAt = textToCheck.indexOf(keyword, searchFrom);
    if (foundAt === -1) break;
    results.push({ index: foundAt, length: keyword.length });
    searchFrom = foundAt + 1;
  }

  return results;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Count matches per keyword
 */
export function countMatchesByKeyword(regions: RedactionRegion[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const region of regions) {
    counts[region.keyword] = (counts[region.keyword] || 0) + 1;
  }
  return counts;
}
