import { describe, test, expect } from 'bun:test';
import { lintBrandNames, lintBareUrls, type LintMessage } from '../src/lint.ts';

// ─── lintBrandNames ──────────────────────────────────────────────────────────

describe('lintBrandNames', () => {
  test('detects "Redhat" misspelling', () => {
    const issues = lintBrandNames('We use Redhat Enterprise Linux.');
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain('Red Hat');
    expect(issues[0].level).toBe('warn');
    expect(issues[0].line).toBe(1);
  });

  test('accepts correct "Red Hat" spelling', () => {
    const issues = lintBrandNames('We use Red Hat Enterprise Linux.');
    expect(issues).toHaveLength(0);
  });

  test('detects "openshift" case mismatch', () => {
    const issues = lintBrandNames('Deploy on openshift today');
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain('OpenShift');
  });

  test('accepts correct "OpenShift" spelling', () => {
    const issues = lintBrandNames('Deploy on OpenShift.');
    expect(issues).toHaveLength(0);
  });

  test('detects "kubernetes" case mismatch', () => {
    const issues = lintBrandNames('Running on kubernetes cluster.');
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain('Kubernetes');
  });

  test('detects "ansible" case mismatch', () => {
    const issues = lintBrandNames('Use ansible for automation.');
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain('Ansible');
  });

  test('skips brand names inside code blocks', () => {
    const text = '```\ninstall redhat packages\n```';
    const issues = lintBrandNames(text);
    expect(issues).toHaveLength(0);
  });

  test('skips brand names inside URLs', () => {
    const text = 'Visit https://console.redhat.com for details.';
    const issues = lintBrandNames(text);
    expect(issues).toHaveLength(0);
  });

  test('reports correct line numbers', () => {
    const text = 'Line 1\nRedhat here\nLine 3\nRedhat again';
    const issues = lintBrandNames(text);
    expect(issues).toHaveLength(2);
    expect(issues[0].line).toBe(2);
    expect(issues[1].line).toBe(4);
  });

  test('handles empty input', () => {
    expect(lintBrandNames('')).toEqual([]);
  });

  test('handles multiple issues on same line', () => {
    const issues = lintBrandNames('Use openshift and kubernetes together.');
    expect(issues).toHaveLength(2);
  });

  test('skips brand names inside tilde code fence', () => {
    const text = '~~~\nRedhat\n~~~\nReal text';
    const issues = lintBrandNames(text);
    expect(issues).toHaveLength(0);
  });

  test('does not flag brand name inside inline code', () => {
    const issues = lintBrandNames('Use `openshift` as a value.');
    expect(issues).toHaveLength(0);
  });
});

// ─── lintBareUrls ────────────────────────────────────────────────────────────

describe('lintBareUrls', () => {
  test('detects bare URL in prose', () => {
    const issues = lintBareUrls('Check out https://docs.redhat.com/en/documentation for more info.');
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('warn');
    expect(issues[0].msg).toContain('Bare URL');
  });

  test('skips URLs wrapped in markdown links', () => {
    const issues = lintBareUrls('See [docs](https://docs.redhat.com/en/documentation) for more.');
    expect(issues).toHaveLength(0);
  });

  test('skips lines that are just a URL', () => {
    const issues = lintBareUrls('https://example.com/some/long/path/here');
    expect(issues).toHaveLength(0);
  });

  test('skips URLs inside code blocks', () => {
    const text = '```\nhttps://example.com/api/endpoint in code\n```';
    const issues = lintBareUrls(text);
    expect(issues).toHaveLength(0);
  });

  test('skips very short URLs (likely false positives)', () => {
    const issues = lintBareUrls('Go to http://x.co for info.');
    expect(issues).toHaveLength(0);
  });

  test('reports correct line number', () => {
    const text = 'Line 1\nCheck https://docs.example.com/path/to/resource here\nLine 3';
    const issues = lintBareUrls(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].line).toBe(2);
  });

  test('handles empty input', () => {
    expect(lintBareUrls('')).toEqual([]);
  });

  test('flags bare URL alongside markdown link', () => {
    const issues = lintBareUrls('See [docs](https://a.com) and https://docs.example.com/path');
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('warn');
  });

  test('does not flag line with only markdown link', () => {
    const issues = lintBareUrls('See [docs](https://a.com)');
    expect(issues).toHaveLength(0);
  });
});
