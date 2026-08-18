/**
 * Google Drive folder and file organisation helpers.
 *
 * Lightweight wrappers around the Drive v3 REST API for creating folders
 * and moving files.  Uses native `fetch()` — no dependency on `googleapis`.
 *
 * @module
 */

/** MIME type for Google Drive folders. */
const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** Base URL for Drive v3 files resource. */
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Minimal shape returned by the Drive files.list and files.create APIs. */
interface DriveFile {
  id?: string;
  name?: string;
  mimeType?: string;
}

interface DriveFileList {
  files?: DriveFile[];
  nextPageToken?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Find an existing Drive folder by name, or create it if it doesn't exist.
 *
 * When `parentId` is provided the search and creation are scoped to that
 * parent folder.  Without it the folder is searched / created in the
 * caller's Drive root.
 *
 * @param token      — OAuth2 access token.
 * @param folderName — Display name of the folder.
 * @param parentId   — Optional parent folder ID.
 * @returns The folder's Drive file ID.
 * @throws On API errors.
 */
export async function findOrCreateFolder(
  token: string,
  folderName: string,
  parentId?: string,
): Promise<string> {
  const qParts = [
    `mimeType='${FOLDER_MIME}'`,
    `name='${folderName.replace(/'/g, "\\'")}'`,
    'trashed=false',
  ];
  if (parentId) qParts.push(`'${parentId}' in parents`);

  const searchParams = new URLSearchParams({
    q: qParts.join(' and '),
    fields: 'files(id,name)',
    pageSize: '1',
  });

  const listRes = await fetch(`${DRIVE_FILES_URL}?${searchParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!listRes.ok) {
    const text = await listRes.text().catch(() => '');
    throw new Error(`Drive folder search failed (${listRes.status}): ${text}`);
  }

  const listBody = (await listRes.json()) as DriveFileList;
  const existing = listBody.files?.[0];
  if (existing?.id) return existing.id;

  const metadata: Record<string, unknown> = {
    name: folderName,
    mimeType: FOLDER_MIME,
  };
  if (parentId) metadata.parents = [parentId];

  const createRes = await fetch(`${DRIVE_FILES_URL}?fields=id`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(metadata),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '');
    throw new Error(`Drive folder creation failed (${createRes.status}): ${text}`);
  }

  const createBody = (await createRes.json()) as DriveFile;
  if (!createBody.id) {
    throw new Error('Drive folder creation returned no file ID');
  }
  return createBody.id;
}

/**
 * Move a file into a folder by updating its parent references.
 *
 * Uses the Drive v3 `files.update` endpoint with `addParents` /
 * `removeParents` query parameters so the file appears exclusively in
 * the target folder.
 *
 * @param token    — OAuth2 access token.
 * @param fileId   — ID of the file to move.
 * @param folderId — ID of the destination folder.
 * @throws On API errors.
 */
export async function moveFileToFolder(
  token: string,
  fileId: string,
  folderId: string,
): Promise<void> {
  const getRes = await fetch(
    `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?fields=parents`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!getRes.ok) {
    const text = await getRes.text().catch(() => '');
    throw new Error(`Drive get file parents failed (${getRes.status}): ${text}`);
  }

  const getBody = (await getRes.json()) as { parents?: string[] };
  const currentParents = (getBody.parents ?? []).join(',');

  const updateParams = new URLSearchParams({
    addParents: folderId,
    fields: 'id',
  });
  if (currentParents) updateParams.set('removeParents', currentParents);

  const updateRes = await fetch(
    `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?${updateParams}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: '{}',
    },
  );

  if (!updateRes.ok) {
    const text = await updateRes.text().catch(() => '');
    throw new Error(`Drive move file failed (${updateRes.status}): ${text}`);
  }
}
