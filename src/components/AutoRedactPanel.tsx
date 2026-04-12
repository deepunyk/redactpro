/**
 * AutoRedactPanel - Main panel for auto-redaction functionality
 */

import React, { useState, useCallback, useEffect } from 'react';
import { PatternSelector } from './PatternSelector';
import { MatchNavigator } from './MatchNavigator';
import { patternRegistry } from '../lib/patterns';
import { findPatternMatchesWithPositions, matchesToRedactionRegions } from '../lib/patterns/patternMatcher';
import type { PatternMatch } from '../lib/patterns/types';
import type { PageContent, RedactionRegion } from '../lib/types';

interface AutoRedactPanelProps {
  pages: PageContent[];
  onRedactionRegionsChange: (regions: RedactionRegion[]) => void;
  onPageChange: (pageNumber: number) => void;
  currentPage: number;
  disabled?: boolean;
  isProcessing?: boolean;
}

export const AutoRedactPanel: React.FC<AutoRedactPanelProps> = ({
  pages,
  onRedactionRegionsChange,
  onPageChange,
  currentPage,
  disabled = false,
  isProcessing = false,
}) => {
  const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(new Set());
  const [matches, setMatches] = useState<PatternMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [matchCounts, setMatchCounts] = useState<Map<string, number>>(new Map());

  // Update match counts when patterns or pages change
  useEffect(() => {
    if (pages.length === 0) return;

    const updateMatches = () => {
      const patternIds = Array.from(selectedPatterns);

      if (patternIds.length === 0) {
        setMatches([]);
        setMatchCounts(new Map());
        return;
      }

      const detectedMatches = findPatternMatchesWithPositions(pages, patternIds);
      setMatches(detectedMatches);

      // Calculate match counts
      const counts = new Map<string, number>();
      detectedMatches.forEach(match => {
        counts.set(match.patternId, (counts.get(match.patternId) || 0) + 1);
      });
      setMatchCounts(counts);

      // Reset current index if out of bounds
      setCurrentMatchIndex(prev => Math.min(prev, Math.max(0, detectedMatches.length - 1)));
    };

    updateMatches();
  }, [selectedPatterns, pages]);

  // Handle pattern toggle
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

  // Handle detect button click
  const handleDetect = useCallback(() => {
    if (selectedPatterns.size === 0) return;

    const patternIds = Array.from(selectedPatterns);
    const detectedMatches = findPatternMatchesWithPositions(pages, patternIds);

    if (detectedMatches.length === 0) return;

    // Convert matches to redaction regions
    const regions = matchesToRedactionRegions(detectedMatches);
    onRedactionRegionsChange(regions);

    // Navigate to first match
    setCurrentMatchIndex(0);
    if (detectedMatches[0]) {
      onPageChange(detectedMatches[0].pageNumber);
    }
  }, [selectedPatterns, pages, onRedactionRegionsChange, onPageChange]);

  // Handle clear all matches
  const handleClear = useCallback(() => {
    setSelectedPatterns(new Set());
    setMatches([]);
    setMatchCounts(new Map());
    setCurrentMatchIndex(0);
  }, []);

  // Handle navigate to match
  const handleNavigate = useCallback((index: number) => {
    setCurrentMatchIndex(index);
  }, []);

  const hasMatches = matches.length > 0;
  const totalSelectedCount = selectedPatterns.size;

  return (
    <div className="space-y-3">
      {/* Pattern Selector */}
      <PatternSelector
        selectedPatterns={selectedPatterns}
        onPatternToggle={handlePatternToggle}
        matchCounts={matchCounts}
        disabled={disabled || isProcessing}
      />

      {/* Action Buttons */}
      {totalSelectedCount > 0 && (
        <div className="flex items-center gap-2 px-2">
          <button
            onClick={handleDetect}
            disabled={disabled || isProcessing || selectedPatterns.size === 0}
            className="flex-1 px-3 py-2 bg-blue-600 dark:bg-blue-700 text-white text-xs font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                Detecting...
              </span>
            ) : (
              'Detect & Redact'
            )}
          </button>

          <button
            onClick={handleClear}
            disabled={disabled || isProcessing}
            className="px-3 py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Match Navigator */}
      {hasMatches && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
          <MatchNavigator
            matches={matches}
            currentIndex={currentMatchIndex}
            onNavigate={handleNavigate}
            onPageChange={onPageChange}
            disabled={disabled || isProcessing}
          />
        </div>
      )}

      {/* Empty State Hint */}
      {!hasMatches && totalSelectedCount > 0 && !isProcessing && (
        <div className="text-center py-3 px-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Click "Detect & Redact" to find matches
          </p>
        </div>
      )}
    </div>
  );
};

