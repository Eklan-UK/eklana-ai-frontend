'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

interface NavItem {
  name: string;
  href: string;
  iconActive: string;
  iconInactive: string;
}

const navItems: NavItem[] = [
  {
    name: 'Home',
    href: '/account',
    iconActive: '/icons/home-fill.svg',
    iconInactive: '/icons/home.svg',
  },
  {
    name: 'Practice',
    href: '/account/practice',
    iconActive: '/icons/practice.svg',
    iconInactive: '/icons/practice-grey.svg',
  },
  {
    name: 'My Plan',
    href: '/account/drills',
    iconActive: '/icons/target-arrow-green.svg',
    iconInactive: '/icons/target-arrow.svg',
  },
  {
    name: 'Profile',
    href: '/account/profile',
    iconActive: '/icons/user-fill.svg',
    iconInactive: '/icons/user.svg',
  },
];

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-md mx-auto px-2 py-1 flex justify-around items-center">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/account' && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 py-2 px-3 relative min-w-[56px]"
            >
              {/* Active pill indicator */}
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full bg-[#3B883E]"
                />
              )}

              {/* Icon */}
              <div className={`w-6 h-6 flex items-center justify-center transition-all duration-200 ${isActive ? 'scale-110' : ''}`}>
                <Image
                  src={isActive ? item.iconActive : item.iconInactive}
                  alt={item.name}
                  width={24}
                  height={24}
                  className={isActive ? '[filter:invert(40%)_sepia(80%)_saturate(400%)_hue-rotate(90deg)_brightness(85%)]' : 'opacity-50'}
                />
              </div>

              {/* Label */}
              <span
                className={`text-[10px] font-medium font-satoshi transition-colors duration-200 ${
                  isActive ? 'text-[#3B883E]' : 'text-gray-400'
                }`}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
