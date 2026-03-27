import { NextResponse } from 'next/server';

const MT5_ENDPOINT = process.env.MT5_API_ENDPOINT ?? 'http://localhost:5555';

export async function GET() {
  try {
    const res = await fetch(`${MT5_ENDPOINT}/account`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'MT5 account unavailable' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'MT5 unreachable' }, { status: 503 });
  }
}
