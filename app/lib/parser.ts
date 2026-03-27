import { MT5Report, MT5Settings, MT5Results, MT5TradeStats, MT5Order, MT5Deal } from './types';

// Live report position interface (for internal use)
interface LivePosition {
  time: string;
  positionId: number;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  openPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  closeTime: string;
  closePrice: number;
  commission: number;
  swap: number;
  profit: number;
}

type ReportType = 'backtest' | 'live' | 'unknown';

function detectReportType(content: string): ReportType {
  const lower = content.toLowerCase();
  // Backtest reports contain "Strategy Tester" in the title
  if (lower.includes('strategy tester')) {
    return 'backtest';
  }
  // Live reports contain "Trade History Report" pattern
  if (lower.includes('trade history report')) {
    return 'live';
  }
  // Fallback: check for 3-table structure unique to live reports
  if (lower.includes('<b>positions</b>') && lower.includes('<b>deals</b>')) {
    return 'live';
  }
  return 'unknown';
}

function cleanText(text: string): string {
  // Handle UTF-16 encoded content
  return text.replace(/\0/g, '').trim();
}

function parseNumber(text: string): number {
  const cleaned = cleanText(text).replace(/\s/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function parsePercentValue(text: string): { value: number; percent: number } {
  const cleaned = cleanText(text);
  const match = cleaned.match(/([\d\s.,]+)\s*\(([\d.,]+)%?\)/);
  if (match) {
    return {
      value: parseNumber(match[1]),
      percent: parseNumber(match[2])
    };
  }
  const percentMatch = cleaned.match(/([\d.,]+)%?\s*\(([\d\s.,]+)\)/);
  if (percentMatch) {
    return {
      value: parseNumber(percentMatch[2]),
      percent: parseNumber(percentMatch[1])
    };
  }
  return { value: parseNumber(cleaned), percent: 0 };
}

function extractTableRows(html: string): string[][] {
  const rows: string[][] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      // Extract text content, removing HTML tags
      const text = cellMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();
      cells.push(cleanText(text));
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return rows;
}

function findValueAfterLabel(rows: string[][], label: string): string {
  for (const row of rows) {
    for (let i = 0; i < row.length - 1; i++) {
      if (row[i].toLowerCase().includes(label.toLowerCase())) {
        // Return the next non-empty cell
        for (let j = i + 1; j < row.length; j++) {
          if (row[j].trim()) {
            return row[j];
          }
        }
      }
    }
  }
  return '';
}

function parseSettings(rows: string[][]): MT5Settings {
  const inputs: Record<string, string | number | boolean> = {};
  let inInputsSection = false;

  for (const row of rows) {
    const rowText = row.join(' ');
    if (rowText.includes('Inputs:')) {
      inInputsSection = true;
      continue;
    }
    if (inInputsSection && row.length > 0) {
      const text = row.join('');
      if (text.includes('=') && !text.startsWith('=')) {
        const [key, value] = text.split('=').map(s => s.trim());
        if (key && value !== undefined) {
          if (value === 'true') inputs[key] = true;
          else if (value === 'false') inputs[key] = false;
          else if (!isNaN(parseFloat(value))) inputs[key] = parseFloat(value);
          else inputs[key] = value;
        }
      }
      if (row.some(cell => cell.toLowerCase().includes('company:'))) {
        inInputsSection = false;
      }
    }
  }

  return {
    expert: findValueAfterLabel(rows, 'Expert:'),
    symbol: findValueAfterLabel(rows, 'Symbol:'),
    period: findValueAfterLabel(rows, 'Period:'),
    company: findValueAfterLabel(rows, 'Company:'),
    currency: findValueAfterLabel(rows, 'Currency:'),
    initialDeposit: parseNumber(findValueAfterLabel(rows, 'Initial Deposit:')),
    leverage: findValueAfterLabel(rows, 'Leverage:'),
    inputs
  };
}

function parseResults(rows: string[][]): MT5Results {
  const balanceDrawdownMax = parsePercentValue(findValueAfterLabel(rows, 'Balance Drawdown Maximal:'));
  const balanceDrawdownRel = parsePercentValue(findValueAfterLabel(rows, 'Balance Drawdown Relative:'));
  const equityDrawdownMax = parsePercentValue(findValueAfterLabel(rows, 'Equity Drawdown Maximal:'));
  const equityDrawdownRel = parsePercentValue(findValueAfterLabel(rows, 'Equity Drawdown Relative:'));
  const ahpr = parsePercentValue(findValueAfterLabel(rows, 'AHPR:'));
  const ghpr = parsePercentValue(findValueAfterLabel(rows, 'GHPR:'));
  const zScore = parsePercentValue(findValueAfterLabel(rows, 'Z-Score:'));

  return {
    historyQuality: findValueAfterLabel(rows, 'History Quality:'),
    bars: parseNumber(findValueAfterLabel(rows, 'Bars:')),
    ticks: parseNumber(findValueAfterLabel(rows, 'Ticks:')),
    symbols: parseNumber(findValueAfterLabel(rows, 'Symbols:')),
    totalNetProfit: parseNumber(findValueAfterLabel(rows, 'Total Net Profit:')),
    grossProfit: parseNumber(findValueAfterLabel(rows, 'Gross Profit:')),
    grossLoss: parseNumber(findValueAfterLabel(rows, 'Gross Loss:')),
    balanceDrawdownAbsolute: parseNumber(findValueAfterLabel(rows, 'Balance Drawdown Absolute:')),
    balanceDrawdownMaximal: balanceDrawdownMax.value,
    balanceDrawdownMaximalPercent: balanceDrawdownMax.percent,
    balanceDrawdownRelative: balanceDrawdownRel.percent,
    balanceDrawdownRelativeAmount: balanceDrawdownRel.value,
    equityDrawdownAbsolute: parseNumber(findValueAfterLabel(rows, 'Equity Drawdown Absolute:')),
    equityDrawdownMaximal: equityDrawdownMax.value,
    equityDrawdownMaximalPercent: equityDrawdownMax.percent,
    equityDrawdownRelative: equityDrawdownRel.percent,
    equityDrawdownRelativeAmount: equityDrawdownRel.value,
    profitFactor: parseNumber(findValueAfterLabel(rows, 'Profit Factor:')),
    expectedPayoff: parseNumber(findValueAfterLabel(rows, 'Expected Payoff:')),
    marginLevel: parseNumber(findValueAfterLabel(rows, 'Margin Level:').replace('%', '')),
    recoveryFactor: parseNumber(findValueAfterLabel(rows, 'Recovery Factor:')),
    sharpeRatio: parseNumber(findValueAfterLabel(rows, 'Sharpe Ratio:')),
    zScore: zScore.value,
    zScorePercent: zScore.percent,
    ahpr: ahpr.value,
    ahprPercent: ahpr.percent,
    ghpr: ghpr.value,
    ghprPercent: ghpr.percent,
    lrCorrelation: parseNumber(findValueAfterLabel(rows, 'LR Correlation:')),
    lrStandardError: parseNumber(findValueAfterLabel(rows, 'LR Standard Error:'))
  };
}

function parseTradeStats(rows: string[][]): MT5TradeStats {
  const shortTrades = parsePercentValue(findValueAfterLabel(rows, 'Short Trades (won %):'));
  const longTrades = parsePercentValue(findValueAfterLabel(rows, 'Long Trades (won %):'));
  const profitTrades = parsePercentValue(findValueAfterLabel(rows, 'Profit Trades (% of total):'));
  const lossTrades = parsePercentValue(findValueAfterLabel(rows, 'Loss Trades (% of total):'));
  const maxConsWins = parsePercentValue(findValueAfterLabel(rows, 'Maximum consecutive wins ($):'));
  const maxConsLosses = parsePercentValue(findValueAfterLabel(rows, 'Maximum consecutive losses ($):'));
  const maxConsProfit = parsePercentValue(findValueAfterLabel(rows, 'Maximal consecutive profit (count):'));
  const maxConsLoss = parsePercentValue(findValueAfterLabel(rows, 'Maximal consecutive loss (count):'));

  return {
    totalTrades: parseNumber(findValueAfterLabel(rows, 'Total Trades:')),
    totalDeals: parseNumber(findValueAfterLabel(rows, 'Total Deals:')),
    shortTrades: shortTrades.value,
    shortWonPercent: shortTrades.percent,
    longTrades: longTrades.value,
    longWonPercent: longTrades.percent,
    profitTrades: profitTrades.value,
    profitTradesPercent: profitTrades.percent,
    lossTrades: lossTrades.value,
    lossTradesPercent: lossTrades.percent,
    largestProfitTrade: parseNumber(findValueAfterLabel(rows, 'Largest profit trade:')),
    largestLossTrade: parseNumber(findValueAfterLabel(rows, 'Largest loss trade:')),
    averageProfitTrade: parseNumber(findValueAfterLabel(rows, 'Average profit trade:')),
    averageLossTrade: parseNumber(findValueAfterLabel(rows, 'Average loss trade:')),
    maxConsecutiveWins: maxConsWins.value,
    maxConsecutiveWinsAmount: maxConsWins.percent,
    maxConsecutiveLosses: maxConsLosses.value,
    maxConsecutiveLossesAmount: maxConsLosses.percent,
    maxConsecutiveProfit: maxConsProfit.value,
    maxConsecutiveProfitCount: maxConsProfit.percent,
    maxConsecutiveLoss: maxConsLoss.value,
    maxConsecutiveLossCount: maxConsLoss.percent,
    averageConsecutiveWins: parseNumber(findValueAfterLabel(rows, 'Average consecutive wins:')),
    averageConsecutiveLosses: parseNumber(findValueAfterLabel(rows, 'Average consecutive losses:')),
    minHoldingTime: findValueAfterLabel(rows, 'Minimal position holding time:'),
    maxHoldingTime: findValueAfterLabel(rows, 'Maximal position holding time:'),
    avgHoldingTime: findValueAfterLabel(rows, 'Average position holding time:')
  };
}

function parseOrders(html: string): MT5Order[] {
  const orders: MT5Order[] = [];

  // Find the Orders section
  const ordersMatch = html.match(/<b>Orders<\/b>[\s\S]*?<\/table>/i);
  if (!ordersMatch) return orders;

  const ordersSection = ordersMatch[0];
  const rows = extractTableRows(ordersSection);

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length >= 10 && row[0].match(/\d{4}\.\d{2}\.\d{2}/)) {
      const volumeParts = row[4].split('/').map(v => parseNumber(v.trim()));
      orders.push({
        openTime: row[0],
        order: parseInt(row[1]) || 0,
        symbol: row[2],
        type: row[3].toLowerCase() as 'buy' | 'sell',
        volume: volumeParts[0] || 0,
        filledVolume: volumeParts[1] || volumeParts[0] || 0,
        price: parseNumber(row[5]),
        stopLoss: row[6] && parseNumber(row[6]) !== 0 ? parseNumber(row[6]) : null,
        takeProfit: row[7] && parseNumber(row[7]) !== 0 ? parseNumber(row[7]) : null,
        time: row[8] || row[0],
        state: row[9] || 'filled',
        comment: row[10] || ''
      });
    }
  }

  return orders;
}

