import { LiveTrade, LiveAccountInfo, PropfirmRule, ObjectiveResult, ObjectiveStatus } from './live-types';

function resolveLimit(value: number, type: 'money' | 'percent', accountSize: number): number {
  return type === 'percent' ? (value / 100) * accountSize : value;
}

function formatLimit(value: number, type: 'money' | 'percent'): string {
  if (type === 'percent') return `${value}%`;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function formatMoney(value: number): string {
  return `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export function calculateObjectives(
  rule: PropfirmRule,
  trades: LiveTrade[],
  account: LiveAccountInfo | null,
): ObjectiveResult[] {
  const results: ObjectiveResult[] = [];
  const equity = account?.equity ?? rule.account_size;
  const balance = account?.balance ?? rule.account_size;

  // Profit Target
  const targetLimit = resolveLimit(rule.profit_target, rule.target_type, rule.account_size);
  const currentProfit = balance - rule.account_size;
  const targetStatus: ObjectiveStatus = currentProfit >= targetLimit ? 'passing' : 'in_progress';
  results.push({
    name: 'Profit Target',
    result: formatMoney(currentProfit),
    target: formatLimit(rule.profit_target, rule.target_type),
    status: targetStatus,
  });

  // Max Daily Loss
  const dailyLimit = resolveLimit(rule.max_daily_loss, rule.daily_loss_type, rule.account_size);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTrades = trades.filter(t => t.close_time.startsWith(todayStr));
  const todayPnl = todayTrades.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0);
  const floatingPnl = account?.floating_pnl ?? 0;
  const dailyLoss = Math.abs(Math.min(0, todayPnl + floatingPnl));
  const dailyStatus: ObjectiveStatus = dailyLoss >= dailyLimit ? 'failed' : 'passing';
  results.push({
    name: 'Max Daily Loss',
    result: formatMoney(-dailyLoss),
    target: formatLimit(rule.max_daily_loss, rule.daily_loss_type),
    status: dailyStatus,
  });

  // Max Total Loss
  const totalLimit = resolveLimit(rule.max_total_loss, rule.total_loss_type, rule.account_size);
  const totalLoss = Math.max(0, rule.account_size - equity);
  const totalStatus: ObjectiveStatus = totalLoss >= totalLimit ? 'failed' : 'passing';
  results.push({
    name: 'Max Total Loss',
    result: formatMoney(-totalLoss),
    target: formatLimit(rule.max_total_loss, rule.total_loss_type),
    status: totalStatus,
  });

  // Min Trading Days
  if (rule.min_trading_days > 0) {
    const tradeDates = new Set(trades.map(t => t.close_time.slice(0, 10)));
    const tradingDays = tradeDates.size;
    const minDayStatus: ObjectiveStatus = tradingDays >= rule.min_trading_days ? 'passing' : 'in_progress';
    results.push({
      name: 'Minimum Trading Days',
      result: `${tradingDays} days`,
      target: `${rule.min_trading_days} days`,
      status: minDayStatus,
    });
  }

  // Max Trading Days
  if (rule.max_trading_days != null) {
    const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));
    let daysElapsed = 0;
    if (sorted.length > 0) {
      const firstDate = new Date(sorted[0].close_time);
      const now = new Date();
      daysElapsed = Math.floor((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    const maxDayStatus: ObjectiveStatus = daysElapsed > rule.max_trading_days ? 'failed' : 'passing';
    results.push({
      name: 'Maximum Trading Days',
      result: `${daysElapsed} days`,
      target: `${rule.max_trading_days} days`,
      status: maxDayStatus,
    });
  }

  return results;
}

export function calculateDisciplineScore(
  rule: PropfirmRule,
  trades: LiveTrade[],
  account: LiveAccountInfo | null,
): number {
  const equity = account?.equity ?? rule.account_size;
  const balance = account?.balance ?? rule.account_size;
  const scores: number[] = [];

  // Daily loss safety
  const dailyLimit = resolveLimit(rule.max_daily_loss, rule.daily_loss_type, rule.account_size);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTrades = trades.filter(t => t.close_time.startsWith(todayStr));
  const todayPnl = todayTrades.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0);
  const floatingPnl = account?.floating_pnl ?? 0;
  const dailyLoss = Math.abs(Math.min(0, todayPnl + floatingPnl));
  if (dailyLimit > 0) scores.push(Math.max(0, Math.min(100, ((dailyLimit - dailyLoss) / dailyLimit) * 100)));

  // Total loss safety
  const totalLimit = resolveLimit(rule.max_total_loss, rule.total_loss_type, rule.account_size);
  const totalLoss = Math.max(0, rule.account_size - equity);
  if (totalLimit > 0) scores.push(Math.max(0, Math.min(100, ((totalLimit - totalLoss) / totalLimit) * 100)));

  // Profit target progress
  const targetLimit = resolveLimit(rule.profit_target, rule.target_type, rule.account_size);
  const currentProfit = balance - rule.account_size;
  if (targetLimit > 0) scores.push(Math.max(0, Math.min(100, (currentProfit / targetLimit) * 100)));

  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
