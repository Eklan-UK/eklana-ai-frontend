"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, Users, Settings, CalendarDays } from "lucide-react";

export function TutorNav() {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/tutor/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/tutor/classes",
      label: "Classes",
      icon: CalendarDays,
    },
    {
      href: "/tutor/drills",
      label: "Drills",
      icon: BookOpen,
    },
    {
      href: "/tutor/students",
      label: "Students",
      icon: Users,
    },
    {
      href: "/tutor/settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white md:relative md:h-screen md:w-64 md:border-r md:border-t-0 md:border-gray-200">
      {/* Mobile: 5-column grid so Dashboard, Classes, Drills, Students, Settings all show without scrolling */}
      <div className="grid grid-cols-5 md:flex md:flex-col md:items-stretch md:justify-start md:py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 px-1 py-2.5 transition-colors md:w-full md:flex-row md:gap-2 md:px-6 md:py-3 ${
                isActive
                  ? "bg-green-50 text-green-600 md:border-l-4 md:border-l-green-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0 md:h-5 md:w-5" />
              <span className="max-w-full truncate text-center text-[9px] font-medium leading-tight sm:text-[10px] md:text-sm">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
