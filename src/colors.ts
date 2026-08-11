/**
 * Red Hat brand color palette and hex↔RGB conversion utilities.
 *
 * RGB values use the Google API convention: each channel is a float in
 * the 0–1 range (sRGB). The palette gathers colours used across both
 * the Docs and Slides tool-chains so consuming projects can share a
 * single source of truth.
 */

/** RGB colour in Google API format (channels 0–1). */
export interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

/**
 * Named Red Hat brand colours.
 *
 * Values are sRGB 0–1 floats ready for the Google Docs/Slides APIs.
 * Hex equivalents are noted in trailing comments.
 */
export const RH_COLORS = {
  /** Red Hat red — #EE0000 */
  red:      { red: 0.9333, green: 0,      blue: 0      } as RgbColor,
  /** Pure black — #000000 */
  black:    { red: 0,      green: 0,      blue: 0      } as RgbColor,
  /** Pure white — #FFFFFF */
  white:    { red: 1,      green: 1,      blue: 1      } as RgbColor,
  /** Mid-gray — #434343 */
  gray:     { red: 0.2627, green: 0.2627, blue: 0.2627 } as RgbColor,
  /** Light gray — #6A6E73 */
  lightGray:{ red: 0.416,  green: 0.431,  blue: 0.451  } as RgbColor,
  /** Dark background — #292929 */
  darkBg:   { red: 0.161,  green: 0.161,  blue: 0.161  } as RgbColor,
  /** Grey background for slide layouts — #F2F2F2. */
  greyBg:   { red: 242 / 255, green: 242 / 255, blue: 242 / 255 } as RgbColor,
} as const;

/**
 * Convert a hex colour string to an {@link RgbColor}.
 *
 * Accepts `#RRGGBB` or `RRGGBB`.
 */
export function hexToRgb(hex: string): RgbColor {
  const n = parseInt(hex.replace('#', ''), 16);
  return {
    red:   ((n >> 16) & 0xff) / 255,
    green: ((n >>  8) & 0xff) / 255,
    blue:  ( n        & 0xff) / 255,
  };
}

/**
 * Convert an {@link RgbColor} (0–1 floats) back to a `#RRGGBB` hex string.
 */
export function rgbToHex(rgb: RgbColor): string {
  const r = Math.round(rgb.red   * 255);
  const g = Math.round(rgb.green * 255);
  const b = Math.round(rgb.blue  * 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase();
}

/**
 * Check whether a hex colour is a shade of gray.
 *
 * Uses HSV saturation < 0.15 and weighted luminance between 0.15 and
 * 0.88, matching the heuristic from the Google-Apps-Script template
 * enforcer.  Accepts `#RRGGBB` format.
 */
export function isGrayHex(hex: string): boolean {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const lum = r * 0.299 + g * 0.587 + b * 0.114;
  return sat < 0.15 && lum > 0.15 && lum < 0.88;
}
