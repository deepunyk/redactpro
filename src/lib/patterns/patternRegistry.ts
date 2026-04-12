/**
 * Pattern Registry - Central pattern management and detection
 */

import type { Pattern, PatternMatch, PatternGroup, PatternCategory } from './types';
import type { PageContent } from '../types';

export class PatternRegistry {
  private patterns: Map<string, Pattern> = new Map();
  private groups: Map<string, PatternGroup> = new Map();

  constructor() {
    this.initializeDefaultGroups();
  }

  private initializeDefaultGroups() {
    // India-specific group
    this.registerGroup({
      id: 'india-personal',
      name: 'India - Personal IDs',
      description: 'PAN, Aadhaar, Passport, Voter ID',
      patterns: ['pan', 'aadhaar', 'passport-india', 'voter-id'],
      category: 'india',
    });

    // India financial group
    this.registerGroup({
      id: 'india-financial',
      name: 'India - Financial',
      description: 'GSTIN, IFSC, UPI ID',
      patterns: ['gstin', 'ifsc', 'upi-id'],
      category: 'india',
    });

    // Global contact group
    this.registerGroup({
      id: 'global-contact',
      name: 'Global - Contact',
      description: 'Email, Phone numbers',
      patterns: ['email', 'phone-india', 'phone-intl'],
      category: 'global',
    });

    // Financial group
    this.registerGroup({
      id: 'global-financial',
      name: 'Global - Financial',
      description: 'Credit cards, Bank accounts, SSN',
      patterns: ['credit-card', 'bank-account', 'ssn'],
      category: 'global',
    });
  }

  /**
   * Register a new pattern
   */
  register(pattern: Pattern): void {
    this.patterns.set(pattern.id, pattern);
  }

  /**
   * Register a pattern group
   */
  registerGroup(group: PatternGroup): void {
    this.groups.set(group.id, group);
  }

  /**
   * Unregister a pattern
   */
  unregister(id: string): void {
    this.patterns.delete(id);
  }

  /**
   * Get a pattern by ID
   */
  getPattern(id: string): Pattern | undefined {
    return this.patterns.get(id);
  }

  /**
   * Get all patterns
   */
  getAllPatterns(): Pattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get enabled patterns
   */
  getEnabledPatterns(): Pattern[] {
    return Array.from(this.patterns.values()).filter(p => p.enabled);
  }

  /**
   * Get patterns by category
   */
  getPatternsByCategory(category: PatternCategory): Pattern[] {
    return Array.from(this.patterns.values()).filter(p => p.category === category);
  }

  /**
   * Get all groups
   */
  getAllGroups(): PatternGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Toggle pattern enabled state
   */
  togglePattern(id: string): void {
    const pattern = this.patterns.get(id);
    if (pattern) {
      pattern.enabled = !pattern.enabled;
    }
  }

  /**
   * Enable/disable all patterns in a group
   */
  toggleGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) return;

    const groupPatterns = group.patterns.map(id => this.patterns.get(id)).filter(Boolean) as Pattern[];
    const allEnabled = groupPatterns.every(p => p.enabled);

    groupPatterns.forEach(pattern => {
      pattern.enabled = !allEnabled;
    });
  }

  /**
   * Set pattern enabled state
   */
  setPatternEnabled(id: string, enabled: boolean): void {
    const pattern = this.patterns.get(id);
    if (pattern) {
      pattern.enabled = enabled;
    }
  }

  /**
   * Detect all patterns in the given pages
   */
  detectAll(pages: PageContent[]): Map<string, number> {
    const matchCounts = new Map<string, number>();

    this.getEnabledPatterns().forEach(pattern => {
      let count = 0;
      pages.forEach(page => {
        page.items.forEach(item => {
          const matches = this.detectInText(item.text, pattern);
          count += matches.length;
        });
      });
      matchCounts.set(pattern.id, count);
    });

    return matchCounts;
  }

  /**
   * Detect pattern matches in text
   */
  private detectInText(text: string, pattern: Pattern): RegExpMatchArray[] {
    const regexes = Array.isArray(pattern.regex) ? pattern.regex : [pattern.regex];
    const allMatches: RegExpMatchArray[] = [];

    regexes.forEach(regex => {
      const matches = text.matchAll(new RegExp(regex, 'gi'));
      for (const match of matches) {
        if (match[0]) {
          // Validate match if validator exists
          if (pattern.validator) {
            try {
              if (pattern.validator(match[0])) {
                allMatches.push(match);
              }
            } catch {
              // If validator fails, skip this match
            }
          } else {
            allMatches.push(match);
          }
        }
      }
    });

    return allMatches;
  }

  /**
   * Get detailed matches for specific patterns
   */
  getDetailedMatches(
    pages: PageContent[],
    patternIds: string[]
  ): Array<{ pattern: Pattern; matches: Array<{ text: string; pageNumber: number; x: number; y: number; width: number; height: number }> }> {
    const results: Array<{ pattern: Pattern; matches: Array<{ text: string; pageNumber: number; x: number; y: number; width: number; height: number }> }> = [];

    patternIds.forEach(id => {
      const pattern = this.patterns.get(id);
      if (!pattern || !pattern.enabled) return;

      const matches: Array<{ text: string; pageNumber: number; x: number; y: number; width: number; height: number }> = [];

      pages.forEach(page => {
        page.items.forEach(item => {
          const regexMatches = this.detectInText(item.text, pattern);
          regexMatches.forEach(match => {
            matches.push({
              text: match[0],
              pageNumber: page.pageNumber,
              x: item.x,
              y: item.y,
              width: item.width,
              height: item.height,
            });
          });
        });
      });

      if (matches.length > 0) {
        results.push({ pattern, matches });
      }
    });

    return results;
  }
}

// Global singleton instance
export const patternRegistry = new PatternRegistry();
