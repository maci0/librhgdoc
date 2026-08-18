/**
 * Inline Markdown parser — converts inline markup to structured text runs.
 *
 * Handles: `**bold**`, `__bold__`, `*italic*`, `_italic_`,
 * `` `code` ``, `[text](url)`, `~~strikethrough~~`, `![alt](url)`,
 * backslash escapes (`\*literal\*`), and nested combinations
 * (e.g. `[**bold link**](url)` or `**text with \`code\` inside**`).
 *
 * The parser is recursive: bold/italic handlers call {@link parseInline}
 * on their inner content, propagating the parent style. This correctly
 * handles `**bold containing \`code\`**` — the code segment receives
 * both `code: true` and `bold: true`.
 *
 * Underscore-based formatting (`__bold__`, `_italic_`) only triggers at
 * word boundaries — underscores inside words (e.g. `snake_case_name`)
 * are left as plain text.
 */

/** A single styled text run produced by {@link parseInline}. */
export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strikethrough?: boolean;
  /** URL target: `https://…`, `mailto:…`, or `#slug` fragment link. */
  link?: string;
}

/**
 * Parse inline Markdown into an array of styled {@link TextRun}s.
 *
 * Recognises `**bold**`, `*italic*`, `` `code` ``, `[text](url)`, and
 * `~~strikethrough~~`. Styles nest: a bold region may contain italic
 * and code spans. Parent bold/italic state is propagated downward.
 *
 * @param text         - Raw inline Markdown string.
 * @param parentBold   - Whether an enclosing context is already bold.
 * @param parentItalic - Whether an enclosing context is already italic.
 */
