/**
 * DownloadButton Component
 * Triggers PDF redaction with text-layer preservation and downloads the result
 */

import React, { useState, useEffect } from 'react';
import { redactPDFWithTextLayer } from '../lib/pdfTextRedactor';
import type { RedactionRegion, PageContent } from '../lib/types';

interface DownloadButtonProps {
  file: File;
  regions: RedactionRegion[];
  pages: PageContent[];
  disabled?: boolean;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  file,
  regions,
  pages,
  disabled = false,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const handleDownload = async () => {
    if (regions.length === 0) {
      setError('No redaction zones. Add keywords or draw zones manually.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress(0);

    // Create abort controller for this operation
    abortControllerRef.current = new AbortController();

    try {
      // Read the file
      const arrayBuffer = await file.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);

      // Redact the PDF with text-layer preservation
      const redactedBytes = await redactPDFWithTextLayer(pdfBytes, regions, pages, {
        scale: 2.0,
        onProgress: (current, total) => {
          setProgress(Math.round((current / total) * 100));
        },
        signal: abortControllerRef.current.signal,
      });

      // Create download link
      const byteCopy = new Uint8Array(redactedBytes);
      const blob = new Blob([byteCopy], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `redacted-${file.name.replace('.pdf', '')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Redaction was cancelled.');
      } else {
        console.error('Error redacting PDF:', err);
        setError(err instanceof Error ? err.message : 'Failed to redact PDF');
      }
    } finally {
      setIsProcessing(false);
      setProgress(0);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          disabled={disabled || isProcessing || regions.length === 0}
          className={`
            flex-1 px-6 py-3 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${disabled || isProcessing || regions.length === 0
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-gray-200 dark:border-gray-700'
              : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-white shadow-sm hover:shadow'
            }
          `}
          data-testid="download-button"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {progress > 0 ? `Processing... ${progress}%` : 'Processing...'}
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Redacted PDF
            </span>
          )}
        </button>

        {isProcessing && (
          <button
            onClick={handleCancel}
            className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            aria-label="Cancel redaction"
          >
            Cancel
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Info about text-layer preservation */}
      {regions.length > 0 && !isProcessing && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Output preserves text for AI readability. Redacted content is removed.
        </p>
      )}
    </div>
  );
};
