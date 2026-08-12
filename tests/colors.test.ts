import { describe, test, expect } from 'bun:test';
import { hexToRgb, rgbToHex, isGrayHex, normHex, RH_COLORS, type RgbColor } from '../src/colors.ts';

describe('hexToRgb', () => {
  test('converts #RRGGBB', () => {
    const rgb = hexToRgb('#EE0000');
    expect(rgb.red).toBeCloseTo(0.9333, 3);
    expect(rgb.green).toBe(0);
    expect(rgb.blue).toBe(0);
  });

  test('accepts RRGGBB without hash', () => {
    const rgb = hexToRgb('EE0000');
    expect(rgb.red).toBeCloseTo(0.9333, 3);
  });

  test('converts black', () => {
    const rgb = hexToRgb('#000000');
    expect(rgb).toEqual({ red: 0, green: 0, blue: 0 });
  });

  test('converts white', () => {
    const rgb = hexToRgb('#FFFFFF');
    expect(rgb).toEqual({ red: 1, green: 1, blue: 1 });
  });

  test('converts mid-gray', () => {
    const rgb = hexToRgb('#808080');
    expect(rgb.red).toBeCloseTo(0.502, 2);
    expect(rgb.green).toBeCloseTo(0.502, 2);
    expect(rgb.blue).toBeCloseTo(0.502, 2);
  });

  test('converts shorthand #FFF to white', () => {
    expect(hexToRgb('#FFF')).toEqual({ red: 1, green: 1, blue: 1 });
  });

  test('converts shorthand #F00 to red', () => {
    expect(hexToRgb('#F00')).toEqual({ red: 1, green: 0, blue: 0 });
  });

  test('returns black for invalid hex "garbage"', () => {
    expect(hexToRgb('garbage')).toEqual({ red: 0, green: 0, blue: 0 });
  });

  test('returns black for empty string', () => {
    expect(hexToRgb('')).toEqual({ red: 0, green: 0, blue: 0 });
  });

  test('handles double hash ##FF0000', () => {
    const rgb = hexToRgb('##FF0000');
    expect(rgb.red).toBe(1);
    expect(rgb.green).toBe(0);
    expect(rgb.blue).toBe(0);
  });
});

describe('rgbToHex', () => {
  test('converts RgbColor to #rrggbb', () => {
    expect(rgbToHex({ red: 1, green: 0, blue: 0 })).toBe('#ff0000');
  });

  test('round-trips with hexToRgb', () => {
    const hex = '#3A7BcD';
    const rgb = hexToRgb(hex);
    expect(rgbToHex(rgb)).toBe('#3a7bcd');
  });

  test('converts black', () => {
    expect(rgbToHex({ red: 0, green: 0, blue: 0 })).toBe('#000000');
  });

  test('converts white', () => {
    expect(rgbToHex({ red: 1, green: 1, blue: 1 })).toBe('#ffffff');
  });

  test('clamps out-of-range channels', () => {
    expect(rgbToHex({ red: 1.5, green: -0.5, blue: 2 })).toBe('#ff00ff');
  });

  test('returns lowercase hex digits', () => {
    const hex = rgbToHex({ red: 0.7333, green: 0.8667, blue: 0.9333 });
    expect(hex).toBe(hex.toLowerCase());
  });
});

describe('isGrayHex', () => {
  test('detects mid-gray', () => {
    expect(isGrayHex('#808080')).toBe(true);
  });

  test('detects #434343 (RH gray)', () => {
    expect(isGrayHex('#434343')).toBe(true);
  });

  test('detects #6A6E73 (RH light gray)', () => {
    expect(isGrayHex('#6A6E73')).toBe(true);
  });

  test('rejects pure red', () => {
    expect(isGrayHex('#EE0000')).toBe(false);
  });

  test('rejects pure black (luminance too low)', () => {
    expect(isGrayHex('#000000')).toBe(false);
  });

  test('rejects pure white (luminance too high)', () => {
    expect(isGrayHex('#FFFFFF')).toBe(false);
  });

  test('rejects null/empty/short', () => {
    expect(isGrayHex('')).toBe(false);
    expect(isGrayHex('#FFF')).toBe(false);
  });

  test('detects gray without # prefix', () => {
    expect(isGrayHex('808080')).toBe(true);
  });

  test('accepts 3-digit gray #999', () => {
    expect(isGrayHex('#999')).toBe(true);
  });

  test('rejects 3-digit white #fff (luminance too high)', () => {
    expect(isGrayHex('#fff')).toBe(false);
  });

  test('rejects 3-digit red #f00 (not gray)', () => {
    expect(isGrayHex('#f00')).toBe(false);
  });

  test('rejects 3-digit #123 (not gray)', () => {
    expect(isGrayHex('#123')).toBe(false);
  });

  test('accepts 3-digit #777 (mid-gray)', () => {
    expect(isGrayHex('#777')).toBe(true);
  });

  test('accepts 3-digit gray without # prefix', () => {
    expect(isGrayHex('999')).toBe(true);
  });
});

describe('RH_COLORS', () => {
  test('has expected named colors', () => {
    expect(RH_COLORS.red).toBeDefined();
    expect(RH_COLORS.black).toBeDefined();
    expect(RH_COLORS.white).toBeDefined();
    expect(RH_COLORS.gray).toBeDefined();
    expect(RH_COLORS.lightGray).toBeDefined();
    expect(RH_COLORS.darkBg).toBeDefined();
    expect(RH_COLORS.greyBg).toBeDefined();
  });

  test('red matches #EE0000', () => {
    expect(RH_COLORS.red.red).toBeCloseTo(0.9333, 3);
    expect(RH_COLORS.red.green).toBe(0);
    expect(RH_COLORS.red.blue).toBe(0);
  });

  test('greyBg matches #F2F2F2', () => {
    expect(RH_COLORS.greyBg.red).toBeCloseTo(242 / 255, 4);
    expect(RH_COLORS.greyBg.green).toBeCloseTo(242 / 255, 4);
    expect(RH_COLORS.greyBg.blue).toBeCloseTo(242 / 255, 4);
    expect(rgbToHex(RH_COLORS.greyBg)).toBe('#f2f2f2');
  });
});

// ─── normHex ─────────────────────────────────────────────────────────────────

describe('normHex', () => {
  test('lowercases and keeps hash prefix', () => {
    expect(normHex('#EE0000')).toBe('#ee0000');
  });

  test('adds hash prefix if missing', () => {
    expect(normHex('EE0000')).toBe('#ee0000');
  });

  test('returns empty string for empty input', () => {
    expect(normHex('')).toBe('');
  });

  test('handles already-lowercase input', () => {
    expect(normHex('#aabbcc')).toBe('#aabbcc');
  });

  test('handles mixed case without hash', () => {
    expect(normHex('AbCdEf')).toBe('#abcdef');
  });

  test('preserves hash on already-prefixed input', () => {
    expect(normHex('#000000')).toBe('#000000');
  });

  test('returns empty string for invalid input', () => {
    expect(normHex('not-hex')).toBe('');
  });

  test('handles double hash', () => {
    expect(normHex('##FF0000')).toBe('#ff0000');
  });

  test('rejects 4-char hex as invalid length', () => {
    expect(normHex('#AABB')).toBe('');
  });
});
