/**
 * PatternSelector - UI for selecting/deselecting auto-redaction patterns
 */

import React from 'react';
import { patternRegistry } from '../lib/patterns';
import type { Pattern, PatternGroup } from '../lib/patterns/types';

interface PatternSelectorProps {
  selectedPatterns: Set<string>;
  onPatternToggle: (patternId: string) => void;
  matchCounts?: Map<string, number>;
  disabled?: boolean;
  compact?: boolean;
}

export const PatternSelector: React.FC<PatternSelectorProps> = ({
  selectedPatterns,
  onPatternToggle,
  matchCounts = new Map(),
  disabled = false,
  compact = false,
}) => {
  const allGroups = patternRegistry.getAllGroups();
  const totalMatches = Array.from(matchCounts.values()).reduce((sum, count) => sum + count, 0);

  if (compact) {
    return (
      <div className="space-y-2">
        {allGroups.map(group => (
          <PatternGroupFlat
            key={group.id}
            group={group}
            selectedPatterns={selectedPatterns}
            onPatternToggle={onPatternToggle}
            matchCounts={matchCounts}
            disabled={disabled}
          />
        ))}
        {totalMatches === 0 && selectedPatterns.size === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 px-1">
            Select patterns to detect sensitive info
          </p>
        )}
      </div>
    );
  }

  // Full mode (unused currently, but kept for compatibility)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2 py-1">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Auto-Redact Patterns</h3>
        {totalMatches > 0 && (
          <span className="text-xs text-gray-600 dark:text-gray-400">{totalMatches} matches</span>
        )}
      </div>
      <div className="space-y-2">
        {allGroups.map(group => (
          <PatternGroupFlat
            key={group.id}
            group={group}
            selectedPatterns={selectedPatterns}
            onPatternToggle={onPatternToggle}
            matchCounts={matchCounts}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * A single pattern group rendered as a flat section with a label and checkboxes.
 */
interface PatternGroupFlatProps {
  group: PatternGroup;
  selectedPatterns: Set<string>;
  onPatternToggle: (patternId: string) => void;
  matchCounts: Map<string, number>;
  disabled: boolean;
}

const PatternGroupFlat: React.FC<PatternGroupFlatProps> = ({
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
    <div>
      {/* Group label */}
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          {group.name}
        </span>
        {groupMatchCount > 0 && (
          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
            {groupMatchCount} found
          </span>
        )}
      </div>

      {/* Pattern checkboxes */}
      <div className="space-y-px">
        {groupPatterns.map(pattern => (
          <PatternRow
            key={pattern.id}
            pattern={pattern}
            isSelected={selectedPatterns.has(pattern.id)}
            matchCount={matchCounts.get(pattern.id) || 0}
            disabled={disabled}
            onToggle={() => !disabled && onPatternToggle(pattern.id)}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * A single pattern row — styled as a flat list item with checkbox.
 */
interface PatternRowProps {
  pattern: Pattern;
  isSelected: boolean;
  matchCount: number;
  disabled: boolean;
  onToggle: () => void;
}

const PatternRow: React.FC<PatternRowProps> = ({
  pattern,
  isSelected,
  matchCount,
  disabled,
  onToggle,
}) => {
  return (
    <label
      className={`
        flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors select-none
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${isSelected
          ? 'bg-blue-50 dark:bg-blue-900/20'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
        }
      `}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        disabled={disabled}
        className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 dark:bg-gray-700 flex-shrink-0"
      />
      <span className={`
        text-xs flex-1 truncate
        ${isSelected
          ? 'text-gray-900 dark:text-white font-medium'
          : 'text-gray-700 dark:text-gray-300'
        }
      `}>
        {pattern.icon && <span className="mr-1">{pattern.icon}</span>}
        {pattern.name}
      </span>
      {matchCount > 0 && (
        <span className={`
          text-[11px] font-semibold flex-shrink-0 min-w-[18px] text-center
          ${isSelected
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-gray-500 dark:text-gray-400'
          }
        `}>
          {matchCount}
        </span>
      )}
    </label>
  );
};
