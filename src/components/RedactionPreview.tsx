/**
 * RedactionPreview Component
 * Toggle switch to show/hide redaction preview
 */

import React from 'react';

interface RedactionPreviewProps {
  showRedactions: boolean;
  onToggle: () => void;
  regionCount: number;
  disabled?: boolean;
}

export const RedactionPreview: React.FC<RedactionPreviewProps> = ({
  showRedactions,
  onToggle,
  regionCount,
  disabled = false,
}) => {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Redaction Preview
        </span>
        <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full">
          {regionCount} region{regionCount !== 1 ? 's' : ''}
        </span>
      </div>

      <button
        onClick={onToggle}
        disabled={disabled || regionCount === 0}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          ${showRedactions
            ? 'bg-blue-600'
            : 'bg-gray-300 dark:bg-gray-600'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        data-testid="redaction-preview-toggle"
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${showRedactions ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>

      <span className="text-xs text-gray-500 dark:text-gray-400 ml-3">
        {showRedactions ? 'Showing' : 'Hidden'}
      </span>
    </div>
  );
};
