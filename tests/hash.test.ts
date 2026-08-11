import { describe, test, expect } from 'bun:test';
import { djb2, contentHash } from '../src/hash.ts';

describe('djb2', () => {
  test('returns a base-36 string', () => {
    const result = djb2('hello');
    expect(result).toMatch(/^[0-9a-z]+$/);
  });

  test('produces different hashes for different inputs', () => {
    expect(djb2('hello')).not.toBe(djb2('world'));
  });

  test('is deterministic', () => {
    expect(djb2('test')).toBe(djb2('test'));
  });

  test('handles empty string', () => {
    const result = djb2('');
    expect(result).toMatch(/^[0-9a-z]+$/);
  });
});

describe('contentHash', () => {
  test('produces stable hash for same input', () => {
    const a = contentHash('body', 'hello world');
    const b = contentHash('body', 'hello world');
    expect(a).toBe(b);
  });

  test('normalizes whitespace for non-code types', () => {
    const a = contentHash('body', 'hello   world');
    const b = contentHash('body', 'hello world');
    expect(a).toBe(b);
  });

  test('preserves whitespace for code type', () => {
    const a = contentHash('code', 'hello   world');
    const b = contentHash('code', 'hello world');
    expect(a).not.toBe(b);
  });

  test('trims leading/trailing whitespace', () => {
    const a = contentHash('body', '  hello  ');
    const b = contentHash('body', 'hello');
    expect(a).toBe(b);
  });

  test('uses extra discriminator', () => {
    const a = contentHash('code', 'console.log(1)', 'js');
    const b = contentHash('code', 'console.log(1)', 'ts');
    expect(a).not.toBe(b);
  });

  test('different types produce different hashes', () => {
    const a = contentHash('body', 'hello');
    const b = contentHash('h1', 'hello');
    expect(a).not.toBe(b);
  });
});