function parseDeals(html: string): MT5Deal[] {
  const deals: MT5Deal[] = [];

  // Find the Deals section
  const dealsMatch = html.match(/<b>Deals<\/b>[\s\S]*?<\/table>/i);
  if (!dealsMatch) return deals;

  const dealsSection = dealsMatch[0];
  const rows = extractTableRows(dealsSection);

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length >= 10 && row[0].match(/\d{4}\.\d{2}\.\d{2}/)) {
      deals.push({
        time: row[0],
        deal: parseInt(row[1]) || 0,
        symbol: row[2],
        type: row[3],
        direction: row[4]?.toLowerCase() === 'out' ? 'out' : 'in',
        volume: parseNumber(row[5]),
        price: parseNumber(row[6]),
        order: parseInt(row[7]) || 0,
        commission: parseNumber(row[8]),
        swap: parseNumber(row[9]),
        profit: parseNumber(row[10]),
        balance: parseNumber(row[11]),
        comment: row[12] || ''
      });
    }
  }

  return deals;
}

function buildEquityCurve(deals: MT5Deal[], initialDeposit: number): { date: string; balance: number; equity: number }[] {
  const curve: { date: string; balance: number; equity: number }[] = [];

  // Add initial point
  if (deals.length > 0) {
    curve.push({
      date: deals[0].time.split(' ')[0],
      balance: initialDeposit,
      equity: initialDeposit
    });
  }

  // Build curve from deals with balance values
  for (const deal of deals) {
    if (deal.balance > 0) {
      curve.push({
        date: deal.time,
        balance: deal.balance,
        equity: deal.balance // We only have balance data from deals
      });
    }
  }

  return curve;
}

