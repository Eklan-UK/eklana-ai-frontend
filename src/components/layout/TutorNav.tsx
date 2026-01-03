"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, Users, Settings } from "lucide-react";

export function TutorNav() {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/tutor/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
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
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 md:relative md:border-t-0 md:border-r md:border-gray-200 md:h-screen md:w-64">
      <div className="flex items-center justify-around md:flex-col md:items-stretch md:justify-start md:py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-3 md:flex-row md:px-6 md:py-3 transition-colors ${
                isActive
                  ? "text-green-600 bg-green-50 md:border-l-4 md:border-l-green-600"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-5 h-5 md:w-5 md:h-5" />
              <span className="text-xs font-medium md:text-sm">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
