/**
 * PDFViewer Component
 * Displays PDF pages with zoom controls and interactive redaction zones
 *
 * Architecture:
 * - Canvas is rendered once at a fixed high quality (RENDERING_SCALE = 2.0)
 * - Zoom only changes CSS display size, no re-rendering needed
 * - Container scrolls when zoomed in beyond the viewport
 * - Coordinate conversion uses actualScale directly (no displayScale indirection)
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { renderPageToCanvas, getTextLayerData } from '../lib/pdfExtractor';
import type { RedactionRegion } from '../lib/types';
import { MatchSimilarPopup, type SimilarMatchInfo } from './MatchSimilarPopup';

/**
 * Measure the browser's actual font ascent ratio using canvas metrics.
 * This is the same technique PDF.js uses internally.
 */
function measureAscentRatio(): number {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = '12px sans-serif';
  const metrics = ctx.measureText('');
  const ascent = metrics.fontBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent;
  if (ascent) {
    return ascent / (ascent + descent);
  }
  return 0.8; // fallback
}

interface PDFViewerProps {
  file: File;
  redactionRegions: RedactionRegion[];
  currentPage: number;
  onPageChange: (page: number) => void;
  onRegionsChange?: (regions: RedactionRegion[]) => void;
  className?: string;
  onManualRegionDrawn?: (region: RedactionRegion, displayPosition: { x: number; y: number }) => void;
  similarMatchPopup?: SimilarMatchInfo | null;
  onSimilarMatchAccept?: () => void;
  onSimilarMatchDismiss?: () => void;
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

const HANDLE_SIZE = 12;
const MIN_SIZE = 10;
// Fixed rendering scale — canvas always renders at this quality regardless of zoom
const RENDERING_SCALE = 2.0;

export const PDFViewer: React.FC<PDFViewerProps> = ({
  file,
  redactionRegions,
  currentPage,
  onPageChange,
  onRegionsChange,
  className = '',
  onManualRegionDrawn,
  similarMatchPopup,
  onSimilarMatchAccept,
  onSimilarMatchDismiss,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fit-width');
  const [actualScale, setActualScale] = useState<number>(1);
  // Natural page dimensions at scale=1 (PDF points)
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

  // Pan/draw mode
  const [interactionMode, setInteractionMode] = useState<'draw' | 'pan' | 'select'>('draw');

  const switchMode = useCallback((mode: 'draw' | 'pan' | 'select') => {
    // Clear any browser text selection when switching modes
    const selection = window.getSelection();
    if (selection) selection.removeAllRanges();
    setInteractionMode(mode);
  }, []);
  // Ref for PDF.js text layer container
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStateRef = useRef({
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
  });
  // effectiveMode: Space key overrides to pan temporarily
  const effectiveMode = spaceHeld ? 'pan' : interactionMode;

  // Refs for throttling updates during drag
  const rafRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<RedactionRegion[] | null>(null);
  const onRegionsChangeRef = useRef(onRegionsChange);

  // Keep the ref in sync with the prop
  useEffect(() => {
    onRegionsChangeRef.current = onRegionsChange;
  }, [onRegionsChange]);

  // Display size = natural page size * zoom scale.
  // This is the CSS pixel size of the canvas/overlay on screen.
  const displaySize = useMemo(() => ({
    width: pageDimensions.width * actualScale,
    height: pageDimensions.height * actualScale,
  }), [pageDimensions.width, pageDimensions.height, actualScale]);

  // Get current page regions
  const currentPageRegions = useCallback(() => {
    return redactionRegions.filter((region) => region.pageNumber === currentPage);
  }, [redactionRegions, currentPage]);

  // Calculate zoom scale for fit modes
  const calculateScale = useCallback((mode: ZoomMode, containerWidth?: number, pageWidth?: number, pageHeight?: number): number => {
    if (mode === 'fit-width' && containerWidth && pageWidth) {
      return (containerWidth - 32) / pageWidth;
    }
    if (mode === 'fit-page' && containerWidth && pageWidth && pageHeight) {
      return Math.min((containerWidth - 32) / pageWidth, 600 / pageHeight);
    }
    return typeof mode === 'number' ? mode : 1.5;
  }, []);

  // Handle zoom mode change
  const handleZoomChange = useCallback((newMode: ZoomMode | string) => {
    let mode: ZoomMode = newMode as ZoomMode;

    if (typeof newMode === 'string') {
      if (newMode === 'fit-width' || newMode === 'fit-page') {
        mode = newMode;
      } else {
        const numValue = parseFloat(newMode);
        if (!isNaN(numValue)) {
          mode = numValue;
        }
      }
    }

    setZoomMode(mode);

    if (typeof mode === 'number') {
      setActualScale(mode);
    } else if (pageDimensions.width > 0 && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 32;
      const scale = calculateScale(mode, containerWidth, pageDimensions.width, pageDimensions.height);
      setActualScale(scale);
    }
  }, [calculateScale, pageDimensions.width, pageDimensions.height]);

  // When pageDimensions becomes available, recalculate scale for fit modes
  useEffect(() => {
    if ((zoomMode === 'fit-width' || zoomMode === 'fit-page') && pageDimensions.width > 0 && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 32;
      const scale = calculateScale(zoomMode, containerWidth, pageDimensions.width, pageDimensions.height);
      setActualScale(scale);
    }
  }, [pageDimensions.width, pageDimensions.height, zoomMode, calculateScale]);

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
      } else if (e.key === 'h' || e.key === 'H') {
        switchMode('pan');
      } else if (e.key === 'd' || e.key === 'D') {
        switchMode('draw');
      } else if (e.key === 's' || e.key === 'S') {
        switchMode('select');
      } else if (e.key === ' ') {
        e.preventDefault();
        setSpaceHeld(true);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && dragState.selectedRegion && onRegionsChange) {
        const globalIndex = redactionRegions.findIndex(r => r.id === dragState.selectedRegion);
        if (globalIndex !== -1) {
          const newRegions = [...redactionRegions];
          newRegions.splice(globalIndex, 1);
          onRegionsChange(newRegions);
          setDragState(prev => ({ ...prev, selectedRegion: null }));
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setSpaceHeld(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleZoomIn, handleZoomOut, dragState.selectedRegion, onRegionsChange, redactionRegions]);

  // Recalculate scale on window resize for fit modes
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && (zoomMode === 'fit-width' || zoomMode === 'fit-page') && pageDimensions.width > 0) {
        const containerWidth = containerRef.current.clientWidth - 32;
        const scale = calculateScale(zoomMode, containerWidth, pageDimensions.width, pageDimensions.height);
        setActualScale(scale);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [zoomMode, calculateScale, pageDimensions.width, pageDimensions.height]);

  // --- Coordinate conversions ---
  // Display space: origin top-left, Y down, units = CSS pixels on screen
  // PDF space: origin bottom-left, Y up, units = PDF points

  const displayToPdfCoords = useCallback((displayX: number, displayY: number) => {
    return {
      pdfX: displayX / actualScale,
      pdfY: pageDimensions.height - (displayY / actualScale),
    };
  }, [actualScale, pageDimensions.height]);

  const pdfToDisplayCoords = useCallback((pdfX: number, pdfY: number, height: number) => {
    return {
      displayX: pdfX * actualScale,
      displayY: (pageDimensions.height - pdfY - height) * actualScale,
    };
  }, [actualScale, pageDimensions.height]);

  // Handle mouse down on overlay (start drawing or select region)
  const handleOverlayMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Select mode — let native text selection work, don't intercept
    if (effectiveMode === 'select') return;

    // Pan mode — start scrolling by drag
    if (effectiveMode === 'pan') {
      if (containerRef.current) {
        panStateRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          startScrollLeft: containerRef.current.scrollLeft,
          startScrollTop: containerRef.current.scrollTop,
        };
        setIsPanning(true);
      }
      return;
    }

