/**
 * PatternSelector - UI for selecting/deselecting auto-redaction patterns
 */

import React, { useState } from 'react';
import { patternRegistry } from '../lib/patterns';
import type { Pattern, PatternGroup } from '../lib/patterns/types';

interface PatternSelectorProps {
  selectedPatterns: Set<string>;
  onPatternToggle: (patternId: string) => void;
  onGroupToggle?: (groupId: string) => void;
  matchCounts?: Map<string, number>;
  disabled?: boolean;
  compact?: boolean;
}

export const PatternSelector: React.FC<PatternSelectorProps> = ({
  selectedPatterns,
  onPatternToggle,
  onGroupToggle,
  matchCounts = new Map(),
  disabled = false,
  compact = false,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['india-personal', 'global-contact']));

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const allGroups = patternRegistry.getAllGroups();
  const totalMatches = Array.from(matchCounts.values()).reduce((sum, count) => sum + count, 0);

  if (compact) {
    return (
      <div className="space-y-0.5 max-h-[180px] overflow-y-auto pr-1">
        {allGroups.map(group => (
          <CompactPatternGroup
            key={group.id}
            group={group}
            selectedPatterns={selectedPatterns}
            onPatternToggle={onPatternToggle}
            matchCounts={matchCounts}
            disabled={disabled}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Auto-Redact Patterns</h3>
        {totalMatches > 0 && (
          <span className="text-xs text-gray-600 dark:text-gray-400">{totalMatches} matches</span>
        )}
      </div>

      {/* Pattern Groups */}
      <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
        {allGroups.map(group => {
          const groupPatterns = group.patterns
            .map(id => patternRegistry.getPattern(id))
            .filter(Boolean) as Pattern[];

          if (groupPatterns.length === 0) return null;

          const isExpanded = expandedGroups.has(group.id);
          const groupMatchCount = groupPatterns.reduce((sum, p) => sum + (matchCounts.get(p.id) || 0), 0);

          return (
            <div key={group.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {/* Group Header */}
              <button
                onClick={() => toggleGroupExpansion(group.id)}
                disabled={disabled}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-xs font-medium text-gray-900 dark:text-white">{group.name}</span>
                </div>
                {groupMatchCount > 0 && (
                  <span className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                    {groupMatchCount}
                  </span>
                )}
              </button>

              {/* Group Patterns */}
              {isExpanded && (
                <div className="px-3 pb-2 space-y-1">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">{group.description}</p>
                  {groupPatterns.map(pattern => {
                    const isSelected = selectedPatterns.has(pattern.id);
                    const matchCount = matchCounts.get(pattern.id) || 0;

                    return (
                      <label
                        key={pattern.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                          disabled
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => !disabled && onPatternToggle(pattern.id)}
                          disabled={disabled}
                          className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 dark:bg-gray-700"
                        />
                        <span className="text-xs text-gray-700 dark:text-gray-300 flex-1">
                          {pattern.icon && <span className="mr-1">{pattern.icon}</span>}
                          {pattern.name}
                        </span>
                        {matchCount > 0 && (
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                            {matchCount}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {totalMatches === 0 && !disabled && (
        <div className="text-center py-4 px-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Select patterns to auto-detect sensitive information
          </p>
        </div>
      )}
    </div>
  );
};

interface CompactPatternGroupProps {
  group: PatternGroup;
  selectedPatterns: Set<string>;
  onPatternToggle: (patternId: string) => void;
  matchCounts: Map<string, number>;
  disabled: boolean;
}

const CompactPatternGroup: React.FC<CompactPatternGroupProps> = ({
  group,
  selectedPatterns,
  onPatternToggle,
  matchCounts,
  disabled,
}) => {
  const groupPatterns = group.patterns
    .map(id => patternRegistry.getPattern(id))
    .filter(Boolean) as Pattern[];

  if (groupPatterns.length === 0) return null;

  const groupMatchCount = groupPatterns.reduce((sum, p) => sum + (matchCounts.get(p.id) || 0), 0);

  return (
    <div className="space-y-0.5">
      {/* Group header */}
      <div className="flex items-center justify-between px-2 py-0.5">
        <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          {group.name}
        </span>
        {groupMatchCount > 0 && (
          <span className="text-[9px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1 rounded">
            {groupMatchCount}
          </span>
        )}
      </div>

      {/* Patterns */}
      {groupPatterns.map(pattern => {
        const isSelected = selectedPatterns.has(pattern.id);
        const matchCount = matchCounts.get(pattern.id) || 0;

        return (
          <label
            key={pattern.id}
            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
              disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => !disabled && onPatternToggle(pattern.id)}
              disabled={disabled}
              className="w-3 h-3 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">
              {pattern.icon && <span className="mr-1">{pattern.icon}</span>}
              {pattern.name}
            </span>
            {matchCount > 0 && (
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium flex-shrink-0">{matchCount}</span>
            )}
          </label>
        );
      })}
    </div>
  );
};
