import { NextRequest, NextResponse } from 'next/server';
import { loadRules, createRule } from '../../../lib/rules';

export async function GET() {
  const rules = await loadRules();
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, account_size, max_daily_loss, daily_loss_type, daily_loss_calc, max_total_loss, total_loss_type, profit_target, target_type, min_trading_days, max_trading_days } = body;

    if (!name || !account_size || max_daily_loss == null || max_total_loss == null || profit_target == null) {
      return NextResponse.json({ error: 'name, account_size, max_daily_loss, max_total_loss, and profit_target are required' }, { status: 400 });
    }

    const rule = await createRule({
      name,
      account_size: Number(account_size),
      max_daily_loss: Number(max_daily_loss),
      daily_loss_type: daily_loss_type ?? 'percent',
      daily_loss_calc: daily_loss_calc ?? 'balance',
      max_total_loss: Number(max_total_loss),
      total_loss_type: total_loss_type ?? 'percent',
      profit_target: Number(profit_target),
      target_type: target_type ?? 'percent',
      min_trading_days: Number(min_trading_days ?? 0),
      max_trading_days: max_trading_days != null ? Number(max_trading_days) : null,
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create rule' }, { status: 500 });
  }
}
