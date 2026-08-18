import { describe, test, expect } from 'bun:test';
import {
  tokenize,
  getSupportedLanguages,
  HIGHLIGHT_COLORS,
  DARK_HIGHLIGHT_COLORS,
} from '../src/highlight.ts';

// ─── HIGHLIGHT_COLORS ─────────────────────────────────────────────────────────

describe('HIGHLIGHT_COLORS', () => {
  test('is a non-empty object', () => {
    expect(typeof HIGHLIGHT_COLORS).toBe('object');
    expect(Object.keys(HIGHLIGHT_COLORS).length).toBeGreaterThan(0);
  });

  test('has entries for common token types', () => {
    expect(HIGHLIGHT_COLORS['hljs-keyword']).toBeDefined();
    expect(HIGHLIGHT_COLORS['hljs-string']).toBeDefined();
    expect(HIGHLIGHT_COLORS['hljs-comment']).toBeDefined();
    expect(HIGHLIGHT_COLORS['hljs-number']).toBeDefined();
    expect(HIGHLIGHT_COLORS['hljs-literal']).toBeDefined();
    expect(HIGHLIGHT_COLORS['hljs-title']).toBeDefined();
    expect(HIGHLIGHT_COLORS['hljs-built_in']).toBeDefined();
    expect(HIGHLIGHT_COLORS['hljs-variable']).toBeDefined();
    expect(HIGHLIGHT_COLORS['hljs-type']).toBeDefined();
  });

  test('all values are hex colour strings', () => {
    for (const [key, value] of Object.entries(HIGHLIGHT_COLORS)) {
      expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  test('all keys start with hljs-', () => {
    for (const key of Object.keys(HIGHLIGHT_COLORS)) {
      expect(key.startsWith('hljs-')).toBe(true);
    }
  });
});

// ─── Probe for highlight.js ──────────────────────────────────────────────────

let hasHljs = false;
try {
  require('highlight.js');
  hasHljs = true;
} catch {}

// ─── getSupportedLanguages ────────────────────────────────────────────────────

describe('getSupportedLanguages', () => {
  if (hasHljs) {
    test('returns a non-empty array of language names', () => {
      const langs = getSupportedLanguages();
      expect(Array.isArray(langs)).toBe(true);
      expect(langs.length).toBeGreaterThan(0);
    });

    test('includes common languages', () => {
      const langs = getSupportedLanguages();
      expect(langs).toContain('javascript');
      expect(langs).toContain('python');
      expect(langs).toContain('typescript');
    });
  } else {
    test('returns empty array when highlight.js is not installed', () => {
      const langs = getSupportedLanguages();
      expect(langs).toEqual([]);
    });
  }
});

// ─── tokenize ─────────────────────────────────────────────────────────────────

describe('tokenize', () => {
  if (hasHljs) {
    test('returns runs for JavaScript code', () => {
      const result = tokenize('const x = 42;', 'javascript');
      expect(result.runs.length).toBeGreaterThan(0);
      expect(result.language).toBe('javascript');

      // Concatenated run text should equal original code
      const text = result.runs.map((r) => r.text).join('');
      expect(text).toBe('const x = 42;');
    });

    test('returns runs for Python code', () => {
      const result = tokenize('def hello():\n  print("world")', 'python');
      expect(result.runs.length).toBeGreaterThan(0);
      expect(result.language).toBe('python');

      const text = result.runs.map((r) => r.text).join('');
      expect(text).toBe('def hello():\n  print("world")');
    });

    test('auto-detects language when not specified', () => {
      const result = tokenize('function hello() { return 42; }');
      expect(result.runs.length).toBeGreaterThan(0);
      expect(result.language).toBeDefined();
    });

    test('each run has text and color properties', () => {
      const result = tokenize('const x = 42;', 'javascript');
      for (const run of result.runs) {
        expect(typeof run.text).toBe('string');
        expect(typeof run.color).toBe('string');
        expect(run.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    test('uses keyword color for language keywords', () => {
      const result = tokenize('const x = 42;', 'javascript');
      const keywordRun = result.runs.find((r) => r.text === 'const');
      // 'const' should be highlighted as a keyword
      if (keywordRun) {
        expect(keywordRun.color).toBe(HIGHLIGHT_COLORS['hljs-keyword']);
      }
    });

    test('handles unknown language gracefully', () => {
      const result = tokenize('some random text', 'nonexistentlang42');
      expect(result.runs.length).toBeGreaterThan(0);
      const text = result.runs.map((r) => r.text).join('');
      expect(text).toBe('some random text');
    });

    test('handles empty code', () => {
      const result = tokenize('', 'javascript');
      // Should return at least one empty run or no runs
      const text = result.runs.map((r) => r.text).join('');
      expect(text).toBe('');
    });

    test('handles HTML entities in code correctly', () => {
      const result = tokenize('x < y && z > w', 'javascript');
      const text = result.runs.map((r) => r.text).join('');
      expect(text).toContain('<');
      expect(text).toContain('>');
      expect(text).toContain('&&');
    });

    test('handles code with strings containing special characters', () => {
      const code = 'const s = "hello <world>"';
      const result = tokenize(code, 'javascript');
      const text = result.runs.map((r) => r.text).join('');
      expect(text).toBe(code);
    });
  } else {
    test('skipped — highlight.js not installed', () => {
      console.log('tokenize tests skipped: highlight.js not installed');
      const result = tokenize('const x = 42;', 'javascript');
      expect(result.runs).toHaveLength(1);
      expect(result.runs[0].text).toBe('const x = 42;');
      expect(result.language).toBe('javascript');
    });
  }
});

// ─── DARK_HIGHLIGHT_COLORS ───────────────────────────────────────────────────

describe('DARK_HIGHLIGHT_COLORS', () => {
  test('is a non-empty object', () => {
    expect(typeof DARK_HIGHLIGHT_COLORS).toBe('object');
    expect(Object.keys(DARK_HIGHLIGHT_COLORS).length).toBeGreaterThan(0);
  });

  test('has entries for common token types', () => {
    expect(DARK_HIGHLIGHT_COLORS['hljs-keyword']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-string']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-comment']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-number']).toBeDefined();
  });

  test('has entries for extended token types', () => {
    expect(DARK_HIGHLIGHT_COLORS['hljs-built_in']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-literal']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-title']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-name']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-variable']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-template-variable']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-type']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-class']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-symbol']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-regexp']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-addition']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-deletion']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-selector-class']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-selector-id']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-selector-tag']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-tag']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-template-tag']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-bullet']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-link']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-doctag']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-section']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-attr']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-attribute']).toBeDefined();
    expect(DARK_HIGHLIGHT_COLORS['hljs-meta']).toBeDefined();
  });

  test('has at least 26 entries', () => {
    expect(Object.keys(DARK_HIGHLIGHT_COLORS).length).toBeGreaterThanOrEqual(26);
  });

  test('all values are hex colour strings', () => {
    for (const [, value] of Object.entries(DARK_HIGHLIGHT_COLORS)) {
      expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  test('uses Red Hat red for keywords', () => {
    expect(DARK_HIGHLIGHT_COLORS['hljs-keyword']).toBe('#ee0000');
  });

  test('differs from HIGHLIGHT_COLORS', () => {
    expect(DARK_HIGHLIGHT_COLORS['hljs-keyword']).not.toBe(HIGHLIGHT_COLORS['hljs-keyword']);
  });
});

// ─── tokenize with custom colorMap ───────────────────────────────────────────

describe('tokenize with custom colorMap', () => {
  if (hasHljs) {
    test('uses custom color map for token coloring', () => {
      const customMap: Record<string, string> = {
        'hljs-keyword': '#ff0000',
      };
      const result = tokenize('const x = 42;', 'javascript', customMap);
      const keywordRun = result.runs.find((r) => r.text === 'const');
      if (keywordRun) {
        expect(keywordRun.color).toBe('#ff0000');
      }
    });

    test('uses DARK_HIGHLIGHT_COLORS as colorMap', () => {
      const result = tokenize('const x = 42;', 'javascript', DARK_HIGHLIGHT_COLORS);
      const keywordRun = result.runs.find((r) => r.text === 'const');
      if (keywordRun) {
        expect(keywordRun.color).toBe(DARK_HIGHLIGHT_COLORS['hljs-keyword']);
      }
    });

    test('falls back to default color for unmapped tokens', () => {
      const result = tokenize('const x = 42;', 'javascript', {});
      // All runs should fall back to default color #24292e
      for (const run of result.runs) {
        expect(run.color).toBe('#24292e');
      }
    });

    test('preserves text content regardless of color map', () => {
      const code = 'const x = 42;';
      const defaultResult = tokenize(code, 'javascript');
      const darkResult = tokenize(code, 'javascript', DARK_HIGHLIGHT_COLORS);
      const defaultText = defaultResult.runs.map((r) => r.text).join('');
      const darkText = darkResult.runs.map((r) => r.text).join('');
      expect(defaultText).toBe(darkText);
    });
  } else {
    test('returns single run when highlight.js not installed (colorMap ignored)', () => {
      const result = tokenize('const x = 42;', 'javascript', DARK_HIGHLIGHT_COLORS);
      expect(result.runs).toHaveLength(1);
      expect(result.runs[0].text).toBe('const x = 42;');
    });
  }
});
