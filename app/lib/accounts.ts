import { readFile } from 'fs/promises';
import { join } from 'path';
import { AccountConfig, AccountsFile } from './live-types';

const ACCOUNTS_PATH = join(process.cwd(), 'accounts.json');

export async function loadAccounts(): Promise<AccountConfig[]> {
  try {
    const raw = await readFile(ACCOUNTS_PATH, 'utf-8');
    const parsed: AccountsFile = JSON.parse(raw);
    if (Array.isArray(parsed.accounts) && parsed.accounts.length > 0) {
      return parsed.accounts;
    }
  } catch {
    // accounts.json missing or malformed — fall through to env var fallback
  }

  const envEndpoint = process.env.MT5_API_ENDPOINT ?? 'http://localhost:5555';
  return [{ id: 'default', name: 'MT5 Account', type: 'live', endpoint: envEndpoint }];
}

export async function resolveEndpoint(accountId: string | null): Promise<{ endpoint: string } | { error: string }> {
  const accounts = await loadAccounts();

  if (!accountId) {
    return { endpoint: accounts[0].endpoint };
  }

  const account = accounts.find((a) => a.id === accountId);
  if (!account) {
    return { error: `Account "${accountId}" not found` };
  }

  return { endpoint: account.endpoint };
}
