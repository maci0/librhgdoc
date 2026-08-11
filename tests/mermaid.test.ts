import { describe, test, expect } from 'bun:test';
import {
  applyRHTheme,
  extractSvgDimensions,
  RH_COLOR_MAP,
  RH_MERMAID_THEME,
  renderMermaidPng,
} from '../src/mermaid.ts';

// ─── RH_MERMAID_THEME ───────────────────────────────────────────────────────

describe('RH_MERMAID_THEME', () => {
  test('has expected keys', () => {
    expect(RH_MERMAID_THEME.bg).toBe('#ffffff');
    expect(RH_MERMAID_THEME.fg).toBe('#151515');
    expect(RH_MERMAID_THEME.accent).toBe('#ee0000');
    expect(RH_MERMAID_THEME.line).toBeDefined();
    expect(RH_MERMAID_THEME.muted).toBeDefined();
    expect(RH_MERMAID_THEME.surface).toBeDefined();
    expect(RH_MERMAID_THEME.border).toBeDefined();
  });
});

// ─── RH_COLOR_MAP ───────────────────────────────────────────────────────────

describe('RH_COLOR_MAP', () => {
  test('is a non-empty array', () => {
    expect(Array.isArray(RH_COLOR_MAP)).toBe(true);
    expect(RH_COLOR_MAP.length).toBeGreaterThan(0);
  });

  test('every entry has a valid RegExp and a string replacement', () => {
    for (const entry of RH_COLOR_MAP) {
      expect(entry.pattern).toBeInstanceOf(RegExp);
      expect(typeof entry.replacement).toBe('string');
    }
  });

  test('patterns have the global+case-insensitive flags', () => {
    for (const { pattern } of RH_COLOR_MAP) {
      expect(pattern.flags).toContain('g');
      expect(pattern.flags).toContain('i');
    }
  });

  test('replacement values are hex colours', () => {
    for (const { replacement } of RH_COLOR_MAP) {
      expect(replacement).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

// ─── applyRHTheme ───────────────────────────────────────────────────────────

describe('applyRHTheme', () => {
  test('replaces green fill colour with charcoal', () => {
    expect(applyRHTheme('fill:#bbf7d0')).toBe('fill:#383838');
  });

  test('replaces blue stroke colour with mid-gray', () => {
    expect(applyRHTheme('stroke:#3b82f6')).toBe('stroke:#707070');
  });

  test('replaces light red/pink with RH red', () => {
    expect(applyRHTheme('color:#ef4444')).toBe('color:#EE0000');
  });

  test('is case-insensitive', () => {
    expect(applyRHTheme('#DBEAFE')).toBe('#F2F2F2');
    expect(applyRHTheme('#dbeafe')).toBe('#F2F2F2');
  });

  test('replaces multiple occurrences', () => {
    const input = '#bbf7d0 #bbf7d0';
    const output = applyRHTheme(input);
    expect(output).toBe('#383838 #383838');
  });

  test('leaves unrecognised colours alone', () => {
    expect(applyRHTheme('#ABCDEF')).toBe('#ABCDEF');
  });

  test('handles empty string', () => {
    expect(applyRHTheme('')).toBe('');
  });
});

// ─── extractSvgDimensions ───────────────────────────────────────────────────

describe('extractSvgDimensions', () => {
  test('extracts integer dimensions', () => {
    const svg = '<svg width="800" height="600"></svg>';
    expect(extractSvgDimensions(svg)).toEqual({ width: 800, height: 600 });
  });

  test('extracts decimal dimensions', () => {
    const svg = '<svg width="123.5" height="456.7"></svg>';
    expect(extractSvgDimensions(svg)).toEqual({ width: 123.5, height: 456.7 });
  });

  test('returns null when width is missing', () => {
    expect(extractSvgDimensions('<svg height="100"></svg>')).toBeNull();
  });

  test('returns null when height is missing', () => {
    expect(extractSvgDimensions('<svg width="100"></svg>')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(extractSvgDimensions('')).toBeNull();
  });

  test('handles SVG with extra attributes', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768"></svg>';
    expect(extractSvgDimensions(svg)).toEqual({ width: 1024, height: 768 });
  });

  test('returns null for non-numeric width/height', () => {
    const svg = '<svg width="auto" height="100%"></svg>';
    expect(extractSvgDimensions(svg)).toBeNull();
  });

  test('handles single-quoted attributes', () => {
    const svg = "<svg width='800' height='600'></svg>";
    expect(extractSvgDimensions(svg)).toEqual({ width: 800, height: 600 });
  });
});

// ─── renderMermaidPng ───────────────────────────────────────────────────────

describe('renderMermaidPng', () => {
  let hasBeautifulMermaid = false;
  let hasResvg = false;

  // Probe for optional deps
  try {
    require.resolve('beautiful-mermaid');
    hasBeautifulMermaid = true;
  } catch {}
  try {
    require.resolve('@resvg/resvg-js');
    hasResvg = true;
  } catch {}

  if (hasBeautifulMermaid && hasResvg) {
    test('renders a simple flowchart to a PNG buffer', async () => {
      const code = 'graph TD\n  A --> B';
      const buf = await renderMermaidPng(code);
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(100);
      // PNG magic bytes
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50); // P
      expect(buf[2]).toBe(0x4e); // N
      expect(buf[3]).toBe(0x47); // G
    });

    test('accepts custom scale option', async () => {
      const code = 'graph LR\n  X --> Y';
      const buf = await renderMermaidPng(code, { scale: 1 });
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(0);
    });
  } else {
    test('skipped — beautiful-mermaid and/or @resvg/resvg-js not installed', () => {
      console.log(
        `renderMermaidPng tests skipped: ` +
          `beautiful-mermaid=${hasBeautifulMermaid}, @resvg/resvg-js=${hasResvg}`,
      );
      expect(true).toBe(true);
    });
  }
});
