import { describe, test, expect } from 'bun:test';
import { findOrCreateFolder, moveFileToFolder } from '../src/drive.ts';

// ─── findOrCreateFolder ─────────────────────────────────────────────────────

describe('findOrCreateFolder', () => {
  test('returns existing folder ID when found', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: any, init?: any) => {
      if (!init?.method || init.method === 'GET') {
        // List endpoint (GET is default)
        return new Response(JSON.stringify({
          files: [{ id: 'existing-folder-id', name: 'My Folder' }],
        }), { status: 200 });
      }
      return new Response('unexpected', { status: 500 });
    }) as unknown as typeof fetch;
    try {
      const id = await findOrCreateFolder('tok', 'My Folder');
      expect(id).toBe('existing-folder-id');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('creates folder when not found', async () => {
    const origFetch = globalThis.fetch;
    let createCalled = false;
    globalThis.fetch = (async (url: any, init?: any) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (init?.method === 'POST') {
        createCalled = true;
        const body = JSON.parse(init.body);
        expect(body.name).toBe('New Folder');
        expect(body.mimeType).toBe('application/vnd.google-apps.folder');
        return new Response(JSON.stringify({ id: 'new-folder-id' }), { status: 200 });
      }
      // List returns empty
      return new Response(JSON.stringify({ files: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    try {
      const id = await findOrCreateFolder('tok', 'New Folder');
      expect(id).toBe('new-folder-id');
      expect(createCalled).toBe(true);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('includes parentId in search query when provided', async () => {
    const origFetch = globalThis.fetch;
    let capturedUrl = '';
    globalThis.fetch = (async (url: any) => {
      capturedUrl = typeof url === 'string' ? url : url.toString();
      return new Response(JSON.stringify({
        files: [{ id: 'child-folder-id' }],
      }), { status: 200 });
    }) as unknown as typeof fetch;
    try {
      await findOrCreateFolder('tok', 'Sub', 'parent-123');
      // URLSearchParams encodes single quotes as %27; verify parent constraint is in query
      expect(capturedUrl).toContain("%27parent-123%27+in+parents");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('sets parents on create when parentId provided', async () => {
    const origFetch = globalThis.fetch;
    let createBody: any = null;
    globalThis.fetch = (async (url: any, init?: any) => {
      if (init?.method === 'POST') {
        createBody = JSON.parse(init.body);
        return new Response(JSON.stringify({ id: 'new-id' }), { status: 200 });
      }
      return new Response(JSON.stringify({ files: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    try {
      await findOrCreateFolder('tok', 'Child', 'parent-xyz');
      expect(createBody.parents).toEqual(['parent-xyz']);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('throws on search API error', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response('forbidden', { status: 403 })
    ) as unknown as typeof fetch;
    try {
      await expect(findOrCreateFolder('tok', 'X')).rejects.toThrow('Drive folder search failed (403)');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('throws on create API error', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: any, init?: any) => {
      if (init?.method === 'POST') {
        return new Response('quota exceeded', { status: 429 });
      }
      return new Response(JSON.stringify({ files: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    try {
      await expect(findOrCreateFolder('tok', 'X')).rejects.toThrow('Drive folder creation failed (429)');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('throws when create returns no ID', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: any, init?: any) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({}), { status: 200 });
      }
      return new Response(JSON.stringify({ files: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    try {
      await expect(findOrCreateFolder('tok', 'X')).rejects.toThrow('Drive folder creation returned no file ID');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('escapes single quotes in folder name', async () => {
    const origFetch = globalThis.fetch;
    let capturedUrl = '';
    globalThis.fetch = (async (url: any) => {
      capturedUrl = typeof url === 'string' ? url : url.toString();
      return new Response(JSON.stringify({ files: [{ id: 'id' }] }), { status: 200 });
    }) as unknown as typeof fetch;
    try {
      await findOrCreateFolder('tok', "It's a folder");
      // The escaped quote should be present in the query string
      expect(capturedUrl).toContain("It%5C%27s");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('sends Authorization header', async () => {
    const origFetch = globalThis.fetch;
    let capturedHeaders: Record<string, string> = {};
    globalThis.fetch = (async (_url: any, init?: any) => {
      capturedHeaders = init?.headers ?? {};
      return new Response(JSON.stringify({ files: [{ id: 'id' }] }), { status: 200 });
    }) as unknown as typeof fetch;
    try {
      await findOrCreateFolder('my-token', 'F');
      expect(capturedHeaders.Authorization ?? capturedHeaders.authorization).toBe('Bearer my-token');
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

// ─── moveFileToFolder ───────────────────────────────────────────────────────

describe('moveFileToFolder', () => {
  test('fetches current parents and sends PATCH with add/remove', async () => {
    const origFetch = globalThis.fetch;
    let patchUrl = '';
    let patchCalled = false;
    globalThis.fetch = (async (url: any, init?: any) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (!init?.method || init.method === 'GET') {
        // GET parents
        return new Response(JSON.stringify({ parents: ['old-parent'] }), { status: 200 });
      }
      if (init.method === 'PATCH') {
        patchCalled = true;
        patchUrl = u;
        return new Response(JSON.stringify({ id: 'file-1' }), { status: 200 });
      }
      return new Response('unexpected', { status: 500 });
    }) as unknown as typeof fetch;
    try {
      await moveFileToFolder('tok', 'file-1', 'new-folder');
      expect(patchCalled).toBe(true);
      expect(patchUrl).toContain('addParents=new-folder');
      expect(patchUrl).toContain('removeParents=old-parent');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('handles file with no current parents', async () => {
    const origFetch = globalThis.fetch;
    let patchUrl = '';
    globalThis.fetch = (async (_url: any, init?: any) => {
      if (init?.method === 'PATCH') {
        patchUrl = typeof _url === 'string' ? _url : _url.toString();
        return new Response(JSON.stringify({ id: 'f' }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 }); // no parents field
    }) as unknown as typeof fetch;
    try {
      await moveFileToFolder('tok', 'file-2', 'folder-2');
      expect(patchUrl).toContain('addParents=folder-2');
      expect(patchUrl).not.toContain('removeParents');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('handles multiple current parents', async () => {
    const origFetch = globalThis.fetch;
    let patchUrl = '';
    globalThis.fetch = (async (_url: any, init?: any) => {
      if (init?.method === 'PATCH') {
        patchUrl = typeof _url === 'string' ? _url : _url.toString();
        return new Response(JSON.stringify({ id: 'f' }), { status: 200 });
      }
      return new Response(JSON.stringify({ parents: ['p1', 'p2'] }), { status: 200 });
    }) as unknown as typeof fetch;
    try {
      await moveFileToFolder('tok', 'file-3', 'dest');
      expect(patchUrl).toContain('removeParents=p1%2Cp2');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('throws on GET parents error', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response('not found', { status: 404 })
    ) as unknown as typeof fetch;
    try {
      await expect(moveFileToFolder('tok', 'f', 'd')).rejects.toThrow('Drive get file parents failed (404)');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('throws on PATCH error', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: any, init?: any) => {
      if (init?.method === 'PATCH') {
        return new Response('rate limited', { status: 429 });
      }
      return new Response(JSON.stringify({ parents: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    try {
      await expect(moveFileToFolder('tok', 'f', 'd')).rejects.toThrow('Drive move file failed (429)');
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
