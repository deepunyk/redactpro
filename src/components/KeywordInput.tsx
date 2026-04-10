/**
 * KeywordInput Component
 * Tag-based input for entering keywords to redact
 */

import React, { useCallback, useRef, useState } from 'react';

interface KeywordInputProps {
  keywords: string[];
  onKeywordsChange: (keywords: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const KeywordInput: React.FC<KeywordInputProps> = ({
  keywords,
  onKeywordsChange,
  placeholder = 'Enter a keyword and press Enter or comma',
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addKeyword = useCallback(
    (keyword: string) => {
      const trimmed = keyword.trim();
      if (trimmed && !keywords.includes(trimmed)) {
        onKeywordsChange([...keywords, trimmed]);
      }
      setInputValue('');
    },
    [keywords, onKeywordsChange]
  );

  const removeKeyword = useCallback(
    (index: number) => {
      onKeywordsChange(keywords.filter((_, i) => i !== index));
    },
    [keywords, onKeywordsChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        if (inputValue) {
          addKeyword(inputValue);
        }
      } else if (e.key === 'Backspace' && !inputValue && keywords.length > 0) {
        // Remove last keyword when backspace is pressed on empty input
        removeKeyword(keywords.length - 1);
      }
    },
    [inputValue, keywords, addKeyword, removeKeyword]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedText = e.clipboardData.getData('text');
      // Split by comma or newline for batch adding
      const newKeywords = pastedText
        .split(/[,\n]/)
        .map((k) => k.trim())
        .filter((k) => k && !keywords.includes(k));

      if (newKeywords.length > 0) {
        onKeywordsChange([...keywords, ...newKeywords]);
      }
    },
    [keywords, onKeywordsChange]
  );

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Keywords to Redact
      </label>

      {/* Keyword tags */}
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg min-h-[60px]">
          {keywords.map((keyword, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-sm"
            >
              <span>{keyword}</span>
              <button
                onClick={() => removeKeyword(index)}
                disabled={disabled}
                className="hover:bg-red-200 dark:hover:bg-red-800 rounded-full p-0.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`Remove ${keyword}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          placeholder={keywords.length === 0 ? placeholder : 'Add more keywords...'}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          data-testid="keyword-input"
        />
        {inputValue && (
          <button
            onClick={() => setInputValue('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Helper text */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Press Enter or comma to add. Paste comma-separated values to add multiple at once.
      </p>
    </div>
  );
};
