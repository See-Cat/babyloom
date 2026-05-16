import { NextResponse } from 'next/server';
import { resolve } from 'node:path';
import { getDb } from '@/lib/db/client';

const dataDir = process.env.BABYLOOM_DATA_DIR ?? resolve(process.cwd(), 'data');

export async function GET() {
  try {
    const { raw } = getDb({ dataDir });
    const result = raw.prepare('SELECT 1 as ok').get() as { ok: number };
    return NextResponse.json({ ok: true, dbReady: result.ok === 1 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
}
