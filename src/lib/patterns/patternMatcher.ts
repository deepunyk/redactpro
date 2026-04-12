/**
 * Pattern Matcher - Detects and creates redaction regions from patterns
 */

import { patternRegistry } from './patternRegistry';
import type { PageContent, RedactionRegion } from '../types';
import type { PatternMatch, Pattern } from './types';

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
            keyword: match.patternId,
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
    const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');

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

  return matches;
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
    const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');

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

      // Calculate match position within the text item
      const matchIndex = match.index;
      const matchLength = matchedText.length;

      // Estimate position based on character position
      const charWidth = itemWidth / text.length;
      const matchX = itemX + (matchIndex * charWidth);
      const matchWidth = matchLength * charWidth;

      matches.push({
        id: crypto.randomUUID(),
        patternId: pattern.id,
        patternName: pattern.name,
        text: matchedText,
        pageNumber,
        x: matchX,
        y: itemY,
        width: matchWidth,
        height: itemHeight,
        confidence: isValid ? 1.0 : 0.5,
        isValid,
      });
    }
  });

  return matches;
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
