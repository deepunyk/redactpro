/**
 * Pattern detection types for auto-redaction
 */

export type PatternCategory = 'india' | 'global' | 'custom';

export interface Pattern {
  id: string;
  name: string;
  description: string;
  regex: RegExp | RegExp[];
  validator?: (match: string) => boolean;
  category: PatternCategory;
  enabled: boolean;
  icon?: string;
}

export interface PatternMatch {
  id: string;
  patternId: string;
  patternName: string;
  text: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  isValid: boolean;
}

export interface DetectionResult {
  patternId: string;
  patternName: string;
  matches: PatternMatch[];
  totalMatches: number;
}

export interface PatternGroup {
  id: string;
  name: string;
  description: string;
  patterns: string[];
  category: PatternCategory;
}

export interface MatchNavigationState {
  currentIndex: number;
  totalMatches: number;
  currentPattern: string | null;
}