// ============================================
// LIVE REPORT PARSING FUNCTIONS
// ============================================

function parsePositionsTable(html: string): LivePosition[] {
  const positions: LivePosition[] = [];

  // Find the Positions section - it's between <b>Positions</b> and <b>Orders</b>
  const positionsMatch = html.match(/<b>Positions<\/b>[\s\S]*?(?=<b>Orders<\/b>)/i);
  if (!positionsMatch) return positions;

  const positionsSection = positionsMatch[0];
  const rows = extractTableRows(positionsSection);

  // Find data rows (skip header rows)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Position data rows start with a date pattern and have position ID
    if (row.length >= 10 && row[0].match(/\d{4}\.\d{2}\.\d{2}/)) {
      // Live report positions table structure:
      // Time(0), Position(1), Symbol(2), Type(3), [hidden cols], Volume, Price, S/L, T/P, CloseTime, ClosePrice, Commission, Swap, Profit
      // Note: The hidden colspan="8" element messes with indexing, so we need to find values by content

      // Find the actual data by scanning for expected patterns
      const time = row[0];
      const positionId = parseInt(row[1]) || 0;
      const symbol = row[2];
      const type = row[3]?.toLowerCase() as 'buy' | 'sell';

      // After type, there may be hidden columns. Find volume (decimal number like 0.53)
      let volumeIdx = 4;
      while (volumeIdx < row.length && !row[volumeIdx].match(/^\d+\.\d+$/)) {
        volumeIdx++;
      }

      if (volumeIdx >= row.length - 5) continue; // Not enough data

      const volume = parseNumber(row[volumeIdx]);
      const openPrice = parseNumber(row[volumeIdx + 1]);
      const stopLoss = row[volumeIdx + 2] && parseNumber(row[volumeIdx + 2]) !== 0 ? parseNumber(row[volumeIdx + 2]) : null;
      const takeProfit = row[volumeIdx + 3] && parseNumber(row[volumeIdx + 3]) !== 0 ? parseNumber(row[volumeIdx + 3]) : null;
      const closeTime = row[volumeIdx + 4] || time;
      const closePrice = parseNumber(row[volumeIdx + 5]);
      const commission = parseNumber(row[volumeIdx + 6]);
      const swap = parseNumber(row[volumeIdx + 7]);
      const profit = parseNumber(row[volumeIdx + 8]);

      if (positionId > 0 && symbol) {
        positions.push({
          time,
          positionId,
          symbol,
          type,
          volume,
          openPrice,
          stopLoss,
          takeProfit,
          closeTime,
          closePrice,
          commission,
          swap,
          profit
        });
      }
    }
  }

  return positions;
}

