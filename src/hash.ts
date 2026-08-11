/**
 * Content identity hashing for incremental sync.
 *
 * Uses the djb2 algorithm — fast and collision-resistant enough for
 * block-count workloads (typically a few hundred items). Non-code
 * content has its whitespace normalized so that trivial reformatting
 * doesn't change the hash.
 */

/**
 * Raw djb2 hash.
 *
 * @returns A base-36 string representation of the 32-bit hash.
 */
export function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Produce a stable content identity hash.
 *
 * For non-`"code"` types whitespace is collapsed so that trailing
 * spaces or re-wrapped paragraphs don't invalidate the hash. Code
 * blocks preserve whitespace because indentation is significant.
 *
 * @param type  - Block type label (e.g. `"body"`, `"code"`, `"h2"`).
 * @param text  - The text content to hash.
 * @param extra - Optional discriminator (language tag, metadata, …).
 */
export function contentHash(type: string, text: string, extra = ''): string {
  const normalized = type === 'code'
    ? text.trim()
    : text.trim().replace(/\s+/g, ' ');
  return djb2(`${type}\x00${normalized}\x00${extra}`);
}

/** Alias for {@link contentHash}. Matches the name used in templar. */
export const blockHash = contentHash;
