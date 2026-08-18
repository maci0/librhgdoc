import { describe, test, expect } from 'bun:test';
import {
  pt,
  emu,
  rgbColor,
  opaqueColor,
  wff,
  optionalColor,
  toEmu,
  batchUpdate,
  EMU_PER_PX,
  SLIDE_W_PX,
  SLIDE_H_PX,
  GOOGLE_ID_RE,
  extractGoogleId,
  type BatchUpdateRequest,
} from '../src/google-api.ts';

// ─── Dimension helpers ──────────────────────────────────────────────────────

describe('pt', () => {
  test('creates a point dimension', () => {
    expect(pt(12)).toEqual({ magnitude: 12, unit: 'PT' });
  });

  test('handles zero', () => {
    expect(pt(0)).toEqual({ magnitude: 0, unit: 'PT' });
  });

  test('handles decimal values', () => {
    expect(pt(10.5)).toEqual({ magnitude: 10.5, unit: 'PT' });
  });
});

describe('emu', () => {
  test('creates an EMU dimension', () => {
    expect(emu(9525)).toEqual({ magnitude: 9525, unit: 'EMU' });
  });

  test('handles zero', () => {
    expect(emu(0)).toEqual({ magnitude: 0, unit: 'EMU' });
  });
});

// ─── Colour helpers ─────────────────────────────────────────────────────────

describe('rgbColor', () => {
  test('creates correct RGB object', () => {
    expect(rgbColor(0.5, 0.25, 0.75)).toEqual({ red: 0.5, green: 0.25, blue: 0.75 });
  });

  test('handles 0 and 1 extremes', () => {
    expect(rgbColor(0, 0, 0)).toEqual({ red: 0, green: 0, blue: 0 });
    expect(rgbColor(1, 1, 1)).toEqual({ red: 1, green: 1, blue: 1 });
  });
});

describe('opaqueColor', () => {
  test('wraps RGB in Slides API envelope', () => {
    const result = opaqueColor(0.9, 0, 0);
    expect(result).toEqual({
      rgbColor: { red: 0.9, green: 0, blue: 0 },
    });
  });

  test('returns nested structure', () => {
    const result = opaqueColor(1, 1, 1);
    expect(result.rgbColor.red).toBe(1);
    expect(result.rgbColor.green).toBe(1);
    expect(result.rgbColor.blue).toBe(1);
  });
});

// ─── Constants ──────────────────────────────────────────────────────────────

describe('constants', () => {
  test('EMU_PER_PX is 9525', () => {
    expect(EMU_PER_PX).toBe(9525);
  });

  test('SLIDE_W_PX is 1280', () => {
    expect(SLIDE_W_PX).toBe(1280);
  });

  test('SLIDE_H_PX is 720', () => {
    expect(SLIDE_H_PX).toBe(720);
  });
});

// ─── toEmu ──────────────────────────────────────────────────────────────────

describe('toEmu', () => {
  test('converts pixel number to EMU', () => {
    expect(toEmu(100, 1280, 0)).toBe(100 * 9525);
  });

  test('converts pixel string to EMU', () => {
    expect(toEmu('200', 1280, 0)).toBe(200 * 9525);
  });

  test('converts percentage string relative to base', () => {
    expect(toEmu('50%', 1280, 0)).toBe(Math.round(0.5 * 1280 * 9525));
  });

  test('converts 100% to full base', () => {
    expect(toEmu('100%', 720, 0)).toBe(Math.round(720 * 9525));
  });

  test('returns defaultValue for undefined', () => {
    expect(toEmu(undefined, 1280, 42)).toBe(42);
  });

  test('returns defaultValue for non-finite strings', () => {
    expect(toEmu('abc', 1280, 99)).toBe(99);
  });

  test('handles zero', () => {
    expect(toEmu(0, 1280, 5000)).toBe(0);
  });

  test('handles whitespace in string', () => {
    expect(toEmu('  50  ', 1280, 0)).toBe(50 * 9525);
  });
});

// ─── batchUpdate ────────────────────────────────────────────────────────────

