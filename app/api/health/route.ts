import { NextResponse } from 'next/server';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getDb } from '@/lib/server/db/client';
import { ensureStartup } from '@/instrumentation.node';

const dataDir = resolve(process.env.BABYLOOM_DATA_DIR ?? './data');

export const GET = async () => {
  try {
    await ensureStartup();
    await access(dataDir, constants.W_OK);
    const { raw } = getDb({ dataDir });
    const result = raw.prepare('SELECT 1 as ok').get() as { ok: number };
    return NextResponse.json({ ok: true, dbReady: result.ok === 1, dataDirWritable: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
};