    if (!onRegionsChange) return;

    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on an existing region
    const regions = currentPageRegions();
    for (const region of regions) {
      const { displayX, displayY } = pdfToDisplayCoords(region.x, region.y, region.height);
      const regionWidth = region.width * actualScale;
      const regionHeight = region.height * actualScale;

      if (x >= displayX && x <= displayX + regionWidth && y >= displayY && y <= displayY + regionHeight) {
        setDragState(prev => ({
          ...prev,
          selectedRegion: region.id,
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
  }, [onRegionsChange, currentPageRegions, pdfToDisplayCoords, actualScale, effectiveMode]);

  // Handle mouse move (drag, resize, or draw)
  const handleOverlayMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Select mode — don't interfere with native text selection
    if (effectiveMode === 'select') return;

    // Pan mode — scroll the container
    if (isPanning && containerRef.current) {
      const dx = e.clientX - panStateRef.current.startX;
      const dy = e.clientY - panStateRef.current.startY;
      containerRef.current.scrollLeft = panStateRef.current.startScrollLeft - dx;
      containerRef.current.scrollTop = panStateRef.current.startScrollTop - dy;
      return;
    }
    if (effectiveMode === 'pan') return;

    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update hover state (only when not dragging/resizing/drawing)
    if (!dragState.isDragging && !dragState.isResizing && !drawingState.isDrawing) {
      let newHoveredRegion: string | null = null;
      let newHoveredHandle: string | null = null;

      const regions = currentPageRegions();
      for (const region of regions) {
        const { displayX, displayY } = pdfToDisplayCoords(region.x, region.y, region.height);
        const regionWidth = region.width * actualScale;
        const regionHeight = region.height * actualScale;

        // Check handles if selected
        if (dragState.selectedRegion === region.id) {
          if (Math.abs(x - displayX) < HANDLE_SIZE && Math.abs(y - displayY) < HANDLE_SIZE) {
            newHoveredHandle = 'nw';
          } else if (Math.abs(x - (displayX + regionWidth)) < HANDLE_SIZE && Math.abs(y - displayY) < HANDLE_SIZE) {
            newHoveredHandle = 'ne';
          } else if (Math.abs(x - displayX) < HANDLE_SIZE && Math.abs(y - (displayY + regionHeight)) < HANDLE_SIZE) {
            newHoveredHandle = 'sw';
          } else if (Math.abs(x - (displayX + regionWidth)) < HANDLE_SIZE && Math.abs(y - (displayY + regionHeight)) < HANDLE_SIZE) {
            newHoveredHandle = 'se';
          }
        }

        // Check if inside region
        if (x >= displayX && x <= displayX + regionWidth && y >= displayY && y <= displayY + regionHeight) {
          newHoveredRegion = region.id;
        }
      }
      setHoveredRegion(newHoveredRegion);
      setHoveredHandle(newHoveredHandle);
    }

    // Handle dragging — throttled with requestAnimationFrame
    if (dragState.isDragging && dragState.selectedRegion && onRegionsChange) {
      // Screen delta to PDF delta: dx same sign, dy inverted
      const dx = (x - dragState.startX) / actualScale;
      const dy = -(y - dragState.startY) / actualScale;

      const globalIndex = redactionRegions.findIndex(r => r.id === dragState.selectedRegion);

      if (globalIndex !== -1) {
        const region = redactionRegions[globalIndex];
        const newRegions = [...redactionRegions];
        newRegions[globalIndex] = {
          ...region,
          x: Math.max(0, dragState.originalX + dx),
          y: Math.max(0, dragState.originalY + dy),
        };

        pendingUpdateRef.current = newRegions;
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            if (pendingUpdateRef.current && onRegionsChangeRef.current) {
              onRegionsChangeRef.current(pendingUpdateRef.current);
              pendingUpdateRef.current = null;
            }
            rafRef.current = null;
          });
        }
      }
    }

