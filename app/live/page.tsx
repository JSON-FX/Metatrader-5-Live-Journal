'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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

      // Fetch available accounts for validation
      let availableIds: string[] = [];
      try {
        const res = await fetch('/api/live/accounts');
        const data = await res.json();
        availableIds = (data.accounts ?? []).map((a: { id: string }) => a.id);
      } catch {
        // If we can't fetch accounts, accept any ID
      }

      if (urlAccount && (availableIds.length === 0 || availableIds.includes(urlAccount))) {
        setAccountId(urlAccount);
        localStorage.setItem(LS_KEY, urlAccount);
      } else {
        const stored = localStorage.getItem(LS_KEY);
        if (stored && (availableIds.length === 0 || availableIds.includes(stored))) {
          setAccountId(stored);
          router.replace(`/live?account=${encodeURIComponent(stored)}`);
        } else if (availableIds.length > 0) {
          const firstId = availableIds[0];
          setAccountId(firstId);
          localStorage.setItem(LS_KEY, firstId);
          router.replace(`/live?account=${encodeURIComponent(firstId)}`);
        }
      }
      setReady(true);
    }

    resolveAccount();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectAccount = useCallback(
    (id: string) => {
      setAccountId(id);
      localStorage.setItem(LS_KEY, id);
      router.replace(`/live?account=${encodeURIComponent(id)}`);
    },
    [router]
  );

  const liveData = useLiveData(accountId, historyDays);

  if (!ready) return null;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <AccountSelector selectedId={accountId} onSelect={handleSelectAccount} />
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
