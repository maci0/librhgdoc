import { describe, test, expect } from 'bun:test';
import { hexToRgb, rgbToHex, isGrayHex, RH_COLORS, type RgbColor } from '../src/colors.ts';

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
});

describe('rgbToHex', () => {
  test('converts RgbColor to #RRGGBB', () => {
    expect(rgbToHex({ red: 1, green: 0, blue: 0 })).toBe('#FF0000');
  });

  test('round-trips with hexToRgb', () => {
    const hex = '#3A7BcD';
    const rgb = hexToRgb(hex);
    expect(rgbToHex(rgb)).toBe('#3A7BCD');
  });

  test('converts black', () => {
    expect(rgbToHex({ red: 0, green: 0, blue: 0 })).toBe('#000000');
  });

  test('converts white', () => {
    expect(rgbToHex({ red: 1, green: 1, blue: 1 })).toBe('#FFFFFF');
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
});

describe('RH_COLORS', () => {
  test('has expected named colors', () => {
    expect(RH_COLORS.red).toBeDefined();
    expect(RH_COLORS.black).toBeDefined();
    expect(RH_COLORS.white).toBeDefined();
    expect(RH_COLORS.gray).toBeDefined();
    expect(RH_COLORS.lightGray).toBeDefined();
    expect(RH_COLORS.darkBg).toBeDefined();
  });

  test('red matches #EE0000', () => {
    expect(RH_COLORS.red.red).toBeCloseTo(0.9333, 3);
    expect(RH_COLORS.red.green).toBe(0);
    expect(RH_COLORS.red.blue).toBe(0);
  });
});
