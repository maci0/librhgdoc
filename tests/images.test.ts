import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  IMAGE_EXTENSIONS,
  detectMimeType,
  mimeToExtension,
  isLocalPath,
  isImagePath,
  findImageRefs,
  readImageAsBase64,
  resolveImagePaths,
} from '../src/images.ts';

// ─── IMAGE_EXTENSIONS ─────────────────────────────────────────────────────────

describe('IMAGE_EXTENSIONS', () => {
  test('is a non-empty Set', () => {
    expect(IMAGE_EXTENSIONS).toBeInstanceOf(Set);
    expect(IMAGE_EXTENSIONS.size).toBeGreaterThan(0);
  });

  test('contains common image extensions', () => {
    expect(IMAGE_EXTENSIONS.has('.png')).toBe(true);
    expect(IMAGE_EXTENSIONS.has('.jpg')).toBe(true);
    expect(IMAGE_EXTENSIONS.has('.jpeg')).toBe(true);
    expect(IMAGE_EXTENSIONS.has('.gif')).toBe(true);
    expect(IMAGE_EXTENSIONS.has('.svg')).toBe(true);
    expect(IMAGE_EXTENSIONS.has('.webp')).toBe(true);
  });
});

// ─── detectMimeType ─────────────────────────────────────────────────────────

describe('detectMimeType', () => {
  test('returns image/png for .png', () => {
    expect(detectMimeType('photo.png')).toBe('image/png');
  });

  test('returns image/jpeg for .jpg', () => {
    expect(detectMimeType('photo.jpg')).toBe('image/jpeg');
  });

  test('returns image/jpeg for .jpeg', () => {
    expect(detectMimeType('photo.jpeg')).toBe('image/jpeg');
  });

  test('returns image/gif for .gif', () => {
    expect(detectMimeType('anim.gif')).toBe('image/gif');
  });

  test('returns image/svg+xml for .svg', () => {
    expect(detectMimeType('icon.svg')).toBe('image/svg+xml');
  });

  test('returns image/webp for .webp', () => {
    expect(detectMimeType('image.webp')).toBe('image/webp');
  });

  test('returns image/bmp for .bmp', () => {
    expect(detectMimeType('bitmap.bmp')).toBe('image/bmp');
  });

  test('returns image/tiff for .tiff', () => {
    expect(detectMimeType('scan.tiff')).toBe('image/tiff');
  });

  test('returns image/x-icon for .ico', () => {
    expect(detectMimeType('favicon.ico')).toBe('image/x-icon');
  });

  test('returns application/octet-stream for unknown extension', () => {
    expect(detectMimeType('file.xyz')).toBe('application/octet-stream');
  });

  test('is case-insensitive', () => {
    expect(detectMimeType('PHOTO.PNG')).toBe('image/png');
    expect(detectMimeType('image.JPG')).toBe('image/jpeg');
  });
});

// ─── mimeToExtension ─────────────────────────────────────────────────────────

describe('mimeToExtension', () => {
  test('returns .png for image/png', () => {
    expect(mimeToExtension('image/png')).toBe('.png');
  });

  test('returns .jpg for image/jpeg', () => {
    expect(mimeToExtension('image/jpeg')).toBe('.jpg');
  });

  test('returns .gif for image/gif', () => {
    expect(mimeToExtension('image/gif')).toBe('.gif');
  });

  test('returns .svg for image/svg+xml', () => {
    expect(mimeToExtension('image/svg+xml')).toBe('.svg');
  });

  test('returns .pdf for application/pdf', () => {
    expect(mimeToExtension('application/pdf')).toBe('.pdf');
  });

  test('returns .bin for unknown MIME type', () => {
    expect(mimeToExtension('unknown/type')).toBe('.bin');
  });

  test('is case-insensitive', () => {
    expect(mimeToExtension('IMAGE/PNG')).toBe('.png');
  });
});

// ─── isLocalPath ──────────────────────────────────────────────────────────────

describe('isLocalPath', () => {
  test('returns true for relative paths', () => {
    expect(isLocalPath('./image.png')).toBe(true);
    expect(isLocalPath('../img/photo.jpg')).toBe(true);
    expect(isLocalPath('images/test.gif')).toBe(true);
  });

  test('returns true for absolute paths', () => {
    expect(isLocalPath('/home/user/image.png')).toBe(true);
  });

  test('returns true for file:// URIs', () => {
    expect(isLocalPath('file:///tmp/image.png')).toBe(true);
  });

  test('returns false for http URLs', () => {
    expect(isLocalPath('http://example.com/image.png')).toBe(false);
  });

  test('returns false for https URLs', () => {
    expect(isLocalPath('https://example.com/image.png')).toBe(false);
  });

  test('returns false for data URIs', () => {
    expect(isLocalPath('data:image/png;base64,abc123')).toBe(false);
  });
});

