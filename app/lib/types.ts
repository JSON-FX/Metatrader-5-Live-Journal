export interface MT5Settings {
  expert: string;
  symbol: string;
  period: string;
  company: string;
  currency: string;
  initialDeposit: number;
  leverage: string;
  inputs: Record<string, string | number | boolean>;
}

export interface MT5Results {
  historyQuality: string;
  bars: number;
  ticks: number;
  symbols: number;
  totalNetProfit: number;
  grossProfit: number;
  grossLoss: number;
  balanceDrawdownAbsolute: number;
  balanceDrawdownMaximal: number;
  balanceDrawdownMaximalPercent: number;
  balanceDrawdownRelative: number;
  balanceDrawdownRelativeAmount: number;
  equityDrawdownAbsolute: number;
  equityDrawdownMaximal: number;
  equityDrawdownMaximalPercent: number;
  equityDrawdownRelative: number;
  equityDrawdownRelativeAmount: number;
  profitFactor: number;
  expectedPayoff: number;
  marginLevel: number;
  recoveryFactor: number;
  sharpeRatio: number;
  zScore: number;
  zScorePercent: number;
  ahpr: number;
  ahprPercent: number;
  ghpr: number;
  ghprPercent: number;
  lrCorrelation: number;
  lrStandardError: number;
}

export interface MT5TradeStats {
  totalTrades: number;
  totalDeals: number;
  shortTrades: number;
  shortWonPercent: number;
  longTrades: number;
  longWonPercent: number;
  profitTrades: number;
  profitTradesPercent: number;
  lossTrades: number;
  lossTradesPercent: number;
  largestProfitTrade: number;
  largestLossTrade: number;
  averageProfitTrade: number;
  averageLossTrade: number;
  maxConsecutiveWins: number;
  maxConsecutiveWinsAmount: number;
  maxConsecutiveLosses: number;
  maxConsecutiveLossesAmount: number;
  maxConsecutiveProfit: number;
  maxConsecutiveProfitCount: number;
  maxConsecutiveLoss: number;
  maxConsecutiveLossCount: number;
  averageConsecutiveWins: number;
  averageConsecutiveLosses: number;
  minHoldingTime: string;
  maxHoldingTime: string;
  avgHoldingTime: string;
}

export interface MT5Order {
  openTime: string;
  order: number;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  filledVolume: number;
  price: number;
  stopLoss: number | null;
  takeProfit: number | null;
  time: string;
  state: string;
  comment: string;
}

export interface MT5Deal {
  time: string;
  deal: number;
  symbol: string;
  type: string;
  direction: 'in' | 'out';
  volume: number;
  price: number;
  order: number;
  commission: number;
  swap: number;
  profit: number;
  balance: number;
  comment: string;
}

export interface MT5Report {
  id: string;
  name: string;
  importedAt: string;
  type: 'backtest' | 'forward' | 'merged';
  settings: MT5Settings;
  results: MT5Results;
  tradeStats: MT5TradeStats;
  orders: MT5Order[];
  deals: MT5Deal[];
  equityCurve: { date: string; balance: number; equity: number }[];
  // Merge metadata
  isMerged?: boolean;
  sourceReportIds?: string[];
  sourceReportNames?: string[];
  // Risk tracking for merged reports
  sourceRiskValues?: number[]; // Risk % from each source report
  combinedRiskExposure?: number; // Total risk if all setups run simultaneously
  // Drawdown tracking for merged reports
  sourceDrawdowns?: number[]; // Max DD % from each source report
  worstCaseDrawdown?: number; // Sum of all max DDs (if all hit simultaneously)
}

export interface ReportGroup {
  id: string;
  name: string;
  reports: MT5Report[];
  createdAt: string;
}
