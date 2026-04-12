/**
 * Main App Component
 * Orchestrates the PDF redaction workflow
 */

import { useCallback, useState, useEffect } from 'react';
import { PDFUploader } from './components/PDFUploader';
import { PDFViewer } from './components/PDFViewer';
import { KeywordInput } from './components/KeywordInput';
import { DownloadButton } from './components/DownloadButton';
import { CompactAutoRedactPanel } from './components/AutoRedactPanel';
import { extractTextContent, findMatches, PDFProcessingError, pdfCache } from './lib';
import type { RedactionRegion } from './lib/types';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [redactionRegions, setRedactionRegions] = useState<RedactionRegion[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<any[]>([]);

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setKeywords([]);
    setRedactionRegions([]);
    setCurrentPage(1);
    setError(null);
    setPages([]);

    // Extract pages content for auto-redaction
    try {
      const extractedPages = await extractTextContent(selectedFile);
      setPages(extractedPages);
    } catch (err) {
      console.error('Error extracting pages for auto-redaction:', err);
    }
  }, []);

  // Handle keywords change - find matches in the PDF
  const handleKeywordsChange = useCallback(async (newKeywords: string[]) => {
    setKeywords(newKeywords);
    setError(null);

    // Preserve manually drawn regions and auto-redaction regions across keyword changes
    const manualRegions = redactionRegions.filter(r => r.keyword === '');
    const autoRedactRegions = redactionRegions.filter(r => r.keyword !== '' && !keywords.includes(r.keyword));

    if (file && newKeywords.length > 0) {
      setIsProcessing(true);
      try {
        const extractedPages = await extractTextContent(file);
        const matches = findMatches(extractedPages, newKeywords);
        setRedactionRegions([...matches, ...manualRegions, ...autoRedactRegions]);
      } catch (error) {
        console.error('Error finding matches:', error);
        let errorMessage = 'Failed to find matches in the PDF. ';
        if (error instanceof PDFProcessingError) {
          errorMessage += error.message;
        } else {
          errorMessage += 'The file may be corrupted or in an unsupported format.';
        }
        setError(errorMessage);
        setRedactionRegions([...manualRegions, ...autoRedactRegions]);
      } finally {
        setIsProcessing(false);
      }
    } else {
      setRedactionRegions([...manualRegions, ...autoRedactRegions]);
    }
  }, [file, redactionRegions, keywords]);

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
    setPages([]);
  }, [file]);

  // Handle auto-redaction regions
  const handleAutoRedactRegionsChange = useCallback((newRegions: RedactionRegion[]) => {
    // Merge with existing manual regions
    const manualRegions = redactionRegions.filter(r => r.keyword === '');
    setRedactionRegions([...newRegions, ...manualRegions]);
  }, [redactionRegions]);

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
                AnonDocs
              </h1>
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
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Secure PDF Redaction
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Quickly find and redact sensitive information from your documents
              </p>
            </div>
            <PDFUploader onFileSelect={handleFileSelect} />

            {/* Security Notice */}
            <div className="mt-10 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p>Your documents are processed locally and never uploaded to any server</p>
              </div>
            </div>
          </div>
        ) : (
          /* Editor State */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-6.5rem)]">
            {/* Left Panel - Controls */}
            <div className="lg:col-span-1 space-y-2 overflow-y-auto pr-1">
              {/* Keywords Input */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5">
                <KeywordInput
                  keywords={keywords}
                  onKeywordsChange={handleKeywordsChange}
                  disabled={isProcessing}
                />

                {/* Error message */}
                {error && (
                  <div className="mt-2 p-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                    <p className="text-xs text-red-800 dark:text-red-300">{error}</p>
                  </div>
                )}
              </div>

              {/* Auto-Redaction Panel */}
              {pages.length > 0 && (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5">
                  <CompactAutoRedactPanel
                    pages={pages}
                    onRedactionRegionsChange={handleAutoRedactRegionsChange}
                    onPageChange={setCurrentPage}
                    disabled={isProcessing}
                  />
                </div>
              )}

              {/* Quick Stats */}
              {redactionRegions.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Redaction Summary</h3>
                    <div className="flex items-center gap-1.5">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">{redactionRegions.length}</span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">region{redactionRegions.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              )}

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
          <p>Always verify redactions before sharing documents</p>
        </footer>
      )}
    </div>
  );
}

export default App;
