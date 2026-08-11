/**
 * Google OAuth2 credential management.
 *
 * Lightweight OAuth2 helpers that both templar and herald can share.
 * Uses native `fetch()` for token refresh — no dependency on
 * `googleapis` or `google-auth-library`.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

// ─── Interfaces ──────────────────────────────────────────────────────────────

/**
 * Shape of a Google OAuth2 client credentials file.
 *
 * Downloaded from the Google Cloud Console, it nests client info under
 * either an `installed` or a `web` key.
 */
export interface OAuthCredentials {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

/**
 * Shape of a persisted OAuth2 token file.
 *
 * Stored on disk after the initial consent flow and updated whenever
 * the access token is refreshed.
 */
export interface OAuthToken {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_type: string;
  scope?: string;
}

/**
 * Configuration for {@link getValidToken}.
 */
export interface AuthConfig {
  /** Path to the credentials JSON file (client_id / client_secret). */
  credentialsPath: string;
  /** Path to the token JSON file (access / refresh tokens). */
  tokenPath: string;
  /** OAuth2 scopes to request. */
  scopes: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Default buffer before expiry: 5 minutes. */
const DEFAULT_BUFFER_MS = 300_000;

/** Google's OAuth2 token endpoint. */
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Google's OAuth2 authorization endpoint. */
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

// ─── Credential / token I/O ─────────────────────────────────────────────────

/**
 * Read and parse a Google OAuth2 credentials JSON file.
 *
 * @throws If the file cannot be read or parsed.
 */
export async function loadCredentials(path: string): Promise<OAuthCredentials> {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as OAuthCredentials;
}

/**
 * Read a persisted token file.
 *
 * @returns The parsed token, or `null` if the file does not exist.
 */
export async function loadToken(path: string): Promise<OAuthToken | null> {
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as OAuthToken;
  } catch {
    return null;
  }
}

/**
 * Write a token to disk, creating parent directories if needed.
 */
export async function saveToken(path: string, token: OAuthToken): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(token, null, 2), { mode: 0o600 });
}

// ─── Token refresh ──────────────────────────────────────────────────────────

/**
 * Refresh an OAuth2 access token using Google's token endpoint.
 *
 * Sends the refresh token to `https://oauth2.googleapis.com/token` and
 * returns an updated {@link OAuthToken} with a new `access_token` and
 * `expiry_date`.  The original `refresh_token` is preserved (Google's
 * response omits it).
 *
 * @throws If the HTTP request fails or Google returns an error.
 */
