import { MT5Report, MT5Deal, MT5Settings, MT5Results, MT5TradeStats } from './types';

export class MergeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MergeError';
  }
}

function getSymbol(report: MT5Report): string {
  return report.settings.symbol.replace('_tickstory', '').toUpperCase();
}

function parseDateTime(dateStr: string): Date {
  // Handle MT5 date format: "2025.01.02 05:02:19"
  const normalized = dateStr.replace(/\./g, '-');
  return new Date(normalized);
}

function mergeDealsChronologically(reports: MT5Report[]): MT5Deal[] {
  const allDeals: MT5Deal[] = [];

  for (const report of reports) {
    // Filter out 'balance' type deals - they represent initial deposits
    // which we handle separately with a single shared capital
    const tradeDeals = report.deals.filter(deal => deal.type !== 'balance');
    allDeals.push(...tradeDeals);
  }

  // Sort by timestamp
  return allDeals.sort((a, b) => {
    const dateA = parseDateTime(a.time);
    const dateB = parseDateTime(b.time);
    return dateA.getTime() - dateB.getTime();
  });
}

function buildEquityCurveFromDeals(
  deals: MT5Deal[],
  initialDeposit: number
): { date: string; balance: number; equity: number }[] {
  const curve: { date: string; balance: number; equity: number }[] = [];

  // Add initial point
  if (deals.length > 0) {
    curve.push({
      date: deals[0].time.split(' ')[0].replace(/\./g, '-'),
      balance: initialDeposit,
      equity: initialDeposit
    });
  }

  // Rebuild balance progression from deals (balance deals already filtered out)
  let runningBalance = initialDeposit;

  for (const deal of deals) {
    if (deal.profit !== 0) {
      runningBalance += deal.profit + (deal.commission || 0) + (deal.swap || 0);
      curve.push({
        date: deal.time.replace(/\./g, '-'),
        balance: runningBalance,
        equity: runningBalance
      });
    }
  }

  return curve;
}

// Recalculate balance values in merged deals to reflect combined running balance
function recalculateDealBalances(deals: MT5Deal[], initialDeposit: number): MT5Deal[] {
  let runningBalance = initialDeposit;

  return deals.map(deal => {
    // Add profit/loss/commission/swap to running balance (balance deals already filtered)
    if (deal.profit !== 0) {
      runningBalance += deal.profit + (deal.commission || 0) + (deal.swap || 0);
    }

    return {
      ...deal,
      balance: runningBalance
    };
  });
}

function getRiskValueFromReport(report: MT5Report): number {
  const riskValue = report.settings.inputs?.RiskValue as number || 0;
  const riskMode = report.settings.inputs?.RiskMode as number;
  // Mode 0 = percentage risk, other modes = fixed lot/amount
  return riskMode === 0 ? riskValue : 0;
}

function mergeSettings(reports: MT5Report[]): MT5Settings {
  const first = reports[0].settings;

  // Use single shared capital (first report's initial deposit)
  // This simulates running all strategies on the same account
  const sharedDeposit = first.initialDeposit;

  // Combine periods
  const periods = reports.map(r => r.settings.period);
  const combinedPeriod = periods.length > 1 ? `Merged (${reports.length} reports)` : first.period;

  return {
    expert: first.expert,
    symbol: first.symbol,
    period: combinedPeriod,
    company: first.company,
    currency: first.currency,
    initialDeposit: sharedDeposit,
    leverage: first.leverage,
    inputs: first.inputs // Keep first report's inputs for reference
  };
}

