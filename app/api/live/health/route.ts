import { NextRequest, NextResponse } from 'next/server';
import { resolveEndpoint } from '../../../lib/accounts';

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get('accountId');
  const resolved = await resolveEndpoint(accountId);

  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 404 });
  }

  try {
    const res = await fetch(`${resolved.endpoint}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ status: 'offline' }, { status: 503 });
  }
}
