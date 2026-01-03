"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { ArrowLeftIcon } from 'lucide-react';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  rightAction,
  className = '',
}) => {

  const router = useRouter()

  return (
    <header className={`sticky top-0 z-40 bg-white ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 max-w-md mx-auto">
        <div className="flex items-center gap-3">
          {showBack && (
            <Button onClick={() => router.back()} variant='ghost' className="p-2 -ml-2">
              <ArrowLeftIcon className="w-6 h-6" />
            </Button>
          )}
          {title && (
            <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          )}
        </div>
        {rightAction && <div>{rightAction}</div>}
      </div>
    </header>
  );
};

