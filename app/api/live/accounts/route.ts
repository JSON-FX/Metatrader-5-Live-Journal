import { NextRequest, NextResponse } from 'next/server';
import { loadAccounts, createAccount } from '../../../lib/accounts';
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
            slug: account.slug,
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
        slug: account.slug,
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, name, type, endpoint } = body;

    if (!slug || !name || !endpoint) {
      return NextResponse.json({ error: 'slug, name, and endpoint are required' }, { status: 400 });
    }

    if (type && type !== 'live' && type !== 'propfirm') {
      return NextResponse.json({ error: 'type must be "live" or "propfirm"' }, { status: 400 });
    }

    const account = await createAccount({ slug, name, type: type ?? 'live', endpoint });
    return NextResponse.json(account, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create account';
    if (message.includes('Duplicate entry')) {
      return NextResponse.json({ error: 'Account with this slug already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
