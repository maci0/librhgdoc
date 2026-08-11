/**
 * Heading slug generation (GitHub-style anchors).
 *
 * Produces the same slug format that GitHub uses for heading anchor
 * links, making `#fragment` links in Markdown portable.
 */

/**
 * Convert heading text to a GitHub-style anchor slug.
 *
 * Lowercases the text, strips non-word characters (except spaces and
 * hyphens), converts spaces to hyphens, and collapses consecutive
 * hyphens.
 *
 * @example
 * ```ts
 * toSlug('MachineConfig & Pool') // → 'machineconfig--pool' → 'machineconfig-pool'
 * ```
 */
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