// ─── isImagePath ──────────────────────────────────────────────────────────────

describe('isImagePath', () => {
  test('returns true for image extensions', () => {
    expect(isImagePath('photo.png')).toBe(true);
    expect(isImagePath('photo.jpg')).toBe(true);
    expect(isImagePath('photo.jpeg')).toBe(true);
    expect(isImagePath('photo.gif')).toBe(true);
    expect(isImagePath('photo.svg')).toBe(true);
    expect(isImagePath('photo.webp')).toBe(true);
  });

  test('returns false for non-image extensions', () => {
    expect(isImagePath('doc.pdf')).toBe(false);
    expect(isImagePath('script.ts')).toBe(false);
    expect(isImagePath('readme.md')).toBe(false);
    expect(isImagePath('data.json')).toBe(false);
  });

  test('is case-insensitive', () => {
    expect(isImagePath('PHOTO.PNG')).toBe(true);
    expect(isImagePath('image.JPG')).toBe(true);
  });
});

// ─── findImageRefs ────────────────────────────────────────────────────────────

describe('findImageRefs', () => {
  test('finds local image references', () => {
    const md = '![logo](./images/logo.png)\nSome text\n![photo](../photo.jpg)';
    const refs = findImageRefs(md);
    expect(refs).toHaveLength(2);
    expect(refs[0].alt).toBe('logo');
    expect(refs[0].path).toBe('./images/logo.png');
    expect(refs[0].originalMarkdown).toBe('![logo](./images/logo.png)');
    expect(refs[1].alt).toBe('photo');
    expect(refs[1].path).toBe('../photo.jpg');
  });

  test('skips remote URLs', () => {
    const md = '![remote](https://example.com/img.png)\n![local](./img.png)';
    const refs = findImageRefs(md);
    expect(refs).toHaveLength(1);
    expect(refs[0].path).toBe('./img.png');
  });

  test('skips http URLs', () => {
    const md = '![remote](http://example.com/img.png)';
    const refs = findImageRefs(md);
    expect(refs).toHaveLength(0);
  });

  test('skips data URIs', () => {
    const md = '![embedded](data:image/png;base64,abc123)';
    const refs = findImageRefs(md);
    expect(refs).toHaveLength(0);
  });

  test('skips images inside fenced code blocks', () => {
    const md = '```\n![code](./img.png)\n```\n![real](./real.png)';
    const refs = findImageRefs(md);
    expect(refs).toHaveLength(1);
    expect(refs[0].path).toBe('./real.png');
  });

  test('finds multiple images on one line', () => {
    const md = '![a](a.png) ![b](b.png)';
    const refs = findImageRefs(md);
    expect(refs).toHaveLength(2);
  });

  test('handles empty alt text', () => {
    const md = '![](image.png)';
    const refs = findImageRefs(md);
    expect(refs).toHaveLength(1);
    expect(refs[0].alt).toBe('');
  });

  test('returns empty array for no images', () => {
    const refs = findImageRefs('Just some text, no images here.');
    expect(refs).toHaveLength(0);
  });

  test('skips images inside tilde code fence', () => {
    const md = '~~~\n![img](path.png)\n~~~';
    const refs = findImageRefs(md);
    expect(refs).toHaveLength(0);
  });
});

// ─── readImageAsBase64 ────────────────────────────────────────────────────────

describe('readImageAsBase64', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'librhgdoc-img-test-'));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('reads a file and returns base64 + mimeType', async () => {
    const content = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const filePath = join(tmpDir, 'test.png');
    await Bun.write(filePath, content);

    const result = await readImageAsBase64(filePath);
    expect(result.mimeType).toBe('image/png');
    expect(result.base64).toBe(content.toString('base64'));
  });

  test('detects JPEG mime type', async () => {
    const filePath = join(tmpDir, 'test.jpg');
    await Bun.write(filePath, Buffer.from([0xff, 0xd8, 0xff]));

    const result = await readImageAsBase64(filePath);
    expect(result.mimeType).toBe('image/jpeg');
  });

  test('throws for non-existent file', async () => {
    await expect(readImageAsBase64(join(tmpDir, 'nonexistent.png'))).rejects.toThrow();
  });
});

// ─── resolveImagePaths ────────────────────────────────────────────────────────

