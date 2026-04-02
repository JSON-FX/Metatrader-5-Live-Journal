'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import { useLiveData } from '../hooks/useLiveData';
import LiveAccountPanel from '../components/live/LiveAccountPanel';
import OpenPositionsTable from '../components/live/OpenPositionsTable';
import LiveEquityChart from '../components/live/LiveEquityChart';
import LiveTradesTable from '../components/live/LiveTradesTable';
import AccountSelector from '../components/live/AccountSelector';

const LS_KEY = 'mt5-last-account';

function LivePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [historyDays, setHistoryDays] = useState(90);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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

  const handleSelectAccount = useCallback(
    (slug: string) => {
      setAccountId(slug);
      localStorage.setItem(LS_KEY, slug);
      router.replace(`/live?account=${encodeURIComponent(slug)}`);
    },
    [router]
  );

  const liveData = useLiveData(accountId, historyDays);

  if (!ready) return null;

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
      </div>

      <LiveAccountPanel
        status={liveData.status}
        account={liveData.account}
        lastUpdated={liveData.lastUpdated}
        trades={liveData.history}
      />

      {liveData.status === 'online' && (
        <OpenPositionsTable positions={liveData.positions} />
      )}

      {liveData.status === 'online' && liveData.account && (
        <LiveEquityChart trades={liveData.history} balance={liveData.account.balance} />
      )}

      {liveData.status === 'online' && (
        <LiveTradesTable
          trades={liveData.history}
          historyDays={historyDays}
          onChangeDays={setHistoryDays}
        />
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
