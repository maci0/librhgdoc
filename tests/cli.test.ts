import { describe, test, expect } from 'bun:test';
import { fmtTime, parsePresenterEntry, formatGoogleApiError, type PresenterEntry } from '../src/cli.ts';

// ─── fmtTime ─────────────────────────────────────────────────────────────────

describe('fmtTime', () => {
  test('formats sub-second durations as milliseconds', () => {
    expect(fmtTime(450)).toBe('450ms');
  });

  test('rounds sub-second durations', () => {
    expect(fmtTime(123.7)).toBe('124ms');
  });

  test('formats zero as 0ms', () => {
    expect(fmtTime(0)).toBe('0ms');
  });

  test('formats exactly 999ms', () => {
    expect(fmtTime(999)).toBe('999ms');
  });

  test('formats exactly 1000ms as seconds', () => {
    expect(fmtTime(1000)).toBe('1.0s');
  });

  test('formats multi-second durations', () => {
    expect(fmtTime(2300)).toBe('2.3s');
  });

  test('formats sub-minute large durations in seconds', () => {
    expect(fmtTime(45000)).toBe('45.0s');
  });

  test('formats exactly 60000ms as minutes', () => {
    expect(fmtTime(60000)).toBe('1.0m');
  });

  test('formats multi-minute durations', () => {
    expect(fmtTime(150000)).toBe('2.5m');
  });

  test('formats large durations in minutes', () => {
    expect(fmtTime(360000)).toBe('6.0m');
  });

  test('formats 1500ms', () => {
    expect(fmtTime(1500)).toBe('1.5s');
  });

  test('returns 0ms for NaN', () => {
    expect(fmtTime(NaN)).toBe('0ms');
  });

  test('returns 0ms for Infinity', () => {
    expect(fmtTime(Infinity)).toBe('0ms');
  });

  test('returns 0ms for negative values', () => {
    expect(fmtTime(-100)).toBe('0ms');
  });
});

// ─── parsePresenterEntry ─────────────────────────────────────────────────────

describe('parsePresenterEntry', () => {
  test('parses bare name', () => {
    const result = parsePresenterEntry('John Doe');
    expect(result).toEqual({ name: 'John Doe' });
  });

  test('parses name with email', () => {
    const result = parsePresenterEntry('John Doe <john@redhat.com>');
    expect(result).toEqual({ name: 'John Doe', email: 'john@redhat.com' });
  });

  test('parses name with title', () => {
    const result = parsePresenterEntry('John Doe, Senior Engineer');
    expect(result).toEqual({ name: 'John Doe', title: 'Senior Engineer' });
  });

  test('parses name, title, and email (title before email)', () => {
    const result = parsePresenterEntry('John Doe, Senior Engineer <john@redhat.com>');
    expect(result).toEqual({ name: 'John Doe', title: 'Senior Engineer', email: 'john@redhat.com' });
  });

  test('parses name, email, then title', () => {
    const result = parsePresenterEntry('John Doe <john@redhat.com>, Senior Engineer');
    expect(result).toEqual({ name: 'John Doe', email: 'john@redhat.com', title: 'Senior Engineer' });
  });

  test('accepts object with name, email, title', () => {
    const result = parsePresenterEntry({ name: 'Jane', email: 'jane@rh.com', title: 'PM' });
    expect(result).toEqual({ name: 'Jane', email: 'jane@rh.com', title: 'PM' });
  });

  test('accepts object with name only', () => {
    const result = parsePresenterEntry({ name: 'Jane' });
    expect(result).toEqual({ name: 'Jane' });
  });

  test('object with no name falls back to email', () => {
    const result = parsePresenterEntry({ email: 'anon@rh.com' } as Record<string, string>);
    expect(result.name).toBe('anon@rh.com');
  });

  test('handles empty string', () => {
    const result = parsePresenterEntry('');
    expect(result).toEqual({ name: '' });
  });

  test('trims whitespace', () => {
    const result = parsePresenterEntry('  John Doe  ');
    expect(result).toEqual({ name: 'John Doe' });
  });
});


// ─── formatGoogleApiError ───────────────────────────────────────────────────

describe('formatGoogleApiError', () => {
  test('maps permission denied', () => {
    expect(formatGoogleApiError('The caller does not have permission')).toContain('Permission denied');
  });

  test('maps quota exceeded', () => {
    expect(formatGoogleApiError('Quota exceeded for quota metric')).toContain('quota exceeded');
  });

  test('maps 404', () => {
    expect(formatGoogleApiError('File not found: abc123')).toContain('not found');
  });

  test('maps expired token', () => {
    expect(formatGoogleApiError('Token has been expired or revoked')).toContain('expired');
  });

  test('maps insufficient scopes', () => {
    expect(formatGoogleApiError('Insufficient authentication scopes')).toContain('scopes');
  });

  test('returns null for unknown errors', () => {
    expect(formatGoogleApiError('Some random error')).toBeNull();
  });

  // alternate branch keywords
  test('maps "permission denied" keyword', () => {
    expect(formatGoogleApiError('permission denied on resource')).toContain('Permission denied');
  });

  test('maps "rate limit" keyword', () => {
    expect(formatGoogleApiError('rate limit exceeded, retry later')).toContain('quota exceeded');
  });

  test('maps bare "404" keyword', () => {
    expect(formatGoogleApiError('Error 404 while fetching doc')).toContain('not found');
  });

  test('maps generic "not found" keyword', () => {
    expect(formatGoogleApiError('Resource not found in API')).toContain('not found');
  });

  test('maps "invalid_grant" keyword', () => {
    expect(formatGoogleApiError('Error: invalid_grant')).toContain('expired');
  });

  // case sensitivity — function lowercases before matching
  test('matches case-insensitively (uppercase input)', () => {
    expect(formatGoogleApiError('THE CALLER DOES NOT HAVE PERMISSION')).toContain('Permission denied');
  });

  test('matches case-insensitively (mixed case quota)', () => {
    expect(formatGoogleApiError('QUOTA EXCEEDED for project')).toContain('quota exceeded');
  });

  test('matches case-insensitively (mixed case scopes)', () => {
    expect(formatGoogleApiError('INSUFFICIENT AUTHENTICATION SCOPES')).toContain('scopes');
  });

  // partial matches — error substring embedded in a longer message
  test('matches permission error embedded in longer message', () => {
    expect(formatGoogleApiError('Google API returned: the caller does not have permission to access this')).toContain('Permission denied');
  });

  test('matches not-found embedded in a verbose error', () => {
    expect(formatGoogleApiError('HttpError: file not found, please check doc id')).toContain('not found');
  });

  test('returns null for completely unrelated message', () => {
    expect(formatGoogleApiError('connection timeout after 30s')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(formatGoogleApiError('')).toBeNull();
  });
});
