import { describe, test, expect } from 'bun:test';
import { parseInline, stripInline, type TextRun, type InlineSeg } from '../src/inline.ts';

describe('parseInline', () => {
  test('plain text returns single run', () => {
    const runs = parseInline('hello world');
    expect(runs).toEqual([{ text: 'hello world' }]);
  });

  test('parses bold', () => {
    const runs = parseInline('hello **bold** world');
    expect(runs).toHaveLength(3);
    expect(runs[1]).toEqual({ text: 'bold', bold: true });
  });

  test('parses italic', () => {
    const runs = parseInline('hello *italic* world');
    expect(runs).toHaveLength(3);
    expect(runs[1]).toEqual({ text: 'italic', italic: true });
  });

  test('parses inline code', () => {
    const runs = parseInline('use `const`');
    expect(runs).toHaveLength(2);
    expect(runs[1]).toEqual({ text: 'const', code: true });
  });

  test('parses links', () => {
    const runs = parseInline('click [here](https://example.com)');
    expect(runs).toHaveLength(2);
    expect(runs[1]).toEqual({ text: 'here', link: 'https://example.com' });
  });

  test('parses strikethrough', () => {
    const runs = parseInline('this is ~~deleted~~ text');
    expect(runs).toHaveLength(3);
    expect(runs[1]).toEqual({ text: 'deleted', strikethrough: true });
  });

  test('parses nested bold+italic', () => {
    const runs = parseInline('**bold *and italic***');
    expect(runs.some(r => r.bold && r.italic)).toBe(true);
  });

  test('parses bold containing code', () => {
    const runs = parseInline('**bold `code` text**');
    const codeRun = runs.find(r => r.code);
    expect(codeRun?.bold).toBe(true);
    expect(codeRun?.code).toBe(true);
  });

  test('parses bold link', () => {
    const runs = parseInline('[**bold link**](https://example.com)');
    expect(runs.some(r => r.bold && r.link === 'https://example.com')).toBe(true);
  });

  test('handles fragment links', () => {
    const runs = parseInline('[section](#my-section)');
    expect(runs[0].link).toBe('#my-section');
  });

  test('drops unsafe URL schemes', () => {
    const runs = parseInline('[bad](javascript:alert(1))');
    expect(runs[0].link).toBeUndefined();
  });

  test('allows mailto links', () => {
    const runs = parseInline('[email](mailto:a@b.com)');
    expect(runs[0].link).toBe('mailto:a@b.com');
  });

  test('handles empty string', () => {
    expect(parseInline('')).toEqual([]);
  });

  test('propagates parent bold', () => {
    const runs = parseInline('text', true, false);
    expect(runs[0].bold).toBe(true);
  });

  test('propagates parent italic', () => {
    const runs = parseInline('text', false, true);
    expect(runs[0].italic).toBe(true);
  });
});

describe('stripInline', () => {
  test('strips bold markers', () => {
    expect(stripInline('hello **bold** world')).toBe('hello bold world');
  });

  test('strips italic markers', () => {
    expect(stripInline('hello *italic* world')).toBe('hello italic world');
  });

  test('strips code markers', () => {
    expect(stripInline('use `const`')).toBe('use const');
  });

  test('strips links keeping text', () => {
    expect(stripInline('click [here](https://example.com)')).toBe('click here');
  });

  test('strips strikethrough', () => {
    expect(stripInline('~~deleted~~')).toBe('deleted');
  });

  test('strips all formatting combined', () => {
    expect(stripInline('**bold** *italic* `code` [link](url) ~~strike~~'))
      .toBe('bold italic code link strike');
  });

  test('handles plain text unchanged', () => {
    expect(stripInline('no formatting')).toBe('no formatting');
  });

  test('trims whitespace', () => {
    expect(stripInline('  spaced  ')).toBe('spaced');
  });
});

describe('parseInline edge cases', () => {
  test('unclosed bold does not crash', () => {
    const runs = parseInline('**unclosed');
    expect(runs.length).toBeGreaterThan(0);
  });

  test('unclosed italic does not crash', () => {
    const runs = parseInline('*unclosed');
    expect(runs.length).toBeGreaterThan(0);
  });

  test('stripInline removes all formatting that parseInline parses', () => {
    const input = '**bold** *italic* `code` [link](url) ~~strike~~';
    const stripped = stripInline(input);
    // stripped text should contain no markdown formatting characters
    expect(stripped).not.toContain('**');
    expect(stripped).not.toContain('`');
    expect(stripped).not.toContain('~~');
    expect(stripped).not.toContain('](');
    // parseInline and stripInline should agree on the plain text content
    const runs = parseInline(input);
    const plainFromRuns = runs.map(r => r.text).join('');
    expect(plainFromRuns).toBe(stripped);
  });
});

describe('InlineSeg type alias', () => {
  test('InlineSeg is assignable from TextRun', () => {
    const run: TextRun = { text: 'hello', bold: true };
    const seg: InlineSeg = run;
    expect(seg.text).toBe('hello');
    expect(seg.bold).toBe(true);
  });

  test('InlineSeg is assignable to TextRun', () => {
    const seg: InlineSeg = { text: 'world', italic: true };
    const run: TextRun = seg;
    expect(run.text).toBe('world');
    expect(run.italic).toBe(true);
  });
});
