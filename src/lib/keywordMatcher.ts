/**
 * Keyword matching logic for PDF redaction
 * Finds occurrences of keywords in extracted PDF text
 */

import type { PageContent, RedactionRegion } from './types';

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
 * Find all occurrences of keywords in extracted PDF text
 * @param pages - Array of page contents with text items
 * @param keywords - Array of keywords to search for
 * @param config - Optional matcher configuration
 * @returns Array of redaction regions where keywords were found
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

  // Pre-process keywords based on case sensitivity
  const processedKeywords = keywords.map(kw =>
    caseSensitive ? kw : kw.toLowerCase()
  );

  for (const page of pages) {
    for (const item of page.items) {
      const textToCheck = caseSensitive ? item.text : item.text.toLowerCase();

      for (const keyword of processedKeywords) {
        let isMatch = false;

        if (wholeWordOnly) {
          // Match whole words only using word boundaries
          const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, caseSensitive ? '' : 'i');
          isMatch = wordBoundaryRegex.test(item.text);
        } else {
          // Match anywhere in the text
          isMatch = textToCheck.includes(keyword);
        }

        if (isMatch) {
          matches.push({
            pageNumber: page.pageNumber,
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            matchedText: item.text,
            keyword: keyword,
          });
        }
      }
    }
  }

  return matches;
}

/**
 * Escape special regex characters in a string
 * @param str - String to escape
 * @returns Escaped string safe for use in regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Count matches per keyword
 * @param regions - Array of redaction regions
 * @returns Object mapping keywords to their match counts
 */
export function countMatchesByKeyword(regions: RedactionRegion[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const region of regions) {
    const keyword = region.keyword;
    counts[keyword] = (counts[keyword] || 0) + 1;
  }

  return counts;
}

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
