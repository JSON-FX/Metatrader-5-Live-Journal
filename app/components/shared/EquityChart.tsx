'use client';

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface EquityChartProps {
  data: { time: string; value: number }[];
  height?: number;
  showReferenceLine?: boolean;
  referenceValue?: number;
  formatXLabel?: (value: string) => string;
}

interface TooltipPayload {
  time: string;
  value: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TooltipPayload }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-3 shadow-xl">
      <p className="text-xs text-text-muted mb-1">{d.time}</p>
      <p className="text-sm font-mono font-semibold text-text-primary">
        ${d.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

export default function EquityChart({
  data,
  height = 300,
  showReferenceLine = false,
  referenceValue,
  formatXLabel,
}: EquityChartProps) {
  const { minValue, maxValue } = useMemo(() => {
    if (data.length === 0) return { minValue: 0, maxValue: 0 };
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.1, 10);
    return {
      minValue: Math.floor((min - padding) / 10) * 10,
      maxValue: Math.ceil((max + padding) / 10) * 10,
    };
  }, [data]);

  if (data.length < 2) return null;

  const isProfit = data[data.length - 1].value >= data[0].value;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={formatXLabel}
            stroke="var(--text-muted)"
            fontSize={11}
            fontFamily="var(--font-geist-mono)"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          <YAxis
            domain={[minValue, maxValue]}
            tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`}
            stroke="var(--text-muted)"
            fontSize={11}
            fontFamily="var(--font-geist-mono)"
            tickLine={false}
            axisLine={false}
            width={65}
          />
          <Tooltip content={<CustomTooltip />} />
          {showReferenceLine && referenceValue != null && (
            <ReferenceLine
              y={referenceValue}
              stroke="var(--text-muted)"
              strokeDasharray="5 5"
              strokeOpacity={0.5}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={isProfit ? 'var(--profit)' : 'var(--loss)'}
            strokeWidth={2}
            fill="url(#equityGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
