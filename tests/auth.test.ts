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
  exchangeCodeForToken,
  defaultAuthConfig,
  getEnvToken,
  getValidToken,
  TOKEN_ENV_VARS,
  DEFAULT_CREDENTIALS_PATH,
  DEFAULT_TOKEN_PATH,
  DEFAULT_SCOPES,
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

  test('includes state parameter when provided', () => {
    const url = buildAuthUrl(creds, ['scope1'], undefined, 'my-csrf-state');
    expect(url).toContain('state=my-csrf-state');
  });

  test('omits state parameter when not provided', () => {
    const url = buildAuthUrl(creds, ['scope1']);
    expect(url).not.toContain('state=');
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
      })) as unknown as typeof fetch;
    try {
      await expect(refreshAccessToken(creds, baseToken)).rejects.toThrow(
        'Token refresh failed: HTTP 400',
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
      )) as unknown as typeof fetch;
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
    }) as unknown as typeof fetch;
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


// ─── DEFAULT_CREDENTIALS_PATH / DEFAULT_TOKEN_PATH ─────────────────────────

describe('DEFAULT_CREDENTIALS_PATH', () => {
  test('ends with credentials.json', () => {
    expect(DEFAULT_CREDENTIALS_PATH.endsWith('credentials.json')).toBe(true);
  });

  test('contains .config/rhgdoc', () => {
    expect(DEFAULT_CREDENTIALS_PATH).toContain('.config/rhgdoc');
  });
});

describe('DEFAULT_TOKEN_PATH', () => {
  test('ends with token.json', () => {
    expect(DEFAULT_TOKEN_PATH.endsWith('token.json')).toBe(true);
  });

  test('contains .config/rhgdoc', () => {
    expect(DEFAULT_TOKEN_PATH).toContain('.config/rhgdoc');
  });
});

// ─── DEFAULT_SCOPES ────────────────────────────────────────────────────────

describe('DEFAULT_SCOPES', () => {
  test('contains documents, presentations, and drive scopes', () => {
    expect(DEFAULT_SCOPES).toContain('https://www.googleapis.com/auth/documents');
    expect(DEFAULT_SCOPES).toContain('https://www.googleapis.com/auth/presentations');
    expect(DEFAULT_SCOPES).toContain('https://www.googleapis.com/auth/drive');
  });
});

// ─── defaultAuthConfig ─────────────────────────────────────────────────────

describe('defaultAuthConfig', () => {
  test('returns correct default paths containing rhgdoc', () => {
    const config = defaultAuthConfig();
    expect(config.credentialsPath).toContain('rhgdoc');
    expect(config.tokenPath).toContain('rhgdoc');
  });

  test('returns DEFAULT_SCOPES by default', () => {
    const config = defaultAuthConfig();
    expect(config.scopes).toBe(DEFAULT_SCOPES);
  });

  test('accepts credentialsPath override', () => {
    const config = defaultAuthConfig({ credentialsPath: '/custom/creds.json' });
    expect(config.credentialsPath).toBe('/custom/creds.json');
    expect(config.tokenPath).toBe(DEFAULT_TOKEN_PATH);
    expect(config.scopes).toBe(DEFAULT_SCOPES);
  });

  test('accepts tokenPath override', () => {
    const config = defaultAuthConfig({ tokenPath: '/custom/token.json' });
    expect(config.credentialsPath).toBe(DEFAULT_CREDENTIALS_PATH);
    expect(config.tokenPath).toBe('/custom/token.json');
  });

  test('accepts scopes override', () => {
    const customScopes = ['https://www.googleapis.com/auth/drive'];
    const config = defaultAuthConfig({ scopes: customScopes });
    expect(config.scopes).toEqual(customScopes);
  });
});

// ─── exchangeCodeForToken ──────────────────────────────────────────────────