interface CompactAutoRedactPanelProps {
  pages: PageContent[];
  onRedactionRegionsChange: (regions: RedactionRegion[]) => void;
  onPageChange: (pageNumber: number) => void;
  disabled?: boolean;
}

export const CompactAutoRedactPanel: React.FC<CompactAutoRedactPanelProps> = ({
  pages,
  onRedactionRegionsChange,
  onPageChange,
  disabled = false,
}) => {
  const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(new Set());
  const [matches, setMatches] = useState<PatternMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [matchCounts, setMatchCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (pages.length === 0) return;

    const patternIds = Array.from(selectedPatterns);
    if (patternIds.length === 0) {
      setMatches([]);
      setMatchCounts(new Map());
      return;
    }

    const detectedMatches = findPatternMatchesWithPositions(pages, patternIds);
    setMatches(detectedMatches);

    const counts = new Map<string, number>();
    detectedMatches.forEach(match => {
      counts.set(match.patternId, (counts.get(match.patternId) || 0) + 1);
    });
    setMatchCounts(counts);
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

  const handleDetect = useCallback(() => {
    if (selectedPatterns.size === 0) return;

    const patternIds = Array.from(selectedPatterns);
    const detectedMatches = findPatternMatchesWithPositions(pages, patternIds);

    if (detectedMatches.length === 0) return;

    const regions = matchesToRedactionRegions(detectedMatches);
    onRedactionRegionsChange(regions);

    setCurrentMatchIndex(0);
    if (detectedMatches[0]) {
      onPageChange(detectedMatches[0].pageNumber);
    }
  }, [selectedPatterns, pages, onRedactionRegionsChange, onPageChange]);

  const hasMatches = matches.length > 0;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-xs font-semibold text-gray-900 dark:text-white">Auto-Redact</span>
          {matchCounts.size > 0 && (
            <span className="text-[10px] text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
              {Array.from(matchCounts.values()).reduce((a, b) => a + b, 0)} found
            </span>
          )}
        </div>
        {selectedPatterns.size > 0 && (
          <button
            onClick={() => setSelectedPatterns(new Set())}
            disabled={disabled}
            className="text-[10px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </div>

      {/* Pattern Selector */}
      <PatternSelector
        selectedPatterns={selectedPatterns}
        onPatternToggle={handlePatternToggle}
        matchCounts={matchCounts}
        disabled={disabled}
        compact
      />

      {/* Detect Button */}
      {selectedPatterns.size > 0 && (
        <button
          onClick={handleDetect}
          disabled={disabled}
          className="w-full px-3 py-2 bg-blue-600 dark:bg-blue-700 text-white text-xs font-medium rounded-md hover:bg-blue-700 dark:hover:bg-blue-800 disabled:opacity-50 transition-colors"
        >
          Detect & Redact ({selectedPatterns.size} pattern{selectedPatterns.size !== 1 ? 's' : ''})
        </button>
      )}

      {/* Match Navigator */}
      {hasMatches && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
          <MatchNavigator
            matches={matches}
            currentIndex={currentMatchIndex}
            onNavigate={setCurrentMatchIndex}
            onPageChange={onPageChange}
            disabled={disabled}
            compact
          />
        </div>
      )}
    </div>
  );
};
