'use client';

import { useEffect, useRef } from 'react';
import { LivePosition } from '../lib/live-types';

const DEFAULT_TITLE = 'MT5 Journal - Trading Dashboard';
const NO_POSITION_TITLE = 'MT5 Journal';
const FAVICON_SIZE = 32;

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const k = abs / 1000;
    return k >= 10 ? Math.round(k) + 'K' : k.toFixed(1) + 'K';
  }
  return String(Math.round(abs));
}

function formatCurrencyTitle(value: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return (value >= 0 ? '+' : '-') + formatted;
}

function renderFavicon(canvas: HTMLCanvasElement, value: number | null): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.clearRect(0, 0, FAVICON_SIZE, FAVICON_SIZE);

  let bg: string;

  if (value === null) {
    // No positions — gray with em-dash
    bg = '#475569';
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, FAVICON_SIZE, FAVICON_SIZE, 5);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(FAVICON_SIZE * 0.44)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('—', FAVICON_SIZE / 2, FAVICON_SIZE / 2 + 1);
  } else {
    const isProfit = value >= 0;
    bg = isProfit ? '#16a34a' : '#dc2626';

    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, FAVICON_SIZE, FAVICON_SIZE, 5);
    ctx.fill();

    // Arrow on top
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(FAVICON_SIZE * 0.31)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isProfit ? '▲' : '▼', FAVICON_SIZE / 2, FAVICON_SIZE * 0.31);

    // Compact value on bottom
    const numText = formatCompact(value);
    ctx.font = `bold ${Math.round(FAVICON_SIZE * 0.34)}px monospace`;
    ctx.fillText(numText, FAVICON_SIZE / 2, FAVICON_SIZE * 0.72);
  }

  return canvas.toDataURL('image/png');
}

export function useTabIndicator(positions: LivePosition[]): void {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const linkRef = useRef<HTMLLinkElement | null>(null);

  // Setup and teardown — runs once
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = FAVICON_SIZE;
    canvas.height = FAVICON_SIZE;
    canvasRef.current = canvas;

    const link = document.createElement('link');
    link.rel = 'icon';
    link.setAttribute('data-dynamic', 'true');
    document.head.appendChild(link);
    linkRef.current = link;

    return () => {
      document.title = DEFAULT_TITLE;
      link.remove();
      linkRef.current = null;
      canvasRef.current = null;
    };
  }, []);

  // Update favicon and title when positions change
  useEffect(() => {
    if (!canvasRef.current || !linkRef.current) return;

    const hasPositions = positions.length > 0;
    const totalFloating = hasPositions
      ? positions.reduce((sum, p) => sum + p.profit, 0)
      : null;

    linkRef.current.href = renderFavicon(canvasRef.current, totalFloating);
    document.title = totalFloating !== null
      ? formatCurrencyTitle(totalFloating)
      : NO_POSITION_TITLE;
  }, [positions]);
}
