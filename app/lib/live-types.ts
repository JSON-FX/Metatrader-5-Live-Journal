export interface LiveAccountInfo {
  login: number;
  name: string;
  server: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  free_margin: number;
  margin_level: number;
  floating_pnl: number;
  drawdown_pct: number;
  leverage: number;
  profit: number;
  timestamp: string;
}

export interface LivePosition {
  ticket: number;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  open_price: number;
  current_price: number;
  sl: number | null;
  tp: number | null;
  profit: number;
  swap: number;
  commission: number;
  open_time: string;
  comment: string;
  magic: number;
}

export interface LiveTrade {
  ticket: number;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  open_price: number;
  close_price: number;
  open_time: string;
  close_time: string;
  profit: number;
  commission: number;
  swap: number;
  comment: string;
  magic: number;
}

export type DisplayMode = 'money' | 'percent';

export type LiveStatus = 'connecting' | 'online' | 'offline';

export interface LiveDataState {
  status: LiveStatus;
  account: LiveAccountInfo | null;
  positions: LivePosition[];
  history: LiveTrade[];
  lastUpdated: Date | null;
  error: string | null;
}

export interface AccountConfig {
  id: number;
  slug: string;
  name: string;
  type: 'live' | 'propfirm';
  endpoint: string;
  sort_order: number;
  rule_id: number | null;
}

export interface AccountListItem {
  id: number;
  slug: string;
  name: string;
  type: 'live' | 'propfirm';
  status: LiveStatus;
  server: string | null;
  login: number | null;
  rule_id: number | null;
}

export interface PropfirmRule {
  id: number;
  name: string;
  account_size: number;
  max_daily_loss: number;
  daily_loss_type: 'money' | 'percent';
  daily_loss_calc: 'balance' | 'equity';
  max_total_loss: number;
  total_loss_type: 'money' | 'percent';
  profit_target: number;
  target_type: 'money' | 'percent';
  min_trading_days: number;
  max_trading_days: number | null;
}

export type ObjectiveStatus = 'passing' | 'failed' | 'in_progress';

export interface ObjectiveResult {
  name: string;
  result: string;
  target: string;
  status: ObjectiveStatus;
}
