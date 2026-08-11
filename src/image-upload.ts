/**
 * Image upload to Google services.
 *
 * Provides functions for uploading images to Google Drive and Google Slides,
 * extracting public CDN URLs for use in document insertion.
 *
 * @module
 */

/** An uploaded image with its public URL and optional cleanup function. */
export interface UploadedImage {
  /** Public URL where the uploaded image can be accessed. */
  url: string;
  /** Optional cleanup function to delete the uploaded resource. */
  cleanup?: () => Promise<void>;
}

/**
 * Upload a single image to Google Drive via multipart upload API.
 *
 * Creates a file in the user's Drive and returns its `webContentLink`
 * (direct download URL). The file can be cleaned up via the returned
 * `cleanup` function.
 *
 * @param options - Upload options.
 * @param options.token - OAuth2 access token.
 * @param options.base64 - Base64-encoded image data.
 * @param options.mimeType - MIME type of the image (e.g. `image/png`).
 * @param options.name - Optional filename for the uploaded file.
 * @returns The uploaded image with its URL and cleanup function.
 */
export async function uploadImageToDrive(options: {
  token: string;
  base64: string;
  mimeType: string;
  name?: string;
}): Promise<UploadedImage> {
  const { token, base64, mimeType, name = 'image' } = options;
  const boundary = `----librhgdoc-${crypto.randomUUID()}`;

  const metadata = JSON.stringify({
    name,
    mimeType,
  });

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    'Content-Transfer-Encoding: base64',
    '',
    base64,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive upload failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { id?: string; webContentLink?: string };
  const fileId = data.id;
  if (!fileId) throw new Error('Drive upload returned no file ID');

  const url = data.webContentLink ?? `https://drive.google.com/uc?id=${fileId}&export=download`;

  return {
    url,
    cleanup: () => deleteGoogleDriveFile(token, fileId),
  };
}

/**
 * Upload an image via a temporary Google Slides presentation.
 *
 * Creates a presentation, inserts the image as a base64 data URI,
 * reads back the CDN content URL, and deletes the presentation.
 * This approach yields `lh7-rt.googleusercontent.com` URLs that
 * work with Google Docs/Slides insertInlineImage.
 *
 * @param options - Upload options.
 * @param options.token - OAuth2 access token.
 * @param options.base64 - Base64-encoded image data.
 * @param options.mimeType - MIME type of the image.
 * @returns The uploaded image with its CDN URL.
 */
export async function uploadImageViaTempSlides(options: {
  token: string;
  base64: string;
  mimeType: string;
}): Promise<UploadedImage> {
  const { token, base64, mimeType } = options;

  // 1. Create a temp presentation
  const createRes = await fetch('https://slides.googleapis.com/v1/presentations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'librhgdoc-temp-images' }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Slides creation failed (${createRes.status}): ${text}`);
  }

  const pres = (await createRes.json()) as {
    presentationId?: string;
    slides?: Array<{ objectId?: string }>;
  };
  const presId = pres.presentationId;
  if (!presId) throw new Error('Slides creation returned no presentationId');

  const slideId = pres.slides?.[0]?.objectId;
  if (!slideId) throw new Error('Temp presentation has no slides');

  try {
    // 2. Insert the image via data URI
    const dataUri = `data:${mimeType};base64,${base64}`;
    const imgObjId = 'librhgdoc_tmp_img_0';

    const batchRes = await fetch(
      `https://slides.googleapis.com/v1/presentations/${presId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              createImage: {
                objectId: imgObjId,
                url: dataUri,
                elementProperties: {
                  pageObjectId: slideId,
                  size: {
                    width: { magnitude: 100, unit: 'EMU' },
                    height: { magnitude: 100, unit: 'EMU' },
                  },
                  transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: 0,
                    translateY: 0,
                    unit: 'EMU',
                  },
                },
              },
            },
          ],
        }),
      },
    );

    if (!batchRes.ok) {
      const text = await batchRes.text();
      throw new Error(`Slides batchUpdate failed (${batchRes.status}): ${text}`);
    }

    // 3. Read back the presentation to get the CDN URL
    const getRes = await fetch(
      `https://slides.googleapis.com/v1/presentations/${presId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!getRes.ok) {
      const text = await getRes.text();
      throw new Error(`Slides get failed (${getRes.status}): ${text}`);
    }

    const presData = (await getRes.json()) as {
      slides?: Array<{
        pageElements?: Array<{
          objectId?: string;
          image?: { contentUrl?: string };
        }>;
      }>;
    };

    const cdnUrl = presData.slides?.[0]?.pageElements?.find(
      (el) => el.objectId === imgObjId,
    )?.image?.contentUrl;

    if (!cdnUrl) throw new Error('CDN URL not found after temp-Slides upload');

    return {
      url: cdnUrl,
      cleanup: () => deleteGoogleDriveFile(token, presId),
    };
  } catch (err) {
    // Clean up the temp presentation on failure
    await deleteGoogleDriveFile(token, presId).catch(() => {});
    throw err;
  }
}