function parseLiveDeals(html: string): MT5Deal[] {
  const deals: MT5Deal[] = [];

  // Find the Deals section in live report
  const dealsMatch = html.match(/<b>Deals<\/b>[\s\S]*?(?=<tr\s+align="right">\s*<td\s+nowrap\s+colspan="8")/i);
  if (!dealsMatch) {
    // Try alternate pattern - until the summary row
    const altMatch = html.match(/<b>Deals<\/b>[\s\S]*?<\/table>/i);
    if (!altMatch) return deals;
    return parseLiveDealsFromSection(altMatch[0]);
  }

  return parseLiveDealsFromSection(dealsMatch[0]);
}

function parseLiveDealsFromSection(dealsSection: string): MT5Deal[] {
  const deals: MT5Deal[] = [];
  const rows = extractTableRows(dealsSection);

  // Skip header row, parse data rows
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Live Deals table structure (14+ columns):
    // Time(0), Deal(1), Symbol(2), Type(3), Direction(4), Volume(5), Price(6), Order(7),
    // [Cost hidden](8), Commission(9), Fee(10), Swap(11), Profit(12), Balance(13), Comment(14)

    // Data rows start with date and have deal ID
    if (row.length >= 12 && row[0].match(/\d{4}\.\d{2}\.\d{2}/)) {
      const time = row[0];
      const dealId = parseInt(row[1]) || 0;
      const symbol = row[2];
      const type = row[3];
      const direction = row[4]?.toLowerCase() === 'out' ? 'out' : 'in';
      const volume = parseNumber(row[5]);
      const price = parseNumber(row[6]);
      const order = parseInt(row[7]) || 0;

      // Column 8 might be hidden Cost column - detect by checking if it looks like commission
      // If we have 14+ columns, Cost is at index 8 (hidden), Commission at 9
      // If Cost column is absent, Commission would be at 8
      let commissionIdx = 8;
      let balanceIdx = 12;

      // Check if we have the extra columns (Cost, Fee)
      if (row.length >= 14) {
        // Full structure with hidden Cost column
        commissionIdx = 9;
        balanceIdx = 13;
      }

      const commission = parseNumber(row[commissionIdx]);
      const swap = parseNumber(row[commissionIdx + 2]); // Skip Fee
      const profit = parseNumber(row[commissionIdx + 3]);
      const balance = parseNumber(row[balanceIdx]);
      const comment = row[balanceIdx + 1] || '';

      if (dealId > 0) {
        deals.push({
          time,
          deal: dealId,
          symbol,
          type,
          direction: direction as 'in' | 'out',
          volume,
          price,
          order,
          commission,
          swap,
          profit,
          balance,
          comment
        });
      }
    }
  }

  return deals;
}

