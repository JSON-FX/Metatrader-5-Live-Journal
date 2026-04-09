'use client';

import { use, useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { loadReports } from '../../lib/storage';
import { MT5Report } from '../../lib/types';
import { DisplayMode } from '../../lib/live-types';
import Header from '../../components/shared/Header';
import ReportTabs from '../../components/backtest/ReportTabs';
import ReportOverview from '../../components/backtest/ReportOverview';
import ReportTrades from '../../components/backtest/ReportTrades';
import ReportCalendar from '../../components/backtest/ReportCalendar';
import ReportPerformance from '../../components/backtest/ReportPerformance';
import DisplayModeToggle from '../../components/shared/DisplayModeToggle';

function getSymbol(report: MT5Report): string {
  return report.settings.symbol.replace('_tickstory', '').toUpperCase();
}

function ReportContent({ id }: { id: string }) {
  const router = useRouter();
  const [report, setReport] = useState<MT5Report | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('percent');

  useEffect(() => {
    const reports = loadReports();
    const found = reports.find(r => r.id === id);
    if (!found) {
      router.replace('/backtests');
      return;
    }
    setReport(found);
  }, [id, router]);

  if (!report) return null;

  const title = `${getSymbol(report)} — ${report.name}`;

  return (
    <>
      <Header title={title} backHref="/backtests" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ReportTabs rightSlot={<DisplayModeToggle mode={displayMode} onChange={setDisplayMode} />}>
          {{
            overview: <ReportOverview report={report} displayMode={displayMode} />,
            trades: <ReportTrades report={report} />,
            calendar: <ReportCalendar report={report} displayMode={displayMode} />,
            performance: <ReportPerformance report={report} displayMode={displayMode} />,
          }}
        </ReportTabs>
      </main>
    </>
  );
}

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <Suspense>
      <ReportContent id={id} />
    </Suspense>
  );
}
