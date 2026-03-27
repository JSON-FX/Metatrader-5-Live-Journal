'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Plus, X, GitMerge } from 'lucide-react';
import ReportUpload from './components/ReportUpload';
import ReportList from './components/ReportList';
import ReportStats from './components/ReportStats';
import EquityChart from './components/EquityChart';
import TradesTable from './components/TradesTable';
import TradeCountChart from './components/TradeCountChart';
import WinstreakCard from './components/WinstreakCard';
import CalendarView from './components/CalendarView';
import YearlyPerformance from './components/YearlyPerformance';
import { MT5Report } from './lib/types';
import { loadReports, deleteReport, addReport } from './lib/storage';
import { mergeReports, canMergeReports } from './lib/merge';
import { useLiveData } from './hooks/useLiveData';
import LiveAccountPanel from './components/LiveAccountPanel';
import OpenPositionsPanel from './components/OpenPositionsPanel';
import LiveTradesTable from './components/LiveTradesTable';
import LiveEquityChart from './components/LiveEquityChart';

export default function Home() {
  const [reports, setReports] = useState<MT5Report[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Merge mode state
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [showMergeNameModal, setShowMergeNameModal] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const [mergeError, setMergeError] = useState<string | null>(null);

  // Load reports from localStorage on mount
  useEffect(() => {
    const savedReports = loadReports();
    setReports(savedReports);
    if (savedReports.length > 0) {
      setSelectedReportId(savedReports[0].id);
    }
    setIsLoaded(true);
  }, []);

  const handleReportImported = useCallback((report: MT5Report) => {
    const updatedReports = addReport(report);
    setReports(updatedReports);
    setSelectedReportId(report.id);
    setShowUploadModal(false);
  }, []);

  const handleDeleteReport = useCallback((id: string) => {
    const updatedReports = deleteReport(id);
    setReports(updatedReports);
    if (selectedReportId === id) {
      setSelectedReportId(updatedReports.length > 0 ? updatedReports[0].id : null);
    }
  }, [selectedReportId]);

  // Merge handlers
  const handleToggleMergeMode = useCallback(() => {
    setMergeMode(prev => !prev);
    setSelectedForMerge([]);
    setMergeError(null);
  }, []);

  const handleToggleMergeSelect = useCallback((id: string) => {
    setSelectedForMerge(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      return [...prev, id];
    });
    setMergeError(null);
  }, []);

  const handleInitiateMerge = useCallback(() => {
    const selectedReports = reports.filter(r => selectedForMerge.includes(r.id));
    const { canMerge, reason } = canMergeReports(selectedReports);

    if (!canMerge) {
      setMergeError(reason || 'Cannot merge selected reports');
      return;
    }

    // Suggest a name
    const symbols = [...new Set(selectedReports.map(r => r.settings.symbol.replace('_tickstory', '')))];
    setMergeName(`${symbols[0]} Merged (${selectedReports.length} reports)`);
    setShowMergeNameModal(true);
  }, [reports, selectedForMerge]);

  const handleConfirmMerge = useCallback(() => {
    try {
      const selectedReports = reports.filter(r => selectedForMerge.includes(r.id));
      const mergedReport = mergeReports(selectedReports, mergeName || 'Merged Report');

      const updatedReports = addReport(mergedReport);
      setReports(updatedReports);
      setSelectedReportId(mergedReport.id);

      // Reset merge state
      setMergeMode(false);
      setSelectedForMerge([]);
      setShowMergeNameModal(false);
      setMergeName('');
      setMergeError(null);
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : 'Failed to merge reports');
    }
  }, [reports, selectedForMerge, mergeName]);

  const handleCancelMerge = useCallback(() => {
    setShowMergeNameModal(false);
    setMergeName('');
  }, []);

  const [historyDays, setHistoryDays] = useState(90);
  const liveData = useLiveData(historyDays);
  const selectedReport = reports.find(r => r.id === selectedReportId);

  // Check if merge is possible
  const selectedReportsForMerge = reports.filter(r => selectedForMerge.includes(r.id));
  const { canMerge } = canMergeReports(selectedReportsForMerge);

  // Show loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <BarChart3 className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Trading Journal</h1>
                <p className="text-xs text-zinc-500">MetaTrader Backtest Analyzer</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {reports.length >= 2 && (
                <button
                  onClick={handleToggleMergeMode}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                    mergeMode
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  }`}
                >
                  <GitMerge className="w-4 h-4" />
                  {mergeMode ? 'Cancel Merge' : 'Merge Reports'}
                </button>
              )}
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Import Report
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Merge Action Bar */}
      {mergeMode && (
        <div className="bg-orange-500/10 border-b border-orange-500/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GitMerge className="w-5 h-5 text-orange-400" />
                <span className="text-sm text-orange-300">
                  Select 2+ reports with the same symbol to merge
                </span>
              </div>
              <div className="flex items-center gap-3">
                {mergeError && (
                  <span className="text-sm text-red-400">{mergeError}</span>
                )}
                <button
                  onClick={handleInitiateMerge}
                  disabled={!canMerge}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    canMerge
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  Merge Selected ({selectedForMerge.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Data Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-4">
        <LiveAccountPanel
          status={liveData.status}
          account={liveData.account}
          lastUpdated={liveData.lastUpdated}
          trades={liveData.history}
        />
        {liveData.positions.length > 0 && (
          <OpenPositionsPanel positions={liveData.positions} />
        )}
        {liveData.status === 'online' && liveData.account && (
          <LiveEquityChart
            trades={liveData.history}
            balance={liveData.account.balance}
          />
        )}
        {liveData.status === 'online' && (
          <LiveTradesTable
            trades={liveData.history}
            historyDays={historyDays}
            onChangeDays={setHistoryDays}
          />
        )}
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {reports.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20">
            <div className="p-4 bg-zinc-800 rounded-2xl mb-6">
              <BarChart3 className="w-12 h-12 text-zinc-600" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No Reports Yet</h2>
            <p className="text-zinc-400 text-center max-w-md mb-8">
              Import your MetaTrader backtest or forward test reports to analyze your trading performance.
            </p>
            <ReportUpload onReportImported={handleReportImported} />
          </div>
        ) : (
          /* Dashboard with reports */
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar - Report List */}
            <div className="lg:col-span-1 space-y-6">
              <ReportList
                reports={reports}
                selectedReportId={selectedReportId}
                onSelectReport={setSelectedReportId}
                onDeleteReport={handleDeleteReport}
                mergeMode={mergeMode}
                selectedForMerge={selectedForMerge}
                onToggleMergeSelect={handleToggleMergeSelect}
              />
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-3 space-y-6">
              {selectedReport ? (
                <>
                  {/* Top Row: Trade Count + Winstreak */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TradeCountChart deals={selectedReport.deals} />
                    <WinstreakCard deals={selectedReport.deals} />
                  </div>

                  {/* Calendar View */}
                  <CalendarView
                    deals={selectedReport.deals}
                    settings={selectedReport.settings}
                  />

                  {/* Yearly Performance */}
                  <YearlyPerformance
                    deals={selectedReport.deals}
                    settings={selectedReport.settings}
                  />

                  <EquityChart report={selectedReport} liveBalance={liveData.account?.balance} />
                  <ReportStats report={selectedReport} />
                  <TradesTable report={selectedReport} />
                </>
              ) : (
                <div className="bg-zinc-900 rounded-xl p-12 text-center border border-zinc-800">
                  <p className="text-zinc-400">Select a report to view details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">Import Report</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <ReportUpload onReportImported={handleReportImported} />
              <p className="text-xs text-zinc-500 mt-4 text-center">
                Supports MetaTrader 5 Strategy Tester HTML reports
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Merge Name Modal */}
      {showMergeNameModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <GitMerge className="w-5 h-5 text-orange-400" />
                <h2 className="text-lg font-semibold text-white">Name Merged Report</h2>
              </div>
              <button
                onClick={handleCancelMerge}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm text-zinc-400 mb-2">Report Name</label>
              <input
                type="text"
                value={mergeName}
                onChange={(e) => setMergeName(e.target.value)}
                placeholder="Enter a name for the merged report"
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                autoFocus
              />
              <p className="text-xs text-zinc-500 mt-2">
                Merging {selectedForMerge.length} reports
              </p>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCancelMerge}
                  className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmMerge}
                  disabled={!mergeName.trim()}
                  className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Merged Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