function parseLiveOrders(html: string): MT5Order[] {
  const orders: MT5Order[] = [];

  // Find the Orders section - between <b>Orders</b> and <b>Deals</b>
  const ordersMatch = html.match(/<b>Orders<\/b>[\s\S]*?(?=<b>Deals<\/b>)/i);
  if (!ordersMatch) return orders;

  const ordersSection = ordersMatch[0];
  const rows = extractTableRows(ordersSection);

  // Parse data rows
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Live Orders table structure:
    // Open Time(0), Order(1), Symbol(2), Type(3), Volume(4), Price(5), S/L(6), T/P(7), Time(8), State(9), Comment(10)

    if (row.length >= 9 && row[0].match(/\d{4}\.\d{2}\.\d{2}/)) {
      // Volume format might be "0.53 / 0.53" (requested/filled)
      const volumeParts = row[4].split('/').map(v => parseNumber(v.trim()));

      orders.push({
        openTime: row[0],
        order: parseInt(row[1]) || 0,
        symbol: row[2],
        type: row[3].toLowerCase().replace(' stop', '').replace(' limit', '') as 'buy' | 'sell',
        volume: volumeParts[0] || 0,
        filledVolume: volumeParts[1] || volumeParts[0] || 0,
        price: parseNumber(row[5]),
        stopLoss: row[6] && parseNumber(row[6]) !== 0 ? parseNumber(row[6]) : null,
        takeProfit: row[7] && parseNumber(row[7]) !== 0 ? parseNumber(row[7]) : null,
        time: row[8] || row[0],
        state: row[9] || 'filled',
        comment: row[10] || ''
      });
    }
  }

  return orders;
}

