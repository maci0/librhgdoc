/**
 * YAML frontmatter parse / serialise / round-trip utilities.
 *
 * Supports the subset of YAML used in Markdown frontmatter blocks:
 * scalar values, inline arrays (`[a, b]`), and block sequences
 * (`- item`). No full YAML library is required.
 */

/**
 * Parse YAML-style frontmatter text into a key→value record.
 *
 * Handles:
 * - Scalar values: `key: value`
 * - Quoted scalars: `key: "value"` or `key: 'value'`
 * - Inline arrays: `key: ["a", "b"]` or `key: [a, b]`
 * - Block sequences: indented `- item` lines under a bare `key:`
 * - Block sequences of objects: `- name: Alice\n  role: dev`
 *
 * @param text - The raw YAML text (without `---` delimiters).
 */
export function parseFrontmatter(text: string): Record<string, string | string[] | Record<string, string>[]> {
  const data: Record<string, any> = {};
  if (!text || !text.trim()) return data;
  const lines = text.split(/\r?\n/);
  let i = 0;

  const parseScalar = (value: string): string =>
    value.trim().replace(/^["']|["']$/g, '');

  const parseKeyValue = (value: string): [string, string] | undefined => {
    const m = value.match(/^([A-Za-z0-9_][\w-]*):\s*(.*)$/);
    return m ? [m[1], parseScalar(m[2])] : undefined;
  };

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) { i++; continue; }

    const keyMatch = line.match(/^([A-Za-z0-9_][\w-]*):\s*(.*)$/);
    if (!keyMatch) { i++; continue; }

    const key = keyMatch[1];
    let val = keyMatch[2].trim();

    // ── Block sequence (bare `key:` followed by `- item` lines) ──
    if (val === '') {
      const items: any[] = [];
      i++;
      while (i < lines.length) {
        const rawNext = lines[i];
        const itemMatch = rawNext.match(/^(\s*)-\s+(.*)$/);
        if (itemMatch) {
          const itemIndent = itemMatch[1].length;
          const itemValue = itemMatch[2].trim();
          const firstPair = parseKeyValue(itemValue);

          if (firstPair) {
            // Object item: `- key: val` possibly followed by indented siblings
            const obj: Record<string, string> = { [firstPair[0]]: firstPair[1] };
            i++;
            while (i < lines.length) {
              const rawChild = lines[i];
              const child = rawChild.trim();
              if (!child) { i++; continue; }
              const childIndent = rawChild.length - rawChild.trimStart().length;
              if (childIndent <= itemIndent || child.startsWith('- ')) break;
              const pair = parseKeyValue(child);
              if (pair) obj[pair[0]] = pair[1];
              i++;
            }
            items.push(obj);
          } else {
            items.push(parseScalar(itemValue));
            i++;
          }
        } else if (rawNext.trim() === '' || rawNext.match(/^\s/)) {
          i++;
        } else {
          break;
        }
      }
      if (items.length) data[key] = items;
      continue;
    }

    // ── Inline array `["a","b"]` or `[a, b]` ───────────────────────
    if (val.startsWith('[')) {
      const inner = val.slice(1, -1);
      data[key] = inner
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
        .map((s: string) => s.replace(/^["']|["']$/g, ''));
      i++;
      continue;
    }

    // ── Scalar ──────────────────────────────────────────────────────
    data[key] = parseScalar(val);
    i++;
  }
  return data;
}

/**
 * Serialise a data record back to YAML frontmatter body text.
 *
 * Returns just the YAML body **without** `---` delimiters. Callers that
 * need the full fenced block (e.g. {@link replaceFrontmatter}) add the
 * delimiters themselves. Scalars that YAML would misparse (empty
 * strings, leading special characters, boolean/null literals, bare
 * numbers) are automatically quoted.
 *
 * @param data - Key→value record to serialise.
 */
export function stringifyFrontmatter(data: Record<string, unknown>): string {
  const quoteYamlScalar = (val: unknown): string => {
    const s = String(val);
    const needsQuote =
      s === '' ||
      /^[\[{'"#]/.test(s) ||
      s.includes(': ') ||
      /^(true|false|null|~)$/i.test(s) ||
      /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s);
    return needsQuote ? `"${s.replace(/"/g, '\\"')}"` : s;
  };

  let out = '';
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;

    if (Array.isArray(v)) {
      const itemLines: string[] = [];
      for (const item of v) {
        if (typeof item === 'object' && item !== null) {
          const entries = Object.entries(item).filter(
            ([, val]) => val !== undefined && val !== null,
          );
          if (entries.length === 0) continue;
          const [[firstKey, firstVal], ...rest] = entries;
          itemLines.push(`  - ${firstKey}: ${quoteYamlScalar(firstVal)}`);
          for (const [childKey, childVal] of rest) {
            itemLines.push(`    ${childKey}: ${quoteYamlScalar(childVal)}`);
          }
        } else {
          itemLines.push(`  - ${quoteYamlScalar(item)}`);
        }
      }
      if (itemLines.length > 0) {
        out += `${k}:\n${itemLines.join('\n')}\n`;
      }
    } else {
      out += `${k}: ${quoteYamlScalar(v)}\n`;
    }
  }
  return out;
}

/** Regex matching a YAML frontmatter block at the start of a string. */
const FRONTMATTER_BLOCK_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Split a Markdown string into its frontmatter text and remaining body.
 *
 * @returns An object with `frontmatter` (raw YAML text, no delimiters)
 *          and `body` (everything after the closing `---`), or `null`
 *          if no frontmatter block is found.
 */
export function extractFrontmatter(
  markdown: string,
): { frontmatter: string; body: string } | null {
  const m = markdown.match(FRONTMATTER_BLOCK_RE);
  if (!m) return null;
  return {
    frontmatter: m[1],
    body: markdown.slice(m[0].length),
  };
}

/**
 * Replace (or insert) the frontmatter in a Markdown string.
 *
 * If the string already has a frontmatter block it is replaced;
 * otherwise the new frontmatter is prepended.
 *
 * @param markdown - Full Markdown source.
 * @param data     - New frontmatter data.
 */
export function replaceFrontmatter(
  markdown: string,
  data: Record<string, unknown>,
): string {
  const newFm = stringifyFrontmatter(data);
  const rest = markdown.replace(FRONTMATTER_BLOCK_RE, '');
  return `---\n${newFm}---\n${rest}`;
}
