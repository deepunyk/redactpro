/**
 * AutoRedactPanel - Panel for auto-redaction functionality
 *
 * Checking a pattern checkbox immediately detects and applies redaction regions.
 * Unchecking removes that pattern's regions.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { PatternSelector } from './PatternSelector';
import { findPatternMatchesWithPositions, matchesToRedactionRegions } from '../lib/patterns/patternMatcher';
import type { PageContent, RedactionRegion } from '../lib/types';

interface CompactAutoRedactPanelProps {
  pages: PageContent[];
  onRedactionRegionsChange: (regions: RedactionRegion[]) => void;
  disabled?: boolean;
}

export const CompactAutoRedactPanel: React.FC<CompactAutoRedactPanelProps> = ({
  pages,
  onRedactionRegionsChange,
  disabled = false,
}) => {
  const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(new Set());
  const [matchCounts, setMatchCounts] = useState<Map<string, number>>(new Map());

  // When patterns or pages change, immediately detect and apply
  useEffect(() => {
    if (pages.length === 0) return;

    const patternIds = Array.from(selectedPatterns);

    if (patternIds.length === 0) {
      setMatchCounts(new Map());
      onRedactionRegionsChange([]);
      return;
    }

    const detectedMatches = findPatternMatchesWithPositions(pages, patternIds);

    const counts = new Map<string, number>();
    detectedMatches.forEach(match => {
      counts.set(match.patternId, (counts.get(match.patternId) || 0) + 1);
    });
    setMatchCounts(counts);

    // Immediately send regions to parent
    const regions = matchesToRedactionRegions(detectedMatches);
    onRedactionRegionsChange(regions);
  }, [selectedPatterns, pages]);

  const handlePatternToggle = useCallback((patternId: string) => {
    setSelectedPatterns(prev => {
      const next = new Set(prev);
      if (next.has(patternId)) {
        next.delete(patternId);
      } else {
        next.add(patternId);
      }
      return next;
    });
  }, []);

  const handleClear = useCallback(() => {
    setSelectedPatterns(new Set());
    setMatchCounts(new Map());
  }, []);

  const totalCount = Array.from(matchCounts.values()).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-xs font-semibold text-gray-900 dark:text-white">Auto-Redact</span>
          {totalCount > 0 && (
            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
              {totalCount} found
            </span>
          )}
        </div>
        {selectedPatterns.size > 0 && (
          <button
            onClick={handleClear}
            disabled={disabled}
            className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </div>

      {/* Pattern Selector — checking a box immediately applies */}
      <PatternSelector
        selectedPatterns={selectedPatterns}
        onPatternToggle={handlePatternToggle}
        matchCounts={matchCounts}
        disabled={disabled}
        compact
      />
    </div>
  );
};
