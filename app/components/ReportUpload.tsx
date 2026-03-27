'use client';

import { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { parseMT5Report, readFileAsText } from '../lib/parser';
import { MT5Report } from '../lib/types';

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
      setError('Failed to parse the report. Please ensure it\'s a valid MetaTrader report file.');
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
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50 dark:bg-zinc-900'
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
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Processing report...</p>
            </>
          ) : (
            <>
              <div className={`p-3 rounded-full ${isDragging ? 'bg-blue-500/20' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                {isDragging ? (
                  <FileText className="w-6 h-6 text-blue-500" />
                ) : (
                  <Upload className="w-6 h-6 text-zinc-500 dark:text-zinc-400" />
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {isDragging ? 'Drop your report here' : 'Drag & drop your MT5 report'}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                  or click to browse (.html files)
                </p>
              </div>
            </>
          )}
        </div>
      </label>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
