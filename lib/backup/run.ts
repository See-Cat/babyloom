import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, link, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { sanitize } from './sanitize';
import { assertWritesAllowed, setBackupInProgress } from './write-barrier';
import { writeZip } from './zip';

export interface BackupFile {
  id: string;
  relativePath: string;
  filename: string;
  sizeBytes: number;
  sha256: string;
}

export interface BackupManifest {
  createdAt: string;
  dbSha256: string;
  files: BackupFile[];
}

export interface BackupResult {
  filename: string;
  zipPath: string;
  sha256: string;
  manifest: BackupManifest;
  stream: () => ReadableStream<Uint8Array>;
  cleanup: () => Promise<void>;
}

interface RunBackupOptions {
  dataDir: string;
  dbPath?: string;
}

interface MediaRow {
  id: string;
  relative_path: string | null;
  original_ext: string | null;
  filename: string;
}

export async function runBackup(opts: RunBackupOptions): Promise<BackupResult> {
  assertWritesAllowed();

  const dataDir = resolve(opts.dataDir);
  const dbPath = opts.dbPath ?? join(dataDir, 'db', 'babyloom.sqlite');
  const id = randomUUID();
  const stagingDir = join(dataDir, '_backup_staging', id);
  const snapshotPath = join(stagingDir, 'snapshot.db');
  const zipPath = join(stagingDir, 'babyloom-backup.zip');

  setBackupInProgress(true);
  try {
    await mkdir(stagingDir, { recursive: true });
    const source = new Database(dbPath, { readonly: true });
    try {
      await source.backup(snapshotPath);
    } finally {
      source.close();
    }

    const snapshot = new Database(snapshotPath);
    try {
      snapshot.pragma('wal_checkpoint(TRUNCATE)');
    } finally {
      snapshot.close();
    }

    sanitize(snapshotPath);
    const files = await stageMediaFiles(dataDir, stagingDir, snapshotPath);
    const dbSha256 = await fileSha256(snapshotPath);
    const manifest: BackupManifest = {
      createdAt: new Date().toISOString(),
      dbSha256,
      files
    };
    const manifestPath = join(stagingDir, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const sha256 = await writeZip(
      [
        { name: 'snapshot.db', path: snapshotPath },
        { name: 'manifest.json', path: manifestPath },
        ...files.map((file) => ({
          name: file.relativePath,
          path: join(stagingDir, file.relativePath)
        }))
      ],
      zipPath
    );
    const filename = `babyloom-backup-${new Date().toISOString().replaceAll(':', '-')}.zip`;

    return {
      filename,
      zipPath,
      sha256,
      manifest,
      stream: () => Readable.toWeb(createReadStream(zipPath)) as ReadableStream<Uint8Array>,
      cleanup: () => rm(stagingDir, { recursive: true, force: true })
    };
  } catch (e) {
    await rm(stagingDir, { recursive: true, force: true });
    throw e;
  } finally {
    setBackupInProgress(false);
  }
}

async function stageMediaFiles(dataDir: string, stagingDir: string, snapshotPath: string) {
  const db = new Database(snapshotPath, { readonly: true });
  try {
    const rows = db
      .prepare(
        `SELECT id, relative_path, original_ext, filename
         FROM media
         WHERE status = 'ready'
         ORDER BY id`
      )
      .all() as MediaRow[];
    const files: BackupFile[] = [];
    for (const row of rows) {
      if (!row.relative_path || !row.original_ext) continue;
      const relativePath = `${row.relative_path}/original.${row.original_ext}`;
      const src = resolveUnder(dataDir, relativePath);
      const dest = resolveUnder(stagingDir, relativePath);
      await mkdir(dest.slice(0, dest.lastIndexOf(sep)), { recursive: true });
      try {
        await link(src, dest);
      } catch {
        await copyFile(src, dest);
      }
      const st = await stat(dest);
      files.push({
        id: row.id,
        relativePath,
        filename: row.filename,
        sizeBytes: st.size,
        sha256: await fileSha256(dest)
      });
    }
    return files;
  } finally {
    db.close();
  }
}

function resolveUnder(root: string, relativePath: string) {
  const abs = resolve(root, relativePath);
  const rootAbs = resolve(root);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + sep)) throw new Error('path_escape');
  return abs;
}

async function fileSha256(path: string) {
  const hash = createHash('sha256');
  await new Promise<void>((resolvePromise, reject) => {
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', resolvePromise);
  });
  return hash.digest('hex');
}
