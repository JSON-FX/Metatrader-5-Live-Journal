import { NextResponse } from 'next/server';

const MT5_ENDPOINT = process.env.MT5_API_ENDPOINT ?? 'http://localhost:5555';

export async function GET() {
  try {
    const res = await fetch(`${MT5_ENDPOINT}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ status: 'offline' }, { status: 503 });
  }
}
