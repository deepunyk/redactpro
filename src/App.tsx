/**
 * Main App Component
 * Orchestrates the PDF redaction workflow
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import { PDFUploader } from './components/PDFUploader';
import { PDFViewer } from './components/PDFViewer';
import { KeywordInput } from './components/KeywordInput';
import { DownloadButton } from './components/DownloadButton';
import { CompactAutoRedactPanel } from './components/AutoRedactPanel';
import { extractTextContent, findMatches, PDFProcessingError, pdfCache } from './lib';
import { patternRegistry } from './lib/patterns';
import { extractTextInRegion, countTextOccurrences } from './lib/regionTextExtractor';
import type { RedactionRegion } from './lib/types';
import type { SimilarMatchInfo } from './components/MatchSimilarPopup';

/**
 * Classify a region's source based on its keyword field.
 * - '' → manually drawn
 * - known pattern ID → auto-redact pattern
 * - anything else → keyword match or match-similar
 */
function isPatternId(keyword: string): boolean {
  return !!patternRegistry.getPattern(keyword);
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [redactionRegions, setRedactionRegions] = useState<RedactionRegion[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<any[]>([]);

  // Match-similar popup state
  const [similarMatchPopup, setSimilarMatchPopup] = useState<SimilarMatchInfo | null>(null);

  // Global match navigator state
  const [navIndex, setNavIndex] = useState(0);

  // Ref to always have latest keywords in functional setState
  const keywordsRef = useRef(keywords);
  keywordsRef.current = keywords;

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setKeywords([]);
    setRedactionRegions([]);
    setCurrentPage(1);
    setError(null);
    setPages([]);
    setSimilarMatchPopup(null);
    setNavIndex(0);

    try {
      const extractedPages = await extractTextContent(selectedFile);
      setPages(extractedPages);
    } catch (err) {
      console.error('Error extracting pages for auto-redaction:', err);
    }
  }, []);

  // Handle keywords change — only replaces regions matching the new keywords, keeps everything else
  const handleKeywordsChange = useCallback(async (newKeywords: string[]) => {
    setKeywords(newKeywords);
    setError(null);

    if (file && newKeywords.length > 0) {
      setIsProcessing(true);
      try {
        const extractedPages = await extractTextContent(file);
        const keywordMatches = findMatches(extractedPages, newKeywords);

        setRedactionRegions(prev => {
          // Keep everything whose keyword is NOT one of the new keywords
          // (manual, pattern, match-similar all survive)
          const preserved = prev.filter(r => !newKeywords.includes(r.keyword));
          return [...keywordMatches, ...preserved];
        });
      } catch (error) {
        console.error('Error finding matches:', error);
        let errorMessage = 'Failed to find matches in the PDF. ';
        if (error instanceof PDFProcessingError) {
          errorMessage += error.message;
        } else {
          errorMessage += 'The file may be corrupted or in an unsupported format.';
        }
        setError(errorMessage);
        // On error, just keep non-keyword regions
        setRedactionRegions(prev => {
          return prev.filter(r => !newKeywords.includes(r.keyword));
        });
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Keywords cleared — remove regions whose keyword matches any old keyword
      setRedactionRegions(prev => {
        const oldKws = keywordsRef.current;
        return prev.filter(r => !oldKws.includes(r.keyword));
      });
    }
  }, [file]);

  const handleReset = useCallback(() => {
    if (file) {
      pdfCache.invalidate(file);
    }
    setFile(null);
    setKeywords([]);
    setRedactionRegions([]);
    setCurrentPage(1);
    setError(null);
    setPages([]);
    setSimilarMatchPopup(null);
    setNavIndex(0);
  }, [file]);

  // Handle auto-redaction regions change
  // ONLY replaces pattern regions. Leaves manual, keyword, and match-similar regions untouched.
  const handleAutoRedactRegionsChange = useCallback((newPatternRegions: RedactionRegion[]) => {
    setRedactionRegions(prev => {
      const nonPatternRegions = prev.filter(r => !isPatternId(r.keyword));
      return [...newPatternRegions, ...nonPatternRegions];
    });
  }, []);

  // --- Global match navigator ---
  const totalRegions = redactionRegions.length;

  const handleNavPrevious = useCallback(() => {
    if (totalRegions === 0) return;
    setNavIndex(prev => {
      const newIndex = prev > 0 ? prev - 1 : totalRegions - 1;
      return newIndex;
    });
  }, [totalRegions]);

  const handleNavNext = useCallback(() => {
    if (totalRegions === 0) return;
    setNavIndex(prev => {
      const newIndex = prev < totalRegions - 1 ? prev + 1 : 0;
      return newIndex;
    });
  }, [totalRegions]);

  // Navigate to the page of the current nav region
  useEffect(() => {
    if (totalRegions > 0 && redactionRegions[navIndex]) {
      setCurrentPage(redactionRegions[navIndex].pageNumber);
    }
  }, [navIndex]); // intentionally only navIndex — don't re-navigate on every region change

  // Keep navIndex in bounds when regions change
  useEffect(() => {
    if (navIndex >= totalRegions) {
      setNavIndex(Math.max(0, totalRegions - 1));
    }
  }, [totalRegions, navIndex]);

  // --- Match-similar feature ---

  const handleManualRegionDrawn = useCallback((region: RedactionRegion, displayPosition: { x: number; y: number }) => {
    setSimilarMatchPopup(null);
    if (pages.length === 0) return;

    const extractedText = extractTextInRegion(pages, region.pageNumber, region.x, region.y, region.width, region.height);
    if (!extractedText || extractedText.length < 2) return;

    const totalCount = countTextOccurrences(pages, extractedText);
    const otherCount = totalCount - 1;
    if (otherCount <= 0) return;

    setSimilarMatchPopup({
      text: extractedText,
      count: otherCount,
      displayPosition,
      regionId: region.id,
    });
  }, [pages]);

  // User accepted "Redact all" — uses functional setState
  const handleSimilarMatchAccept = useCallback(() => {
    if (!similarMatchPopup) return;

    const { text, regionId } = similarMatchPopup;
    setSimilarMatchPopup(null);

    const allMatches = findMatches(pages, [text]);

    setRedactionRegions(prev => {
      const manualRegion = prev.find(r => r.id === regionId);
      const filteredMatches = manualRegion
        ? allMatches.filter(m => {
            if (m.pageNumber !== manualRegion.pageNumber) return true;
            const overlapX = Math.max(0, Math.min(m.x + m.width, manualRegion.x + manualRegion.width) - Math.max(m.x, manualRegion.x));
            const overlapY = Math.max(0, Math.min(m.y + m.height, manualRegion.y + manualRegion.height) - Math.max(m.y, manualRegion.y));
            const matchArea = m.width * m.height;
            if (matchArea === 0) return true;
            return (overlapX * overlapY) / matchArea < 0.5;
          })
        : allMatches;

      // Update the drawn region's matchedText, keep everything else, add new matches
      return [
        ...prev.map(r => r.id === regionId ? { ...r, matchedText: text } : r),
        ...filteredMatches,
      ];
    });
  }, [similarMatchPopup, pages]);

  const handleSimilarMatchDismiss = useCallback(() => {
    setSimilarMatchPopup(null);
  }, []);

  // Auto-dismiss popup if referenced region deleted
  useEffect(() => {
    if (similarMatchPopup && !redactionRegions.some(r => r.id === similarMatchPopup.regionId)) {
      setSimilarMatchPopup(null);
    }
  }, [redactionRegions, similarMatchPopup]);

  // Cleanup cache on unmount
  useEffect(() => {
    return () => { pdfCache.clear(); };
  }, []);

  // Current region info for navigator
  const currentNavRegion = totalRegions > 0 ? redactionRegions[navIndex] : null;

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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-6.5rem)]">
            {/* Left Panel - Controls */}
            <div className="lg:col-span-1 flex flex-col min-h-0 gap-2">
              {/* Keywords Input — fixed */}
              <div className="flex-shrink-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5">
                <KeywordInput
                  keywords={keywords}
                  onKeywordsChange={handleKeywordsChange}
                  disabled={isProcessing}
                />
                {error && (
                  <div className="mt-2 p-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                    <p className="text-xs text-red-800 dark:text-red-300">{error}</p>
                  </div>
                )}
              </div>

              {/* Auto-Redaction Panel — scrollable */}
              {pages.length > 0 && (
                <div className="flex-1 min-h-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5 overflow-y-auto">
                  <CompactAutoRedactPanel
                    pages={pages}
                    onRedactionRegionsChange={handleAutoRedactRegionsChange}
                    disabled={isProcessing}
                  />
                </div>
              )}

              {/* Redaction Summary + Global Navigator — fixed */}
              {totalRegions > 0 && (
                <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Redactions</h3>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{totalRegions}</span>
                  </div>
                  {/* Global navigator */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleNavPrevious}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      aria-label="Previous region"
                    >
                      <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 text-center truncate">
                      {navIndex + 1}/{totalRegions}
                      {currentNavRegion && (
                        <span className="text-gray-400 dark:text-gray-500 ml-1">
                          {currentNavRegion.matchedText && currentNavRegion.matchedText !== '(manual)'
                            ? `"${currentNavRegion.matchedText.length > 20 ? currentNavRegion.matchedText.slice(0, 20) + '...' : currentNavRegion.matchedText}"`
                            : 'manual'
                          }
                        </span>
                      )}
                    </span>
                    <button
                      onClick={handleNavNext}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      aria-label="Next region"
                    >
                      <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Download Button — pinned at bottom */}
              <div className="flex-shrink-0 pt-1 border-t border-gray-200 dark:border-gray-700">
                <DownloadButton file={file} regions={redactionRegions} pages={pages} />
              </div>
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
                    onManualRegionDrawn={handleManualRegionDrawn}
                    similarMatchPopup={similarMatchPopup}
                    onSimilarMatchAccept={handleSimilarMatchAccept}
                    onSimilarMatchDismiss={handleSimilarMatchDismiss}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {!file && (
        <footer className="py-3 text-center text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
          <p>Always verify redactions before sharing documents</p>
        </footer>
      )}
    </div>
  );
}

export default App;
