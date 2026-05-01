"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { ArrowLeftIcon } from 'lucide-react';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  className?: string;
  /** When set with total &gt; 0, shows “current of total” on the title row (with rightAction) and a thin progress bar below. */
  progress?: { current: number; total: number };
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  rightAction,
  className = '',
  progress,
}) => {

  const router = useRouter()

  const showProgress =
    progress != null && progress.total > 0;
  const progressPct = showProgress
    ? Math.min(100, Math.max(0, (progress!.current / progress!.total) * 100))
    : 0;

  return (
    <header className={`sticky top-0 z-40 bg-background ${className}`}>
      <div className="max-w-md md:max-w-2xl mx-auto px-4 md:px-8 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {showBack && (
              <Button onClick={() => router.back()} variant='ghost' className="p-2 -ml-2 shrink-0">
                <ArrowLeftIcon className="w-6 h-6" />
              </Button>
            )}
            {title && (
              <h1 className="text-xl font-bold text-foreground truncate">{title}</h1>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {showProgress ? (
              <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                {progress!.current} of {progress!.total}
              </span>
            ) : null}
            {rightAction ? <div className="flex items-center">{rightAction}</div> : null}
          </div>
        </div>
        {showProgress ? (
          <div
            className="mt-2 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden"
            role="progressbar"
            aria-valuenow={progress!.current}
            aria-valuemin={0}
            aria-valuemax={progress!.total}
          >
            <div
              className="h-full rounded-full bg-[#3B883E] transition-[width] duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        ) : null}
      </div>
    </header>
  );
};

