import { NextRequest, NextResponse } from 'next/server';

const MT5_ENDPOINT = process.env.MT5_API_ENDPOINT ?? 'http://localhost:5555';

export async function GET(req: NextRequest) {
  const days = req.nextUrl.searchParams.get('days') ?? '90';
  try {
    const res = await fetch(`${MT5_ENDPOINT}/history?days=${days}`, {
      signal: AbortSignal.timeout(15000), // history can be slow on large accounts
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'MT5 history unavailable' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'MT5 unreachable' }, { status: 503 });
  }
}
