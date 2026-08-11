import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isTokenExpired,
  extractClientInfo,
  buildAuthUrl,
  loadCredentials,
  loadToken,
  saveToken,
  refreshAccessToken,
  type OAuthCredentials,
  type OAuthToken,
} from '../src/auth.ts';

// ─── isTokenExpired ─────────────────────────────────────────────────────────

describe('isTokenExpired', () => {
  test('returns true when expiry_date is in the past', () => {
    const token: OAuthToken = {
      access_token: 'a',
      refresh_token: 'r',
      expiry_date: Date.now() - 60_000,
      token_type: 'Bearer',
    };
    expect(isTokenExpired(token)).toBe(true);
  });

  test('returns true when token expires within default buffer (5 min)', () => {
    const token: OAuthToken = {
      access_token: 'a',
      refresh_token: 'r',
      expiry_date: Date.now() + 200_000, // 3.3 min from now — within 5-min buffer
      token_type: 'Bearer',
    };
    expect(isTokenExpired(token)).toBe(true);
  });

  test('returns false when token has plenty of time left', () => {
    const token: OAuthToken = {
      access_token: 'a',
      refresh_token: 'r',
      expiry_date: Date.now() + 3_600_000, // 1 hour
      token_type: 'Bearer',
    };
    expect(isTokenExpired(token)).toBe(false);
  });

  test('respects custom bufferMs', () => {
    const token: OAuthToken = {
      access_token: 'a',
      refresh_token: 'r',
      expiry_date: Date.now() + 10_000, // 10 seconds
      token_type: 'Bearer',
    };
    // With a 5-second buffer it should NOT be expired
    expect(isTokenExpired(token, 5_000)).toBe(false);
    // With a 15-second buffer it should be expired
    expect(isTokenExpired(token, 15_000)).toBe(true);
  });

  test('returns true when expiry_date is 0', () => {
    const token: OAuthToken = {
      access_token: 'a',
      refresh_token: 'r',
      expiry_date: 0,
      token_type: 'Bearer',
    };
    expect(isTokenExpired(token)).toBe(true);
  });
});

// ─── extractClientInfo ──────────────────────────────────────────────────────

describe('extractClientInfo', () => {
  test('extracts from "installed" key', () => {
    const creds: OAuthCredentials = {
      installed: {
        client_id: 'id-123',
        client_secret: 'secret-456',
        redirect_uris: ['http://localhost:3000/callback'],
      },
    };
    const info = extractClientInfo(creds);
    expect(info.clientId).toBe('id-123');
    expect(info.clientSecret).toBe('secret-456');
    expect(info.redirectUri).toBe('http://localhost:3000/callback');
  });

  test('extracts from "web" key', () => {
    const creds: OAuthCredentials = {
      web: {
        client_id: 'web-id',
        client_secret: 'web-secret',
        redirect_uris: ['https://example.com/auth'],
      },
    };
    const info = extractClientInfo(creds);
    expect(info.clientId).toBe('web-id');
    expect(info.clientSecret).toBe('web-secret');
    expect(info.redirectUri).toBe('https://example.com/auth');
  });

  test('prefers "installed" over "web" when both present', () => {
    const creds: OAuthCredentials = {
      installed: {
        client_id: 'installed-id',
        client_secret: 'installed-secret',
        redirect_uris: ['http://localhost'],
      },
      web: {
        client_id: 'web-id',
        client_secret: 'web-secret',
        redirect_uris: ['https://example.com'],
      },
    };
    expect(extractClientInfo(creds).clientId).toBe('installed-id');
  });

  test('throws when neither key is present', () => {
    expect(() => extractClientInfo({} as OAuthCredentials)).toThrow(
      'credentials must have an "installed" or "web" key',
    );
  });

  test('defaults redirectUri to http://localhost when redirect_uris is empty', () => {
    const creds: OAuthCredentials = {
      installed: {
        client_id: 'id',
        client_secret: 'secret',
        redirect_uris: [],
      },
    };
    expect(extractClientInfo(creds).redirectUri).toBe('http://localhost');
  });
});

// ─── buildAuthUrl ───────────────────────────────────────────────────────────

