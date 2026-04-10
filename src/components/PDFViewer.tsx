/**
 * PDFViewer Component
 * Displays PDF pages with zoom controls and interactive redaction zones
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { renderPageToCanvas } from '../lib/pdfExtractor';
import type { RedactionRegion } from '../lib/types';

interface PDFViewerProps {
  file: File;
  redactionRegions: RedactionRegion[];
  currentPage: number;
  onPageChange: (page: number) => void;
  onRegionsChange?: (regions: RedactionRegion[]) => void;
  className?: string;
}

// Zoom preset options
const ZOOM_PRESETS = [
  { label: 'Fit Width', value: 'fit-width' as const },
  { label: 'Fit Page', value: 'fit-page' as const },
  { label: '100%', value: 1 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2 },
];

type ZoomPreset = typeof ZOOM_PRESETS[number]['value'];
type ZoomMode = ZoomPreset | number;

interface DragState {
  isDragging: boolean;
  isResizing: boolean;
  resizeHandle?: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';
  selectedRegion: string | null;
  startX: number;
  startY: number;
  originalX: number;
  originalY: number;
  originalWidth: number;
  originalHeight: number;
}

interface DrawingState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const HANDLE_SIZE = 8;
const MIN_SIZE = 10;

export const PDFViewer: React.FC<PDFViewerProps> = ({
  file,
  redactionRegions,
  currentPage,
  onPageChange,
  onRegionsChange,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [zoomMode, setZoomMode] = useState<ZoomMode>(1.5);
  const [actualScale, setActualScale] = useState<number>(1.5);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });

  // Interactive states
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    isResizing: false,
    selectedRegion: null,
    startX: 0,
    startY: 0,
    originalX: 0,
    originalY: 0,
    originalWidth: 0,
    originalHeight: 0,
  });
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);

  // Get unique ID for regions
  const getRegionId = useCallback((region: RedactionRegion, index: number) => {
    return `${region.pageNumber}-${region.x}-${region.y}-${region.width}-${region.height}-${index}`;
  }, []);

  // Get current page regions
  const currentPageRegions = useCallback(() => {
    return redactionRegions
      .map((r, i) => ({ region: r, id: getRegionId(r, i) }))
      .filter(({ region }) => region.pageNumber === currentPage);
  }, [redactionRegions, currentPage, getRegionId]);

  // Calculate actual scale based on zoom mode
  const calculateScale = useCallback((mode: ZoomMode, containerWidth?: number, pageWidth?: number): number => {
    if (mode === 'fit-width' && containerWidth && pageWidth) {
      return (containerWidth - 32) / pageWidth;
    }
    if (mode === 'fit-page' && containerWidth && pageWidth) {
      return Math.min((containerWidth - 32) / pageWidth, 600 / pageWidth);
    }
    return typeof mode === 'number' ? mode : 1.5;
  }, []);

  // Handle zoom mode change
  const handleZoomChange = useCallback((newMode: ZoomMode) => {
    setZoomMode(newMode);
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 32;
      const estimatedPageWidth = 600;
      const scale = calculateScale(newMode, containerWidth, estimatedPageWidth);
      setActualScale(scale);
    }
  }, [calculateScale]);

  // Handle zoom in/out
  const handleZoomIn = useCallback(() => {
    const newScale = Math.min(actualScale + 0.25, 3);
    setZoomMode(newScale);
    setActualScale(newScale);
  }, [actualScale]);

  const handleZoomOut = useCallback(() => {
    const newScale = Math.max(actualScale - 0.25, 0.5);
    setZoomMode(newScale);
    setActualScale(newScale);
  }, [actualScale]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && dragState.selectedRegion && onRegionsChange) {
        // Delete selected region
        const regions = currentPageRegions();
        const selectedIndex = regions.findIndex(r => r.id === dragState.selectedRegion);
        if (selectedIndex !== -1) {
          const globalIndex = redactionRegions.findIndex(r =>
            r.pageNumber === currentPage &&
            getRegionId(r, redactionRegions.indexOf(r)) === dragState.selectedRegion
          );
          if (globalIndex !== -1) {
            const newRegions = [...redactionRegions];
            newRegions.splice(globalIndex, 1);
            onRegionsChange(newRegions);
            setDragState(prev => ({ ...prev, selectedRegion: null }));
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, dragState.selectedRegion, onRegionsChange, redactionRegions, currentPage, currentPageRegions, getRegionId]);

  // Recalculate scale on container resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && (zoomMode === 'fit-width' || zoomMode === 'fit-page')) {
        const containerWidth = containerRef.current.clientWidth - 32;
        const estimatedPageWidth = 600;
        const scale = calculateScale(zoomMode, containerWidth, estimatedPageWidth);
        setActualScale(scale);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [zoomMode, calculateScale]);

  // Convert canvas coordinates to PDF coordinates
  const canvasToPdfCoords = useCallback((canvasX: number, canvasY: number) => {
    const unscaledPageHeight = pageDimensions.height / actualScale;
    const pdfX = canvasX / actualScale;
    const pdfY = unscaledPageHeight - (canvasY / actualScale);
    return { pdfX, pdfY };
  }, [actualScale, pageDimensions.height]);

  // Convert PDF coordinates to canvas coordinates
  const pdfToCanvasCoords = useCallback((pdfX: number, pdfY: number, width: number, height: number) => {
    const unscaledPageHeight = pageDimensions.height / actualScale;
    const canvasX = pdfX * actualScale;
    const baselineY = (unscaledPageHeight - pdfY) * actualScale;
    const textTopY = baselineY - (height * actualScale * 0.7);
    return { canvasX, canvasY: textTopY };
  }, [actualScale, pageDimensions.height]);

  // Handle mouse down on overlay (start drawing or select region)
  const handleOverlayMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onRegionsChange) return;

    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on an existing region
    const regions = currentPageRegions();
    for (const { region, id } of regions) {
      const { canvasX, canvasY } = pdfToCanvasCoords(region.x, region.y, region.width, region.height);
      const canvasWidth = region.width * actualScale;
      const canvasHeight = region.height * actualScale;

      if (x >= canvasX && x <= canvasX + canvasWidth && y >= canvasY && y <= canvasY + canvasHeight) {
        // Select this region
        setDragState(prev => ({
          ...prev,
          selectedRegion: id,
          isDragging: true,
          startX: x,
          startY: y,
          originalX: region.x,
          originalY: region.y,
        }));
        return;
      }
    }

    // Start drawing new region
    setDrawingState({
      isDrawing: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    });
    setDragState(prev => ({ ...prev, selectedRegion: null }));
  }, [onRegionsChange, currentPageRegions, pdfToCanvasCoords, actualScale]);

  // Handle mouse move (drag, resize, or draw)
  const handleOverlayMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update hover state
    let newHoveredRegion: string | null = null;
    let newHoveredHandle: string | null = null;

    if (!dragState.isDragging && !dragState.isResizing && !drawingState.isDrawing) {
      const regions = currentPageRegions();
      for (const { region, id } of regions) {
        const { canvasX, canvasY } = pdfToCanvasCoords(region.x, region.y, region.width, region.height);
        const canvasWidth = region.width * actualScale;
        const canvasHeight = region.height * actualScale;

        // Check handles if selected
        if (dragState.selectedRegion === id) {
          // Check corner handles
          if (Math.abs(x - canvasX) < HANDLE_SIZE && Math.abs(y - canvasY) < HANDLE_SIZE) {
            newHoveredHandle = 'nw';
          } else if (Math.abs(x - (canvasX + canvasWidth)) < HANDLE_SIZE && Math.abs(y - canvasY) < HANDLE_SIZE) {
            newHoveredHandle = 'ne';
          } else if (Math.abs(x - canvasX) < HANDLE_SIZE && Math.abs(y - (canvasY + canvasHeight)) < HANDLE_SIZE) {
            newHoveredHandle = 'sw';
          } else if (Math.abs(x - (canvasX + canvasWidth)) < HANDLE_SIZE && Math.abs(y - (canvasY + canvasHeight)) < HANDLE_SIZE) {
            newHoveredHandle = 'se';
          }
        }

        // Check if inside region
        if (x >= canvasX && x <= canvasX + canvasWidth && y >= canvasY && y <= canvasY + canvasHeight) {
          newHoveredRegion = id;
        }
      }
      setHoveredRegion(newHoveredRegion);
      setHoveredHandle(newHoveredHandle);
    }

    // Handle dragging
    if (dragState.isDragging && dragState.selectedRegion && onRegionsChange) {
      const dx = (x - dragState.startX) / actualScale;
      const dy = -(y - dragState.startY) / actualScale; // Y is inverted in PDF

      const regions = currentPageRegions();
      const { region } = regions.find(r => r.id === dragState.selectedRegion)!;
      const globalIndex = redactionRegions.findIndex(r =>
        r.pageNumber === currentPage &&
        getRegionId(r, redactionRegions.indexOf(r)) === dragState.selectedRegion
      );

      if (globalIndex !== -1) {
        const newRegions = [...redactionRegions];
        newRegions[globalIndex] = {
          ...region,
          x: Math.max(0, dragState.originalX + dx),
          y: Math.max(0, dragState.originalY + dy),
        };
        onRegionsChange(newRegions);
      }
    }

    // Handle resizing
    if (dragState.isResizing && dragState.selectedRegion && onRegionsChange) {
      const dx = (x - dragState.startX) / actualScale;
      const dy = (y - dragState.startY) / actualScale;

      const regions = currentPageRegions();
      const { region } = regions.find(r => r.id === dragState.selectedRegion)!;
      const globalIndex = redactionRegions.findIndex(r =>
        r.pageNumber === currentPage &&
        getRegionId(r, redactionRegions.indexOf(r)) === dragState.selectedRegion
      );

      if (globalIndex !== -1) {
        const newRegions = [...redactionRegions];
        let newRegion = { ...region };

        switch (dragState.resizeHandle) {
          case 'se':
            newRegion.width = Math.max(MIN_SIZE / actualScale, dragState.originalWidth + dx);
            newRegion.height = Math.max(MIN_SIZE / actualScale, dragState.originalHeight - dy);
            break;
          case 'sw':
            newRegion.x = Math.max(0, dragState.originalX + dx);
            newRegion.width = Math.max(MIN_SIZE / actualScale, dragState.originalWidth - dx);
            newRegion.height = Math.max(MIN_SIZE / actualScale, dragState.originalHeight - dy);
            break;
          case 'ne':
            newRegion.width = Math.max(MIN_SIZE / actualScale, dragState.originalWidth + dx);
            newRegion.y = Math.max(0, dragState.originalY + dy);
            newRegion.height = Math.max(MIN_SIZE / actualScale, dragState.originalHeight - dy);
            break;
          case 'nw':
            newRegion.x = Math.max(0, dragState.originalX + dx);
            newRegion.width = Math.max(MIN_SIZE / actualScale, dragState.originalWidth - dx);
            newRegion.y = Math.max(0, dragState.originalY + dy);
            newRegion.height = Math.max(MIN_SIZE / actualScale, dragState.originalHeight - dy);
            break;
        }

        newRegions[globalIndex] = newRegion;
        onRegionsChange(newRegions);
      }
    }

    // Handle drawing
    if (drawingState.isDrawing) {
      setDrawingState(prev => ({ ...prev, currentX: x, currentY: y }));
    }
  }, [dragState, drawingState, currentPageRegions, pdfToCanvasCoords, actualScale, onRegionsChange, redactionRegions, currentPage, getRegionId]);

  // Handle mouse up (finish drawing, drag, or resize)
  const handleOverlayMouseUp = useCallback(() => {
    // Finish drawing
    if (drawingState.isDrawing && onRegionsChange) {
      const { startX, startY, currentX, currentY } = drawingState;
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      if (width > MIN_SIZE && height > MIN_SIZE) {
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const { pdfX, pdfY } = canvasToPdfCoords(x, y + height);

        const newRegion: RedactionRegion = {
          pageNumber: currentPage,
          x: pdfX,
          y: pdfY,
          width: width / actualScale,
          height: height / actualScale,
          matchedText: '(manual)',
        };

        onRegionsChange([...redactionRegions, newRegion]);
      }

      setDrawingState({
        isDrawing: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
      });
    }

    // Finish dragging/resizing
    setDragState(prev => ({
      ...prev,
      isDragging: false,
      isResizing: false,
      resizeHandle: undefined,
    }));
  }, [drawingState, onRegionsChange, redactionRegions, currentPage, actualScale, canvasToPdfCoords]);

  // Handle resize handle mouse down
  const handleResizeHandleMouseDown = useCallback((e: React.MouseEvent, handle: string, regionId: string) => {
    e.stopPropagation();
    if (!onRegionsChange) return;

    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const regions = currentPageRegions();
    const { region } = regions.find(r => r.id === regionId)!;

    setDragState(prev => ({
      ...prev,
      isResizing: true,
      resizeHandle: handle as any,
      selectedRegion: regionId,
      startX: x,
      startY: y,
      originalX: region.x,
      originalY: region.y,
      originalWidth: region.width,
      originalHeight: region.height,
    }));
  }, [onRegionsChange, currentPageRegions]);

  useEffect(() => {
    const loadPage = async () => {
      if (!file || !canvasRef.current) return;

      setIsLoading(true);

      try {
        const renderedCanvas = await renderPageToCanvas(file, currentPage, actualScale);
        const ctx = canvasRef.current.getContext('2d')!;

        if (ctx) {
          canvasRef.current.width = renderedCanvas.width;
          canvasRef.current.height = renderedCanvas.height;
          ctx.drawImage(renderedCanvas, 0, 0);

          // Update page dimensions for coordinate conversion
          setPageDimensions({
            width: renderedCanvas.width / actualScale,
            height: renderedCanvas.height / actualScale,
          });

          // Update scale if needed for fit modes
          if (containerRef.current) {
            const containerWidth = containerRef.current.clientWidth - 32;
            if (zoomMode === 'fit-width' || zoomMode === 'fit-page') {
              const pageWidth = renderedCanvas.width / actualScale;
              const newScale = calculateScale(zoomMode, containerWidth, pageWidth);
              if (Math.abs(newScale - actualScale) > 0.01) {
                setActualScale(newScale);
                const correctedCanvas = await renderPageToCanvas(file, currentPage, newScale);
                canvasRef.current.width = correctedCanvas.width;
                canvasRef.current.height = correctedCanvas.height;
                const correctedCtx = canvasRef.current.getContext('2d')!;
                correctedCtx.drawImage(correctedCanvas, 0, 0);
                setPageDimensions({
                  width: correctedCanvas.width / newScale,
                  height: correctedCanvas.height / newScale,
                });
              }
            }
          }

          // Draw redaction overlays on canvas (for export)
          const pageRegions = redactionRegions.filter((r) => r.pageNumber === currentPage);
          if (pageRegions.length > 0) {
            for (const region of pageRegions) {
              const unscaledPageHeight = canvasRef.current.height / actualScale;
              const canvasX = region.x * actualScale;
              const canvasWidth = region.width * actualScale;
              const canvasHeight = region.height * actualScale;
              const baselineY = (unscaledPageHeight - region.y) * actualScale;
              const textTopY = baselineY - (canvasHeight * 0.7);

              ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
              ctx.fillRect(canvasX, textTopY, canvasWidth, canvasHeight);
              ctx.strokeStyle = 'rgba(220, 38, 38, 0.8)';
              ctx.lineWidth = 2;
              ctx.strokeRect(canvasX, textTopY, canvasWidth, canvasHeight);
            }
          }
        }
      } catch (error) {
        console.error('Error rendering PDF page:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPage();
  }, [file, currentPage, actualScale, redactionRegions, zoomMode, calculateScale]);

  useEffect(() => {
    const getPageCount = async () => {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await (await import('pdfjs-dist')).getDocument({ data: arrayBuffer }).promise;
      setTotalPages(pdf.numPages);
    };

    getPageCount();
  }, [file]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
      setDragState(prev => ({ ...prev, selectedRegion: null }));
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
      setDragState(prev => ({ ...prev, selectedRegion: null }));
    }
  };

  const getZoomPercentage = useCallback(() => {
    return Math.round(actualScale * 100);
  }, [actualScale]);

  const getCursor = useCallback(() => {
    if (dragState.isResizing) {
      switch (dragState.resizeHandle) {
        case 'nw': case 'se': return 'nwse-resize';
        case 'ne': case 'sw': return 'nesw-resize';
        default: return 'move';
      }
    }
    if (dragState.isDragging) return 'move';
    if (hoveredHandle) {
      switch (hoveredHandle) {
        case 'nw': case 'se': return 'nwse-resize';
        case 'ne': case 'sw': return 'nesw-resize';
        default: return 'move';
      }
    }
    if (hoveredRegion) return 'move';
    return 'crosshair';
  }, [dragState, hoveredHandle, hoveredRegion]);

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 px-2">
        {/* Page controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreviousPage}
            disabled={currentPage <= 1 || isLoading}
            className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Previous page"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[80px] text-center">
            Page {currentPage} of {totalPages || '?'}
          </span>

          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages || isLoading}
            className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Next page"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={isLoading}
            className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Zoom out"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>

          <div className="relative">
            <select
              value={zoomMode}
              onChange={(e) => handleZoomChange(e.target.value as ZoomMode)}
              className="appearance-none px-3 py-2 pr-8 bg-gray-100 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {ZOOM_PRESETS.map((preset) => (
                <option key={preset.label} value={preset.value}>{preset.label}</option>
              ))}
              <option value={0.5} key="50%">50%</option>
              <option value={0.75} key="75%">75%</option>
              <option value={1.25} key="125%">125%</option>
              <option value={2.5} key="250%">250%</option>
              <option value={3} key="300%">300%</option>
            </select>
            <svg className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[45px]">
            {getZoomPercentage()}%
          </span>

          <button
            onClick={handleZoomIn}
            disabled={isLoading}
            className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Zoom in"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Canvas container with overlay */}
      <div
        ref={containerRef}
        className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center min-h-[500px]"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400"></div>
          </div>
        )}

        <div className="relative">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-[70vh] shadow-lg"
            style={{ display: isLoading ? 'none' : 'block' }}
          />

          {/* Interactive overlay */}
          {!isLoading && (
            <div
              ref={overlayRef}
              className="absolute inset-0"
              style={{
                width: canvasRef.current?.width || 0,
                height: canvasRef.current?.height || 0,
                cursor: getCursor(),
              }}
              onMouseDown={handleOverlayMouseDown}
              onMouseMove={handleOverlayMouseMove}
              onMouseUp={handleOverlayMouseUp}
              onMouseLeave={handleOverlayMouseUp}
            >
              {/* Render redaction zones */}
              {currentPageRegions().map(({ region, id }) => {
                const { canvasX, canvasY } = pdfToCanvasCoords(region.x, region.y, region.width, region.height);
                const canvasWidth = region.width * actualScale;
                const canvasHeight = region.height * actualScale;
                const isSelected = dragState.selectedRegion === id;
                const isHovered = hoveredRegion === id;

                return (
                  <div
                    key={id}
                    className={`absolute border-2 transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/20'
                        : isHovered
                        ? 'border-blue-400 bg-red-500/30'
                        : 'border-red-500 bg-red-500/20'
                    }`}
                    style={{
                      left: canvasX,
                      top: canvasY,
                      width: canvasWidth,
                      height: canvasHeight,
                    }}
                  >
                    {/* Selection handles */}
                    {isSelected && onRegionsChange && (
                      <>
                        {/* Corner handles */}
                        <div
                          className="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm cursor-nwse-resize"
                          style={{ left: -4, top: -4 }}
                          onMouseDown={(e) => handleResizeHandleMouseDown(e, 'nw', id)}
                        />
                        <div
                          className="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm cursor-nesw-resize"
                          style={{ right: -4, top: -4 }}
                          onMouseDown={(e) => handleResizeHandleMouseDown(e, 'ne', id)}
                        />
                        <div
                          className="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm cursor-nesw-resize"
                          style={{ left: -4, bottom: -4 }}
                          onMouseDown={(e) => handleResizeHandleMouseDown(e, 'sw', id)}
                        />
                        <div
                          className="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm cursor-nwse-resize"
                          style={{ right: -4, bottom: -4 }}
                          onMouseDown={(e) => handleResizeHandleMouseDown(e, 'se', id)}
                        />
                      </>
                    )}

                    {/* Delete button for selected region */}
                    {isSelected && onRegionsChange && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const globalIndex = redactionRegions.findIndex(r =>
                            r.pageNumber === currentPage &&
                            getRegionId(r, redactionRegions.indexOf(r)) === id
                          );
                          if (globalIndex !== -1) {
                            const newRegions = [...redactionRegions];
                            newRegions.splice(globalIndex, 1);
                            onRegionsChange(newRegions);
                            setDragState(prev => ({ ...prev, selectedRegion: null }));
                          }
                        }}
                        className="absolute -top-6 -right-1 p-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                        aria-label="Delete zone"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Drawing preview */}
              {drawingState.isDrawing && (
                <div
                  className="absolute border-2 border-dashed border-blue-500 bg-blue-500/10 pointer-events-none"
                  style={{
                    left: Math.min(drawingState.startX, drawingState.currentX),
                    top: Math.min(drawingState.startY, drawingState.currentY),
                    width: Math.abs(drawingState.currentX - drawingState.startX),
                    height: Math.abs(drawingState.currentY - drawingState.startY),
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="mt-3 px-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Draw to add zones • Click to select • Drag to move • Drag corners to resize • <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 font-mono text-xs">Delete</kbd> to remove • <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 font-mono text-xs">+/-</kbd> to zoom
        </p>
      </div>

      {/* Region count */}
      {currentPageRegions().length > 0 && (
        <div className="mt-3 px-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {currentPageRegions().length} redaction zone{currentPageRegions().length !== 1 ? 's' : ''} on this page
          </p>
        </div>
      )}
    </div>
  );
};