describe('batchUpdate', () => {
  test('returns empty array when no requests', async () => {
    const result = await batchUpdate({
      url: 'https://example.com/batch',
      token: 'tok',
      requests: [],
    });
    expect(result).toEqual([]);
  });

  test('sends all requests in one chunk when under chunkSize', async () => {
    const origFetch = globalThis.fetch;
    let callCount = 0;
    let capturedBody: any;
    globalThis.fetch = (async (_url: any, init: any) => {
      callCount++;
      capturedBody = JSON.parse(init.body);
      return new Response(JSON.stringify({ replies: [] }), { status: 200 });
    }) as typeof fetch;

    try {
      const requests: BatchUpdateRequest[] = [
        { insertText: { text: 'a' } },
        { insertText: { text: 'b' } },
      ];
      const result = await batchUpdate({
        url: 'https://docs.googleapis.com/v1/documents/123:batchUpdate',
        token: 'my-token',
        requests,
        chunkSize: 200,
      });
      expect(callCount).toBe(1);
      expect(capturedBody.requests).toHaveLength(2);
      expect(result).toHaveLength(1);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('chunks requests correctly', async () => {
    const origFetch = globalThis.fetch;
    const chunkSizes: number[] = [];
    globalThis.fetch = (async (_url: any, init: any) => {
      const body = JSON.parse(init.body);
      chunkSizes.push(body.requests.length);
      return new Response(JSON.stringify({ replies: [] }), { status: 200 });
    }) as typeof fetch;

    try {
      const requests: BatchUpdateRequest[] = Array.from({ length: 5 }, (_, i) => ({
        op: i,
      }));
      const result = await batchUpdate({
        url: 'https://example.com/batch',
        token: 'tok',
        requests,
        chunkSize: 2,
      });
      expect(chunkSizes).toEqual([2, 2, 1]); // 5 items in chunks of 2
      expect(result).toHaveLength(3);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('sends Authorization header', async () => {
    const origFetch = globalThis.fetch;
    let capturedHeaders: any;
    globalThis.fetch = (async (_url: any, init: any) => {
      capturedHeaders = init.headers;
      return new Response(JSON.stringify({ replies: [] }), { status: 200 });
    }) as typeof fetch;

    try {
      await batchUpdate({
        url: 'https://example.com/batch',
        token: 'secret-token',
        requests: [{ op: 1 }],
      });
      expect(capturedHeaders.Authorization).toBe('Bearer secret-token');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('throws on non-OK response', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response('Not Found', { status: 404 })) as unknown as typeof fetch;

    try {
      await expect(
        batchUpdate({
          url: 'https://example.com/batch',
          token: 'tok',
          requests: [{ op: 1 }],
        }),
      ).rejects.toThrow('batchUpdate failed (404)');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('defaults chunkSize to 200', async () => {
    const origFetch = globalThis.fetch;
    const chunkSizes: number[] = [];
    globalThis.fetch = (async (_url: any, init: any) => {
      const body = JSON.parse(init.body);
      chunkSizes.push(body.requests.length);
      return new Response(JSON.stringify({ replies: [] }), { status: 200 });
    }) as typeof fetch;

    try {
      const requests = Array.from({ length: 250 }, (_, i) => ({ op: i }));
      await batchUpdate({
        url: 'https://example.com/batch',
        token: 'tok',
        requests,
      });
      expect(chunkSizes).toEqual([200, 50]);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

// ─── wff ───────────────────────────────────────────────────────────────────

describe('wff', () => {
  test('creates WeightedFontFamily with default weight', () => {
    expect(wff('Roboto')).toEqual({ fontFamily: 'Roboto', weight: 400 });
  });

  test('creates WeightedFontFamily with custom weight', () => {
    expect(wff('Roboto', 700)).toEqual({ fontFamily: 'Roboto', weight: 700 });
  });

  test('handles empty font name', () => {
    expect(wff('')).toEqual({ fontFamily: '', weight: 400 });
  });
});

// ─── optionalColor ─────────────────────────────────────────────────────────

describe('optionalColor', () => {
  test('wraps RgbColor in Docs API OptionalColor envelope', () => {
    const result = optionalColor({ red: 0.9, green: 0, blue: 0 });
    expect(result).toEqual({
      color: { rgbColor: { red: 0.9, green: 0, blue: 0 } },
    });
  });

  test('returns nested structure with correct path', () => {
    const result = optionalColor({ red: 1, green: 1, blue: 1 });
    expect(result.color.rgbColor.red).toBe(1);
    expect(result.color.rgbColor.green).toBe(1);
    expect(result.color.rgbColor.blue).toBe(1);
  });

  test('preserves the input color reference', () => {
    const c = { red: 0.5, green: 0.25, blue: 0.75 };
    const result = optionalColor(c);
    expect(result.color.rgbColor).toBe(c);
  });
});

// ─── GOOGLE_ID_RE ─────────────────────────────────────────────────────────────

describe('GOOGLE_ID_RE', () => {
  test('matches a valid Google document ID', () => {
    expect(GOOGLE_ID_RE.test('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms')).toBe(true);
  });

  test('rejects short strings', () => {
    expect(GOOGLE_ID_RE.test('short')).toBe(false);
  });

  test('rejects strings with spaces', () => {
    expect(GOOGLE_ID_RE.test('1BxiMVs0XRA5nFMdKvBdBZjgmUU qptlbs74OgVE2upms')).toBe(false);
  });
});

// ─── extractGoogleId ─────────────────────────────────────────────────────────

describe('extractGoogleId', () => {
  test('extracts ID from Google Docs URL', () => {
    const url = 'https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit';
    expect(extractGoogleId(url)).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms');
  });

  test('extracts ID from Google Slides URL', () => {
    const url = 'https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit';
    expect(extractGoogleId(url)).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms');
  });

  test('accepts a bare valid ID', () => {
    const id = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms';
    expect(extractGoogleId(id)).toBe(id);
  });

  test('returns null for invalid input', () => {
    expect(extractGoogleId('not-a-valid-id')).toBe(null);
  });

  test('returns null for empty string', () => {
    expect(extractGoogleId('')).toBe(null);
  });

  test('extracts ID from Drive URL with /d/ path', () => {
    const url = 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/view';
    expect(extractGoogleId(url)).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms');
  });

  test('extracts ID from full Google Docs URL', () => {
    expect(extractGoogleId('https://docs.google.com/document/d/1a2b3c4d5e6f7g8h9i0j1k2l3m4n/edit'))
      .toBe('1a2b3c4d5e6f7g8h9i0j1k2l3m4n');
  });

  test('extracts ID from full Google Slides URL', () => {
    expect(extractGoogleId('https://docs.google.com/presentation/d/1a2b3c4d5e6f7g8h9i0j1k2l3m4n/edit'))
      .toBe('1a2b3c4d5e6f7g8h9i0j1k2l3m4n');
  });

  test('returns null for invalid short string', () => {
    expect(extractGoogleId('too-short')).toBe(null);
  });

  test('returns null for URL with too-short ID', () => {
    expect(extractGoogleId('https://example.com/d/abc')).toBe(null);
  });
});
