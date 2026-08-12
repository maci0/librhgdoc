/**
 * Local image detection, resolution, and base64 encoding.
 *
 * Scans Markdown for `![alt](path)` references to local images, reads them
 * from disk, base64-encodes the content, and optionally replaces them with
 * `[[IMAGE_N]]` placeholders for downstream processing.
 *
 * @module
 */

import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

/** Map of file extensions to MIME types for recognized image formats. */
const IMAGE_MIME_MAP: Record<string, string> = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
  '.bmp':  'image/bmp',
  '.tiff': 'image/tiff',
  '.tif':  'image/tiff',
  '.ico':  'image/x-icon',
};

/** Map of file extensions to MIME types for document, office, archive, and data formats. */
const DOC_MIME_MAP: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls':  'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt':  'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip':  'application/zip',
  '.gz':   'application/gzip',
  '.tar':  'application/x-tar',
  '.csv':  'text/csv',
  '.json': 'application/json',
  '.xml':  'application/xml',
  '.txt':  'text/plain',
  '.md':   'text/markdown',
  '.yaml': 'text/yaml',
  '.yml':  'text/yaml',
  '.html': 'text/html',
  '.odt':  'application/vnd.oasis.opendocument.text',
  '.ods':  'application/vnd.oasis.opendocument.spreadsheet',
  '.odp':  'application/vnd.oasis.opendocument.presentation',
};

/** Combined MIME map for all recognized file types (images + documents). */
const MIME_MAP: Record<string, string> = { ...IMAGE_MIME_MAP, ...DOC_MIME_MAP };

/** Set of recognized image file extensions (e.g. `.png`, `.jpg`). */
export const IMAGE_EXTENSIONS = new Set(Object.keys(IMAGE_MIME_MAP));

/** Map a MIME type string to a file extension (with leading dot).
 * Returns `'.bin'` for unrecognized MIME types.
 * @example mimeToExtension('image/jpeg') // → '.jpg' */
export function mimeToExtension(mime: string): string {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
    'image/x-icon': '.ico',
    'application/pdf': '.pdf',
    'application/zip': '.zip',
    'text/plain': '.txt',
    'text/html': '.html',
    'text/markdown': '.md',
    'application/json': '.json',
    'application/xml': '.xml',
    'text/csv': '.csv',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/gzip': '.gz',
    'application/x-tar': '.tar',
    'text/yaml': '.yaml',
    'application/vnd.oasis.opendocument.text': '.odt',
    'application/vnd.oasis.opendocument.spreadsheet': '.ods',
    'application/vnd.oasis.opendocument.presentation': '.odp',
  };
  return map[mime.toLowerCase()] ?? '.bin';
}

/**
 * Detect the MIME type of an image file from its extension.
 *
 * @param filePath - Path to the image file.
 * @returns The detected MIME type, or `application/octet-stream` for unknown extensions.
 */
export function detectMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

/**
 * Check whether a URL or path refers to a local file.
 *
 * Returns `false` for `http://`, `https://`, and `data:` URIs.
 * Returns `true` for relative paths, absolute paths, and `file://` URIs.
 *
 * @param url - The URL or file path to check.
 */
export function isLocalPath(url: string): boolean {
  if (/^https?:\/\//i.test(url)) return false;
  if (url.startsWith('data:')) return false;
  return true;
}

/**
 * Check whether a file path has a recognized image extension.
 *
 * @param filePath - The file path to check.
 */
export function isImagePath(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

/** A reference to a local image found in Markdown. */
export interface ImageRef {
  /** The alt text from `![alt](path)`. */
  alt: string;
  /** The local file path from the Markdown reference. */
  path: string;
  /** The full original Markdown syntax, e.g. `![alt](path)`. */
  originalMarkdown: string;
}

/**
 * Find all `![alt](path)` references in Markdown where the path is a local file.
 *
 * Skips references inside fenced code blocks, and skips remote URLs
 * (`http://`, `https://`) and `data:` URIs.
 *
 * @param markdown - The Markdown source to scan.
 * @returns An array of image references found.
 */
export function findImageRefs(markdown: string): ImageRef[] {
  const refs: ImageRef[] = [];
  const lines = markdown.split('\n');
  let inCode = false;

  for (const line of lines) {
    if (/^\s*```/.test(line) || /^\s*~~~/.test(line)) { inCode = !inCode; continue; }
    if (inCode) continue;

    const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const [originalMarkdown, alt, path] = m;
      if (!isLocalPath(path)) continue;
      refs.push({ alt, path, originalMarkdown });
    }
  }

  return refs;
}

/**
 * Read a local image file and return its base64-encoded content with MIME type.
 *
 * @param filePath - Absolute or relative path to the image file.
 * @returns An object with `base64` (the encoded content) and `mimeType`.
 * @throws If the file cannot be read.
 */
export async function readImageAsBase64(
  filePath: string,
): Promise<{ base64: string; mimeType: string }> {
  const buf = await readFile(filePath);
  const base64 = buf.toString('base64');
  const mimeType = detectMimeType(filePath);
  return { base64, mimeType };
}

/**
 * Find all local image references in Markdown, read the files, replace them
 * with `[[IMAGE_N]]` placeholders, and return the modified Markdown along with
 * the image data.
 *
 * Images are resolved relative to `basePath`. Remote URLs and `data:` URIs
 * are left unchanged. References inside fenced code blocks are skipped.
 *
 * @param markdown  - The Markdown source.
 * @param basePath  - Directory to resolve relative image paths against.
 * @returns Modified Markdown with placeholders and an array of image data.
 */
export async function resolveImagePaths(
  markdown: string,
  basePath: string,
): Promise<{
  markdown: string;
  images: Array<{
    index: number;
    alt: string;
    base64: string;
    mimeType: string;
    originalPath: string;
  }>;
}> {
  const images: Array<{
    index: number;
    alt: string;
    base64: string;
    mimeType: string;
    originalPath: string;
  }> = [];

  let idx = 0;
  const lines = markdown.split('\n');
  const outLines: string[] = [];
  let inCode = false;

  for (const line of lines) {
    if (/^\s*```/.test(line) || /^\s*~~~/.test(line)) { inCode = !inCode; outLines.push(line); continue; }
    if (inCode) { outLines.push(line); continue; }

    let result = line;
    const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const replacements: Array<{ match: string; replacement: string }> = [];
    let m: RegExpExecArray | null;

    while ((m = re.exec(line)) !== null) {
      const [match, alt, src] = m;
      if (!isLocalPath(src)) continue;

      const absPath = resolve(basePath, src);
      try {
        const { base64, mimeType } = await readImageAsBase64(absPath);
        const imageIdx = idx++;
        images.push({ index: imageIdx, alt, base64, mimeType, originalPath: src });
        replacements.push({ match, replacement: `[[IMAGE_${imageIdx}]]` });
      } catch {
        // File not found or unreadable — leave the reference unchanged
      }
    }

    for (const { match, replacement } of replacements) {
      result = result.replace(match, replacement);
    }
    outLines.push(result);
  }

  return { markdown: outLines.join('\n'), images };
}
