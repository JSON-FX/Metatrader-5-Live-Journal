import { getDb } from './db';
import { AccountConfig } from './live-types';
import { RowDataPacket } from 'mysql2';

export async function loadAccounts(): Promise<AccountConfig[]> {
  try {
    const db = await getDb();
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT id, slug, name, type, endpoint, sort_order, rule_id FROM mt5_accounts ORDER BY sort_order ASC, id ASC'
    );
    return rows as AccountConfig[];
  } catch {
    return [];
  }
}

export async function resolveEndpoint(slug: string | null): Promise<{ endpoint: string } | { error: string }> {
  if (!slug) {
    const accounts = await loadAccounts();
    if (accounts.length === 0) {
      return { error: 'No accounts configured' };
    }
    return { endpoint: accounts[0].endpoint };
  }

  try {
    const db = await getDb();
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT endpoint FROM mt5_accounts WHERE slug = ?',
      [slug]
    );
    if (rows.length === 0) {
      return { error: `Account "${slug}" not found` };
    }
    return { endpoint: (rows[0] as { endpoint: string }).endpoint };
  } catch {
    return { error: 'Database connection failed' };
  }
}

export async function getAccountById(id: number): Promise<AccountConfig | null> {
  try {
    const db = await getDb();
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT id, slug, name, type, endpoint, sort_order, rule_id FROM mt5_accounts WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? (rows[0] as AccountConfig) : null;
  } catch {
    return null;
  }
}

export async function createAccount(data: { slug: string; name: string; type: string; endpoint: string; rule_id?: number | null }): Promise<AccountConfig> {
  const db = await getDb();
  const [result] = await db.execute(
    'INSERT INTO mt5_accounts (slug, name, type, endpoint, rule_id) VALUES (?, ?, ?, ?, ?)',
    [data.slug, data.name, data.type, data.endpoint, data.rule_id ?? null]
  );
  const insertId = (result as { insertId: number }).insertId;
  return (await getAccountById(insertId))!;
}

export async function updateAccount(id: number, data: { slug?: string; name?: string; type?: string; endpoint?: string; rule_id?: number | null }): Promise<AccountConfig | null> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.slug !== undefined) { fields.push('slug = ?'); values.push(data.slug); }
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
  if (data.endpoint !== undefined) { fields.push('endpoint = ?'); values.push(data.endpoint); }
  if (data.rule_id !== undefined) { fields.push('rule_id = ?'); values.push(data.rule_id); }

  if (fields.length === 0) return getAccountById(id);

  values.push(id);
  const db = await getDb();
  await db.execute(`UPDATE mt5_accounts SET ${fields.join(', ')} WHERE id = ?`, values);
  return getAccountById(id);
}

export async function deleteAccount(id: number): Promise<boolean> {
  const db = await getDb();
  const [result] = await db.execute('DELETE FROM mt5_accounts WHERE id = ?', [id]);
  return (result as { affectedRows: number }).affectedRows > 0;
}