export async function refreshAccessToken(
  credentials: OAuthCredentials,
  token: OAuthToken,
): Promise<OAuthToken> {
  const { clientId, clientSecret } = extractClientInfo(credentials);

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const body = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (body.error || !body.access_token) {
    throw new Error(
      `Token refresh failed: ${body.error ?? 'no access_token'}` +
        (body.error_description ? ` — ${body.error_description}` : ''),
    );
  }

  return {
    ...token,
    access_token: body.access_token,
    expiry_date: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
}

// ─── High-level entry point ─────────────────────────────────────────────────

/**
 * Load credentials and token, refresh if expired or near-expiry, persist the
 * refreshed token, and return the current `access_token`.
 *
 * @throws If no token file exists, or the refresh request fails.
 */
export async function getValidToken(config: AuthConfig): Promise<string> {
  const credentials = await loadCredentials(config.credentialsPath);
  const token = await loadToken(config.tokenPath);
  if (!token) {
    throw new Error(
      `No token file found at ${config.tokenPath}. ` +
        'Run the OAuth2 consent flow first.',
    );
  }

  if (!isTokenExpired(token)) {
    return token.access_token;
  }

  const refreshed = await refreshAccessToken(credentials, token);
  await saveToken(config.tokenPath, refreshed);
  return refreshed.access_token;
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/**
 * Check whether a token is expired or will expire within `bufferMs`.
 *
 * @param bufferMs — Milliseconds before actual expiry to treat as expired
 *                   (default 300 000 = 5 minutes).
 */
export function isTokenExpired(token: OAuthToken, bufferMs = DEFAULT_BUFFER_MS): boolean {
  if (!token.expiry_date) return true;
  return Date.now() >= token.expiry_date - bufferMs;
}

/**
 * Build a Google OAuth2 consent URL.
 *
 * Generates the URL the user should visit to grant permissions.  Pass the
 * resulting authorization code to Google's token endpoint to obtain tokens.
 *
 * @param redirectUri — Override for the redirect URI; defaults to the first
 *                      URI listed in the credentials file.
 */
export function buildAuthUrl(
  credentials: OAuthCredentials,
  scopes: string[],
  redirectUri?: string,
): string {
  const info = extractClientInfo(credentials);
  const params = new URLSearchParams({
    client_id: info.clientId,
    redirect_uri: redirectUri ?? info.redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Extract client ID, secret, and redirect URI from an {@link OAuthCredentials}
 * object, handling both `installed` and `web` credential layouts.
 *
 * @throws If neither `installed` nor `web` key is present.
 */
export function extractClientInfo(
  credentials: OAuthCredentials,
): { clientId: string; clientSecret: string; redirectUri: string } {
  const cred = credentials.installed ?? credentials.web;
  if (!cred) {
    throw new Error(
      'credentials must have an "installed" or "web" key',
    );
  }
  return {
    clientId: cred.client_id,
    clientSecret: cred.client_secret,
    redirectUri: cred.redirect_uris?.[0] ?? 'http://localhost',
  };
}

// ─── Default configuration ────────────────────────────────────────────────

/** Default path for Google OAuth2 client credentials. */
export const DEFAULT_CREDENTIALS_PATH = join(homedir(), '.config', 'rhgdoc', 'credentials.json');

/** Default path for the persisted OAuth2 token. */
export const DEFAULT_TOKEN_PATH = join(homedir(), '.config', 'rhgdoc', 'token.json');

/** Combined OAuth2 scopes covering both templar (Docs) and herald (Slides) needs. */
export const DEFAULT_SCOPES: string[] = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/devstorage.read_write',
  'https://www.googleapis.com/auth/script.deployments',
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.webapp.deploy',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

/** Build an AuthConfig from defaults, optionally overriding individual fields. */
export function defaultAuthConfig(overrides?: Partial<AuthConfig>): AuthConfig {
  return {
    credentialsPath: overrides?.credentialsPath ?? DEFAULT_CREDENTIALS_PATH,
    tokenPath: overrides?.tokenPath ?? DEFAULT_TOKEN_PATH,
    scopes: overrides?.scopes ?? DEFAULT_SCOPES,
  };
}

// ─── Token exchange ───────────────────────────────────────────────────────

/**
 * Exchange an authorization code for OAuth2 tokens.
 *
 * Posts the code to Google's token endpoint and returns a full OAuthToken.
 * Called after the user completes the browser consent flow.
 *
 * @throws If the exchange fails or Google returns an error.
 */
export async function exchangeCodeForToken(
  credentials: OAuthCredentials,
  code: string,
  redirectUri: string,
): Promise<OAuthToken> {
  const { clientId, clientSecret } = extractClientInfo(credentials);

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const body = await res.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (body.error || !body.access_token) {
    throw new Error(
      `Token exchange failed: ${body.error ?? 'no access_token'}` +
        (body.error_description ? ` — ${body.error_description}` : ''),
    );
  }

  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token ?? '',
    expiry_date: Date.now() + (body.expires_in ?? 3600) * 1000,
    token_type: body.token_type ?? 'Bearer',
    scope: body.scope,
  };
}

// ─── Interactive auth flow ────────────────────────────────────────────────

/** Options for the interactive auth flow. */
export interface AuthFlowOptions {
  /** Port for the local callback server. Defaults to 0 (random). */
  port?: number;
  /** Function to open a URL in the browser. Defaults to `open` command on macOS. */
  openUrl?: (url: string) => Promise<void> | void;
}

/**
 * Run an interactive OAuth2 browser consent flow.
 *
 * 1. Starts a local HTTP server on a random port
 * 2. Opens the Google consent URL in the user's browser
 * 3. Waits for the OAuth2 callback with the authorization code
 * 4. Exchanges the code for tokens
 * 5. Saves the token to disk
 *
 * @returns The obtained OAuthToken
 * @throws On timeout (120s), user denial, or token exchange failure
 */
export async function runAuthFlow(
  config: AuthConfig,
  options?: AuthFlowOptions,
): Promise<OAuthToken> {
  const credentials = await loadCredentials(config.credentialsPath);
  const state = crypto.randomUUID();

  let resolveCode: (code: string) => void;
  let rejectCode: (err: Error) => void;
  const codePromise = new Promise<string>((res, rej) => {
    resolveCode = res;
    rejectCode = rej;
  });

  const server = Bun.serve({
    port: options?.port ?? 0,
    fetch(req) {
      const url = new URL(req.url);
      if (url.searchParams.get('state') !== state) {
        return new Response('Invalid state parameter.', { status: 400 });
      }
      const error = url.searchParams.get('error');
      if (error) {
        rejectCode(new Error(`OAuth error: ${error}`));
        queueMicrotask(() => server.stop());
        return new Response(
          '<html><body>Authentication failed. You can close this tab.</body></html>',
          { headers: { 'Content-Type': 'text/html' }, status: 400 },
        );
      }
      const code = url.searchParams.get('code');
      if (code) {
        resolveCode(code);
        queueMicrotask(() => server.stop());
        return new Response(
          '<html><body>Authenticated! You can close this tab.</body></html>',
          { headers: { 'Content-Type': 'text/html' } },
        );
      }
      return new Response('Waiting for callback...', { status: 404 });
    },
  });

  const redirectUri = `http://localhost:${server.port}`;
  const authUrl = buildAuthUrl(credentials, config.scopes, redirectUri);
  // Add state parameter
  const authUrlWithState = `${authUrl}&state=${encodeURIComponent(state)}`;

  process.stderr.write(`Opening browser for auth (port ${server.port})...\n`);

  const timeout = setTimeout(() => {
    server.stop();
    rejectCode(new Error('Auth timeout after 120 seconds'));
  }, 120_000);

  try {
    if (options?.openUrl) {
      await options.openUrl(authUrlWithState);
    } else {
      // Default: use macOS `open` command
      const proc = Bun.spawn(['open', authUrlWithState]);
      await proc.exited;
    }

    const code = await codePromise;

    const token = await exchangeCodeForToken(credentials, code, redirectUri);
    await saveToken(config.tokenPath, token);
    process.stderr.write(`Token saved to ${config.tokenPath}\n`);
    return token;
  } finally {
    clearTimeout(timeout);
    server.stop();
  }
}
