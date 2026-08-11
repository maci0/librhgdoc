import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
  uploadImageToDrive,
  uploadImageViaTempSlides,
  uploadImagesBatch,
  deleteGoogleDriveFile,
} from '../src/image-upload.ts';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

const TOKEN = 'test-oauth-token';
const FAKE_FILE_ID = 'fake-file-id-123';
const FAKE_PRES_ID = 'fake-pres-id-456';
const FAKE_CDN_URL = 'https://lh7-rt.googleusercontent.com/fake-image';

let fetchCalls: Array<{ url: string; init: RequestInit }>;
let originalFetch: typeof globalThis.fetch;

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    fetchCalls.push({ url, init: init ?? {} });
    return handler(url, init ?? {});
  }) as typeof fetch;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  fetchCalls = [];
});

afterEach(() => {
  if (originalFetch) globalThis.fetch = originalFetch;
});

// ─── deleteGoogleDriveFile ────────────────────────────────────────────────────

describe('deleteGoogleDriveFile', () => {
  test('sends DELETE to correct URL with auth header', async () => {
    mockFetch(() => new Response(null, { status: 204 }));

    await deleteGoogleDriveFile(TOKEN, FAKE_FILE_ID);

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe(
      `https://www.googleapis.com/drive/v3/files/${FAKE_FILE_ID}`,
    );
    expect(fetchCalls[0].init.method).toBe('DELETE');
    expect((fetchCalls[0].init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  test('succeeds silently for 404 (already deleted)', async () => {
    mockFetch(() => new Response('Not Found', { status: 404 }));
    await expect(deleteGoogleDriveFile(TOKEN, 'gone')).resolves.toBeUndefined();
  });

  test('throws on server error', async () => {
    mockFetch(() => new Response('Server Error', { status: 500 }));
    await expect(deleteGoogleDriveFile(TOKEN, 'bad')).rejects.toThrow('Drive delete failed');
  });
});

// ─── uploadImageToDrive ───────────────────────────────────────────────────────

describe('uploadImageToDrive', () => {
  test('sends multipart upload to Drive API with correct headers', async () => {
    mockFetch((url) => {
      if (url.includes('/upload/drive/v3/files')) {
        return jsonResponse({ id: FAKE_FILE_ID, webContentLink: 'https://drive.google.com/uc?id=fake' });
      }
      return new Response(null, { status: 204 }); // cleanup
    });

    const result = await uploadImageToDrive({
      token: TOKEN,
      base64: 'aGVsbG8=',
      mimeType: 'image/png',
      name: 'test.png',
    });

    expect(result.url).toBe('https://drive.google.com/uc?id=fake');
    expect(typeof result.cleanup).toBe('function');

    // Verify request
    const uploadCall = fetchCalls.find((c) => c.url.includes('/upload/drive/v3/files'));
    expect(uploadCall).toBeDefined();
    expect(uploadCall!.init.method).toBe('POST');
    const headers = uploadCall!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers['Content-Type']).toContain('multipart/related');
  });

  test('uses fallback URL when webContentLink is missing', async () => {
    mockFetch((url) => {
      if (url.includes('/upload/drive/v3/files')) {
        return jsonResponse({ id: FAKE_FILE_ID });
      }
      return new Response(null, { status: 204 });
    });

    const result = await uploadImageToDrive({
      token: TOKEN,
      base64: 'aGVsbG8=',
      mimeType: 'image/png',
    });

    expect(result.url).toContain(FAKE_FILE_ID);
  });

  test('throws when Drive API returns error', async () => {
    mockFetch(() => new Response('Unauthorized', { status: 401 }));

    await expect(
      uploadImageToDrive({ token: TOKEN, base64: 'aGVsbG8=', mimeType: 'image/png' }),
    ).rejects.toThrow('Drive upload failed');
  });
});

// ─── uploadImageViaTempSlides ─────────────────────────────────────────────────

describe('uploadImageViaTempSlides', () => {
  test('creates presentation, inserts image, reads CDN URL, and provides cleanup', async () => {
    mockFetch((url, init) => {
      // Create presentation
      if (url === 'https://slides.googleapis.com/v1/presentations' && init.method === 'POST') {
        return jsonResponse({
          presentationId: FAKE_PRES_ID,
          slides: [{ objectId: 'slide_0' }],
        });
      }
      // Batch update (insert image)
      if (url.includes(':batchUpdate')) {
        return jsonResponse({ replies: [] });
      }
      // Get presentation (read back CDN URL)
      if (url === `https://slides.googleapis.com/v1/presentations/${FAKE_PRES_ID}`) {
        return jsonResponse({
          slides: [{
            pageElements: [{
              objectId: 'librhgdoc_tmp_img_0',
              image: { contentUrl: FAKE_CDN_URL },
            }],
          }],
        });
      }
      // Cleanup delete
      return new Response(null, { status: 204 });
    });

    const result = await uploadImageViaTempSlides({
      token: TOKEN,
      base64: 'aGVsbG8=',
      mimeType: 'image/png',
    });

    expect(result.url).toBe(FAKE_CDN_URL);
    expect(typeof result.cleanup).toBe('function');
  });

  test('throws when presentation creation fails', async () => {
    mockFetch(() => new Response('Error', { status: 500 }));

    await expect(
      uploadImageViaTempSlides({ token: TOKEN, base64: 'aGVsbG8=', mimeType: 'image/png' }),
    ).rejects.toThrow('Slides creation failed');
  });
});

// ─── uploadImagesBatch ────────────────────────────────────────────────────────

describe('uploadImagesBatch', () => {
  test('returns empty array for empty input', async () => {
    const result = await uploadImagesBatch({ token: TOKEN, images: [] });
    expect(result).toEqual([]);
  });

  test('uploads multiple images in a single presentation', async () => {
    let batchUpdateCount = 0;

    mockFetch((url, init) => {
      // Create presentation
      if (url === 'https://slides.googleapis.com/v1/presentations' && init.method === 'POST') {
        return jsonResponse({
          presentationId: FAKE_PRES_ID,
          slides: [{ objectId: 'slide_0' }],
        });
      }
      // Batch updates (add slides + insert images)
      if (url.includes(':batchUpdate')) {
        batchUpdateCount++;
        return jsonResponse({ replies: [] });
      }
      // Get presentation
      if (url === `https://slides.googleapis.com/v1/presentations/${FAKE_PRES_ID}`) {
        return jsonResponse({
          slides: [
            {
              pageElements: [{
                objectId: 'librhgdoc_tmp_img_0',
                image: { contentUrl: `${FAKE_CDN_URL}/0` },
              }],
            },
            {
              pageElements: [{
                objectId: 'librhgdoc_tmp_img_1',
                image: { contentUrl: `${FAKE_CDN_URL}/1` },
              }],
            },
          ],
        });
      }
      return new Response(null, { status: 204 });
    });

    const result = await uploadImagesBatch({
      token: TOKEN,
      images: [
        { base64: 'img1data', mimeType: 'image/png' },
        { base64: 'img2data', mimeType: 'image/jpeg' },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0].url).toBe(`${FAKE_CDN_URL}/0`);
    expect(result[1].url).toBe(`${FAKE_CDN_URL}/1`);
    // Should have 2 batchUpdate calls: one for adding slides, one for inserting images
    expect(batchUpdateCount).toBe(2);
  });

  test('single image skips addSlides step', async () => {
    let batchUpdateCount = 0;

    mockFetch((url, init) => {
      if (url === 'https://slides.googleapis.com/v1/presentations' && init.method === 'POST') {
        return jsonResponse({
          presentationId: FAKE_PRES_ID,
          slides: [{ objectId: 'slide_0' }],
        });
      }
      if (url.includes(':batchUpdate')) {
        batchUpdateCount++;
        return jsonResponse({ replies: [] });
      }
      if (url === `https://slides.googleapis.com/v1/presentations/${FAKE_PRES_ID}`) {
        return jsonResponse({
          slides: [{
            pageElements: [{
              objectId: 'librhgdoc_tmp_img_0',
              image: { contentUrl: FAKE_CDN_URL },
            }],
          }],
        });
      }
      return new Response(null, { status: 204 });
    });

    const result = await uploadImagesBatch({
      token: TOKEN,
      images: [{ base64: 'singleimg', mimeType: 'image/png' }],
    });

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe(FAKE_CDN_URL);
    // Only 1 batchUpdate call (insert image, no addSlides needed)
    expect(batchUpdateCount).toBe(1);
  });

  test('cleanup function is attached to first result', async () => {
    mockFetch((url, init) => {
      if (url === 'https://slides.googleapis.com/v1/presentations' && init.method === 'POST') {
        return jsonResponse({
          presentationId: FAKE_PRES_ID,
          slides: [{ objectId: 'slide_0' }],
        });
      }
      if (url.includes(':batchUpdate')) return jsonResponse({ replies: [] });
      if (url === `https://slides.googleapis.com/v1/presentations/${FAKE_PRES_ID}`) {
        return jsonResponse({
          slides: [{
            pageElements: [{
              objectId: 'librhgdoc_tmp_img_0',
              image: { contentUrl: FAKE_CDN_URL },
            }],
          }],
        });
      }
      return new Response(null, { status: 204 });
    });

    const result = await uploadImagesBatch({
      token: TOKEN,
      images: [{ base64: 'data', mimeType: 'image/png' }],
    });

    expect(typeof result[0].cleanup).toBe('function');
  });

  test('auth header is set on all requests', async () => {
    mockFetch((url, init) => {
      if (url === 'https://slides.googleapis.com/v1/presentations' && init.method === 'POST') {
        return jsonResponse({
          presentationId: FAKE_PRES_ID,
          slides: [{ objectId: 'slide_0' }],
        });
      }
      if (url.includes(':batchUpdate')) return jsonResponse({ replies: [] });
      if (url === `https://slides.googleapis.com/v1/presentations/${FAKE_PRES_ID}`) {
        return jsonResponse({
          slides: [{
            pageElements: [{
              objectId: 'librhgdoc_tmp_img_0',
              image: { contentUrl: FAKE_CDN_URL },
            }],
          }],
        });
      }
      return new Response(null, { status: 204 });
    });

    await uploadImagesBatch({
      token: TOKEN,
      images: [{ base64: 'data', mimeType: 'image/png' }],
    });

    for (const call of fetchCalls) {
      const headers = call.init.headers as Record<string, string> | undefined;
      if (headers) {
        expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
      }
    }
  });
});
