/**
 * GitHub-flavored markdown admonition/callout constants.
 *
 * Provides type definitions, labels, and colour palettes for the five
 * standard admonition types (NOTE, TIP, IMPORTANT, WARNING, CAUTION).
 *
 * @module
 */

import type { RgbColor } from './colors.ts';

/** Standard admonition/callout types used in GitHub-flavored markdown. */
export type AdmonitionType = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION';

/** All valid admonition type strings. */
export const ADMONITION_TYPES: ReadonlySet<string> = new Set([
  'NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION',
]);

/** Emoji + label for each admonition type. */
export const ADMONITION_LABELS: Record<AdmonitionType, string> = {
  NOTE:      'ℹ️ NOTE',
  TIP:       '💡 TIP',
  IMPORTANT: '❗ IMPORTANT',
  WARNING:   '⚠️ WARNING',
  CAUTION:   '🔴 CAUTION',
};

/** Accent color for each admonition type (used for left borders, icons).
 * Values are sRGB 0–1 floats for the Google Docs/Slides APIs. */
export const ADMONITION_ACCENT: Record<AdmonitionType, RgbColor> = {
  NOTE:      { red: 0.0,   green: 0.306, blue: 0.486 }, // #004e7c dark blue
  TIP:       { red: 0.098, green: 0.502, blue: 0.220 }, // #198038 dark green
  IMPORTANT: { red: 0.412, green: 0.161, blue: 0.769 }, // #6929c4 purple
  WARNING:   { red: 0.620, green: 0.306, blue: 0.0   }, // #9e4e00 dark amber
  CAUTION:   { red: 0.647, green: 0.094, blue: 0.094 }, // #a51818 dark red
};

/** Background color for each admonition type (used for container fill).
 * Values are sRGB 0–1 floats for the Google Docs/Slides APIs. */
export const ADMONITION_BG: Record<AdmonitionType, RgbColor> = {
  NOTE:      { red: 0.867, green: 0.957, blue: 1.0   }, // light blue
  TIP:       { red: 0.855, green: 0.980, blue: 0.882 }, // light green
  IMPORTANT: { red: 0.984, green: 0.937, blue: 1.0   }, // light purple
  WARNING:   { red: 1.0,   green: 0.973, blue: 0.773 }, // light amber
  CAUTION:   { red: 1.0,   green: 0.922, blue: 0.918 }, // light red
};
