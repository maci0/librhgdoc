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

/** Returns the full fence marker (e.g. ````` or ~~~) when the line is a fence, or null. */
function fenceMarker(line: string): string | null {
  const m = line.match(/^\s*(```+|~~~+)/);
  return m ? m[1] : null;
}

/**
 * Iterate over lines outside fenced code blocks.
 *
 * Splits `text` on newlines, tracks ``` / ~~~ fence state, and calls
 * `callback(line, lineNumber)` for every line that is NOT inside a
 * fenced code block.  `lineNumber` is 1-based.
 */
export function forEachNonCodeLine(
  text: string,
  callback: (line: string, lineNumber: number) => void,
): void {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let openMarker: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const candidate = fenceMarker(raw);
    if (candidate) {
      if (openMarker === null) {
        openMarker = candidate;
      } else if (candidate.charAt(0) === openMarker.charAt(0) && candidate.length >= openMarker.length) {
        openMarker = null;
      }
      continue;
    }
    if (openMarker !== null) continue;
    callback(raw, i + 1);
  }
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

  forEachNonCodeLine(text, (raw, lineNumber) => {
    // Strip URLs and inline code before scanning so they don't false-positive
    const scanLine = raw
      .replace(/https?:\/\/\S+/g, '')
      .replace(/`[^`]+`/g, '');
    for (const [pattern, correct] of BRAND_PATTERNS) {
      for (const m of scanLine.matchAll(pattern)) {
        if (m[0] !== correct) {
          issues.push({ line: lineNumber, level: 'warn', msg: `Brand name: "${m[0]}" should be "${correct}"` });
        }
      }
    }
  });

  return issues;
}

/** Check for bare URLs (not wrapped in markdown link syntax).
 * Returns lint messages for lines with bare `http://` or `https://` URLs.
 * Skips content inside fenced code blocks. */
export function lintBareUrls(text: string): LintMessage[] {
  const issues: LintMessage[] = [];

  forEachNonCodeLine(text, (raw, lineNumber) => {
    // Skip lines that are just a URL (common in reference sections)
    if (/^https?:\/\/\S+$/.test(raw.trim())) return;

    // Remove markdown link constructs and inline code, then check remaining text for bare URLs
    const stripped = raw
      .replace(/\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/`[^`]+`/g, '');
    for (const m of stripped.matchAll(/(?<!\()(https?:\/\/[^\s)>\]]+)/g)) {
      const url = m[0].replace(/[.,;:!?]+$/, '');
      if (url.length > 20) {
        issues.push({
          line: lineNumber,
          level: 'warn',
          msg: `Bare URL in prose — wrap in markdown link syntax`,
        });
      }
    }
  });

  return issues;
}

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
      openMarker = marker;
      openLine = i;
    } else if (marker.charAt(0) === openMarker.charAt(0) && marker.length >= openMarker.length) {
      openMarker = null;
      openLine = -1;
    }
  }

  if (openMarker !== null) {
    return [{ line: openLine + 1, level: 'error', msg: 'Unclosed code fence (missing closing fence)' }];
  }
  return [];
}

/** Flag opening ``` fences that have no language identifier.
 *  Skips fences that are nested inside an already-open fence. */
export function lintCodeBlockLanguage(text: string): LintMessage[] {
  const issues: LintMessage[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let inCode = false;
  let openMarker: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const m = raw.match(/^\s*(```+|~~~+)(.*)/);
    if (!m) continue;

    const marker = m[1];

    if (inCode) {
      if (openMarker && marker.charAt(0) === openMarker.charAt(0) && marker.length >= openMarker.length) {
        inCode = false;
        openMarker = null;
      }
      continue;
    }

    inCode = true;
    openMarker = marker;
    const lang = m[2].trim();
    if (!lang) {
      issues.push({ line: i + 1, level: 'warn', msg: 'Code block has no language tag — add one (bash, yaml, json, etc.)' });
    }
  }

  return issues;
}

/** Flag em dash (U+2014) in prose lines. Skips code fences and headings. */
export function lintEmDash(text: string): LintMessage[] {
  const issues: LintMessage[] = [];

  forEachNonCodeLine(text, (raw, lineNumber) => {
    if (/^#{1,6}\s/.test(raw)) return; // skip headings

    if (/\u2014/.test(raw)) {
      issues.push({ line: lineNumber, level: 'warn', msg: 'Em dash (\u2014) detected: consider replacing with a colon, comma, period, or rewording' });
    }
  });

  return issues;
}

/** Flag TODO, TBD, PLACEHOLDER, FIXME, XXX in prose lines.
 *  Skips content inside code fences. */
export function lintPlaceholderText(text: string): LintMessage[] {
  const issues: LintMessage[] = [];
  const PLACEHOLDERS = ['TODO', 'TBD', 'PLACEHOLDER', 'FIXME', 'XXX'];

  forEachNonCodeLine(text, (raw, lineNumber) => {
    const upper = raw.toUpperCase();
    for (const ph of PLACEHOLDERS) {
      const re = new RegExp(`\\b${ph}\\b`);
      if (re.test(upper)) {
        issues.push({ line: lineNumber, level: 'warn', msg: `Placeholder text "${ph}" found — remove or replace before publishing` });
        break; // one warning per line is enough
      }
    }
  });

  return issues;
}

/** Flag images with empty alt text: `![](url)`.
 *  Skips content inside code fences. */
export function lintEmptyImageAlt(text: string): LintMessage[] {
  const issues: LintMessage[] = [];

  forEachNonCodeLine(text, (raw, lineNumber) => {
    if (/!\[\]\([^)]+\)/.test(raw)) {
      issues.push({ line: lineNumber, level: 'warn', msg: 'Image has empty alt text — add descriptive alt text for accessibility' });
    }
  });

  return issues;
}

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
    const marker = fenceMarker(raw);

    if (marker) {
      if (!inCode) {
        inCode = true;
        openMarker = marker;
        fenceStart = i;
        codeLineCount = 0;
      } else if (openMarker && marker.charAt(0) === openMarker.charAt(0) && marker.length >= openMarker.length) {
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

/**
 * Check a raw Mermaid diagram source string for common authoring mistakes.
 *
 * `code` is the text between the ``` fences — no fences, no language tag.
 * Line numbers in the returned messages are 1-based relative to `code`.
 */
export function lintMermaidDiagram(code: string): LintMessage[] {
  if (!code) return [];
  const issues: LintMessage[] = [];
  const lines = code.replace(/\r\n/g, '\n').split('\n');

  for (let i = 0; i < lines.length; i++) {
    const ln = i + 1;
    const raw = lines[i];

    if (/\bclassDef\s+end\b/.test(raw)) {
      issues.push({ line: ln, level: 'error', msg: 'Mermaid: `classDef end` uses a reserved keyword — rename (e.g. `classDef terminal`)' });
    }
    if (/\bclassDef\s+class\b/.test(raw)) {
      issues.push({ line: ln, level: 'error', msg: 'Mermaid: `classDef class` uses a reserved keyword — rename the class' });
    }
    if (/\bstyle\s+\w+\s+fill:#[A-Fa-f0-9]{3,6}[^,]*,\s*color:#[0-3][0-9a-f]{5}/i.test(raw)) {
      issues.push({ line: ln, level: 'warn', msg: 'Mermaid: dark text on potentially dark fill — use white text on dark/red backgrounds' });
    }
  }

  return issues;
}
