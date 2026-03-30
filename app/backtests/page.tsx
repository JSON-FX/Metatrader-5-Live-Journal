'use client';

import { useState, useEffect, useCallback } from 'react';
import { GitMerge, Plus, FileText } from 'lucide-react';
import { MT5Report } from '../lib/types';
import { loadReports, deleteReport, addReport } from '../lib/storage';
import { mergeReports, canMergeReports } from '../lib/merge';
import Header from '../components/shared/Header';
import EmptyState from '../components/shared/EmptyState';
import Modal from '../components/shared/Modal';
import ReportLibrary from '../components/backtest/ReportLibrary';
import ReportUpload from '../components/backtest/ReportUpload';
import MergeBar from '../components/backtest/MergeBar';

export default function BacktestsPage() {
  const [reports, setReports] = useState<MT5Report[]>([]);
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showMergeNameModal, setShowMergeNameModal] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const [mergeError, setMergeError] = useState<string | null>(null);

  useEffect(() => {
    setReports(loadReports());
  }, []);

  const handleDelete = useCallback((id: string) => {
    const updated = deleteReport(id);
    setReports(updated);
    // Clean up merge selection if deleted report was selected
    setSelectedForMerge(prev => prev.filter(sid => sid !== id));
  }, []);

  const handleReportImported = useCallback((report: MT5Report) => {
    const updated = addReport(report);
    setReports(updated);
    setShowUploadModal(false);
  }, []);

  const handleToggleMergeMode = useCallback(() => {
    setMergeMode(prev => {
      if (prev) {
        // Exiting merge mode — clear selection
        setSelectedForMerge([]);
        setMergeError(null);
      }
      return !prev;
    });
  }, []);

  const handleToggleMergeSelect = useCallback((id: string) => {
    setSelectedForMerge(prev => {
      if (prev.includes(id)) {
        const next = prev.filter(sid => sid !== id);
        setMergeError(null);
        return next;
      }
      return [...prev, id];
    });
  }, []);

  const selectedReports = reports.filter(r => selectedForMerge.includes(r.id));
  const { canMerge, reason } = canMergeReports(selectedReports);
  const mergeValidationError = selectedForMerge.length > 0 ? (reason ?? null) : null;

  const handleInitiateMerge = useCallback(() => {
    if (!canMerge) {
      setMergeError(reason ?? 'Cannot merge selected reports');
      return;
    }
    const symbols = [...new Set(selectedReports.map(r =>
      r.settings.symbol.replace('_tickstory', '').toUpperCase()
    ))];
    setMergeName(`Merged ${symbols.join('+')} Portfolio`);
    setMergeError(null);
    setShowMergeNameModal(true);
  }, [canMerge, reason, selectedReports]);

  const handleConfirmMerge = useCallback(() => {
    if (!canMerge) return;
    try {
      const merged = mergeReports(selectedReports, mergeName.trim() || 'Merged Portfolio');
      const updated = addReport(merged);
      setReports(updated);
      setMergeMode(false);
      setSelectedForMerge([]);
      setMergeError(null);
      setShowMergeNameModal(false);
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : 'Merge failed');
      setShowMergeNameModal(false);
    }
  }, [canMerge, selectedReports, mergeName]);

  const handleCancelMerge = useCallback(() => {
    setShowMergeNameModal(false);
    setMergeName('');
  }, []);

  const headerActions = (
    <>
      {reports.length > 0 && (
        <button
          onClick={handleToggleMergeMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
            ${mergeMode
              ? 'bg-warning/20 text-warning border border-warning/40 hover:bg-warning/30'
              : 'bg-bg-tertiary text-text-secondary border border-border hover:text-text-primary hover:border-accent/40'
            }`}
        >
          <GitMerge className="w-3.5 h-3.5" />
          {mergeMode ? 'Cancel Merge' : 'Merge'}
        </button>
      )}
      <button
        onClick={() => setShowUploadModal(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:opacity-90 transition-opacity"
      >
        <Plus className="w-3.5 h-3.5" />
        Import Report
      </button>
    </>
  );

  return (
    <>
      <Header title="Backtests" backHref="/" actions={headerActions} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Merge bar */}
        {mergeMode && (
          <MergeBar
            selectedCount={selectedForMerge.length}
            canMerge={canMerge}
            error={mergeError ?? mergeValidationError}
            onMerge={handleInitiateMerge}
          />
        )}

        {/* Empty state */}
        {reports.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No backtest reports yet"
            description="Import a MetaTrader 5 backtest HTML report to get started."
            action={{
              label: 'Import Report',
              onClick: () => setShowUploadModal(true),
            }}
          />
        ) : (
          <ReportLibrary
            reports={reports}
            onDelete={handleDelete}
            mergeMode={mergeMode}
            selectedForMerge={selectedForMerge}
            onToggleMerge={handleToggleMergeSelect}
          />
        )}
      </div>

      {/* Upload modal */}
      <Modal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Import MT5 Report"
      >
        <ReportUpload onReportImported={handleReportImported} />
      </Modal>

      {/* Merge name modal */}
      <Modal
        open={showMergeNameModal}
        onClose={handleCancelMerge}
        title="Name Merged Report"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Merging {selectedForMerge.length} reports. Give this merged portfolio a name.
          </p>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-[0.5px]">
              Report Name
            </label>
            <input
              type="text"
              value={mergeName}
              onChange={(e) => setMergeName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmMerge(); }}
              placeholder="e.g. EURUSD Portfolio"
              autoFocus
              className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={handleCancelMerge}
              className="px-4 py-2 text-sm text-text-secondary bg-bg-tertiary border border-border rounded-lg hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmMerge}
              disabled={!mergeName.trim()}
              className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              Merge Reports
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
