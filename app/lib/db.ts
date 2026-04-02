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

  initialized = true;
}

export async function getDb(): Promise<Pool> {
  await ensureDatabase();
  return getPool();
}
