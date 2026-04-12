/**
 * MatchNavigator - Navigate between detected pattern matches
 */

import React from 'react';
import type { PatternMatch } from '../lib/patterns/types';

interface MatchNavigatorProps {
  matches: PatternMatch[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  onPageChange?: (pageNumber: number) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const MatchNavigator: React.FC<MatchNavigatorProps> = ({
  matches,
  currentIndex,
  onNavigate,
  onPageChange,
  disabled = false,
  compact = false,
}) => {
  const currentMatch = matches[currentIndex];
  const hasMatches = matches.length > 0;

  const goToPrevious = () => {
    if (!hasMatches || disabled) return;
    const newIndex = currentIndex > 0 ? currentIndex - 1 : matches.length - 1;
    onNavigate(newIndex);
    if (onPageChange && matches[newIndex]) {
      onPageChange(matches[newIndex].pageNumber);
    }
  };

  const goToNext = () => {
    if (!hasMatches || disabled) return;
    const newIndex = currentIndex < matches.length - 1 ? currentIndex + 1 : 0;
    onNavigate(newIndex);
    if (onPageChange && matches[newIndex]) {
      onPageChange(matches[newIndex].pageNumber);
    }
  };

  if (!hasMatches) {
    return compact ? null : (
      <div className="text-center py-3 px-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">No matches found</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-2 py-1">
        <button
          onClick={goToPrevious}
          disabled={disabled}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous match"
        >
          <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="text-xs text-gray-600 dark:text-gray-400 min-w-[60px] text-center">
          {currentIndex + 1} / {matches.length}
        </span>

        <button
          onClick={goToNext}
          disabled={disabled}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Next match"
        >
          <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Navigation Controls */}
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Navigate Matches
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={goToPrevious}
            disabled={disabled}
            className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous match"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <span className="text-xs text-gray-600 dark:text-gray-400 min-w-[60px] text-center">
            {currentIndex + 1} / {matches.length}
          </span>

          <button
            onClick={goToNext}
            disabled={disabled}
            className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Next match"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Current Match Info */}
      {currentMatch && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 mx-2">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                {currentMatch.patternName}
              </p>
              <p className="text-[10px] text-gray-600 dark:text-gray-400 truncate font-mono">
                {currentMatch.text}
              </p>
              <p className="text-[9px] text-gray-500 dark:text-gray-500 mt-0.5">
                Page {currentMatch.pageNumber}
                {!currentMatch.isValid && (
                  <span className="ml-1 text-orange-600 dark:text-orange-400">(unverified)</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Match List (Scrollable) */}
      <div className="max-h-[200px] overflow-y-auto pr-1">
        <div className="space-y-1 px-2">
          {matches.map((match, index) => (
            <button
              key={match.id}
              onClick={() => {
                onNavigate(index);
                if (onPageChange) {
                  onPageChange(match.pageNumber);
                }
              }}
              disabled={disabled}
              className={`w-full text-left px-2 py-1.5 rounded-md transition-colors ${
                index === currentIndex
                  ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-start gap-2">
                <div className={`flex-shrink-0 w-4 h-4 rounded flex items-center justify-center ${
                  index === currentIndex
                    ? 'bg-blue-600 dark:bg-blue-500'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}>
                  <span className="text-[9px] font-medium text-white">
                    {index + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-gray-900 dark:text-white truncate">
                    {match.patternName}
                  </p>
                  <p className="text-[9px] text-gray-600 dark:text-gray-400 truncate font-mono">
                    {match.text}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface QuickMatchBadgeProps {
  count: number;
  onClick: () => void;
  disabled?: boolean;
}

export const QuickMatchBadge: React.FC<QuickMatchBadgeProps> = ({ count, onClick, disabled = false }) => {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {count} match{count !== 1 ? 'es' : ''}
    </button>
  );
};