    // Handle resizing — throttled with requestAnimationFrame
    if (dragState.isResizing && dragState.selectedRegion && onRegionsChange) {
      const dx = (x - dragState.startX) / actualScale;
      const dy = (y - dragState.startY) / actualScale; // screen direction: down=positive

      const globalIndex = redactionRegions.findIndex(r => r.id === dragState.selectedRegion);

      if (globalIndex !== -1) {
        const region = redactionRegions[globalIndex];
        const newRegions = [...redactionRegions];
        let newRegion = { ...region };

        const minSize = MIN_SIZE / actualScale;

        // dy is in screen direction (down=positive). PDF Y is inverted (up=positive).
        // region.y = bottom edge in PDF space, region.y + region.height = top edge.
        // When moving a bottom edge: y shifts by -dy, height adjusts by +dy to keep top fixed.
        // When moving a top edge: height adjusts by -dy to keep bottom (y) fixed.
        switch (dragState.resizeHandle) {
          case 'se': // Moves bottom edge (y) and right edge
            newRegion.width = Math.max(minSize, dragState.originalWidth + dx);
            newRegion.y = Math.max(0, dragState.originalY - dy);
            newRegion.height = Math.max(minSize, dragState.originalHeight + dy);
            break;
          case 'sw': // Moves bottom edge (y) and left edge (x)
            newRegion.x = Math.max(0, dragState.originalX + dx);
            newRegion.width = Math.max(minSize, dragState.originalWidth - dx);
            newRegion.y = Math.max(0, dragState.originalY - dy);
            newRegion.height = Math.max(minSize, dragState.originalHeight + dy);
            break;
          case 'ne': // Moves top edge (y+height) and right edge — bottom (y) stays fixed
            newRegion.width = Math.max(minSize, dragState.originalWidth + dx);
            newRegion.height = Math.max(minSize, dragState.originalHeight - dy);
            break;
          case 'nw': // Moves top edge (y+height) and left edge (x) — bottom (y) stays fixed
            newRegion.x = Math.max(0, dragState.originalX + dx);
            newRegion.width = Math.max(minSize, dragState.originalWidth - dx);
            newRegion.height = Math.max(minSize, dragState.originalHeight - dy);
            break;
        }

        newRegions[globalIndex] = newRegion;

        pendingUpdateRef.current = newRegions;
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            if (pendingUpdateRef.current && onRegionsChangeRef.current) {
              onRegionsChangeRef.current(pendingUpdateRef.current);
              pendingUpdateRef.current = null;
            }
            rafRef.current = null;
          });
        }
      }
    }

    // Handle drawing
    if (drawingState.isDrawing) {
      setDrawingState(prev => ({ ...prev, currentX: x, currentY: y }));
    }
  }, [dragState, drawingState, currentPageRegions, pdfToDisplayCoords, actualScale, onRegionsChange, redactionRegions, effectiveMode, isPanning]);

  // Handle mouse up (finish drawing, drag, or resize)
  const handleOverlayMouseUp = useCallback(() => {
    // Stop panning
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // Flush any pending RAF updates
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (pendingUpdateRef.current && onRegionsChangeRef.current) {
      onRegionsChangeRef.current(pendingUpdateRef.current);
      pendingUpdateRef.current = null;
    }

    // Finish drawing
    if (drawingState.isDrawing && onRegionsChange) {
      const { startX, startY, currentX, currentY } = drawingState;
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      if (width > MIN_SIZE && height > MIN_SIZE) {
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);

        // (x, y+height) is the screen-space bottom-left of the drawn rect.
        // In PDF coords, this is the bottom-left of the new region.
        const { pdfX, pdfY } = displayToPdfCoords(x, y + height);

        const newRegion: RedactionRegion = {
          id: crypto.randomUUID(),
          pageNumber: currentPage,
          x: pdfX,
          y: pdfY,
          width: width / actualScale,
          height: height / actualScale,
          matchedText: '(manual)',
          keyword: '',
        };

        onRegionsChange([...redactionRegions, newRegion]);

        // Notify parent about the new manual region for match-similar detection
        if (onManualRegionDrawn) {
          onManualRegionDrawn(newRegion, { x, y });
        }
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
  }, [drawingState, onRegionsChange, redactionRegions, currentPage, actualScale, displayToPdfCoords, isPanning]);

  // Handle resize handle mouse down
  const handleResizeHandleMouseDown = useCallback((e: React.MouseEvent, handle: string, regionId: string) => {
    e.stopPropagation();
    if (!onRegionsChange) return;

    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const regions = currentPageRegions();
    const region = regions.find(r => r.id === regionId)!;

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

  // Render PDF page at fixed RENDERING_SCALE (independent of zoom)
  useEffect(() => {
    let isMounted = true;
    let cancelled = false;

    const loadPage = async () => {
      if (!file || !canvasRef.current) return;

      setIsLoading(true);

      try {
        const renderedCanvas = await renderPageToCanvas(file, currentPage, RENDERING_SCALE);

        if (!isMounted || cancelled) {
          return;
        }

        const ctx = canvasRef.current.getContext('2d')!;

        if (ctx) {
          canvasRef.current.width = renderedCanvas.width;
          canvasRef.current.height = renderedCanvas.height;
          ctx.drawImage(renderedCanvas, 0, 0);

          // Store natural page dimensions (at scale=1, in PDF points)
          setPageDimensions({
            width: renderedCanvas.width / RENDERING_SCALE,
            height: renderedCanvas.height / RENDERING_SCALE,
          });
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error rendering PDF page:', error);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadPage();

    return () => {
      isMounted = false;
      cancelled = true;
    };
  }, [file, currentPage]);

  // Get total page count
  useEffect(() => {
    let isMounted = true;

    const getPageCount = async () => {
      try {
        const { getPageCount } = await import('../lib/pdfExtractor');
        const count = await getPageCount(file);
        if (isMounted) {
          setTotalPages(count);
        }
      } catch (error) {
        console.error('Error getting page count:', error);
      }
    };

    getPageCount();

    return () => {
      isMounted = false;
    };
  }, [file]);

  // Render text layer for select mode using direct coordinate transforms
  useEffect(() => {
    let cancelled = false;

    const renderTextLayer = async () => {
      const container = textLayerRef.current;
      if (!container) return;

      container.innerHTML = '';

      if (interactionMode !== 'select' || !file || actualScale <= 0) return;

      try {
        const { textContent, viewport } = await getTextLayerData(file, currentPage, actualScale);
        if (cancelled) return;

        const ascentRatio = measureAscentRatio();
        const vpTransform = viewport.transform;

        // Use a DocumentFragment to batch DOM writes
        const fragment = document.createDocumentFragment();

        for (const item of textContent.items) {
          const str = (item as any).str;
          if (!str || !str.trim()) continue;

          const itemTransform = (item as any).transform;
          if (!itemTransform) continue;

          // Combine viewport transform with text item transform.
          // This gives coordinates in the same space as the CSS display.
          const tx = [
            vpTransform[0] * itemTransform[0] + vpTransform[2] * itemTransform[1],
            vpTransform[1] * itemTransform[0] + vpTransform[3] * itemTransform[1],
            vpTransform[0] * itemTransform[2] + vpTransform[2] * itemTransform[3],
            vpTransform[1] * itemTransform[2] + vpTransform[3] * itemTransform[3],
            vpTransform[0] * itemTransform[4] + vpTransform[2] * itemTransform[5] + vpTransform[4],
            vpTransform[1] * itemTransform[4] + vpTransform[3] * itemTransform[5] + vpTransform[5],
          ];

          const fontHeight = Math.hypot(tx[2], tx[3]);
          const fontAscent = fontHeight * ascentRatio;

          // tx[4] = x position from left (CSS pixels)
          // tx[5] = baseline from top (CSS pixels)
          const left = tx[4];
          const top = tx[5] - fontAscent;

          const span = document.createElement('span');
          span.textContent = str;
          span.style.position = 'absolute';
          span.style.left = `${left}px`;
          span.style.top = `${top}px`;
          span.style.fontSize = `${fontHeight}px`;
          span.style.lineHeight = '1';
          span.style.color = 'transparent';
          span.style.whiteSpace = 'pre';
          span.style.pointerEvents = 'auto';

          fragment.appendChild(span);
        }

        if (!cancelled) {
          container.appendChild(fragment);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error rendering text layer:', error);
        }
      }
    };

    renderTextLayer();

    return () => {
      cancelled = true;
      if (textLayerRef.current) {
        textLayerRef.current.innerHTML = '';
      }
    };
  }, [file, currentPage, interactionMode, actualScale]);

  // Cleanup canvas and RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    };
  }, []);

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
    if (effectiveMode === 'select') {
      return 'text';
    }
    if (effectiveMode === 'pan') {
      return isPanning ? 'grabbing' : 'grab';
    }
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
  }, [effectiveMode, isPanning, dragState, hoveredHandle, hoveredRegion]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2 px-1">
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

        {/* Interaction mode toggle */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => switchMode('draw')}
            className={`p-2 rounded-md transition-colors ${
              interactionMode === 'draw' && !spaceHeld
                ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            title="Draw mode (D)"
            aria-label="Draw mode"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          </button>
          <button
            onClick={() => switchMode('select')}
            className={`p-2 rounded-md transition-colors ${
              interactionMode === 'select' && !spaceHeld
                ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            title="Select text mode (S)"
            aria-label="Select text mode"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3h6M12 3v18M9 21h6M7 7h2M17 7h-2M7 17h2M17 17h-2" />
            </svg>
          </button>
          <button
            onClick={() => switchMode('pan')}
            className={`p-2 rounded-md transition-colors ${
              interactionMode === 'pan' || spaceHeld
                ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            title="Pan mode (H)"
            aria-label="Pan mode"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
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

      {/* Canvas container — scrollable when zoomed in */}
      <div
        ref={containerRef}
        className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-auto flex-1"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400"></div>
          </div>
        )}

        <div
          className="relative"
          style={{
            display: isLoading ? 'none' : 'block',
            width: displaySize.width || 100,
            height: displaySize.height || 100,
            margin: '16px auto',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: displaySize.width || undefined,
              height: displaySize.height || undefined,
              display: 'block',
            }}
          />

          {/* Interactive overlay — exactly covers the displayed canvas */}
          {!isLoading && displaySize.width > 0 && displaySize.height > 0 && (
            <div
              ref={overlayRef}
              className="absolute inset-0"
              style={{
                cursor: getCursor(),
              }}
              onMouseDown={handleOverlayMouseDown}
              onMouseMove={handleOverlayMouseMove}
              onMouseUp={handleOverlayMouseUp}
              onMouseLeave={handleOverlayMouseUp}
            >
              {/* Text layer for select mode */}
              {interactionMode === 'select' && (
                <div
                  ref={textLayerRef}
                  className="absolute inset-0 select-text"
                  onMouseDown={(e) => e.stopPropagation()}
                />
              )}

              {/* Render redaction zones */}
              {currentPageRegions().map((region) => {
                const { displayX, displayY } = pdfToDisplayCoords(region.x, region.y, region.height);
                const regionWidth = region.width * actualScale;
                const regionHeight = region.height * actualScale;
                const isSelected = dragState.selectedRegion === region.id;
                const isHovered = hoveredRegion === region.id;

                return (
                  <div
                    key={region.id}
                    className={`absolute border-2 transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/20'
                        : isHovered
                        ? 'border-blue-400 bg-red-500/30'
                        : 'border-red-500 bg-red-500/20'
                    }`}
                    style={{
                      left: displayX,
                      top: displayY,
                      width: regionWidth,
                      height: regionHeight,
                    }}
                  >
                    {/* Selection handles */}
                    {isSelected && onRegionsChange && (
                      <>
                        {/* Corner handles - visible dot + larger transparent hit area */}
                        <div
                          className="absolute cursor-nwse-resize"
                          style={{ left: -10, top: -10, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onMouseDown={(e) => handleResizeHandleMouseDown(e, 'nw', region.id)}
                        >
                          <div className="w-3 h-3 bg-blue-500 border border-white rounded-sm" />
                        </div>
                        <div
                          className="absolute cursor-nesw-resize"
                          style={{ right: -10, top: -10, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onMouseDown={(e) => handleResizeHandleMouseDown(e, 'ne', region.id)}
                        >
                          <div className="w-3 h-3 bg-blue-500 border border-white rounded-sm" />
                        </div>
                        <div
                          className="absolute cursor-nesw-resize"
                          style={{ left: -10, bottom: -10, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onMouseDown={(e) => handleResizeHandleMouseDown(e, 'sw', region.id)}
                        >
                          <div className="w-3 h-3 bg-blue-500 border border-white rounded-sm" />
                        </div>
                        <div
                          className="absolute cursor-nwse-resize"
                          style={{ right: -10, bottom: -10, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onMouseDown={(e) => handleResizeHandleMouseDown(e, 'se', region.id)}
                        >
                          <div className="w-3 h-3 bg-blue-500 border border-white rounded-sm" />
                        </div>
                      </>
                    )}

                    {/* Delete button for selected region */}
                    {isSelected && onRegionsChange && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const globalIndex = redactionRegions.findIndex(r => r.id === region.id);
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

              {/* Match-similar popup */}
              {similarMatchPopup && onSimilarMatchAccept && onSimilarMatchDismiss && (
                <MatchSimilarPopup
                  match={similarMatchPopup}
                  onAccept={onSimilarMatchAccept}
                  onDismiss={onSimilarMatchDismiss}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="mt-1 px-1">
        <p className="text-[10px] text-gray-500 dark:text-gray-400">
          {effectiveMode === 'select' ? (
            <>Select text to copy • <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 font-mono text-[9px]">Ctrl+C</kbd> copy • <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 font-mono text-[9px]">+/-</kbd> zoom</>
          ) : (
            <>Draw zones • Click select • Drag move/resize • <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 font-mono text-[9px]">Del</kbd> remove • <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 font-mono text-[9px]">+/-</kbd> zoom • <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 font-mono text-[9px]">Space</kbd> pan</>
          )}
        </p>
      </div>

      {/* Region count */}
      {currentPageRegions().length > 0 && (
        <div className="mt-1 px-1">
          <p className="text-[10px] text-gray-600 dark:text-gray-400">
            {currentPageRegions().length} zone{currentPageRegions().length !== 1 ? 's' : ''} on page
          </p>
        </div>
      )}
    </div>
  );
};
