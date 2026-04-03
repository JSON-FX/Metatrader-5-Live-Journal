import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
  const db = await getDb();
  const [rows] = await db.execute<RowDataPacket[]>('SELECT setting_key, setting_value FROM app_settings');
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.setting_key] = row.setting_value;
  }
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = await getDb();

  for (const [key, value] of Object.entries(body)) {
    if (typeof key !== 'string' || typeof value !== 'string') continue;
    await db.execute(
      'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
      [key, value]
    );
  }

  return NextResponse.json({ ok: true });
}
