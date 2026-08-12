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
 * Accepts `#RRGGBB`, `RRGGBB`, `#RGB`, or `RGB`.
 */
export function hexToRgb(hex: string): RgbColor {
  let h = hex.replace(/^#+/, '');
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    return { red: 0, green: 0, blue: 0 };
  }
  const n = parseInt(h, 16);
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
  const clamp = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 255);
  const r = clamp(rgb.red);
  const g = clamp(rgb.green);
  const b = clamp(rgb.blue);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Normalize a hex color string: lowercase, ensure `#` prefix. */
export function normHex(hex: string): string {
  if (!hex) return '';
  const stripped = hex.replace(/^#+/, '');
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$|^[0-9a-f]{8}$/i.test(stripped)) return '';
  return `#${stripped.toLowerCase()}`;
}

/**
 * Check whether a hex colour is a shade of gray.
 *
 * Uses HSV saturation < 0.15 and weighted luminance between 0.15 and
 * 0.88, matching the heuristic from the Google-Apps-Script template
 * enforcer.  Accepts `#RRGGBB` or `RRGGBB` format.
 */
export function isGrayHex(hex: string): boolean {
  let norm = hex.startsWith('#') ? hex : `#${hex}`;
  if (norm.length === 4) {
    norm = `#${norm[1]}${norm[1]}${norm[2]}${norm[2]}${norm[3]}${norm[3]}`;
  }
  if (norm.length < 7) return false;
  const r = parseInt(norm.slice(1, 3), 16) / 255;
  const g = parseInt(norm.slice(3, 5), 16) / 255;
  const b = parseInt(norm.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const lum = r * 0.299 + g * 0.587 + b * 0.114;
  return sat < 0.15 && lum > 0.15 && lum < 0.88;
}
