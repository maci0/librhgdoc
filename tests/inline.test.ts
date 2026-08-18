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

describe('parseInline additional edge cases', () => {
  test('empty link URL produces output without link', () => {
    const runs = parseInline('[text]()');
    expect(runs.length).toBeGreaterThan(0);
    // Empty URL "()" — urlEnd === close + 2 so it won't match as link
    const allText = runs.map(r => r.text).join('');
    expect(allText).toContain('text');
  });

  test('single tilde is plain text', () => {
    const runs = parseInline('hello~world');
    // Single ~ is not strikethrough — no run should have strikethrough set
    expect(runs.every(r => !r.strikethrough)).toBe(true);
    expect(runs.map(r => r.text).join('')).toBe('hello~world');
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

describe('parseInline backslash escapes', () => {
  test('\\* produces literal asterisk, not italic', () => {
    const runs = parseInline('\\*not italic\\*');
    const allText = runs.map(r => r.text).join('');
    expect(allText).toBe('*not italic*');
    expect(runs.every(r => !r.italic)).toBe(true);
  });

  test('\\\\  produces literal backslash', () => {
    const runs = parseInline('\\\\');
    expect(runs).toEqual([{ text: '\\' }]);
  });

  test('\\` produces literal backtick, not code', () => {
    const runs = parseInline('\\`not code\\`');
    const allText = runs.map(r => r.text).join('');
    expect(allText).toBe('`not code`');
    expect(runs.every(r => !r.code)).toBe(true);
  });

  test('\\~ produces literal tilde', () => {
    const runs = parseInline('\\~not strike\\~');
    const allText = runs.map(r => r.text).join('');
    expect(allText).toBe('~not strike~');
    expect(runs.every(r => !r.strikethrough)).toBe(true);
  });

  test('escape before bold marker: \\** is literal *', () => {
    const runs = parseInline('\\**not bold');
    const allText = runs.map(r => r.text).join('');
    expect(allText).toContain('*');
  });

  test('escape inside formatted text', () => {
    const runs = parseInline('**bold with \\* literal**');
    const boldRuns = runs.filter(r => r.bold);
    const allBoldText = boldRuns.map(r => r.text).join('');
    expect(allBoldText).toContain('*');
    expect(allBoldText).toContain('bold with');
  });
});

describe('parseInline underscore variants', () => {
  test('__bold__ produces bold run', () => {
    const runs = parseInline('hello __bold__ world');
    expect(runs).toHaveLength(3);
    expect(runs[1]).toEqual({ text: 'bold', bold: true });
  });

  test('_italic_ produces italic run', () => {
    const runs = parseInline('hello _italic_ world');
    expect(runs).toHaveLength(3);
    expect(runs[1]).toEqual({ text: 'italic', italic: true });
  });

  test('**bold** and __also bold__ both produce bold', () => {
    const runs = parseInline('**star** and __under__');
    const boldRuns = runs.filter(r => r.bold);
    expect(boldRuns).toHaveLength(2);
    expect(boldRuns[0].text).toBe('star');
    expect(boldRuns[1].text).toBe('under');
  });

  test('word-internal underscores do NOT trigger italic', () => {
    const runs = parseInline('snake_case_name');
    expect(runs).toHaveLength(1);
    expect(runs[0]).toEqual({ text: 'snake_case_name' });
    expect(runs[0].italic).toBeUndefined();
  });

  test('double underscore inside word does NOT trigger bold', () => {
    const runs = parseInline('my__var__name');
    expect(runs.every(r => !r.bold)).toBe(true);
    const allText = runs.map(r => r.text).join('');
    expect(allText).toBe('my__var__name');
  });

  test('underscore italic at start of string', () => {
    const runs = parseInline('_italic_ text');
    expect(runs[0]).toEqual({ text: 'italic', italic: true });
  });

  test('underscore italic at end of string', () => {
    const runs = parseInline('text _italic_');
    const lastStyled = runs.find(r => r.italic);
    expect(lastStyled?.text).toBe('italic');
  });

  test('__bold with _italic_ inside__', () => {
    const runs = parseInline('__bold _italic_ text__');
    expect(runs.some(r => r.bold && !r.italic)).toBe(true);
    expect(runs.some(r => r.bold && r.italic)).toBe(true);
  });

  test('underscore after punctuation triggers italic', () => {
    const runs = parseInline('hello, _italic_ world');
    expect(runs.some(r => r.italic)).toBe(true);
  });
});

describe('parseInline image passthrough', () => {
  test('![alt](url) produces plain alt text', () => {
    const runs = parseInline('text ![image](https://example.com/img.png) more');
    const allText = runs.map(r => r.text).join('');
    expect(allText).toBe('text image more');
    expect(runs.every(r => !r.link)).toBe(true);
  });

  test('![](url) with empty alt produces no extra run', () => {
    const runs = parseInline('before ![](url) after');
    const allText = runs.map(r => r.text).join('');
    expect(allText).toBe('before  after');
  });

  test('![alt](url) is not confused with [link](url)', () => {
    const runs = parseInline('[link](https://a.com) and ![img](https://b.com/x.png)');
    expect(runs.some(r => r.link === 'https://a.com')).toBe(true);
    const allText = runs.map(r => r.text).join('');
    expect(allText).toContain('link');
    expect(allText).toContain('img');
  });
});

describe('stripInline extended', () => {
  test('strips backslash escapes', () => {
    expect(stripInline('\\*literal\\*')).toBe('*literal*');
  });

  test('strips __bold__ markers', () => {
    expect(stripInline('__bold__')).toBe('bold');
  });

  test('strips _italic_ markers', () => {
    expect(stripInline('_italic_ text')).toBe('italic text');
  });

  test('strips ![alt](url) to alt text', () => {
    expect(stripInline('see ![diagram](img.png) here')).toBe('see diagram here');
  });

  test('preserves snake_case_name', () => {
    expect(stripInline('my_var_name')).toBe('my_var_name');
  });

  test('strips \\\\  to single backslash', () => {
    expect(stripInline('path\\\\file')).toBe('path\\file');
  });

  test('strips all new + old formatting combined', () => {
    const input = '**bold** __under__ *italic* _under2_ `code` [link](url) ![img](src) ~~strike~~';
    const result = stripInline(input);
    expect(result).not.toContain('**');
    expect(result).not.toContain('__');
    expect(result).not.toContain('`');
    expect(result).not.toContain('~~');
    expect(result).not.toContain('](');
    expect(result).not.toContain('![');
  });
});

describe('parseInline italic/bold nesting', () => {
  test('*italic **bold** italic* — italic wrapping bold', () => {
    const runs = parseInline('*italic **bold** italic*');
    // Should have italic runs and a bold+italic run, no leaked * chars
    const allText = runs.map(r => r.text).join('');
    expect(allText).not.toContain('*');
    expect(runs.some(r => r.italic && !r.bold)).toBe(true);
    expect(runs.some(r => r.bold && r.italic)).toBe(true);
  });

  test('**bold *italic* bold** — bold wrapping italic', () => {
    const runs = parseInline('**bold *italic* bold**');
    const allText = runs.map(r => r.text).join('');
    expect(allText).not.toContain('*');
    expect(runs.some(r => r.bold && !r.italic)).toBe(true);
    expect(runs.some(r => r.bold && r.italic)).toBe(true);
  });
});
