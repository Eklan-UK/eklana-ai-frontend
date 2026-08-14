"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Users,
  PhoneCall,
  Hammer,
  Bookmark,
  BarChart2,
  Settings,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeft,
  Mic,
  FileCheck,
  FileText,
  BookOpen,
  CreditCard,
  UserPlus,
  Video,
  MessageSquare,
  List,
  Target,
  Trophy,
  Drama,
  type LucideIcon,
} from "lucide-react";

const STORAGE_KEY = "admin-sidebar-collapsed";

interface NavItem {
  name: string;
  icon: LucideIcon;
  path: string;
}

interface NavGroup {
  heading?: string;
  items: NavItem[];
}

const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // ignore storage errors
    }
  }, []);

  const isDark = mounted && theme === "dark";

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const navGroups: NavGroup[] = [
    {
      items: [
        { name: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
      ],
    },
    {
      heading: "Learning",
      items: [
        { name: "Learners", icon: Users, path: "/admin/Learners" },
        { name: "Classes", icon: Video, path: "/admin/classes" },
        { name: "Tutor", icon: UserPlus, path: "/admin/tutor" },
      ],
    },
    {
      heading: "Content",
      items: [
        { name: "Drill Builder", icon: Hammer, path: "/admin/drills" },
        { name: "Eklan Precision Clinic", icon: Target, path: "/admin/precision-clinic" },
        { name: "Bookmark Drills", icon: Bookmark, path: "/admin/drills/bookmarked" },
        { name: "Free Talk Scenarios", icon: MessageSquare, path: "/admin/drill/free-talk" },
        { name: "Simulation Room", icon: Drama, path: "/admin/simulation/scenarios" },
        { name: "Weekly Challenge", icon: Trophy, path: "/admin/weekly-challenge" },
        { name: "Old Drill Builder", icon: List, path: "/admin/drill" },
        { name: "Pronunciations", icon: Mic, path: "/admin/pronunciations" },
      ],
    },
    {
      heading: "Reviews",
      items: [
        { name: "Sentence Reviews", icon: FileCheck, path: "/admin/drills/sentence-reviews" },
        { name: "Grammar Reviews", icon: FileText, path: "/admin/drills/grammar-reviews" },
        { name: "Summary Reviews", icon: BookOpen, path: "/admin/drills/summary-reviews" },
      ],
    },
    {
      heading: "Business",
      items: [
        { name: "Subscriptions", icon: CreditCard, path: "/admin/subscriptions" },
        { name: "Discovery Calls", icon: PhoneCall, path: "/admin/discovery-call" },
        { name: "Analytics", icon: BarChart2, path: "/admin/analytics" },
        { name: "Settings", icon: Settings, path: "/admin/settings" },
      ],
    },
  ];

  return (
    <aside
      className={`flex h-full min-h-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-200 ease-in-out dark:border-border dark:bg-card ${
        collapsed ? "w-[72px] min-w-[72px]" : "w-64 min-w-64"
      }`}
    >
      <div
        className={`shrink-0 flex ${
          collapsed
            ? "flex-col items-center gap-2 px-2 py-4"
            : "items-center gap-2 p-6"
        }`}
      >
        <Image
          src="/logo2.png"
          alt="eklan Logo"
          width={32}
          height={32}
          className="shrink-0 rounded-lg"
        />
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate text-xl font-bold text-gray-800 dark:text-foreground">
            eklan
          </span>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className={`shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground ${
            collapsed ? "" : "ml-auto"
          }`}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav
        className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain ${
          collapsed ? "px-2" : "px-4"
        }`}
        aria-label="Admin"
      >
        {navGroups.map((group, groupIndex) => (
          <div
            key={group.heading ?? `group-${groupIndex}`}
            className={groupIndex === 0 ? "" : "mt-4"}
          >
            {group.heading && !collapsed && (
              <p className="mb-1 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-muted-foreground">
                {group.heading}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.path ||
                  pathname?.startsWith(item.path + "/");
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    title={collapsed ? item.name : undefined}
                    className={`group flex items-center rounded-full text-sm transition-colors ${
                      collapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3"
                    } ${
                      isActive
                        ? "bg-primary-100 font-semibold text-primary-700 dark:bg-primary-900/40 dark:font-semibold dark:text-primary-300"
                        : "font-normal text-gray-500 hover:text-gray-700 dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground"
                    }`}
                  >
                    {item.name === "Classes" && isActive ? (
                      <img
                        src="/images/classes_icon.svg"
                        alt=""
                        width={20}
                        height={20}
                        className="h-5 w-5 shrink-0"
                        aria-hidden
                      />
                    ) : (
                      <item.icon
                        className={`h-5 w-5 shrink-0 ${
                          isActive
                            ? "text-primary-700 dark:text-primary-300"
                            : "text-gray-500 group-hover:text-gray-700 dark:text-muted-foreground dark:group-hover:text-foreground"
                        }`}
                      />
                    )}
                    {!collapsed && <span className="truncate">{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="shrink-0 border-t border-gray-100 p-4 dark:border-border">
          <div className="flex items-center justify-around rounded-xl bg-gray-50 p-1 dark:bg-muted">
            <button
              type="button"
              onClick={() => setTheme("light")}
              aria-pressed={!isDark}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-colors ${
                !isDark
                  ? "bg-white text-gray-700 shadow-sm dark:bg-card dark:text-foreground"
                  : "text-gray-500 dark:text-muted-foreground"
              }`}
            >
              <Sun className="h-4 w-4" />
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              aria-pressed={isDark}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-colors ${
                isDark
                  ? "bg-white text-gray-700 shadow-sm dark:bg-card dark:text-foreground"
                  : "text-gray-500 dark:text-muted-foreground"
              }`}
            >
              <Moon className="h-4 w-4" />
              Dark
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