function parseLiveSettings(rows: string[][], positions: LivePosition[], initialDeposit: number): MT5Settings {
  // Extract info from live report header
  const company = findValueAfterLabel(rows, 'Company:');

  // Extract symbol from positions
  const symbols = [...new Set(positions.map(p => p.symbol))];
  const symbol = symbols.length > 0 ? symbols.join(', ') : findValueAfterLabel(rows, 'Symbol:');

  // Try to find account info - format: "Account: 7409058 (USD, ICMarketsSC-MT5-2, real, Hedge)"
  let currency = 'USD';
  let leverage = '1:500'; // Default for most brokers

  for (const row of rows) {
    const rowText = row.join(' ');
    // Look for account line with currency info
    const accountMatch = rowText.match(/\((\w+),\s*([^,]+),/);
    if (accountMatch) {
      currency = accountMatch[1];
    }
  }

  // Estimate risk per trade from actual losses
  // Calculate average loss as percentage of initial deposit
  const lossPositions = positions.filter(p => p.profit < 0);
  let estimatedRiskValue = 0;

  if (lossPositions.length > 0 && initialDeposit > 0) {
    // Use the average absolute loss as the risk estimate
    const avgLoss = Math.abs(lossPositions.reduce((sum, p) => sum + p.profit, 0) / lossPositions.length);
    estimatedRiskValue = Math.round((avgLoss / initialDeposit) * 100 * 10) / 10; // Round to 1 decimal
  }

  return {
    expert: 'Live Trading',
    symbol,
    period: 'Live',
    company,
    currency,
    initialDeposit,
    leverage,
    inputs: {
      // Provide estimated risk values for UI display
      RiskMode: 0, // Percentage mode
      RiskValue: estimatedRiskValue,
      _isEstimated: true // Flag to indicate these are estimated values
    }
  };
}

function parseLiveResults(rows: string[][], positions: LivePosition[]): MT5Results {
  // Calculate from positions if stats not available in summary
  const profitPositions = positions.filter(p => p.profit > 0);
  const lossPositions = positions.filter(p => p.profit < 0);

  const grossProfit = profitPositions.reduce((sum, p) => sum + p.profit, 0);
  const grossLoss = Math.abs(lossPositions.reduce((sum, p) => sum + p.profit, 0));

  // Try to extract from summary section first
  const balanceDrawdownMax = parsePercentValue(findValueAfterLabel(rows, 'Balance Drawdown Maximal:'));
  const balanceDrawdownRel = parsePercentValue(findValueAfterLabel(rows, 'Balance Drawdown Relative:'));

  return {
    historyQuality: 'Live Trading',
    bars: 0,
    ticks: 0,
    symbols: new Set(positions.map(p => p.symbol)).size || 1,
    totalNetProfit: parseNumber(findValueAfterLabel(rows, 'Total Net Profit:')) || (grossProfit - grossLoss),
    grossProfit: parseNumber(findValueAfterLabel(rows, 'Gross Profit:')) || grossProfit,
    grossLoss: parseNumber(findValueAfterLabel(rows, 'Gross Loss:')) || -grossLoss,
    balanceDrawdownAbsolute: parseNumber(findValueAfterLabel(rows, 'Balance Drawdown Absolute:')),
    balanceDrawdownMaximal: balanceDrawdownMax.value,
    balanceDrawdownMaximalPercent: balanceDrawdownMax.percent,
    balanceDrawdownRelative: balanceDrawdownRel.percent,
    balanceDrawdownRelativeAmount: balanceDrawdownRel.value,
    equityDrawdownAbsolute: 0, // Not available in live reports
    equityDrawdownMaximal: 0,
    equityDrawdownMaximalPercent: 0,
    equityDrawdownRelative: 0,
    equityDrawdownRelativeAmount: 0,
    profitFactor: parseNumber(findValueAfterLabel(rows, 'Profit Factor:')),
    expectedPayoff: parseNumber(findValueAfterLabel(rows, 'Expected Payoff:')),
    marginLevel: parseNumber(findValueAfterLabel(rows, 'Margin Level:').replace('%', '')),
    recoveryFactor: parseNumber(findValueAfterLabel(rows, 'Recovery Factor:')),
    sharpeRatio: parseNumber(findValueAfterLabel(rows, 'Sharpe Ratio:')),
    zScore: 0,
    zScorePercent: 0,
    ahpr: 0,
    ahprPercent: 0,
    ghpr: 0,
    ghprPercent: 0,
    lrCorrelation: 0,
    lrStandardError: 0
  };
}

function parseLiveTradeStats(rows: string[][], positions: LivePosition[]): MT5TradeStats {
  const shortTrades = parsePercentValue(findValueAfterLabel(rows, 'Short Trades (won %):'));
  const longTrades = parsePercentValue(findValueAfterLabel(rows, 'Long Trades (won %):'));
  const profitTrades = parsePercentValue(findValueAfterLabel(rows, 'Profit Trades (% of total):'));
  const lossTrades = parsePercentValue(findValueAfterLabel(rows, 'Loss Trades (% of total):'));
  const maxConsWins = parsePercentValue(findValueAfterLabel(rows, 'Maximum consecutive wins ($):'));
  const maxConsLosses = parsePercentValue(findValueAfterLabel(rows, 'Maximum consecutive losses ($):'));
  const maxConsProfit = parsePercentValue(findValueAfterLabel(rows, 'Maximal consecutive profit (count):'));
  const maxConsLoss = parsePercentValue(findValueAfterLabel(rows, 'Maximal consecutive loss (count):'));

  // Calculate from positions if not in summary
  const totalTrades = parseNumber(findValueAfterLabel(rows, 'Total Trades:')) || positions.length;

  return {
    totalTrades,
    totalDeals: positions.length * 2, // Each position has open + close deal
    shortTrades: shortTrades.value || positions.filter(p => p.type === 'sell').length,
    shortWonPercent: shortTrades.percent,
    longTrades: longTrades.value || positions.filter(p => p.type === 'buy').length,
    longWonPercent: longTrades.percent,
    profitTrades: profitTrades.value || positions.filter(p => p.profit > 0).length,
    profitTradesPercent: profitTrades.percent,
    lossTrades: lossTrades.value || positions.filter(p => p.profit < 0).length,
    lossTradesPercent: lossTrades.percent,
    largestProfitTrade: parseNumber(findValueAfterLabel(rows, 'Largest profit trade:')) ||
      Math.max(...positions.map(p => p.profit), 0),
    largestLossTrade: parseNumber(findValueAfterLabel(rows, 'Largest loss trade:')) ||
      Math.min(...positions.map(p => p.profit), 0),
    averageProfitTrade: parseNumber(findValueAfterLabel(rows, 'Average profit trade:')),
    averageLossTrade: parseNumber(findValueAfterLabel(rows, 'Average loss trade:')),
    maxConsecutiveWins: maxConsWins.value,
    maxConsecutiveWinsAmount: maxConsWins.percent,
    maxConsecutiveLosses: maxConsLosses.value,
    maxConsecutiveLossesAmount: maxConsLosses.percent,
    maxConsecutiveProfit: maxConsProfit.value,
    maxConsecutiveProfitCount: maxConsProfit.percent,
    maxConsecutiveLoss: maxConsLoss.value,
    maxConsecutiveLossCount: maxConsLoss.percent,
    averageConsecutiveWins: parseNumber(findValueAfterLabel(rows, 'Average consecutive wins:')),
    averageConsecutiveLosses: parseNumber(findValueAfterLabel(rows, 'Average consecutive losses:')),
    minHoldingTime: '',
    maxHoldingTime: '',
    avgHoldingTime: ''
  };
}

function parseLiveReport(content: string, fileName: string): MT5Report {
  const rows = extractTableRows(content);

  // Parse the three tables
  const positions = parsePositionsTable(content);
  const liveOrders = parseLiveOrders(content);
  const liveDeals = parseLiveDeals(content);

  // Determine initial balance from first deal or calculate
  let initialDeposit = 1000;
  if (liveDeals.length > 0) {
    // First deal balance minus its profit and commission gives us starting balance
    const firstDeal = liveDeals[0];
    initialDeposit = firstDeal.balance - firstDeal.profit + Math.abs(firstDeal.commission);
  }

  // Build settings, results, tradeStats (pass initialDeposit to calculate estimated risk)
  const settings = parseLiveSettings(rows, positions, initialDeposit);

  const results = parseLiveResults(rows, positions);
  const tradeStats = parseLiveTradeStats(rows, positions);

  // Use live deals for equity curve (they have balance)
  const equityCurve = buildEquityCurve(liveDeals, initialDeposit);

  const id = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    id,
    name: fileName.replace('.html', '').replace('.htm', ''),
    importedAt: new Date().toISOString(),
    type: 'forward', // Live reports are forward tests
    settings,
    results,
    tradeStats,
    orders: liveOrders,
    deals: liveDeals,
    equityCurve
  };
}

