import { describe, test, expect } from 'bun:test';
import { toSlug } from '../src/slug.ts';

describe('toSlug', () => {
  test('lowercases text', () => {
    expect(toSlug('Hello World')).toBe('hello-world');
  });

  test('converts spaces to hyphens', () => {
    expect(toSlug('one two three')).toBe('one-two-three');
  });

  test('strips non-word characters', () => {
    expect(toSlug('Hello, World!')).toBe('hello-world');
  });

  test('collapses consecutive hyphens', () => {
    expect(toSlug('MachineConfig & Pool')).toBe('machineconfig-pool');
  });

  test('handles already-slugified text', () => {
    expect(toSlug('already-a-slug')).toBe('already-a-slug');
  });

  test('handles empty string', () => {
    expect(toSlug('')).toBe('');
  });

  test('handles special characters', () => {
    expect(toSlug('C++ & C#')).toBe('c-c');
  });

  test('preserves underscores', () => {
    expect(toSlug('my_function')).toBe('my_function');
  });

  test('preserves digits', () => {
    expect(toSlug('Section 42')).toBe('section-42');
  });
});
