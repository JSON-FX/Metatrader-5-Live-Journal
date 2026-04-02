'use client';

import { Flame } from 'lucide-react';
import { StreakData } from '../../lib/trade-stats';

interface StreaksTableProps {
  title: string;
  streaks: StreakData;
}

export default function StreaksTable({ title, streaks }: StreaksTableProps) {
  return (
    <div className="bg-bg-secondary border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px] mb-4">
        {title}
      </h3>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left text-[10px] text-text-muted uppercase tracking-wider font-medium pb-2"></th>
            <th className="text-center text-[10px] text-text-muted uppercase tracking-wider font-medium pb-2">Current</th>
            <th className="text-center text-[10px] text-text-muted uppercase tracking-wider font-medium pb-2">Longest</th>
          </tr>
        </thead>
        <tbody className="text-center">
          <tr className="border-t border-border/50">
            <td className="py-2.5 text-left">
              <span className="text-xs text-text-secondary flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-profit" /> Winning Days</span>
            </td>
            <td className="py-2.5"><span className="text-lg font-bold text-profit font-mono">{streaks.winStreak}</span></td>
            <td className="py-2.5"><span className="text-lg font-bold text-text-primary font-mono">{streaks.maxWinStreak}</span></td>
          </tr>
          <tr className="border-t border-border/50">
            <td className="py-2.5 text-left">
              <span className="text-xs text-text-secondary flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-loss" /> Losing Days</span>
            </td>
            <td className="py-2.5"><span className="text-lg font-bold text-loss font-mono">{streaks.loseStreak}</span></td>
            <td className="py-2.5"><span className="text-lg font-bold text-text-primary font-mono">{streaks.maxLoseStreak}</span></td>
          </tr>
          <tr className="border-t border-border/50">
            <td className="py-2.5 text-left">
              <span className="text-xs text-text-secondary flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-profit" /> Winning Trades</span>
            </td>
            <td className="py-2.5"><span className="text-lg font-bold text-profit font-mono">{streaks.winStreakTrades}</span></td>
            <td className="py-2.5"><span className="text-lg font-bold text-text-primary font-mono">{streaks.maxWinStreakTrades}</span></td>
          </tr>
          <tr className="border-t border-border/50">
            <td className="py-2.5 text-left">
              <span className="text-xs text-text-secondary flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-loss" /> Losing Trades</span>
            </td>
            <td className="py-2.5"><span className="text-lg font-bold text-loss font-mono">{streaks.loseStreakTrades}</span></td>
            <td className="py-2.5"><span className="text-lg font-bold text-text-primary font-mono">{streaks.maxLoseStreakTrades}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
