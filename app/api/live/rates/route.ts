import { NextRequest, NextResponse } from 'next/server';
import { resolveEndpoint } from '../../../lib/accounts';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const accountId = searchParams.get('accountId');
  const symbol    = searchParams.get('symbol');
  const timeframe = searchParams.get('timeframe');
  const from      = searchParams.get('from');
  const to        = searchParams.get('to');

  if (!symbol || !timeframe || !from || !to) {
    return NextResponse.json(
      { error: 'Missing required params: symbol, timeframe, from, to' },
      { status: 400 }
    );
  }

  const resolved = await resolveEndpoint(accountId);
  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 404 });
  }

  const upstream = new URL(`${resolved.endpoint}/rates`);
  upstream.searchParams.set('symbol', symbol);
  upstream.searchParams.set('timeframe', timeframe);
  upstream.searchParams.set('from', from);
  upstream.searchParams.set('to', to);

  try {
    const res = await fetch(upstream, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'MT5 rates unavailable' }));
      return NextResponse.json(body, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'MT5 unreachable' }, { status: 503 });
  }
}
