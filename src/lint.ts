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
  [/(?<![/:.`\-_@])\bRHEL\b(?![/:.`\-_])/gi,       'RHEL'],
  [/(?<![/:.`\-_@])\bFedora\b(?![/:.`\-_])/gi,     'Fedora'],
  [/(?<![/:.`\-_@])\bPodman\b(?![/:.`\-_])/gi,     'Podman'],
  [/(?<![/:.`\-_@])\bCentOS\b(?![/:.`\-_])/gi,     'CentOS'],
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
    if (/^\s*```/.test(raw) || /^\s*~~~/.test(raw)) { inCode = !inCode; continue; }
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
    if (/^\s*```/.test(raw) || /^\s*~~~/.test(raw)) { inCode = !inCode; continue; }
    if (inCode) continue;

    // Skip lines that are just a URL (common in reference sections)
    if (/^https?:\/\//.test(raw.trim())) continue;

    // Remove markdown link constructs, then check remaining text for bare URLs
    const stripped = raw.replace(/\[[^\]]*\]\([^)]*\)/g, '');
    const bareUrl = stripped.match(/(?<!\()(https?:\/\/[^\s)>\]]+)/)?.[0] ?? '';
    if (bareUrl.length > 20) {
      issues.push({
        line: i + 1,
        level: 'warn',
        msg: `Bare URL in prose — wrap in markdown link syntax`,
      });
    }
  }

  return issues;
}

// ─── Fence-tracking helper ──────────────────────────────────────────────────

/** Test whether a line opens or closes a fenced code block.
 *  Returns the fence marker (``` or ~~~) when the line is a fence, or null. */
function fenceMarker(line: string): string | null {
  const m = line.match(/^\s*(```+|~~~+)/);
  return m ? m[1].charAt(0).repeat(3) : null;
}

// ─── lintUnclosedCodeFence ──────────────────────────────────────────────────

/** Detect unmatched ``` or ~~~ fences.
 *  If a fence is still open at EOF, reports an error on the opening line. */
export function lintUnclosedCodeFence(text: string): LintMessage[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let openLine = -1;
  let openMarker: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const marker = fenceMarker(lines[i]);
    if (!marker) continue;

    if (openMarker === null) {
      // Opening fence
      openMarker = marker;
      openLine = i;
    } else if (marker === openMarker) {
      // Closing fence (same type)
      openMarker = null;
      openLine = -1;
    }
    // Otherwise it's a different fence type inside an open fence — ignore
  }

  if (openMarker !== null) {
    return [{ line: openLine + 1, level: 'error', msg: 'Unclosed code fence (missing closing fence)' }];
  }
  return [];
}

// ─── lintCodeBlockLanguage ──────────────────────────────────────────────────

/** Flag opening ``` fences that have no language identifier.
 *  Skips fences that are nested inside an already-open fence. */
export function lintCodeBlockLanguage(text: string): LintMessage[] {
  const issues: LintMessage[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const m = raw.match(/^\s*(```+|~~~+)(.*)/);
    if (!m) continue;

    if (inCode) {
      // Could be closing fence
      inCode = false;
      continue;
    }

    // Opening fence
    inCode = true;
    const lang = m[2].trim();
    if (!lang) {
      issues.push({ line: i + 1, level: 'warn', msg: 'Code block has no language tag — add one (bash, yaml, json, etc.)' });
    }
  }

  return issues;
}

// ─── lintEmDash ─────────────────────────────────────────────────────────────

/** Flag em dash (U+2014) in prose lines. Skips code fences and headings. */
export function lintEmDash(text: string): LintMessage[] {
  const issues: LintMessage[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/^\s*```/.test(raw) || /^\s*~~~/.test(raw)) { inCode = !inCode; continue; }
    if (inCode) continue;
    if (/^#{1,6}\s/.test(raw)) continue; // skip headings

    if (/\u2014/.test(raw)) {
      issues.push({ line: i + 1, level: 'warn', msg: 'Em dash (\u2014) detected: consider replacing with a colon, comma, period, or rewording' });
    }
  }

  return issues;
}

// ─── lintPlaceholderText ────────────────────────────────────────────────────

/** Flag TODO, TBD, PLACEHOLDER, FIXME, XXX in prose lines.
 *  Skips content inside code fences. */
export function lintPlaceholderText(text: string): LintMessage[] {
  const issues: LintMessage[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const PLACEHOLDERS = ['TODO', 'TBD', 'PLACEHOLDER', 'FIXME', 'XXX'];
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/^\s*```/.test(raw) || /^\s*~~~/.test(raw)) { inCode = !inCode; continue; }
    if (inCode) continue;

    const upper = raw.toUpperCase();
    for (const ph of PLACEHOLDERS) {
      if (upper.includes(ph)) {
        issues.push({ line: i + 1, level: 'warn', msg: `Placeholder text "${ph}" found — remove or replace before publishing` });
        break; // one warning per line is enough
      }
    }
  }

  return issues;
}

// ─── lintEmptyImageAlt ──────────────────────────────────────────────────────

/** Flag images with empty alt text: `![](url)`.
 *  Skips content inside code fences. */
export function lintEmptyImageAlt(text: string): LintMessage[] {
  const issues: LintMessage[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/^\s*```/.test(raw) || /^\s*~~~/.test(raw)) { inCode = !inCode; continue; }
    if (inCode) continue;

    if (/!\[\]\([^)]+\)/.test(raw)) {
      issues.push({ line: i + 1, level: 'warn', msg: 'Image has empty alt text — add descriptive alt text for accessibility' });
    }
  }

  return issues;
}

// ─── lintLongCodeBlock ──────────────────────────────────────────────────────

/** Flag code blocks exceeding maxLines (default 50).
 *  Reports on the opening fence line. */
export function lintLongCodeBlock(text: string, maxLines: number = 50): LintMessage[] {
  const issues: LintMessage[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let inCode = false;
  let fenceStart = -1;
  let codeLineCount = 0;
  let openMarker: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const m = raw.match(/^\s*(```+|~~~+)/);

    if (m) {
      const marker = m[1].charAt(0).repeat(3);
      if (!inCode) {
        inCode = true;
        openMarker = marker;
        fenceStart = i;
        codeLineCount = 0;
      } else if (marker === openMarker) {
        // Closing fence
        if (codeLineCount > maxLines) {
          issues.push({ line: fenceStart + 1, level: 'warn', msg: `Code block is ${codeLineCount} lines — consider splitting or moving to an appendix` });
        }
        inCode = false;
        openMarker = null;
      } else {
        codeLineCount++;
      }
    } else if (inCode) {
      codeLineCount++;
    }
  }

  return issues;
}
