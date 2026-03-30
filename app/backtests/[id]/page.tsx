'use client';

import { use, useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { loadReports } from '../../lib/storage';
import { MT5Report } from '../../lib/types';
import Header from '../../components/shared/Header';
import ReportTabs from '../../components/backtest/ReportTabs';
import ReportOverview from '../../components/backtest/ReportOverview';
import ReportTrades from '../../components/backtest/ReportTrades';
import ReportCalendar from '../../components/backtest/ReportCalendar';
import ReportPerformance from '../../components/backtest/ReportPerformance';

function getSymbol(report: MT5Report): string {
  return report.settings.symbol.replace('_tickstory', '').toUpperCase();
}

function ReportContent({ id }: { id: string }) {
  const router = useRouter();
  const [report, setReport] = useState<MT5Report | null>(null);

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
        <ReportTabs>
          {{
            overview: <ReportOverview report={report} />,
            trades: <ReportTrades report={report} />,
            calendar: <ReportCalendar report={report} />,
            performance: <ReportPerformance report={report} />,
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