describe('resolveImagePaths', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'librhgdoc-resolve-test-'));
    await Bun.write(join(tmpDir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await Bun.write(join(tmpDir, 'photo.jpg'), Buffer.from([0xff, 0xd8, 0xff]));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('replaces local images with placeholders', async () => {
    const md = '![Logo](logo.png)\nSome text\n![Photo](photo.jpg)';
    const result = await resolveImagePaths(md, tmpDir);

    expect(result.markdown).toContain('[[IMAGE_0]]');
    expect(result.markdown).toContain('[[IMAGE_1]]');
    expect(result.markdown).not.toContain('logo.png');
    expect(result.markdown).not.toContain('photo.jpg');
  });

  test('returns image data array', async () => {
    const md = '![Logo](logo.png)';
    const result = await resolveImagePaths(md, tmpDir);

    expect(result.images).toHaveLength(1);
    expect(result.images[0].index).toBe(0);
    expect(result.images[0].alt).toBe('Logo');
    expect(result.images[0].mimeType).toBe('image/png');
    expect(result.images[0].originalPath).toBe('logo.png');
    expect(result.images[0].base64.length).toBeGreaterThan(0);
  });

  test('leaves remote URLs unchanged', async () => {
    const md = '![remote](https://example.com/img.png)\n![local](logo.png)';
    const result = await resolveImagePaths(md, tmpDir);

    expect(result.markdown).toContain('https://example.com/img.png');
    expect(result.images).toHaveLength(1);
  });

  test('leaves non-existent files unchanged', async () => {
    const md = '![missing](nonexistent.png)';
    const result = await resolveImagePaths(md, tmpDir);

    expect(result.markdown).toContain('nonexistent.png');
    expect(result.images).toHaveLength(0);
  });

  test('skips images inside code blocks', async () => {
    const md = '```\n![code](logo.png)\n```\n![real](logo.png)';
    const result = await resolveImagePaths(md, tmpDir);

    expect(result.images).toHaveLength(1);
    expect(result.markdown).toContain('[[IMAGE_0]]');
  });

  test('handles empty markdown', async () => {
    const result = await resolveImagePaths('', tmpDir);
    expect(result.markdown).toBe('');
    expect(result.images).toHaveLength(0);
  });
});

// ─── detectMimeType (office/document types) ──────────────────────────────────

describe('detectMimeType (office/document types)', () => {
  test('returns application/pdf for .pdf', () => {
    expect(detectMimeType('doc.pdf')).toBe('application/pdf');
  });

  test('returns correct type for .docx', () => {
    expect(detectMimeType('report.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  test('returns correct type for .doc', () => {
    expect(detectMimeType('old.doc')).toBe('application/msword');
  });

  test('returns correct type for .xlsx', () => {
    expect(detectMimeType('data.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  test('returns correct type for .xls', () => {
    expect(detectMimeType('data.xls')).toBe('application/vnd.ms-excel');
  });

  test('returns correct type for .pptx', () => {
    expect(detectMimeType('slides.pptx')).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
  });

  test('returns correct type for .ppt', () => {
    expect(detectMimeType('old.ppt')).toBe('application/vnd.ms-powerpoint');
  });

  test('returns application/zip for .zip', () => {
    expect(detectMimeType('archive.zip')).toBe('application/zip');
  });

  test('returns application/gzip for .gz', () => {
    expect(detectMimeType('log.gz')).toBe('application/gzip');
  });

  test('returns application/x-tar for .tar', () => {
    expect(detectMimeType('archive.tar')).toBe('application/x-tar');
  });

  test('returns text/csv for .csv', () => {
    expect(detectMimeType('data.csv')).toBe('text/csv');
  });

  test('returns application/json for .json', () => {
    expect(detectMimeType('config.json')).toBe('application/json');
  });

  test('returns application/xml for .xml', () => {
    expect(detectMimeType('feed.xml')).toBe('application/xml');
  });

  test('returns text/plain for .txt', () => {
    expect(detectMimeType('readme.txt')).toBe('text/plain');
  });

  test('returns text/markdown for .md', () => {
    expect(detectMimeType('doc.md')).toBe('text/markdown');
  });

  test('returns text/yaml for .yaml and .yml', () => {
    expect(detectMimeType('config.yaml')).toBe('text/yaml');
    expect(detectMimeType('config.yml')).toBe('text/yaml');
  });

  test('returns text/html for .html', () => {
    expect(detectMimeType('page.html')).toBe('text/html');
  });

  test('returns correct type for OpenDocument formats', () => {
    expect(detectMimeType('doc.odt')).toBe('application/vnd.oasis.opendocument.text');
    expect(detectMimeType('sheet.ods')).toBe('application/vnd.oasis.opendocument.spreadsheet');
    expect(detectMimeType('pres.odp')).toBe('application/vnd.oasis.opendocument.presentation');
  });

  test('is case-insensitive for new types', () => {
    expect(detectMimeType('DOC.PDF')).toBe('application/pdf');
    expect(detectMimeType('DATA.JSON')).toBe('application/json');
  });
});
