/**
 * Markdown lint helpers for Red Hat document compliance.
 *
 * Provides generic lint checks that can be composed into project-specific
 * linting pipelines.
 *
 * @module
 */

/** Severity level for lint diagnostics. */
export type LintLevel = 'error' | 'warn';

/** A single lint diagnostic. */
export interface LintMessage {
  line: number;
  level: LintLevel;
  msg: string;
}

/** Brand-name spelling patterns: [regex, correct form].
 * Only warns when the match text differs from the correct form. */
const BRAND_PATTERNS: Array<[RegExp, string]> = [
  [/(?<![/:.`\-_@])\bRedhat\b(?![/:.`\-_])/gi,     'Red Hat'],
  [/(?<![/:.`\-_@])\bOpenShift\b(?![/:.`\-_])/gi,   'OpenShift'],
  [/(?<![/:.`\-_@])\bKubernetes\b(?![/:.`\-_])/gi,  'Kubernetes'],
  [/(?<![/:.`\-_@])\bAnsible\b(?![/:.`\-_])/gi,     'Ansible'],
];

/** Check if a string contains common Red Hat brand name misspellings.
 * Returns lint messages for lines with issues.
 * Skips content inside fenced code blocks. */
export function lintBrandNames(text: string): LintMessage[] {
  const issues: LintMessage[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/^```/.test(raw)) { inCode = !inCode; continue; }
    if (inCode) continue;

    // Strip URLs before scanning so "platform=openshift" inside a URL doesn't false-positive
    const scanLine = raw.replace(/https?:\/\/\S+/g, '');
    for (const [pattern, correct] of BRAND_PATTERNS) {
      for (const m of scanLine.matchAll(pattern)) {
        if (m[0] !== correct) {
          issues.push({ line: i + 1, level: 'warn', msg: `Brand name: "${m[0]}" should be "${correct}"` });
        }
      }
    }
  }

  return issues;
}

/** Check for bare URLs (not wrapped in markdown link syntax).
 * Returns lint messages for lines with bare `http://` or `https://` URLs.
 * Skips content inside fenced code blocks. */
export function lintBareUrls(text: string): LintMessage[] {
  const issues: LintMessage[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/^```/.test(raw)) { inCode = !inCode; continue; }
    if (inCode) continue;

    // Skip lines that are just a URL (common in reference sections)
    if (/^https?:\/\//.test(raw.trim())) continue;

    // Check for URLs not inside []() or <>
    if (/https?:\/\/[^\s)>]+/.test(raw) && !/\]\(https?:\/\//.test(raw)) {
      const bareUrl = raw.match(/(?<!\()(https?:\/\/[^\s)>\]]+)/)?.[0] ?? '';
      if (bareUrl.length > 20) {
        issues.push({
          line: i + 1,
          level: 'warn',
          msg: `Bare URL in prose — wrap in markdown link syntax`,
        });
      }
    }
  }

  return issues;
}