function mergeResults(reports: MT5Report[], mergedDeals: MT5Deal[], totalDeposit: number): MT5Results {
  // Sum additive fields
  const totalNetProfit = reports.reduce((sum, r) => sum + r.results.totalNetProfit, 0);
  const grossProfit = reports.reduce((sum, r) => sum + r.results.grossProfit, 0);
  const grossLoss = reports.reduce((sum, r) => sum + r.results.grossLoss, 0);

  // Recalculate profit factor
  const profitFactor = grossLoss !== 0 ? grossProfit / Math.abs(grossLoss) : grossProfit > 0 ? Infinity : 0;

  // Max drawdown across reports
  const maxBalanceDrawdown = Math.max(...reports.map(r => r.results.balanceDrawdownMaximal));
  const maxBalanceDrawdownPercent = Math.max(...reports.map(r => r.results.balanceDrawdownMaximalPercent));
  const maxEquityDrawdown = Math.max(...reports.map(r => r.results.equityDrawdownMaximal));
  const maxEquityDrawdownPercent = Math.max(...reports.map(r => r.results.equityDrawdownMaximalPercent));

  // Calculate expected payoff from merged trades
  const totalTrades = reports.reduce((sum, r) => sum + r.tradeStats.totalTrades, 0);
  const expectedPayoff = totalTrades > 0 ? totalNetProfit / totalTrades : 0;

  // Recovery factor
  const recoveryFactor = maxEquityDrawdown > 0 ? totalNetProfit / maxEquityDrawdown : 0;

  // Sum other additive fields
  const bars = reports.reduce((sum, r) => sum + r.results.bars, 0);
  const ticks = reports.reduce((sum, r) => sum + r.results.ticks, 0);

  // Weighted average for ratios (by trade count)
  const totalTradesForWeight = reports.reduce((sum, r) => sum + r.tradeStats.totalTrades, 0);
  const sharpeRatio = totalTradesForWeight > 0
    ? reports.reduce((sum, r) => sum + r.results.sharpeRatio * r.tradeStats.totalTrades, 0) / totalTradesForWeight
    : 0;

  return {
    historyQuality: 'Merged',
    bars,
    ticks,
    symbols: 1,
    totalNetProfit,
    grossProfit,
    grossLoss,
    balanceDrawdownAbsolute: Math.max(...reports.map(r => r.results.balanceDrawdownAbsolute)),
    balanceDrawdownMaximal: maxBalanceDrawdown,
    balanceDrawdownMaximalPercent: maxBalanceDrawdownPercent,
    balanceDrawdownRelative: Math.max(...reports.map(r => r.results.balanceDrawdownRelative)),
    balanceDrawdownRelativeAmount: Math.max(...reports.map(r => r.results.balanceDrawdownRelativeAmount)),
    equityDrawdownAbsolute: Math.max(...reports.map(r => r.results.equityDrawdownAbsolute)),
    equityDrawdownMaximal: maxEquityDrawdown,
    equityDrawdownMaximalPercent: maxEquityDrawdownPercent,
    equityDrawdownRelative: Math.max(...reports.map(r => r.results.equityDrawdownRelative)),
    equityDrawdownRelativeAmount: Math.max(...reports.map(r => r.results.equityDrawdownRelativeAmount)),
    profitFactor: Number.isFinite(profitFactor) ? profitFactor : 0,
    expectedPayoff,
    marginLevel: Math.max(...reports.map(r => r.results.marginLevel)),
    recoveryFactor,
    sharpeRatio,
    zScore: 0, // Would need full trade sequence to calculate
    zScorePercent: 0,
    ahpr: 0,
    ahprPercent: 0,
    ghpr: 0,
    ghprPercent: 0,
    lrCorrelation: 0,
    lrStandardError: 0
  };
}

function mergeTradeStats(reports: MT5Report[]): MT5TradeStats {
  // Sum counts
  const totalTrades = reports.reduce((sum, r) => sum + r.tradeStats.totalTrades, 0);
  const totalDeals = reports.reduce((sum, r) => sum + r.tradeStats.totalDeals, 0);
  const shortTrades = reports.reduce((sum, r) => sum + r.tradeStats.shortTrades, 0);
  const longTrades = reports.reduce((sum, r) => sum + r.tradeStats.longTrades, 0);
  const profitTrades = reports.reduce((sum, r) => sum + r.tradeStats.profitTrades, 0);
  const lossTrades = reports.reduce((sum, r) => sum + r.tradeStats.lossTrades, 0);

  // Calculate short won trades
  const shortWon = reports.reduce((sum, r) =>
    sum + Math.round(r.tradeStats.shortTrades * r.tradeStats.shortWonPercent / 100), 0);
  const longWon = reports.reduce((sum, r) =>
    sum + Math.round(r.tradeStats.longTrades * r.tradeStats.longWonPercent / 100), 0);

  // Recalculate percentages
  const shortWonPercent = shortTrades > 0 ? (shortWon / shortTrades) * 100 : 0;
  const longWonPercent = longTrades > 0 ? (longWon / longTrades) * 100 : 0;
  const profitTradesPercent = totalTrades > 0 ? (profitTrades / totalTrades) * 100 : 0;
  const lossTradesPercent = totalTrades > 0 ? (lossTrades / totalTrades) * 100 : 0;

  // Max values
  const largestProfitTrade = Math.max(...reports.map(r => r.tradeStats.largestProfitTrade));
  const largestLossTrade = Math.min(...reports.map(r => r.tradeStats.largestLossTrade));
  const maxConsecutiveWins = Math.max(...reports.map(r => r.tradeStats.maxConsecutiveWins));
  const maxConsecutiveLosses = Math.max(...reports.map(r => r.tradeStats.maxConsecutiveLosses));

  // Weighted averages
  const totalProfitTrades = reports.reduce((sum, r) => sum + r.tradeStats.profitTrades, 0);
  const totalLossTrades = reports.reduce((sum, r) => sum + r.tradeStats.lossTrades, 0);

  const averageProfitTrade = totalProfitTrades > 0
    ? reports.reduce((sum, r) => sum + r.tradeStats.averageProfitTrade * r.tradeStats.profitTrades, 0) / totalProfitTrades
    : 0;
  const averageLossTrade = totalLossTrades > 0
    ? reports.reduce((sum, r) => sum + r.tradeStats.averageLossTrade * r.tradeStats.lossTrades, 0) / totalLossTrades
    : 0;

  return {
    totalTrades,
    totalDeals,
    shortTrades,
    shortWonPercent,
    longTrades,
    longWonPercent,
    profitTrades,
    profitTradesPercent,
    lossTrades,
    lossTradesPercent,
    largestProfitTrade,
    largestLossTrade,
    averageProfitTrade,
    averageLossTrade,
    maxConsecutiveWins,
    maxConsecutiveWinsAmount: Math.max(...reports.map(r => r.tradeStats.maxConsecutiveWinsAmount)),
    maxConsecutiveLosses,
    maxConsecutiveLossesAmount: Math.max(...reports.map(r => r.tradeStats.maxConsecutiveLossesAmount)),
    maxConsecutiveProfit: Math.max(...reports.map(r => r.tradeStats.maxConsecutiveProfit)),
    maxConsecutiveProfitCount: Math.max(...reports.map(r => r.tradeStats.maxConsecutiveProfitCount)),
    maxConsecutiveLoss: Math.min(...reports.map(r => r.tradeStats.maxConsecutiveLoss)),
    maxConsecutiveLossCount: Math.max(...reports.map(r => r.tradeStats.maxConsecutiveLossCount)),
    averageConsecutiveWins: Math.round(reports.reduce((sum, r) => sum + r.tradeStats.averageConsecutiveWins, 0) / reports.length),
    averageConsecutiveLosses: Math.round(reports.reduce((sum, r) => sum + r.tradeStats.averageConsecutiveLosses, 0) / reports.length),
    minHoldingTime: reports.reduce((min, r) => r.tradeStats.minHoldingTime < min ? r.tradeStats.minHoldingTime : min, reports[0].tradeStats.minHoldingTime),
    maxHoldingTime: reports.reduce((max, r) => r.tradeStats.maxHoldingTime > max ? r.tradeStats.maxHoldingTime : max, reports[0].tradeStats.maxHoldingTime),
    avgHoldingTime: reports[0].tradeStats.avgHoldingTime // Approximation
  };
}