describe('buildAuthUrl', () => {
  const creds: OAuthCredentials = {
    installed: {
      client_id: 'my-client-id',
      client_secret: 'my-secret',
      redirect_uris: ['http://localhost:3000/callback'],
    },
  };

  test('generates a Google OAuth2 URL with correct base', () => {
    const url = buildAuthUrl(creds, ['https://www.googleapis.com/auth/drive']);
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
  });

  test('includes client_id parameter', () => {
    const url = buildAuthUrl(creds, ['scope1']);
    expect(url).toContain('client_id=my-client-id');
  });

  test('includes scopes joined by space', () => {
    const url = buildAuthUrl(creds, ['scope1', 'scope2']);
    // URL-encoded space is +
    expect(url).toContain('scope=scope1+scope2');
  });

  test('includes access_type=offline and prompt=consent', () => {
    const url = buildAuthUrl(creds, ['scope1']);
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
  });

  test('uses provided redirectUri override', () => {
    const url = buildAuthUrl(creds, ['scope1'], 'http://custom:9999/auth');
    expect(url).toContain(encodeURIComponent('http://custom:9999/auth'));
  });

  test('uses credentials redirect_uri when no override', () => {
    const url = buildAuthUrl(creds, ['scope1']);
    expect(url).toContain(encodeURIComponent('http://localhost:3000/callback'));
  });
});

// ─── File I/O ───────────────────────────────────────────────────────────────

describe('loadCredentials / loadToken / saveToken', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'auth-test-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('loadCredentials reads and parses a credentials file', async () => {
    const path = join(tmpDir, 'creds.json');
    const data: OAuthCredentials = {
      installed: {
        client_id: 'cid',
        client_secret: 'csec',
        redirect_uris: ['http://localhost'],
      },
    };
    await writeFile(path, JSON.stringify(data));
    const loaded = await loadCredentials(path);
    expect(loaded.installed?.client_id).toBe('cid');
  });

  test('loadCredentials throws on missing file', async () => {
    await expect(loadCredentials(join(tmpDir, 'nope.json'))).rejects.toThrow();
  });

  test('loadToken returns null when file is missing', async () => {
    const result = await loadToken(join(tmpDir, 'missing-token.json'));
    expect(result).toBeNull();
  });

  test('saveToken + loadToken round-trips', async () => {
    const path = join(tmpDir, 'sub', 'token.json');
    const token: OAuthToken = {
      access_token: 'at',
      refresh_token: 'rt',
      expiry_date: 9999999999999,
      token_type: 'Bearer',
      scope: 'email',
    };
    await saveToken(path, token);
    const loaded = await loadToken(path);
    expect(loaded).not.toBeNull();
    expect(loaded!.access_token).toBe('at');
    expect(loaded!.refresh_token).toBe('rt');
    expect(loaded!.scope).toBe('email');
  });
});

// ─── refreshAccessToken ─────────────────────────────────────────────────────

describe('refreshAccessToken', () => {
  const creds: OAuthCredentials = {
    installed: {
      client_id: 'cid',
      client_secret: 'csec',
      redirect_uris: ['http://localhost'],
    },
  };

  const baseToken: OAuthToken = {
    access_token: 'old-at',
    refresh_token: 'rt',
    expiry_date: Date.now() - 1000,
    token_type: 'Bearer',
  };

  test('throws when Google returns an error', async () => {
    // Mock fetch to return an error response
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 400,
      })) as typeof fetch;
    try {
      await expect(refreshAccessToken(creds, baseToken)).rejects.toThrow(
        'Token refresh failed: invalid_grant',
      );
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('returns updated token on success', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ access_token: 'new-at', expires_in: 3600 }),
        { status: 200 },
      )) as typeof fetch;
    try {
      const refreshed = await refreshAccessToken(creds, baseToken);
      expect(refreshed.access_token).toBe('new-at');
      expect(refreshed.refresh_token).toBe('rt'); // preserved
      expect(refreshed.expiry_date).toBeGreaterThan(Date.now());
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('sends correct parameters to token endpoint', async () => {
    const origFetch = globalThis.fetch;
    let capturedBody = '';
    globalThis.fetch = (async (_url: any, init: any) => {
      capturedBody = init.body.toString();
      return new Response(
        JSON.stringify({ access_token: 'x', expires_in: 3600 }),
        { status: 200 },
      );
    }) as typeof fetch;
    try {
      await refreshAccessToken(creds, baseToken);
      expect(capturedBody).toContain('grant_type=refresh_token');
      expect(capturedBody).toContain('client_id=cid');
      expect(capturedBody).toContain('client_secret=csec');
      expect(capturedBody).toContain('refresh_token=rt');
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
