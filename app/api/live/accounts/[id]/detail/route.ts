import { NextRequest, NextResponse } from 'next/server';
import { getAccountById } from '../../../../../lib/accounts';
import { getRuleById } from '../../../../../lib/rules';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
  }

  const account = await getAccountById(id);
  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const rule = account.rule_id ? await getRuleById(account.rule_id) : null;

  return NextResponse.json({ ...account, rule });
}