export function parseInline(
  text: string,
  parentBold = false,
  parentItalic = false,
): TextRun[] {
  const runs: TextRun[] = [];
  let i = 0;

  while (i < text.length) {
    // ── Backslash escape ─────────────────────────────────────────────
    if (text[i] === '\\' && i + 1 < text.length) {
      runs.push({
        text: text[i + 1],
        bold: parentBold || undefined,
        italic: parentItalic || undefined,
      });
      i += 2;
      continue;
    }

    // ── Image ![alt](url) — passthrough as plain alt text ───────────
    if (text[i] === '!' && text[i + 1] === '[') {
      const close = text.indexOf(']', i + 2);
      if (close > i + 1 && text[close + 1] === '(') {
        const urlEnd = text.indexOf(')', close + 2);
        if (urlEnd > close + 1) {
          const alt = text.slice(i + 2, close);
          if (alt) {
            runs.push({
              text: alt,
              bold: parentBold || undefined,
              italic: parentItalic || undefined,
            });
          }
          i = urlEnd + 1;
          continue;
        }
      }
    }

    // ── Strikethrough ~~text~~ ──────────────────────────────────────
    if (text[i] === '~' && text[i + 1] === '~') {
      const end = text.indexOf('~~', i + 2);
      if (end > i + 2) {
        for (const run of parseInline(text.slice(i + 2, end), parentBold, parentItalic))
          runs.push({ ...run, strikethrough: true });
        i = end + 2;
        continue;
      }
    }

    // ── Bold **text** ──────────────────────────────────────────────
    if (text[i] === '*' && text[i + 1] === '*') {
      let end = text.indexOf('**', i + 2);
      if (end > i + 2) {
        // Handle *** as italic-close + bold-close: when the inner text
        // has an unmatched italic * and the closing ** is immediately
        // followed by another *, shift end forward by one so the inner
        // text receives the closing *.
        if (text[end + 2] === '*') {
          const inner = text.slice(i + 2, end);
          let singles = 0;
          for (let k = 0; k < inner.length; k++) {
            if (inner[k] === '*' &&
                (k === 0 || inner[k - 1] !== '*') &&
                (k === inner.length - 1 || inner[k + 1] !== '*'))
              singles++;
          }
          if (singles % 2 === 1) end++;
        }
        for (const run of parseInline(text.slice(i + 2, end), true, parentItalic))
          runs.push({ ...run, bold: true });
        i = end + 2;
        continue;
      }
    }

    // ── Bold __text__ (word-boundary only) ──────────────────────────
    if (text[i] === '_' && text[i + 1] === '_') {
      // Only at word boundary: preceded by start-of-string, whitespace, or punctuation
      const prevChar = i > 0 ? text[i - 1] : ' ';
      if (/[\s\p{P}]/u.test(prevChar)) {
        const end = text.indexOf('__', i + 2);
        if (end > i + 2) {
          // Closing __ must also be at word boundary (followed by end/whitespace/punct)
          const afterClose = text[end + 2];
          if (afterClose === undefined || /[\s\p{P}]/u.test(afterClose)) {
            for (const run of parseInline(text.slice(i + 2, end), true, parentItalic))
              runs.push({ ...run, bold: true });
            i = end + 2;
            continue;
          }
        }
      }
    }

    // ── Italic *text* ───────────────────────────────────────────────
    if (text[i] === '*' && text[i + 1] !== '*') {
      let end = -1;
      for (let k = i + 1; k < text.length; k++) {
        if (text[k] === '*' && text[k + 1] !== '*' && text[k - 1] !== '*') { end = k; break; }
      }
      if (end > i + 1) {
        for (const run of parseInline(text.slice(i + 1, end), parentBold, true))
          runs.push({ ...run, italic: true });
        i = end + 1;
        continue;
      }
    }

    // ── Italic _text_ (word-boundary only) ──────────────────────────
    if (text[i] === '_' && text[i + 1] !== '_') {
      const prevChar = i > 0 ? text[i - 1] : ' ';
      if (/[\s\p{P}]/u.test(prevChar)) {
        let end = -1;
        for (let k = i + 1; k < text.length; k++) {
          if (text[k] === '_' && text[k + 1] !== '_' && text[k - 1] !== '_') {
            const afterClose = text[k + 1];
            if (afterClose === undefined || /[\s\p{P}]/u.test(afterClose)) {
              end = k;
              break;
            }
          }
        }
        if (end > i + 1) {
          for (const run of parseInline(text.slice(i + 1, end), parentBold, true))
            runs.push({ ...run, italic: true });
          i = end + 1;
          continue;
        }
      }
    }

    // ── Inline code `text` ──────────────────────────────────────────
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i + 1) {
        runs.push({
          text: text.slice(i + 1, end),
          code: true,
          bold: parentBold || undefined,
          italic: parentItalic || undefined,
        });
        i = end + 1;
        continue;
      }
    }

    // ── Link [text](url) ────────────────────────────────────────────
    if (text[i] === '[') {
      const close = text.indexOf(']', i + 1);
      if (close > i && text[close + 1] === '(') {
        const urlEnd = text.indexOf(')', close + 2);
        if (urlEnd > close + 2) {
          const url = text.slice(close + 2, urlEnd);
          const isFragment = url.startsWith('#');
          const safeUrl = /^(https?:\/\/|mailto:)/.test(url)
            ? url
            : isFragment
              ? url
              : undefined;
          for (const run of parseInline(text.slice(i + 1, close), parentBold, parentItalic))
            runs.push(safeUrl ? { ...run, link: safeUrl } : { ...run });
          i = urlEnd + 1;
          continue;
        }
      }
    }

    // ── Plain text ──────────────────────────────────────────────────
    let j = i + 1;
    while (j < text.length) {
      const ch = text[j];
      if (ch === '*' || ch === '`' || ch === '[' || ch === '~' || ch === '!' || ch === '\\') break;
      // Only stop at _ if it's at a word boundary (preceded by whitespace/punctuation)
      if (ch === '_') {
        const prev = j > 0 ? text[j - 1] : ' ';
        if (/[\s\p{P}]/u.test(prev)) break;
      }
      j++;
    }
    runs.push({
      text: text.slice(i, j),
      bold: parentBold || undefined,
      italic: parentItalic || undefined,
    });
    i = j;
  }

  return runs.filter(r => r.text);
}

/** Alias for {@link TextRun}. Matches the name used in templar. */
export type InlineSeg = TextRun;

/**
 * Strip inline Markdown formatting, returning plain text.
 *
 * Removes `**bold**`, `__bold__`, `*italic*`, `_italic_`,
 * `` `code` ``, `[text](url)`, `![alt](url)`, `~~strikethrough~~`,
 * and backslash escapes.
 */
export function stripInline(s: string): string {
  // Replace backslash escapes with a placeholder to prevent the escaped
  // characters from being consumed by subsequent formatting regexes.
  const ESC_PREFIX = '\x00ESC';
  let result = s.replace(/\\([\\*`_~\[!#>])/g, (_m, ch) => `${ESC_PREFIX}${ch.charCodeAt(0)}\x00`);
  result = result
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images → alt text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/(?<=^|[\s\p{P}])_(.+?)_(?=$|[\s\p{P}])/gu, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/~~(.+?)~~/g, '$1');
  // Restore escaped characters from placeholders
  result = result.replace(/\x00ESC(\d+)\x00/g, (_m, code) => String.fromCharCode(Number(code)));
  return result.trim();
}
