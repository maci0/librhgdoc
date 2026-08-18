import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveUnderBase } from '../src/safe-path.ts';

const TMP = join(tmpdir(), `librhgdoc-safe-path-test-${process.pid}`);
const OUTSIDE = join(tmpdir(), `librhgdoc-safe-path-outside-${process.pid}`);

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
  mkdirSync(OUTSIDE, { recursive: true });
  writeFileSync(join(TMP, 'file.txt'), 'hello');
  writeFileSync(join(OUTSIDE, 'secret.txt'), 'secret');
  symlinkSync(join(OUTSIDE, 'secret.txt'), join(TMP, 'escaped.txt'));
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
  rmSync(OUTSIDE, { recursive: true, force: true });
});

describe('resolveUnderBase', () => {
  test('resolves a normal file under basePath', () => {
    const result = resolveUnderBase(TMP, 'file.txt');
    expect(result).not.toBeNull();
    expect(result?.endsWith('file.txt')).toBe(true);
  });

  test('returns null for missing file', () => {
    expect(resolveUnderBase(TMP, 'missing.txt')).toBeNull();
  });

  test('returns null for empty src', () => {
    expect(resolveUnderBase(TMP, '')).toBeNull();
  });

  test('returns null for null-byte in src', () => {
    expect(resolveUnderBase(TMP, 'file\0.txt')).toBeNull();
  });

  test('returns null for path traversal above basePath', () => {
    expect(resolveUnderBase(TMP, `..${sep}librhgdoc-safe-path-outside-${process.pid}${sep}secret.txt`)).toBeNull();
  });

  test('returns null for symlink escaping basePath', () => {
    expect(resolveUnderBase(TMP, 'escaped.txt')).toBeNull();
  });

  test('returns null for absolute path outside basePath', () => {
    expect(resolveUnderBase(TMP, join(OUTSIDE, 'secret.txt'))).toBeNull();
  });
});
