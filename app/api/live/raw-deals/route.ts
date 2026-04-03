import { NextRequest, NextResponse } from 'next/server';
import { resolveEndpoint } from '../../../lib/accounts';

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get('accountId');
  const days = req.nextUrl.searchParams.get('days') ?? '90';
  const resolved = await resolveEndpoint(accountId);

  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 404 });
  }

  try {
    const res = await fetch(`${resolved.endpoint}/raw-deals?days=${days}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'MT5 raw deals unavailable' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'MT5 unreachable' }, { status: 503 });
  }
}
