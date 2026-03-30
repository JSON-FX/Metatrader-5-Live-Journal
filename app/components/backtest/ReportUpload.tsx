'use client';

import { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { parseMT5Report, readFileAsText } from '../../lib/parser';
import { MT5Report } from '../../lib/types';

interface ReportUploadProps {
  onReportImported: (report: MT5Report) => void;
}

export default function ReportUpload({ onReportImported }: ReportUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      setError('Please upload an HTML file from MetaTrader');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const content = await readFileAsText(file);
      const report = parseMT5Report(content, file.name);
      onReportImported(report);
    } catch (err) {
      console.error('Error parsing report:', err);
      setError("Failed to parse the report. Please ensure it's a valid MetaTrader report file.");
    } finally {
      setIsProcessing(false);
    }
  }, [onReportImported]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  return (
    <div className="w-full">
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          flex flex-col items-center justify-center w-full h-48
          border-2 border-dashed rounded-xl cursor-pointer
          transition-all duration-200 ease-in-out
          ${isDragging
            ? 'border-accent bg-accent/10'
            : 'border-border hover:border-accent/50 bg-bg-primary'
          }
          ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input
          type="file"
          accept=".html,.htm"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isProcessing}
        />
        <div className="flex flex-col items-center gap-3 p-6">
          {isProcessing ? (
            <>
              <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-text-muted">Processing report...</p>
            </>
          ) : (
            <>
              <div className={`p-3 rounded-full ${isDragging ? 'bg-accent/20' : 'bg-bg-tertiary'}`}>
                {isDragging ? (
                  <FileText className="w-6 h-6 text-accent" />
                ) : (
                  <Upload className="w-6 h-6 text-text-muted" />
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text-primary">
                  {isDragging ? 'Drop your report here' : 'Drag & drop your MT5 report'}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  or click to browse (.html files)
                </p>
              </div>
            </>
          )}
        </div>
      </label>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-loss text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
