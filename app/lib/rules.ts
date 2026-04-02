import { getDb } from './db';
import { PropfirmRule } from './live-types';
import { RowDataPacket } from 'mysql2';

export async function loadRules(): Promise<PropfirmRule[]> {
  try {
    const db = await getDb();
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT id, name, account_size, max_daily_loss, daily_loss_type, daily_loss_calc, max_total_loss, total_loss_type, profit_target, target_type, min_trading_days, max_trading_days FROM propfirm_rules ORDER BY name ASC'
    );
    return rows as PropfirmRule[];
  } catch {
    return [];
  }
}

export async function getRuleById(id: number): Promise<PropfirmRule | null> {
  try {
    const db = await getDb();
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT id, name, account_size, max_daily_loss, daily_loss_type, daily_loss_calc, max_total_loss, total_loss_type, profit_target, target_type, min_trading_days, max_trading_days FROM propfirm_rules WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? (rows[0] as PropfirmRule) : null;
  } catch {
    return null;
  }
}

export async function createRule(data: Omit<PropfirmRule, 'id'>): Promise<PropfirmRule> {
  const db = await getDb();
  const [result] = await db.execute(
    'INSERT INTO propfirm_rules (name, account_size, max_daily_loss, daily_loss_type, daily_loss_calc, max_total_loss, total_loss_type, profit_target, target_type, min_trading_days, max_trading_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [data.name, data.account_size, data.max_daily_loss, data.daily_loss_type, data.daily_loss_calc, data.max_total_loss, data.total_loss_type, data.profit_target, data.target_type, data.min_trading_days, data.max_trading_days]
  );
  const insertId = (result as { insertId: number }).insertId;
  return (await getRuleById(insertId))!;
}

export async function updateRule(id: number, data: Partial<Omit<PropfirmRule, 'id'>>): Promise<PropfirmRule | null> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  const fieldMap: Record<string, keyof typeof data> = {
    'name': 'name', 'account_size': 'account_size',
    'max_daily_loss': 'max_daily_loss', 'daily_loss_type': 'daily_loss_type',
    'daily_loss_calc': 'daily_loss_calc', 'max_total_loss': 'max_total_loss',
    'total_loss_type': 'total_loss_type', 'profit_target': 'profit_target',
    'target_type': 'target_type', 'min_trading_days': 'min_trading_days',
    'max_trading_days': 'max_trading_days',
  };

  for (const [col, key] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      fields.push(`${col} = ?`);
      values.push(data[key] as string | number | null);
    }
  }

  if (fields.length === 0) return getRuleById(id);

  values.push(id);
  const db = await getDb();
  await db.execute(`UPDATE propfirm_rules SET ${fields.join(', ')} WHERE id = ?`, values);
  return getRuleById(id);
}

export async function deleteRule(id: number): Promise<boolean> {
  const db = await getDb();
  await db.execute('UPDATE mt5_accounts SET rule_id = NULL WHERE rule_id = ?', [id]);
  const [result] = await db.execute('DELETE FROM propfirm_rules WHERE id = ?', [id]);
  return (result as { affectedRows: number }).affectedRows > 0;
}
