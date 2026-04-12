/**
 * Main App Component
 * Orchestrates the PDF redaction workflow
 */

import { useCallback, useState, useEffect } from 'react';
import { PDFUploader } from './components/PDFUploader';
import { PDFViewer } from './components/PDFViewer';
import { KeywordInput } from './components/KeywordInput';
import { DownloadButton } from './components/DownloadButton';
import { extractTextContent, findMatches, PDFProcessingError, pdfCache } from './lib';
import type { RedactionRegion } from './lib/types';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [redactionRegions, setRedactionRegions] = useState<RedactionRegion[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setKeywords([]);
    setRedactionRegions([]);
    setCurrentPage(1);
    setError(null);
  }, []);

  // Handle keywords change - find matches in the PDF
  const handleKeywordsChange = useCallback(async (newKeywords: string[]) => {
    setKeywords(newKeywords);
    setError(null);

    if (file && newKeywords.length > 0) {
      setIsProcessing(true);
      try {
        const pages = await extractTextContent(file);
        const matches = findMatches(pages, newKeywords);
        setRedactionRegions(matches);
      } catch (error) {
        console.error('Error finding matches:', error);
        let errorMessage = 'Failed to find matches in the PDF. ';
        if (error instanceof PDFProcessingError) {
          errorMessage += error.message;
        } else {
          errorMessage += 'The file may be corrupted or in an unsupported format.';
        }
        setError(errorMessage);
        setRedactionRegions([]);
      } finally {
        setIsProcessing(false);
      }
    } else {
      setRedactionRegions([]);
    }
  }, [file]);

  const handleReset = useCallback(() => {
    // Clear PDF cache when resetting
    if (file) {
      pdfCache.invalidate(file);
    }
    setFile(null);
    setKeywords([]);
    setRedactionRegions([]);
    setCurrentPage(1);
    setError(null);
  }, [file]);

  // Cleanup cache on unmount
  useEffect(() => {
    return () => {
      pdfCache.clear();
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                RedactPro
              </h1>
              {!file && (
                <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                  Client-side PDF redaction
                </span>
              )}
            </div>
            {file && (
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                New
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full overflow-hidden">
        {!file ? (
          /* Upload State */
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Begin Redacting
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Upload a PDF document. All processing occurs locally in your browser.
              </p>
            </div>
            <PDFUploader onFileSelect={handleFileSelect} />

            {/* Security Notice */}
            <div className="mt-10 p-5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <p className="font-medium mb-1">Enterprise-Grade Privacy</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    Your documents never leave your device. All redaction is performed using client-side processing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Editor State */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-6.5rem)]">
            {/* Left Panel - Controls */}
            <div className="lg:col-span-1 space-y-3 overflow-y-auto pr-1">
              {/* File Info */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                <h3 className="font-medium text-gray-900 dark:text-white mb-1.5 text-xs">Document</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-0.5">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              {/* Keywords Input */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                <KeywordInput
                  keywords={keywords}
                  onKeywordsChange={handleKeywordsChange}
                  disabled={isProcessing}
                />

                {/* Error message */}
                {error && (
                  <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                    <p className="text-xs text-red-800 dark:text-red-300">{error}</p>
                  </div>
                )}

                {/* Match count indicator */}
                {redactionRegions.length > 0 && (
                  <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                          {redactionRegions.length} match{redactionRegions.length !== 1 ? 'es' : ''} found
                        </p>
                        <p className="text-[10px] text-gray-600 dark:text-gray-400">
                          Review zones before downloading
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Download Button */}
              <DownloadButton file={file} regions={redactionRegions} />
            </div>

            {/* Right Panel - PDF Viewer */}
            <div className="lg:col-span-2 h-full min-h-0">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 h-full flex flex-col">
                {isProcessing ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                      <p className="text-gray-600 dark:text-gray-400">Finding matches...</p>
                    </div>
                  </div>
                ) : (
                  <PDFViewer
                    file={file}
                    redactionRegions={redactionRegions}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    onRegionsChange={setRedactionRegions}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer - hidden in editor mode */}
      {!file && (
        <footer className="py-3 text-center text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
          <p>Client-side processing. Verify redactions before sharing.</p>
        </footer>
      )}
    </div>
  );
}

export default App;
