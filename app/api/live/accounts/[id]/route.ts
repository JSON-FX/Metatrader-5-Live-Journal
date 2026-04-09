import { NextRequest, NextResponse } from 'next/server';
import { updateAccount, deleteAccount, getAccountById } from '../../../../lib/accounts';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
  }

  const existing = await getAccountById(id);
  if (!existing) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { slug, name, type, endpoint, rule_id } = body;

    if (type && type !== 'live' && type !== 'propfirm' && type !== 'demo') {
      return NextResponse.json({ error: 'type must be "live", "demo", or "propfirm"' }, { status: 400 });
    }

    const updated = await updateAccount(id, { slug, name, type, endpoint, rule_id });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update account';
    if (message.includes('Duplicate entry')) {
      return NextResponse.json({ error: 'Account with this slug already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
  }

  const deleted = await deleteAccount(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
