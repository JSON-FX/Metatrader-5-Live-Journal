'use client';

import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  title: string;
  backHref?: string;
  actions?: React.ReactNode;
}

export default function Header({ title, backHref, actions }: HeaderProps) {
  return (
    <header className="border-b border-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            {backHref ? (
              <Link href={backHref} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            ) : (
              <div className="p-1.5">
                <BarChart3 className="w-5 h-5 text-accent" />
              </div>
            )}
            <h1 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