export function mergeReports(reports: MT5Report[], name: string): MT5Report {
  // Validate minimum reports
  if (reports.length < 2) {
    throw new MergeError('At least 2 reports are required to merge');
  }

  // Validate same symbol
  const symbols = new Set(reports.map(getSymbol));
  if (symbols.size > 1) {
    throw new MergeError(`Cannot merge reports with different symbols: ${Array.from(symbols).join(', ')}`);
  }

  // Merge deals chronologically
  const chronologicalDeals = mergeDealsChronologically(reports);

  // Merge settings
  const mergedSettings = mergeSettings(reports);

  // Recalculate balance values for merged deals (important for equity curve)
  const mergedDeals = recalculateDealBalances(chronologicalDeals, mergedSettings.initialDeposit);

  // Build equity curve from merged deals
  const equityCurve = buildEquityCurveFromDeals(mergedDeals, mergedSettings.initialDeposit);

  // Merge results
  const mergedResults = mergeResults(reports, mergedDeals, mergedSettings.initialDeposit);

  // Merge trade stats
  const mergedTradeStats = mergeTradeStats(reports);

  // Combine orders
  const mergedOrders = reports.flatMap(r => r.orders).sort((a, b) =>
    parseDateTime(a.openTime).getTime() - parseDateTime(b.openTime).getTime()
  );

  // Generate unique ID
  const id = `merged-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Extract risk values from each source report
  const sourceRiskValues = reports.map(getRiskValueFromReport);
  const combinedRiskExposure = sourceRiskValues.reduce((sum, risk) => sum + risk, 0);

  // Extract max drawdowns from each report (use highest of balance/equity DD)
  const sourceDrawdowns = reports.map(r => Math.max(
    r.results.balanceDrawdownMaximalPercent,
    r.results.equityDrawdownMaximalPercent
  ));
  // Worst case: if all strategies hit max DD simultaneously
  const worstCaseDrawdown = sourceDrawdowns.reduce((sum, dd) => sum + dd, 0);

  return {
    id,
    name,
    importedAt: new Date().toISOString(),
    type: 'merged',
    settings: mergedSettings,
    results: mergedResults,
    tradeStats: mergedTradeStats,
    orders: mergedOrders,
    deals: mergedDeals,
    equityCurve,
    isMerged: true,
    sourceReportIds: reports.map(r => r.id),
    sourceReportNames: reports.map(r => r.name),
    sourceRiskValues,
    combinedRiskExposure,
    sourceDrawdowns,
    worstCaseDrawdown
  };
}

export function canMergeReports(reports: MT5Report[]): { canMerge: boolean; reason?: string } {
  if (reports.length < 2) {
    return { canMerge: false, reason: 'Select at least 2 reports to merge' };
  }

  const symbols = new Set(reports.map(getSymbol));
  if (symbols.size > 1) {
    return { canMerge: false, reason: `Cannot merge different symbols: ${Array.from(symbols).join(', ')}` };
  }

  return { canMerge: true };
}