function parseBacktestReport(content: string, fileName: string): MT5Report {
  const rows = extractTableRows(content);
  const settings = parseSettings(rows);
  const results = parseResults(rows);
  const tradeStats = parseTradeStats(rows);
  const orders = parseOrders(content);
  const deals = parseDeals(content);
  const equityCurve = buildEquityCurve(deals, settings.initialDeposit);

  const id = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    id,
    name: fileName.replace('.html', '').replace('.htm', ''),
    importedAt: new Date().toISOString(),
    type: 'backtest',
    settings,
    results,
    tradeStats,
    orders,
    deals,
    equityCurve
  };
}

export function parseMT5Report(html: string, fileName: string): MT5Report {
  // Decode UTF-16 if needed
  let content = html;
  if (html.charCodeAt(0) === 0xFEFF || html.includes('\0')) {
    // Clean UTF-16 null bytes
    content = html.replace(/\0/g, '');
  }

  // Detect report type and route to appropriate parser
  const reportType = detectReportType(content);

  if (reportType === 'live') {
    return parseLiveReport(content, fileName);
  }

  // Default to backtest parser (handles both backtest and unknown)
  return parseBacktestReport(content, fileName);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      let result = reader.result as string;
      // Try UTF-16 decoding if needed
      if (result.charCodeAt(0) === 0xFEFF || result.includes('\0')) {
        // Re-read as UTF-16
        const readerUTF16 = new FileReader();
        readerUTF16.onload = () => {
          resolve(readerUTF16.result as string);
        };
        readerUTF16.onerror = () => reject(readerUTF16.error);
        readerUTF16.readAsText(file, 'UTF-16LE');
      } else {
        resolve(result);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
