'use client';

import { useMemo } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { LiveTrade, LiveAccountInfo, PropfirmRule, ObjectiveStatus } from '../../lib/live-types';
import { calculateObjectives, calculateDisciplineScore } from '../../lib/objectives';

interface ObjectivesTabProps {
  rule: PropfirmRule;
  trades: LiveTrade[];
  account: LiveAccountInfo | null;
}

function StatusIcon({ status }: { status: ObjectiveStatus }) {
  if (status === 'passing') return <CheckCircle className="w-5 h-5 text-profit" />;
  if (status === 'failed') return <XCircle className="w-5 h-5 text-loss" />;
  return <Clock className="w-5 h-5 text-warning" />;
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-profit' : score >= 40 ? 'text-warning' : 'text-loss';
  const bgColor = score >= 70 ? 'stroke-profit' : score >= 40 ? 'stroke-warning' : 'stroke-loss';

  // SVG semi-circle gauge
  const radius = 50;
  const circumference = Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="80" viewBox="0 0 140 80" className="overflow-visible">
        {/* Background arc */}
        <path
          d="M 10 70 A 50 50 0 0 1 130 70"
          fill="none"
          stroke="var(--border)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d="M 10 70 A 50 50 0 0 1 130 70"
          fill="none"
          className={bgColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
        />
      </svg>
      <p className={`text-3xl font-bold font-mono ${color} -mt-6`}>{score}%</p>
      <p className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Discipline Score</p>
    </div>
  );
}

export default function ObjectivesTab({ rule, trades, account }: ObjectivesTabProps) {
  const objectives = useMemo(() => calculateObjectives(rule, trades, account), [rule, trades, account]);
  const score = useMemo(() => calculateDisciplineScore(rule, trades, account), [rule, trades, account]);

  return (
    <div className="space-y-6 pt-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Discipline Score */}
        <div className="bg-bg-secondary border border-border rounded-xl p-6 flex flex-col items-center justify-center">
          <ScoreGauge score={score} />
        </div>

        {/* Objectives Checklist */}
        <div className="bg-bg-secondary border border-border rounded-xl p-6 sm:col-span-2">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px] mb-4">Objectives</h3>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] text-text-muted uppercase tracking-wider font-medium pb-2">Trading Objective</th>
                <th className="text-right text-[10px] text-text-muted uppercase tracking-wider font-medium pb-2">Result</th>
                <th className="text-right text-[10px] text-text-muted uppercase tracking-wider font-medium pb-2">Target</th>
                <th className="text-center text-[10px] text-text-muted uppercase tracking-wider font-medium pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {objectives.map((obj) => (
                <tr key={obj.name} className="border-t border-border/50">
                  <td className="py-3 text-sm text-text-primary">{obj.name}</td>
                  <td className="py-3 text-sm text-text-secondary font-mono text-right">{obj.result}</td>
                  <td className="py-3 text-sm text-text-muted font-mono text-right">{obj.target}</td>
                  <td className="py-3 text-center"><StatusIcon status={obj.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rule Info */}
      <div className="bg-bg-secondary border border-border rounded-xl p-4">
        <p className="text-xs text-text-muted">
          Rule Set: <span className="text-text-primary font-medium">{rule.name}</span>
          {' · '}Account Size: <span className="text-text-primary font-mono">${rule.account_size.toLocaleString()}</span>
          {' · '}Daily Loss Calc: <span className="text-text-primary">{rule.daily_loss_calc === 'balance' ? 'Balance-based' : 'Equity-based'}</span>
        </p>
      </div>
    </div>
  );
}
