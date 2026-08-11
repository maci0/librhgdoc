import { describe, test, expect } from 'bun:test';
import { calcColumnWidths, type ColumnWidthOptions } from '../src/tables.ts';

describe('calcColumnWidths', () => {
  const simpleTable = [
    '| Name | Age | City |',
    '|------|-----|------|',
    '| Alice | 30 | New York |',
    '| Bob | 25 | San Francisco |',
  ].join('\n');

  test('returns widths for a basic table', () => {
    const widths = calcColumnWidths(simpleTable);
    expect(widths).toHaveLength(3);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(468);
  });

  test('wider columns get more space', () => {
    const widths = calcColumnWidths(simpleTable);
    // "San Francisco" is longer than "30", so City > Age
    expect(widths[2]).toBeGreaterThan(widths[1]);
  });

  test('returns empty array for empty input', () => {
    expect(calcColumnWidths('')).toEqual([]);
  });

  test('returns empty array for no table rows', () => {
    expect(calcColumnWidths('no table here')).toEqual([]);
  });

  test('handles header-only table (no data rows)', () => {
    const headerOnly = '| A | B |\n|---|---|';
    const widths = calcColumnWidths(headerOnly);
    expect(widths).toHaveLength(2);
    // With no data rows, returns equal widths
    expect(widths[0]).toBe(widths[1]);
  });

  test('respects custom pageWidthPt', () => {
    const widths = calcColumnWidths(simpleTable, { pageWidthPt: 600 });
    expect(widths.reduce((a, b) => a + b, 0)).toBe(600);
  });

  test('skips separator rows', () => {
    const table = [
      '| ID | Description |',
      '|:---|:-----------|',
      '| 1 | A long description of something important |',
    ].join('\n');
    const widths = calcColumnWidths(table);
    expect(widths).toHaveLength(2);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(468);
  });

  test('narrow columns get tighter minimum', () => {
    const table = [
      '| ID | Very Long Description Column Name |',
      '|---|----|',
      '| 1 | This is a very long description that takes up a lot of space |',
      '| 2 | Another long description with many characters in it |',
    ].join('\n');
    const widths = calcColumnWidths(table);
    // ID column should be narrow
    expect(widths[0]).toBeLessThan(widths[1]);
  });

  test('handles single-column table', () => {
    const table = '| Data |\n|---|\n| Hello |\n| World |';
    const widths = calcColumnWidths(table);
    expect(widths).toHaveLength(1);
    expect(widths[0]).toBe(468);
  });

  test('all widths are rounded integers', () => {
    const widths = calcColumnWidths(simpleTable);
    for (const w of widths) {
      expect(w).toBe(Math.round(w));
    }
  });
});
