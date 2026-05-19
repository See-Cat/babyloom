import { and, eq, ne } from 'drizzle-orm';
import { randomUUID, createHash } from 'node:crypto';
import { createReadStream } from 'fs';
import { rename, stat } from 'fs/promises';
import { join } from 'node:path';
import { getDb } from '@/lib/db/client';
import { entryMedia, media } from '@/lib/db/schema';
import { getMediaLimits } from './config';
import { derivePhotoVariants, deriveVideoPoster } from './derive';
import { variantFilename } from './paths';
import { sniffAndValidate, MediaUnsupportedError } from './sniff';
import { commitStaging, prepareStaging, purgeStagingDir } from './storage';

export type UploadOutcome =
  | { kind: 'retry'; mediaId: string; status: 'pending' | 'processing'; pollUrl: string }
  | { kind: 'ready_idempotent'; mediaId: string; deduplicated: false }
  | { kind: 'deduped'; mediaId: string }
  | { kind: 'created'; mediaId: string };

export class UploadValidationError extends Error {
  constructor(
    public httpStatus: number,
    public errCode: string
  ) {
    super(errCode);
  }
}

export interface UploadInput {
  dataDir: string;
  userId: string;
  babyId: string;
  entryId: string | null;
  clientUploadId: string;
  filenameRaw: string;
  uploadedFilePath: string;
}

export async function runUploadPipeline(input: UploadInput): Promise<UploadOutcome> {
  const { db } = getDb({ dataDir: input.dataDir });
  const limits = getMediaLimits(input.dataDir);

  const prior = db
    .select({ id: media.id, status: media.status })
    .from(media)
    .where(and(eq(media.clientUploadId, input.clientUploadId), eq(media.uploadedBy, input.userId)))
    .get();

  if (prior) {
    if (prior.status === 'pending' || prior.status === 'processing') {
      return {
        kind: 'retry',
        mediaId: prior.id,
        status: prior.status,
        pollUrl: `/api/media/${prior.id}/status`
      };
    }
    if (prior.status === 'ready') {
      return { kind: 'ready_idempotent', mediaId: prior.id, deduplicated: false };
    }
  }

  const mediaId = randomUUID();
  const nowMs = Date.now();
  db.insert(media)
    .values({
      id: mediaId,
      babyId: input.babyId,
      uploadedBy: input.userId,
      clientUploadId: input.clientUploadId,
      status: 'pending',
      filename: sanitizeFilenameDisplay(input.filenameRaw),
      createdAt: nowMs,
      updatedAt: nowMs
    })
    .run();

  const staging = await prepareStaging(input.dataDir, mediaId);
  await rename(input.uploadedFilePath, staging.rawPath);

  const size = (await stat(staging.rawPath)).size;
  if (size > Math.max(limits.maxPhotoBytes, limits.maxVideoBytes)) {
    await purgeStagingDir(staging.stagingDir);
    await markFailed(db, mediaId);
    throw new UploadValidationError(413, 'too_large');
  }

  const hash = await streamHashFile(staging.rawPath);

  let sniffed;
  try {
    sniffed = await sniffAndValidate(staging.rawPath);
  } catch (e) {
    await purgeStagingDir(staging.stagingDir);
    await markFailed(db, mediaId);
    if (e instanceof MediaUnsupportedError) {
      throw new UploadValidationError(422, e.message);
    }
    throw e;
  }

  const cap = sniffed.type === 'photo' ? limits.maxPhotoBytes : limits.maxVideoBytes;
  if (size > cap) {
    await purgeStagingDir(staging.stagingDir);
    await markFailed(db, mediaId);
    throw new UploadValidationError(413, 'too_large');
  }

  const originalName = variantFilename('original', sniffed.ext);
  await rename(staging.rawPath, join(staging.stagingDir, originalName));

  const dupe = db
    .select({ id: media.id })
    .from(media)
    .where(
      and(
        eq(media.babyId, input.babyId),
        eq(media.contentHash, hash),
        eq(media.status, 'ready'),
        ne(media.id, mediaId)
      )
    )
    .get();

  if (dupe) {
    await purgeStagingDir(staging.stagingDir);
    db.transaction((tx) => {
      tx.update(media)
        .set({ status: 'failed', updatedAt: Date.now() })
        .where(eq(media.id, mediaId))
        .run();
      if (input.entryId) {
        tx.insert(entryMedia)
          .values({
            entryId: input.entryId,
            mediaId: dupe.id,
            attachedBy: input.userId,
            attachedAt: Date.now()
          })
          .onConflictDoNothing()
          .run();
      }
    });
    return { kind: 'deduped', mediaId: dupe.id };
  }

  db.update(media).set({ status: 'processing', updatedAt: Date.now() }).where(eq(media.id, mediaId)).run();
  try {
    const originalAbs = join(staging.stagingDir, originalName);
    if (sniffed.type === 'photo') {
      await derivePhotoVariants(originalAbs, staging.stagingDir);
    } else {
      await deriveVideoPoster(originalAbs, staging.stagingDir);
    }
  } catch {
    await purgeStagingDir(staging.stagingDir);
    await markFailed(db, mediaId);
    throw new UploadValidationError(500, 'derive_failed');
  }

  let relativePath: string;
  try {
    relativePath = await commitStaging(input.dataDir, {
      mediaId,
      babyId: input.babyId,
      createdAtMs: sniffed.takenAtMs ?? nowMs,
      ext: sniffed.ext,
      kind: sniffed.type
    });
  } catch {
    await purgeStagingDir(staging.stagingDir).catch(() => {});
    await markFailed(db, mediaId);
    throw new UploadValidationError(500, 'commit_failed');
  }

  try {
    db.transaction((tx) => {
      tx.update(media)
        .set({
          status: 'ready',
          type: sniffed.type,
          mimeType: sniffed.mimeType,
          sizeBytes: size,
          contentHash: hash,
          width: sniffed.width,
          height: sniffed.height,
          durationSec: sniffed.durationSec,
          relativePath,
          originalExt: sniffed.ext,
          takenAt: sniffed.takenAtMs ?? nowMs,
          updatedAt: Date.now()
        })
        .where(eq(media.id, mediaId))
        .run();
      if (input.entryId) {
        tx.insert(entryMedia)
          .values({
            entryId: input.entryId,
            mediaId,
            attachedBy: input.userId,
            attachedAt: Date.now()
          })
          .onConflictDoNothing()
          .run();
      }
    });
  } catch {
    await markFailed(db, mediaId).catch(() => {});
    throw new UploadValidationError(409, 'commit_conflict');
  }

  return { kind: 'created', mediaId };
}

async function streamHashFile(path: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function markFailed(db: any, mediaId: string): Promise<void> {
  db.update(media).set({ status: 'failed', updatedAt: Date.now() }).where(eq(media.id, mediaId)).run();
}

function sanitizeFilenameDisplay(s: string): string {
  return (s || 'upload').replace(/[/\\\x00-\x1f]/g, '_').slice(0, 255);
}
