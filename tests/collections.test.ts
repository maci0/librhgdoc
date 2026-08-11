import { describe, test, expect } from 'bun:test';
import { sparseMap } from '../src/collections.ts';

describe('sparseMap', () => {
  test('filters out empty items', () => {
    const result = sparseMap(['a', '', 'b', '', 'c'], s => s === '', 'default');
    expect(result.items).toEqual(['a', 'b', 'c']);
    expect(result.indices).toEqual([0, 2, 4]);
  });

  test('reconstructs results back to original positions', () => {
    const result = sparseMap(['a', '', 'b', '', 'c'], s => s === '', '');
    const processed = ['A', 'B', 'C'];
    const out = result.reconstruct(processed);
    expect(out).toEqual(['A', '', 'B', '', 'C']);
  });

  test('handles all-empty input', () => {
    const result = sparseMap(['', '', ''], s => s === '', 'x');
    expect(result.items).toEqual([]);
    expect(result.indices).toEqual([]);
    expect(result.reconstruct([])).toEqual(['x', 'x', 'x']);
  });

  test('handles no-empty input', () => {
    const result = sparseMap(['a', 'b', 'c'], s => s === '', '');
    expect(result.items).toEqual(['a', 'b', 'c']);
    expect(result.indices).toEqual([0, 1, 2]);
    expect(result.reconstruct(['A', 'B', 'C'])).toEqual(['A', 'B', 'C']);
  });

  test('handles empty input array', () => {
    const result = sparseMap([] as string[], s => s === '', '');
    expect(result.items).toEqual([]);
    expect(result.indices).toEqual([]);
    expect(result.reconstruct([])).toEqual([]);
  });

  test('works with numeric types', () => {
    const result = sparseMap([1, 0, 2, 0, 3], n => n === 0, -1);
    expect(result.items).toEqual([1, 2, 3]);
    expect(result.indices).toEqual([0, 2, 4]);
    expect(result.reconstruct([10, 20, 30])).toEqual([10, -1, 20, -1, 30]);
  });

  test('preserves default value for skipped positions', () => {
    const result = sparseMap(['x', '', 'y'], s => s === '', 'EMPTY');
    expect(result.reconstruct(['X', 'Y'])).toEqual(['X', 'EMPTY', 'Y']);
  });

  test('handles single-element arrays', () => {
    const result = sparseMap(['a'], s => s === '', '');
    expect(result.items).toEqual(['a']);
    expect(result.indices).toEqual([0]);
    expect(result.reconstruct(['A'])).toEqual(['A']);
  });

  test('handles single empty element', () => {
    const result = sparseMap([''], s => s === '', 'default');
    expect(result.items).toEqual([]);
    expect(result.indices).toEqual([]);
    expect(result.reconstruct([])).toEqual(['default']);
  });
});
