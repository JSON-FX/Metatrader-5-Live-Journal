'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings, RefreshCw } from 'lucide-react';
import { useLiveData } from '../hooks/useLiveData';
import { useTabIndicator } from '../hooks/useTabIndicator';
import { useSettings } from '../lib/settings-context';
import { DisplayMode, PropfirmRule } from '../lib/live-types';
import ObjectivesTab from '../components/live/ObjectivesTab';
import LiveAccountPanel from '../components/live/LiveAccountPanel';
import OpenPositionsTable from '../components/live/OpenPositionsTable';
import AccountSelector from '../components/live/AccountSelector';
import LiveTabs, { TabId } from '../components/live/LiveTabs';
import DisplayModeToggle from '../components/shared/DisplayModeToggle';
import OverviewTab from '../components/live/OverviewTab';
import TradesTab from '../components/live/TradesTab';
import CalendarTab from '../components/live/CalendarTab';
import PerformanceTab from '../components/live/PerformanceTab';
import OrdersDealsTab from '../components/live/OrdersDealsTab';

const LS_KEY = 'mt5-last-account';

function getInitialTab(): TabId {
  if (typeof window === 'undefined') return 'overview';
  const hash = window.location.hash.slice(1);
  if (['overview', 'objectives', 'trades', 'orders-deals', 'calendar', 'performance'].includes(hash)) return hash as TabId;
  return 'overview';
}

function LivePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('percent');
  const [accountRule, setAccountRule] = useState<PropfirmRule | null>(null);

  useEffect(() => {
    async function resolveAccount() {
      const urlAccount = searchParams.get('account');

      let availableSlugs: string[] = [];
      try {
        const res = await fetch('/api/live/accounts');
        const data = await res.json();
        availableSlugs = (data.accounts ?? []).map((a: { slug: string }) => a.slug);
      } catch {
        // If we can't fetch accounts, accept any ID
      }

      if (urlAccount && (availableSlugs.length === 0 || availableSlugs.includes(urlAccount))) {
        setAccountId(urlAccount);
        localStorage.setItem(LS_KEY, urlAccount);
      } else {
        const stored = localStorage.getItem(LS_KEY);
        if (stored && (availableSlugs.length === 0 || availableSlugs.includes(stored))) {
          setAccountId(stored);
          router.replace(`/live?account=${encodeURIComponent(stored)}`);
        } else if (availableSlugs.length > 0) {
          const firstSlug = availableSlugs[0];
          setAccountId(firstSlug);
          localStorage.setItem(LS_KEY, firstSlug);
          router.replace(`/live?account=${encodeURIComponent(firstSlug)}`);
        }
      }
      setReady(true);
    }

    resolveAccount();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!accountId) { setAccountRule(null); return; }

    async function fetchRule() {
      try {
        const accountsRes = await fetch('/api/live/accounts');
        const accountsData = await accountsRes.json();
        const account = (accountsData.accounts ?? []).find((a: { slug: string }) => a.slug === accountId);
        if (!account?.rule_id) { setAccountRule(null); return; }

        const ruleRes = await fetch(`/api/live/rules/${account.rule_id}`);
        if (ruleRes.ok) {
          setAccountRule(await ruleRes.json());
        } else {
          setAccountRule(null);
        }
      } catch {
        setAccountRule(null);
      }
    }

    fetchRule();
  }, [accountId]);

  const handleSelectAccount = useCallback(
    (slug: string) => {
      setAccountId(slug);
      localStorage.setItem(LS_KEY, slug);
      router.replace(`/live?account=${encodeURIComponent(slug)}`);
    },
    [router]
  );

  function handleTabChange(tab: TabId) {
    setActiveTab(tab);
    window.location.hash = tab;
  }

  const { pollingFast, pollingSlow } = useSettings();
  const liveData = useLiveData(accountId, { pollingFast, pollingSlow });
  useTabIndicator(liveData.positions);

  const startingCapital = useMemo(() => {
    if (!liveData.account) return 0;
    // Prefer deposit-based: sum all balance-type deals (deposits/withdrawals)
    const deposits = liveData.rawDeals
      .filter(d => d.type === 'balance')
      .reduce((sum, d) => sum + d.profit, 0);
    if (deposits > 0) return deposits;
    // Fallback: derive from current balance minus realized P&L
    if (liveData.history.length === 0) return 0;
    const totalPnl = liveData.history.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0);
    return liveData.account.balance - totalPnl;
  }, [liveData.account, liveData.history, liveData.rawDeals]);

  if (!ready) return null;

  const isRefreshing = liveData.status === 'connecting';

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <AccountSelector selectedId={accountId} onSelect={handleSelectAccount} />
        <Link
          href="/live/settings"
          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          title="Account Settings"
        >
          <Settings className="w-4.5 h-4.5" />
        </Link>
        <button
          onClick={liveData.refresh}
          disabled={isRefreshing}
          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
          title="Refresh data"
        >
          <RefreshCw className={`w-4.5 h-4.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <LiveAccountPanel
        status={liveData.status}
        account={liveData.account}
        lastUpdated={liveData.lastUpdated}
        startingCapital={startingCapital}
      />

      {liveData.status === 'online' && (
        <OpenPositionsTable positions={liveData.positions} />
      )}

      <div className="flex items-center justify-between">
        <LiveTabs activeTab={activeTab} onTabChange={handleTabChange} showObjectives={!!accountRule} />
        <DisplayModeToggle mode={displayMode} onChange={setDisplayMode} />
      </div>

      {activeTab === 'overview' && liveData.account && (
        <OverviewTab trades={liveData.history} startingCapital={startingCapital} displayMode={displayMode} />
      )}
      {activeTab === 'objectives' && accountRule && (
        <ObjectivesTab rule={accountRule} trades={liveData.history} account={liveData.account} />
      )}
      {activeTab === 'trades' && liveData.account && accountId && (
        <TradesTab
          trades={liveData.history}
          startingCapital={startingCapital}
          displayMode={displayMode}
          accountId={accountId}
        />
      )}
      {activeTab === 'orders-deals' && liveData.account && (
        <OrdersDealsTab
          rawDeals={liveData.rawDeals}
          rawOrders={liveData.rawOrders}
          startingCapital={startingCapital}
          displayMode={displayMode}
        />
      )}
      {activeTab === 'calendar' && liveData.account && (
        <CalendarTab trades={liveData.history} startingCapital={startingCapital} displayMode={displayMode} />
      )}
      {activeTab === 'performance' && liveData.account && (
        <PerformanceTab trades={liveData.history} startingCapital={startingCapital} displayMode={displayMode} />
      )}

      {!liveData.account && liveData.history.length === 0 && activeTab !== 'overview' && (
        <div className="py-16 text-center text-text-muted text-sm">
          Waiting for account data...
        </div>
      )}
    </main>
  );
}

export default function LivePage() {
  return (
    <Suspense>
      <LivePageContent />
    </Suspense>
  );
}