describe('exchangeCodeForToken', () => {
  const creds: OAuthCredentials = {
    installed: {
      client_id: 'cid',
      client_secret: 'csec',
      redirect_uris: ['http://localhost'],
    },
  };

  test('successful exchange returns correct OAuthToken', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          access_token: 'new-at',
          refresh_token: 'new-rt',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'email',
        }),
        { status: 200 },
      )) as unknown as typeof fetch;
    try {
      const token = await exchangeCodeForToken(creds, 'auth-code-123', 'http://localhost:9999');
      expect(token.access_token).toBe('new-at');
      expect(token.refresh_token).toBe('new-rt');
      expect(token.token_type).toBe('Bearer');
      expect(token.scope).toBe('email');
      expect(token.expiry_date).toBeGreaterThan(Date.now());
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('sends correct parameters to token endpoint', async () => {
    const origFetch = globalThis.fetch;
    let capturedUrl = '';
    let capturedBody = '';
    globalThis.fetch = (async (url: any, init: any) => {
      capturedUrl = typeof url === 'string' ? url : url.toString();
      capturedBody = init.body.toString();
      return new Response(
        JSON.stringify({ access_token: 'x', expires_in: 3600 }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    try {
      await exchangeCodeForToken(creds, 'the-code', 'http://localhost:8080');
      expect(capturedUrl).toContain('oauth2.googleapis.com/token');
      expect(capturedBody).toContain('grant_type=authorization_code');
      expect(capturedBody).toContain('code=the-code');
      expect(capturedBody).toContain('client_id=cid');
      expect(capturedBody).toContain('client_secret=csec');
      expect(capturedBody).toContain(encodeURIComponent('http://localhost:8080'));
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('throws on error response', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ error: 'invalid_grant', error_description: 'Code expired' }),
        { status: 400 },
      )) as unknown as typeof fetch;
    try {
      await expect(
        exchangeCodeForToken(creds, 'bad-code', 'http://localhost'),
      ).rejects.toThrow('Token exchange failed: HTTP 400');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('defaults refresh_token to empty string when missing', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ access_token: 'at', expires_in: 3600 }),
        { status: 200 },
      )) as unknown as typeof fetch;
    try {
      const token = await exchangeCodeForToken(creds, 'code', 'http://localhost');
      expect(token.refresh_token).toBe('');
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

// ─── getEnvToken / TOKEN_ENV_VARS ─────────────────────────────────────────

describe('TOKEN_ENV_VARS', () => {
  test('includes GOOGLE_WORKSPACE_CLI_TOKEN', () => {
    expect(TOKEN_ENV_VARS).toContain('GOOGLE_WORKSPACE_CLI_TOKEN');
  });

  test('includes GWS_TOKEN', () => {
    expect(TOKEN_ENV_VARS).toContain('GWS_TOKEN');
  });
});

describe('getEnvToken', () => {
  // Save and restore env vars around each test
  const saved: Record<string, string | undefined> = {};

  function clearTokenVars() {
    for (const name of TOKEN_ENV_VARS) {
      saved[name] = process.env[name];
      delete process.env[name];
    }
  }

  function restoreTokenVars() {
    for (const name of TOKEN_ENV_VARS) {
      if (saved[name] !== undefined) process.env[name] = saved[name];
      else delete process.env[name];
    }
  }

  test('returns null when no env vars set', () => {
    clearTokenVars();
    try {
      expect(getEnvToken()).toBeNull();
    } finally {
      restoreTokenVars();
    }
  });

  test('returns GOOGLE_WORKSPACE_CLI_TOKEN when set', () => {
    clearTokenVars();
    try {
      process.env.GOOGLE_WORKSPACE_CLI_TOKEN = 'gws-token-123';
      expect(getEnvToken()).toBe('gws-token-123');
    } finally {
      restoreTokenVars();
    }
  });

  test('returns GWS_TOKEN when set', () => {
    clearTokenVars();
    try {
      process.env.GWS_TOKEN = 'short-token-456';
      expect(getEnvToken()).toBe('short-token-456');
    } finally {
      restoreTokenVars();
    }
  });

  test('GOOGLE_WORKSPACE_CLI_TOKEN takes precedence over GWS_TOKEN', () => {
    clearTokenVars();
    try {
      process.env.GOOGLE_WORKSPACE_CLI_TOKEN = 'primary';
      process.env.GWS_TOKEN = 'secondary';
      expect(getEnvToken()).toBe('primary');
    } finally {
      restoreTokenVars();
    }
  });

  test('skips empty string values', () => {
    clearTokenVars();
    try {
      process.env.GOOGLE_WORKSPACE_CLI_TOKEN = '';
      process.env.GWS_TOKEN = 'fallback';
      expect(getEnvToken()).toBe('fallback');
    } finally {
      restoreTokenVars();
    }
  });

  test('trims whitespace', () => {
    clearTokenVars();
    try {
      process.env.GOOGLE_WORKSPACE_CLI_TOKEN = '  tok-with-spaces  ';
      expect(getEnvToken()).toBe('tok-with-spaces');
    } finally {
      restoreTokenVars();
    }
  });

  test('skips whitespace-only values', () => {
    clearTokenVars();
    try {
      process.env.GOOGLE_WORKSPACE_CLI_TOKEN = '   ';
      expect(getEnvToken()).toBeNull();
    } finally {
      restoreTokenVars();
    }
  });
});

// ─── getValidToken with env var ───────────────────────────────────────────

describe('getValidToken (env var interop)', () => {
  const saved: Record<string, string | undefined> = {};

  function clearTokenVars() {
    for (const name of TOKEN_ENV_VARS) {
      saved[name] = process.env[name];
      delete process.env[name];
    }
  }

  function restoreTokenVars() {
    for (const name of TOKEN_ENV_VARS) {
      if (saved[name] !== undefined) process.env[name] = saved[name];
      else delete process.env[name];
    }
  }

  test('returns env token without touching filesystem', async () => {
    clearTokenVars();
    try {
      process.env.GWS_TOKEN = 'env-access-token';
      // Use bogus paths that don't exist — should never be read
      const config = defaultAuthConfig({
        credentialsPath: '/nonexistent/credentials.json',
        tokenPath: '/nonexistent/token.json',
      });
      const token = await getValidToken(config);
      expect(token).toBe('env-access-token');
    } finally {
      restoreTokenVars();
    }
  });

  test('falls through to file-based when env var not set', async () => {
    clearTokenVars();
    try {
      const config = defaultAuthConfig({
        credentialsPath: '/nonexistent/credentials.json',
        tokenPath: '/nonexistent/token.json',
      });
      // Should throw because the file doesn't exist
      await expect(getValidToken(config)).rejects.toThrow();
    } finally {
      restoreTokenVars();
    }
  });
});
