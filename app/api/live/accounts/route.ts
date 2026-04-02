import { NextResponse } from 'next/server';
import { loadAccounts } from '../../../lib/accounts';
import { AccountListItem } from '../../../lib/live-types';

export async function GET() {
  const accounts = await loadAccounts();

  const results: AccountListItem[] = await Promise.all(
    accounts.map(async (account) => {
      try {
        const res = await fetch(`${account.endpoint}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const health = await res.json();
          return {
            id: account.id,
            name: account.name,
            type: account.type,
            status: 'online' as const,
            server: health.server ?? null,
            login: health.account ?? null,
          };
        }
      } catch {
        // offline — fall through
      }

      return {
        id: account.id,
        name: account.name,
        type: account.type,
        status: 'offline' as const,
        server: null,
        login: null,
      };
    })
  );

  return NextResponse.json({ accounts: results });
}
