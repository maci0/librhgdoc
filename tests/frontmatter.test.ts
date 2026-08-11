import { describe, test, expect } from 'bun:test';
import {
  parseFrontmatter,
  stringifyFrontmatter,
  extractFrontmatter,
  replaceFrontmatter,
} from '../src/frontmatter.ts';

describe('parseFrontmatter', () => {
  test('parses simple key-value pairs', () => {
    const result = parseFrontmatter('title: Hello\nauthor: Alice');
    expect(result.title).toBe('Hello');
    expect(result.author).toBe('Alice');
  });

  test('strips quotes from values', () => {
    const result = parseFrontmatter('title: "Quoted Value"');
    expect(result.title).toBe('Quoted Value');
  });

  test('parses inline arrays with double quotes', () => {
    const result = parseFrontmatter('tags: ["foo", "bar"]');
    expect(result.tags).toEqual(['foo', 'bar']);
  });

  test('parses inline arrays with single quotes', () => {
    const result = parseFrontmatter("tags: ['foo', 'bar']");
    expect(result.tags).toEqual(['foo', 'bar']);
  });

  test('parses unquoted inline arrays', () => {
    const result = parseFrontmatter('tags: [foo, bar, baz]');
    expect(result.tags).toEqual(['foo', 'bar', 'baz']);
  });

  test('parses block sequence of scalars', () => {
    const result = parseFrontmatter('authors:\n  - Alice\n  - Bob');
    expect(result.authors).toEqual(['Alice', 'Bob']);
  });

  test('parses block sequence of objects', () => {
    const result = parseFrontmatter(
      'presenters:\n  - name: Alice\n    role: dev\n  - name: Bob\n    role: pm',
    );
    expect(result.presenters).toEqual([
      { name: 'Alice', role: 'dev' },
      { name: 'Bob', role: 'pm' },
    ]);
  });

  test('skips comments', () => {
    const result = parseFrontmatter('# comment\ntitle: Test');
    expect(result.title).toBe('Test');
  });

  test('handles empty input', () => {
    expect(parseFrontmatter('')).toEqual({});
  });

  test('handles keys with hyphens', () => {
    const result = parseFrontmatter('gdoc-id: abc123');
    expect(result['gdoc-id']).toBe('abc123');
  });

  test('parses mixed quoted/unquoted inline array', () => {
    const result = parseFrontmatter('tags: ["a", b, "c"]');
    expect(result.tags).toEqual(['a', 'b', 'c']);
  });

  test('parses inline array with all unquoted', () => {
    const result = parseFrontmatter('items: [x, y, z]');
    expect(result.items).toEqual(['x', 'y', 'z']);
  });

  test('treats unclosed inline array as scalar', () => {
    const result = parseFrontmatter('tags: [a, b');
    expect(result.tags).toBe('[a, b');
  });
});

describe('stringifyFrontmatter', () => {
  test('serialises scalars', () => {
    const out = stringifyFrontmatter({ title: 'Hello', version: '1.0' });
    expect(out).toContain('title: Hello');
    expect(out).toContain('version: "1.0"');  // numeric-like → quoted
    expect(out).not.toContain('---');
  });

  test('serialises arrays', () => {
    const out = stringifyFrontmatter({ tags: ['a', 'b'] });
    expect(out).toContain('tags:\n  - a\n  - b');
  });

  test('serialises object arrays', () => {
    const out = stringifyFrontmatter({
      people: [{ name: 'Alice', role: 'dev' }],
    });
    expect(out).toContain('  - name: Alice');
    expect(out).toContain('    role: dev');
  });

  test('skips undefined/null values', () => {
    const out = stringifyFrontmatter({ title: 'Hi', skip: undefined, also: null });
    expect(out).not.toContain('skip');
    expect(out).not.toContain('also');
  });

  test('quotes empty strings', () => {
    const out = stringifyFrontmatter({ empty: '' });
    expect(out).toContain('empty: ""');
  });

  test('quotes boolean-like strings', () => {
    const out = stringifyFrontmatter({ flag: 'true' });
    expect(out).toContain('flag: "true"');
  });

  test('quotes boolean-like values in arrays', () => {
    const out = stringifyFrontmatter({ tags: ['true', 'false', 'null'] });
    expect(out).toContain('"true"');
    expect(out).toContain('"false"');
    expect(out).toContain('"null"');
  });

  test('quotes numeric-like values in arrays', () => {
    const out = stringifyFrontmatter({ nums: ['42', '3.14'] });
    expect(out).toContain('"42"');
    expect(out).toContain('"3.14"');
  });

  test('quotes values in object arrays', () => {
    const out = stringifyFrontmatter({ people: [{ name: 'true' }] });
    expect(out).toContain('"true"');
  });
});

