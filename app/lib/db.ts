import mysql, { Pool } from 'mysql2/promise';

let pool: Pool | null = null;
let initialized = false;

function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST ?? 'lgu-mysql',
      user: process.env.MYSQL_USER ?? 'root',
      password: process.env.MYSQL_PASSWORD ?? '',
      database: process.env.MYSQL_DATABASE ?? 'db_metatrader_journal',
      waitForConnections: true,
      connectionLimit: 5,
    });
  }
  return pool;
}

async function ensureDatabase(): Promise<void> {
  if (initialized) return;

  const dbName = process.env.MYSQL_DATABASE ?? 'db_metatrader_journal';

  const tempConn = await mysql.createConnection({
    host: process.env.MYSQL_HOST ?? 'lgu-mysql',
    user: process.env.MYSQL_USER ?? 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
  });

  await tempConn.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await tempConn.end();

  const p = getPool();
  await p.execute(`
    CREATE TABLE IF NOT EXISTS mt5_accounts (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      slug        VARCHAR(50) UNIQUE NOT NULL,
      name        VARCHAR(100) NOT NULL,
      type        ENUM('live', 'propfirm') NOT NULL DEFAULT 'live',
      endpoint    VARCHAR(255) NOT NULL,
      sort_order  INT NOT NULL DEFAULT 0,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS propfirm_rules (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      name            VARCHAR(100) NOT NULL,
      account_size    DECIMAL(12,2) NOT NULL,
      max_daily_loss  DECIMAL(8,2) NOT NULL,
      daily_loss_type ENUM('money','percent') NOT NULL DEFAULT 'percent',
      daily_loss_calc ENUM('balance','equity') NOT NULL DEFAULT 'balance',
      max_total_loss  DECIMAL(8,2) NOT NULL,
      total_loss_type ENUM('money','percent') NOT NULL DEFAULT 'percent',
      profit_target   DECIMAL(8,2) NOT NULL,
      target_type     ENUM('money','percent') NOT NULL DEFAULT 'percent',
      min_trading_days INT NOT NULL DEFAULT 0,
      max_trading_days INT DEFAULT NULL,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Add rule_id column to mt5_accounts if it doesn't exist
  try {
    await p.execute(`ALTER TABLE mt5_accounts ADD COLUMN rule_id INT DEFAULT NULL`);
  } catch {
    // Column already exists — ignore
  }

  initialized = true;
}

export async function getDb(): Promise<Pool> {
  await ensureDatabase();
  return getPool();
}
