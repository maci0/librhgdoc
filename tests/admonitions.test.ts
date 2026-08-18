import { describe, test, expect } from 'bun:test';
import {
  type AdmonitionType,
  ADMONITION_TYPES,
  ADMONITION_LABELS,
  ADMONITION_ACCENT,
  ADMONITION_BG,
  isAdmonitionType,
} from '../src/admonitions.ts';

describe('ADMONITION_TYPES', () => {
  test('is a Set with 5 entries', () => {
    expect(ADMONITION_TYPES.size).toBe(5);
  });

  test('contains all five types', () => {
    expect(ADMONITION_TYPES.has('NOTE')).toBe(true);
    expect(ADMONITION_TYPES.has('TIP')).toBe(true);
    expect(ADMONITION_TYPES.has('IMPORTANT')).toBe(true);
    expect(ADMONITION_TYPES.has('WARNING')).toBe(true);
    expect(ADMONITION_TYPES.has('CAUTION')).toBe(true);
  });

  test('rejects invalid types', () => {
    expect(isAdmonitionType('DANGER')).toBe(false);
    expect(isAdmonitionType('note')).toBe(false);
  });
});

describe('ADMONITION_LABELS', () => {
  test('has labels for all five types', () => {
    const types: AdmonitionType[] = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'];
    for (const t of types) {
      expect(ADMONITION_LABELS[t]).toBeDefined();
      expect(ADMONITION_LABELS[t]).toContain(t);
    }
  });

  test('labels include emoji', () => {
    expect(ADMONITION_LABELS.NOTE).toContain('ℹ️');
    expect(ADMONITION_LABELS.TIP).toContain('💡');
    expect(ADMONITION_LABELS.WARNING).toContain('⚠️');
    expect(ADMONITION_LABELS.CAUTION).toContain('🔴');
  });
});

describe('ADMONITION_ACCENT', () => {
  test('has accent colors for all five types', () => {
    const types: AdmonitionType[] = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'];
    for (const t of types) {
      const c = ADMONITION_ACCENT[t];
      expect(c).toBeDefined();
      expect(typeof c.red).toBe('number');
      expect(typeof c.green).toBe('number');
      expect(typeof c.blue).toBe('number');
    }
  });

  test('accent colors are in 0-1 range', () => {
    for (const c of Object.values(ADMONITION_ACCENT)) {
      expect(c.red).toBeGreaterThanOrEqual(0);
      expect(c.red).toBeLessThanOrEqual(1);
      expect(c.green).toBeGreaterThanOrEqual(0);
      expect(c.green).toBeLessThanOrEqual(1);
      expect(c.blue).toBeGreaterThanOrEqual(0);
      expect(c.blue).toBeLessThanOrEqual(1);
    }
  });

  test('NOTE accent is dark blue', () => {
    const c = ADMONITION_ACCENT.NOTE;
    expect(c.blue).toBeGreaterThan(c.red);
    expect(c.blue).toBeGreaterThan(c.green);
  });

  test('CAUTION accent is dark red', () => {
    const c = ADMONITION_ACCENT.CAUTION;
    expect(c.red).toBeGreaterThan(c.green);
    expect(c.red).toBeGreaterThan(c.blue);
  });
});

describe('ADMONITION_BG', () => {
  test('has background colors for all five types', () => {
    const types: AdmonitionType[] = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'];
    for (const t of types) {
      const c = ADMONITION_BG[t];
      expect(c).toBeDefined();
      expect(typeof c.red).toBe('number');
      expect(typeof c.green).toBe('number');
      expect(typeof c.blue).toBe('number');
    }
  });

  test('background colors are lighter than accent colors', () => {
    const types: AdmonitionType[] = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'];
    for (const t of types) {
      const accent = ADMONITION_ACCENT[t];
      const bg = ADMONITION_BG[t];
      const accentLum = accent.red * 0.299 + accent.green * 0.587 + accent.blue * 0.114;
      const bgLum = bg.red * 0.299 + bg.green * 0.587 + bg.blue * 0.114;
      expect(bgLum).toBeGreaterThan(accentLum);
    }
  });
});

describe('isAdmonitionType', () => {
  test('returns true for valid admonition types', () => {
    expect(isAdmonitionType('NOTE')).toBe(true);
    expect(isAdmonitionType('TIP')).toBe(true);
    expect(isAdmonitionType('IMPORTANT')).toBe(true);
    expect(isAdmonitionType('WARNING')).toBe(true);
    expect(isAdmonitionType('CAUTION')).toBe(true);
  });

  test('returns false for invalid strings', () => {
    expect(isAdmonitionType('DANGER')).toBe(false);
    expect(isAdmonitionType('note')).toBe(false);
    expect(isAdmonitionType('')).toBe(false);
    expect(isAdmonitionType('INFO')).toBe(false);
  });
});
