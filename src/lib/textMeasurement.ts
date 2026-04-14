/**
 * Canvas-based text measurement for accurate proportional-font positioning.
 *
 * PDF.js gives us the total width of each text item (measured from font metrics),
 * but we need to know where a *substring* starts and how wide it is.
 * Dividing totalWidth / charCount assumes monospace — wrong for proportional fonts.
 *
 * This module measures prefix/match widths using the browser's canvas text renderer,
 * then scales to match the PDF.js-provided total width. The browser font won't be
 * pixel-identical to the PDF font, but character *proportions* (narrow 'i', wide 'm')
 * are consistent enough to give far better results than uniform division.
 */

let _canvas: HTMLCanvasElement | null = null;
let _ctx: CanvasRenderingContext2D | null = null;

function getCtx(): CanvasRenderingContext2D {
  if (!_ctx) {
    _canvas = document.createElement('canvas');
    _ctx = _canvas.getContext('2d')!;
  }
  return _ctx;
}

export interface SubstringPosition {
  /** X offset of the substring relative to the text item's x */
  offsetX: number;
  /** Width of the substring */
  width: number;
}

/**
 * Measure the position and width of a substring within a text item,
 * scaled to match the PDF.js-provided total item width.
 */
export function measureSubstring(
  text: string,
  matchIndex: number,
  matchLength: number,
  itemWidth: number,
  fontSize: number
): SubstringPosition {
  if (text.length === 0 || itemWidth === 0) {
    return { offsetX: 0, width: 0 };
  }

  // Single character or very short matches: uniform is fine
  if (text.length === 1) {
    return { offsetX: 0, width: itemWidth };
  }

  const ctx = getCtx();
  ctx.font = `${fontSize}px sans-serif`;

  const totalMeasured = ctx.measureText(text).width;
  if (totalMeasured === 0) {
    // Fallback to uniform distribution
    const charWidth = itemWidth / text.length;
    return { offsetX: matchIndex * charWidth, width: matchLength * charWidth };
  }

  const scale = itemWidth / totalMeasured;

  // Measure prefix (everything before the match)
  let prefixWidth: number;
  if (matchIndex === 0) {
    prefixWidth = 0;
  } else {
    prefixWidth = ctx.measureText(text.substring(0, matchIndex)).width * scale;
  }

  // Measure the match itself
  let matchWidth: number;
  if (matchIndex === 0 && matchLength === text.length) {
    // Match is the entire text item — use the precise PDF.js width directly
    matchWidth = itemWidth;
  } else {
    matchWidth = ctx.measureText(text.substring(matchIndex, matchIndex + matchLength)).width * scale;
  }

  return { offsetX: prefixWidth, width: matchWidth };
}

/**
 * Redaction padding constants (in PDF points).
 * These ensure the box fully covers the text including ascenders, descenders,
 * and accounts for small measurement errors.
 */
export const PADDING = {
  /** Horizontal padding per side */
  horizontal: 1.5,
  /** Vertical padding as fraction of font height */
  verticalFraction: 0.15,
} as const;

/**
 * Adjust a raw match rectangle to ensure it fully covers the text.
 * Adds padding and shifts the box to cover descenders.
 */
export function padRegion(
  x: number,
  y: number,
  width: number,
  height: number
): { x: number; y: number; width: number; height: number } {
  const vPad = height * PADDING.verticalFraction;
  return {
    x: x - PADDING.horizontal,
    y: y - vPad * 0.4,                        // extend slightly above (for ascent overshoot)
    width: width + PADDING.horizontal * 2,
    height: height + vPad * 1.2,               // extend more below to cover descenders
  };
}
