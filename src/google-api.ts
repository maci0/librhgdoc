/**
 * Google API batch-update helpers.
 *
 * Lightweight wrappers for Google Docs / Slides batch-update calls and
 * dimension/colour constructors.  Uses native `fetch()` — no dependency
 * on `googleapis`.
 */

// ─── Interfaces ──────────────────────────────────────────────────────────────

/** A single request object in a Google API batch update. */
export interface BatchUpdateRequest {
  [key: string]: unknown;
}

/** Response from a Google API batch update call. */
export interface BatchUpdateResponse {
  replies?: unknown[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** EMU (English Metric Units) per CSS pixel (at 96 dpi). */
export const EMU_PER_PX = 9525;

/** Standard Google Slides page width in CSS pixels. */
export const SLIDE_W_PX = 1280;

/** Standard Google Slides page height in CSS pixels. */
export const SLIDE_H_PX = 720;

// ─── Batch update ────────────────────────────────────────────────────────────

/**
 * Send batch-update requests to a Google API endpoint in chunks.
 *
 * Splits `requests` into groups of `chunkSize` (default 200) and POSTs each
 * group as `{ requests: [...] }` with a Bearer token.  Returns one
 * {@link BatchUpdateResponse} per chunk.
 *
 * @throws On non-OK HTTP responses.
 */
export async function batchUpdate(options: {
  /** Full URL of the batchUpdate endpoint (e.g. `https://docs.googleapis.com/v1/documents/{id}:batchUpdate`). */
  url: string;
  /** OAuth2 access token. */
  token: string;
  /** Array of request objects. */
  requests: BatchUpdateRequest[];
  /** Maximum requests per HTTP call (default 200). */
  chunkSize?: number;
}): Promise<BatchUpdateResponse[]> {
  const { url, token, requests, chunkSize = 200 } = options;
  if (requests.length === 0) return [];

  const results: BatchUpdateResponse[] = [];
  for (let i = 0; i < requests.length; i += chunkSize) {
    const chunk = requests.slice(i, i + chunkSize);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: chunk }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `batchUpdate failed (${res.status}): ${text}`,
      );
    }
    results.push((await res.json()) as BatchUpdateResponse);
  }
  return results;
}

// ─── Dimension helpers ───────────────────────────────────────────────────────

/**
 * Create a dimension object in **points**.
 *
 * Used by the Google Docs API for font sizes, margins, padding, etc.
 */
export function pt(n: number): { magnitude: number; unit: string } {
  return { magnitude: n, unit: 'PT' };
}

/**
 * Create a dimension object in **EMU** (English Metric Units).
 *
 * Used by the Google Slides API for element sizes and positions.
 */
export function emu(n: number): { magnitude: number; unit: string } {
  return { magnitude: n, unit: 'EMU' };
}

// ─── Colour helpers ─────────────────────────────────────────────────────────

/**
 * Create an RGB colour object with channels in the 0–1 range.
 *
 * Complements the colour utilities in the `colors` module.
 */
export function rgbColor(
  r: number,
  g: number,
  b: number,
): { red: number; green: number; blue: number } {
  return { red: r, green: g, blue: b };
}

/**
 * Create an opaque-colour wrapper used by the Google Slides API.
 *
 * Wraps an RGB triple in the `{ rgbColor: … }` envelope that many
 * Slides-API style fields expect.
 */
export function opaqueColor(
  r: number,
  g: number,
  b: number,
): { rgbColor: { red: number; green: number; blue: number } } {
  return { rgbColor: { red: r, green: g, blue: b } };
}

/** Create a WeightedFontFamily object for Google Docs/Slides API. */
export function wff(fontFamily: string, weight = 400): { fontFamily: string; weight: number } {
  return { fontFamily, weight };
}

/** Wrap an RgbColor in the OptionalColor envelope used by the Docs API. */
export function optionalColor(color: { red: number; green: number; blue: number }): { color: { rgbColor: { red: number; green: number; blue: number } } } {
  return { color: { rgbColor: color } };
}

// ─── Google ID extraction ───────────────────────────────────────────────────

/** Regex matching a bare Google Doc/Slides/Drive ID (25+ alphanumeric chars + hyphens/underscores). */
export const GOOGLE_ID_RE = /^[a-zA-Z0-9_-]{25,}$/;

/** Extract a Google Doc/Slides/Drive file ID from a URL or validate a bare ID string.
 * Accepts full URLs like `https://docs.google.com/document/d/ID/edit` or bare IDs. */
export function extractGoogleId(input: string): string | null {
  const m = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m && GOOGLE_ID_RE.test(m[1])) return m[1];
  return GOOGLE_ID_RE.test(input) ? input : null;
}

// ─── Unit conversion ─────────────────────────────────────────────────────────

/**
 * Convert a pixel, percentage, or undefined value to EMU.
 *
 * - A plain number (or numeric string) is treated as CSS pixels.
 * - A string ending with `%` is resolved relative to `base` (in pixels).
 * - `undefined` or non-finite values fall back to `defaultValue` (in EMU).
 *
 * @param value        — The value to convert.
 * @param base         — Base dimension in pixels (used for percentage calc).
 * @param defaultValue — Fallback in EMU when `value` is undefined / invalid.
 */
export function toEmu(
  value: number | string | undefined,
  base: number,
  defaultValue: number,
): number {
  if (value === undefined) return defaultValue;
  const s = String(value).trim();
  const parsed = parseFloat(s);
  if (!Number.isFinite(parsed)) return defaultValue;
  if (s.endsWith('%')) return Math.round((parsed / 100) * base * EMU_PER_PX);
  return Math.round(parsed * EMU_PER_PX);
}
