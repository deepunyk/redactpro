/**
 * Pattern Matcher - Detects and creates redaction regions from patterns
 */

import { patternRegistry } from './patternRegistry';
import type { PageContent, RedactionRegion } from '../types';
import type { PatternMatch, Pattern } from './types';
import { measureSubstring, padRegion } from '../textMeasurement';

/**
 * Find pattern matches in PDF pages and convert to redaction regions
 */
export function findPatternMatches(
  pages: PageContent[],
  patternIds: string[] | null = null
): RedactionRegion[] {
  const regions: RedactionRegion[] = [];

  // Get patterns to detect
  const patternsToDetect = patternIds
    ? patternIds.map(id => patternRegistry.getPattern(id)).filter(Boolean) as Pattern[]
    : patternRegistry.getEnabledPatterns();

  pages.forEach(page => {
    page.items.forEach(item => {
      patternsToDetect.forEach(pattern => {
        const matches = detectMatchesInItem(item.text, pattern, page.pageNumber);

        matches.forEach(match => {
          regions.push({
            id: crypto.randomUUID(),
            pageNumber: match.pageNumber,
            x: match.x,
            y: match.y,
            width: match.width,
            height: match.height,
            matchedText: match.text,
            keyword: pattern.id,
          });
        });
      });
    });
  });

  return regions;
}

/**
 * Detect all pattern matches in a single text item
 */
function detectMatchesInItem(
  text: string,
  pattern: Pattern,
  pageNumber: number
): Array<{ text: string; pageNumber: number; x: number; y: number; width: number; height: number }> {
  const matches: Array<{ text: string; pageNumber: number; x: number; y: number; width: number; height: number }> = [];

  const regexes = Array.isArray(pattern.regex) ? pattern.regex : [pattern.regex];

  regexes.forEach(regex => {
    // Ensure both 'g' and 'i' flags for global case-insensitive matching
    let flags = regex.flags;
    if (!flags.includes('g')) flags += 'g';
    if (!flags.includes('i')) flags += 'i';
    const globalRegex = new RegExp(regex.source, flags);

    let match;
    while ((match = globalRegex.exec(text)) !== null) {
      const matchedText = match[0];

      // Validate if validator exists
      if (pattern.validator) {
        try {
          if (!pattern.validator(matchedText)) {
            continue;
          }
        } catch {
          // If validation fails, skip this match
          continue;
        }
      }

      matches.push({
        text: matchedText,
        pageNumber,
        x: 0, // Will be set by caller based on text item position
        y: 0,
        width: 0,
        height: 0,
      });
    }
  });

  return matches;
}

/**
 * Check if two matches overlap on the same page
 */
function matchesOverlap(a: PatternMatch, b: PatternMatch): boolean {
  if (a.pageNumber !== b.pageNumber) return false;

  // Check if the horizontal ranges overlap
  const aLeft = a.x;
  const aRight = a.x + a.width;
  const bLeft = b.x;
  const bRight = b.x + b.width;

  // Check if vertical ranges overlap (same line)
  const aTop = a.y;
  const aBottom = a.y + a.height;
  const bTop = b.y;
  const bBottom = b.y + b.height;

  const horizontalOverlap = aLeft < bRight && aRight > bLeft;
  const verticalOverlap = aTop < bBottom && aBottom > bTop;

  return horizontalOverlap && verticalOverlap;
}

/**
 * Remove duplicate/overlapping matches, keeping the one with higher confidence
 * or the more specific (shorter) match
 */
function deduplicateMatches(matches: PatternMatch[]): PatternMatch[] {
  if (matches.length <= 1) return matches;

  // Sort by confidence (desc), then by matched text length (asc = more specific)
  const sorted = [...matches].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.text.length - b.text.length;
  });

  const kept: PatternMatch[] = [];

  for (const match of sorted) {
    const overlaps = kept.some(existing => matchesOverlap(match, existing));
    if (!overlaps) {
      kept.push(match);
    }
  }

  return kept;
}

/**
 * Find pattern matches with accurate position information
 */
export function findPatternMatchesWithPositions(
  pages: PageContent[],
  patternIds: string[] | null = null
): PatternMatch[] {
  const matches: PatternMatch[] = [];

  // Get patterns to detect
  const patternsToDetect = patternIds
    ? patternIds.map(id => patternRegistry.getPattern(id)).filter(Boolean) as Pattern[]
    : patternRegistry.getEnabledPatterns();

  pages.forEach(page => {
    page.items.forEach(item => {
      patternsToDetect.forEach(pattern => {
        const itemMatches = detectMatchesInItemWithPosition(
          item.text,
          pattern,
          page.pageNumber,
          item.x,
          item.y,
          item.width,
          item.height
        );

        matches.push(...itemMatches);
      });
    });
  });

  // Deduplicate overlapping matches
  return deduplicateMatches(matches);
}

/**
 * Detect matches with accurate position information
 */
function detectMatchesInItemWithPosition(
  text: string,
  pattern: Pattern,
  pageNumber: number,
  itemX: number,
  itemY: number,
  itemWidth: number,
  itemHeight: number
): PatternMatch[] {
  const matches: PatternMatch[] = [];

  const regexes = Array.isArray(pattern.regex) ? pattern.regex : [pattern.regex];

  regexes.forEach(regex => {
    // Ensure both 'g' and 'i' flags for global case-insensitive matching
    let flags = regex.flags;
    if (!flags.includes('g')) flags += 'g';
    if (!flags.includes('i')) flags += 'i';
    const globalRegex = new RegExp(regex.source, flags);

    let match;
    while ((match = globalRegex.exec(text)) !== null) {
      const matchedText = match[0];

      // Validate if validator exists
      let isValid = true;
      if (pattern.validator) {
        try {
          isValid = pattern.validator(matchedText);
        } catch {
          isValid = false;
        }
      }

      // Calculate match position within the text item using proportional font measurement
      const matchIndex = match.index;
      const matchLength = matchedText.length;

      const pos = measureSubstring(text, matchIndex, matchLength, itemWidth, itemHeight);
      const padded = padRegion(itemX + pos.offsetX, itemY, pos.width, itemHeight);

      matches.push({
        id: crypto.randomUUID(),
        patternId: pattern.id,
        patternName: pattern.name,
        text: matchedText,
        pageNumber,
        x: padded.x,
        y: padded.y,
        width: padded.width,
        height: padded.height,
        confidence: isValid ? 1.0 : 0.5,
        isValid,
      });
    }
  });

  // Deduplicate within the same text item (multiple regex patterns may overlap)
  return deduplicateMatches(matches);
}

/**
 * Get match counts for all enabled patterns
 */
export function getPatternMatchCounts(pages: PageContent[]): Map<string, number> {
  return patternRegistry.detectAll(pages);
}

/**
 * Convert pattern matches to redaction regions
 */
export function matchesToRedactionRegions(matches: PatternMatch[]): RedactionRegion[] {
  return matches.map(match => ({
    id: match.id,
    pageNumber: match.pageNumber,
    x: match.x,
    y: match.y,
    width: match.width,
    height: match.height,
    matchedText: match.text,
    keyword: match.patternId,
  }));
}