/**
 * Batch upload multiple images using the temporary Slides approach.
 *
 * Creates a single temporary presentation with one slide per image,
 * inserts all images, reads back all CDN URLs, and deletes the
 * presentation. More efficient than individual uploads for multiple images.
 *
 * @param options - Upload options.
 * @param options.token - OAuth2 access token.
 * @param options.images - Array of images to upload.
 * @returns Array of uploaded images with CDN URLs, in the same order as input.
 */
export async function uploadImagesBatch(options: {
  token: string;
  images: Array<{ base64: string; mimeType: string }>;
}): Promise<UploadedImage[]> {
  const { token, images } = options;
  if (images.length === 0) return [];

  // 1. Create a temp presentation
  const createRes = await fetch('https://slides.googleapis.com/v1/presentations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'librhgdoc-temp-images' }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Slides creation failed (${createRes.status}): ${text}`);
  }

  const pres = (await createRes.json()) as {
    presentationId?: string;
    slides?: Array<{ objectId?: string }>;
  };
  const presId = pres.presentationId;
  if (!presId) throw new Error('Slides creation returned no presentationId');

  const firstSlideId = pres.slides?.[0]?.objectId;
  if (!firstSlideId) throw new Error('Temp presentation has no slides');

  try {
    // 2. Create additional slides if needed
    const slideIds = [firstSlideId];
    if (images.length > 1) {
      const addSlideRequests = [];
      for (let i = 1; i < images.length; i++) {
        const newSlideId = `librhgdoc_tmp_slide_${i}`;
        slideIds.push(newSlideId);
        addSlideRequests.push({ createSlide: { objectId: newSlideId } });
      }

      const addRes = await fetch(
        `https://slides.googleapis.com/v1/presentations/${presId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requests: addSlideRequests }),
        },
      );

      if (!addRes.ok) {
        const text = await addRes.text();
        throw new Error(`Slides addSlides failed (${addRes.status}): ${text}`);
      }
    }

    // 3. Insert all images via data URIs in one batch
    const imgIds = images.map((_, i) => `librhgdoc_tmp_img_${i}`);
    const insertRequests = images.map((img, i) => {
      const dataUri = `data:${img.mimeType};base64,${img.base64}`;
      return {
        createImage: {
          objectId: imgIds[i],
          url: dataUri,
          elementProperties: {
            pageObjectId: slideIds[i],
            size: {
              width: { magnitude: 100, unit: 'EMU' },
              height: { magnitude: 100, unit: 'EMU' },
            },
            transform: {
              scaleX: 1,
              scaleY: 1,
              translateX: 0,
              translateY: 0,
              unit: 'EMU',
            },
          },
        },
      };
    });

    const insertRes = await fetch(
      `https://slides.googleapis.com/v1/presentations/${presId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests: insertRequests }),
      },
    );

    if (!insertRes.ok) {
      const text = await insertRes.text();
      throw new Error(`Slides insertImages failed (${insertRes.status}): ${text}`);
    }

    // 4. Read back all CDN URLs
    const getRes = await fetch(
      `https://slides.googleapis.com/v1/presentations/${presId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!getRes.ok) {
      const text = await getRes.text();
      throw new Error(`Slides get failed (${getRes.status}): ${text}`);
    }

    const presData = (await getRes.json()) as {
      slides?: Array<{
        pageElements?: Array<{
          objectId?: string;
          image?: { contentUrl?: string };
        }>;
      }>;
    };

    const results: UploadedImage[] = [];
    for (let i = 0; i < images.length; i++) {
      const slide = presData.slides?.[i];
      const cdnUrl = slide?.pageElements?.find(
        (el) => el.objectId === imgIds[i],
      )?.image?.contentUrl;

      if (!cdnUrl) {
        throw new Error(`CDN URL not found for image ${i} after batch upload`);
      }

      results.push({ url: cdnUrl });
    }

    // Attach cleanup only to the first result to avoid double-delete
    if (results.length > 0) {
      results[0].cleanup = () => deleteGoogleDriveFile(token, presId);
    }

    return results;
  } catch (err) {
    await deleteGoogleDriveFile(token, presId).catch(() => {});
    throw err;
  }
}

/**
 * Delete a file from Google Drive.
 *
 * Used for cleaning up temporary presentations and uploaded images.
 * Silently succeeds if the file is already deleted.
 *
 * @param token - OAuth2 access token.
 * @param fileId - The Google Drive file ID to delete.
 */
export async function deleteGoogleDriveFile(
  token: string,
  fileId: string,
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  // 204 = success, 404 = already deleted — both are fine
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Drive delete failed (${res.status}): ${text}`);
  }
}

/** Delete multiple files from Google Drive. Errors are silently ignored (files may already be gone). */
export async function deleteGoogleDriveFiles(token: string, fileIds: string[]): Promise<void> {
  await Promise.all(fileIds.map(id => deleteGoogleDriveFile(token, id).catch(() => {})));
}
