/**
 * MatchSimilarPopup - Shows when user draws a manual redaction over text.
 * Offers to find and redact all other occurrences of that text.
 */

import React, { useEffect, useRef } from 'react';

export interface SimilarMatchInfo {
  text: string;
  count: number;
  displayPosition: { x: number; y: number };
  regionId: string;
}

interface MatchSimilarPopupProps {
  match: SimilarMatchInfo;
  onAccept: () => void;
  onDismiss: () => void;
}

export const MatchSimilarPopup: React.FC<MatchSimilarPopupProps> = ({
  match,
  onAccept,
  onDismiss,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  // Click-away dismiss
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    // Delay listener to avoid the same mouseup that created the popup
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onDismiss]);

  const { text, count, displayPosition } = match;

  // Position: below-right of the region, with some offset
  const style: React.CSSProperties = {
    position: 'absolute',
    left: displayPosition.x + 8,
    top: displayPosition.y + 8,
    zIndex: 50,
    minWidth: 200,
    maxWidth: 280,
  };

  return (
    <div
      ref={popupRef}
      style={style}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-2.5 animate-in fade-in"
    >
      {/* Close button */}
      <button
        onClick={onDismiss}
        className="absolute top-1 right-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        aria-label="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Message */}
      <p className="text-xs text-gray-700 dark:text-gray-300 pr-4 mb-2">
        Found <span className="font-semibold text-gray-900 dark:text-white">"{text}"</span> in{' '}
        <span className="font-semibold text-gray-900 dark:text-white">{count}</span> other place{count !== 1 ? 's' : ''}.
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onAccept}
          className="flex-1 px-2.5 py-1.5 bg-blue-600 dark:bg-blue-700 text-white text-xs font-medium rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
        >
          Redact all
        </button>
        <button
          onClick={onDismiss}
          className="px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
};