describe('extractFrontmatter', () => {
  test('extracts frontmatter and body', () => {
    const md = '---\ntitle: Test\n---\n# Hello';
    const result = extractFrontmatter(md);
    expect(result).not.toBeNull();
    expect(result!.frontmatter).toBe('title: Test');
    expect(result!.body).toBe('# Hello');
  });

  test('returns null when no frontmatter', () => {
    expect(extractFrontmatter('# Just a heading')).toBeNull();
  });

  test('returns null for unclosed frontmatter', () => {
    expect(extractFrontmatter('---\ntitle: Test\n# No closing')).toBeNull();
  });

  test('handles empty body', () => {
    const result = extractFrontmatter('---\ntitle: X\n---\n');
    expect(result).not.toBeNull();
    expect(result!.body).toBe('');
  });

  test('handles multi-line frontmatter', () => {
    const md = '---\ntitle: A\nauthor: B\ndate: 2024-01-01\n---\nBody text';
    const result = extractFrontmatter(md);
    expect(result!.frontmatter).toContain('title: A');
    expect(result!.frontmatter).toContain('date: 2024-01-01');
    expect(result!.body).toBe('Body text');
  });
});

describe('replaceFrontmatter', () => {
  test('replaces existing frontmatter', () => {
    const md = '---\ntitle: Old\n---\n# Content';
    const result = replaceFrontmatter(md, { title: 'New' });
    expect(result).toContain('title: New');
    expect(result).toContain('# Content');
    expect(result).not.toContain('Old');
  });

  test('prepends frontmatter when none exists', () => {
    const md = '# Just content';
    const result = replaceFrontmatter(md, { title: 'Added' });
    expect(result).toStartWith('---\n');
    expect(result).toContain('title: Added');
    expect(result).toContain('# Just content');
  });
});

describe('round-trip', () => {
  test('parse then stringify preserves data', () => {
    const original = 'title: My Doc\nauthor: Alice\nversion: 2';
    const parsed = parseFrontmatter(original);
    const serialized = stringifyFrontmatter(parsed);
    const reparsed = parseFrontmatter(serialized);
    expect(reparsed.title).toBe(parsed.title);
    expect(reparsed.author).toBe(parsed.author);
  });

  test('extract then replace round-trips', () => {
    const md = '---\ntitle: Test\nauthor: Bob\n---\n# Hello World\n\nBody text.';
    const extracted = extractFrontmatter(md);
    const parsed = parseFrontmatter(extracted!.frontmatter);
    const result = replaceFrontmatter(md, parsed);
    const re = extractFrontmatter(result);
    expect(re!.body.trim()).toBe('# Hello World\n\nBody text.');
  });
});

describe('parseScalar trailing quote preservation', () => {
  test('preserves trailing quote that is not a delimiter', () => {
    const result = parseFrontmatter('val: end quote"');
    expect(result.val).toBe('end quote"');
  });
});

describe('inline array with commas in quotes', () => {
  test('does not split on commas inside quoted values', () => {
    const result = parseFrontmatter('tags: ["hello, world", "foo"]');
    expect(result.tags).toEqual(['hello, world', 'foo']);
  });
});

describe('quoteYamlScalar extended patterns', () => {
  test('quotes yes/no/on/off', () => {
    const out = stringifyFrontmatter({ flag: 'yes' });
    expect(out).toContain('"yes"');
  });

  test('quotes dates like 2024-01-01', () => {
    const out = stringifyFrontmatter({ date: '2024-01-01' });
    expect(out).toContain('"2024-01-01"');
  });

  test('quotes mid-string # (YAML comment)', () => {
    const out = stringifyFrontmatter({ note: 'hello # world' });
    expect(out).toContain('"hello # world"');
  });
});
