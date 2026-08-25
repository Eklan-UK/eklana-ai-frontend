"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Settings,
  CalendarDays,
  Clock,
  List,
  Drama,
  Target,
  Bookmark,
  FileCheck,
  FileText,
  BarChart2,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  heading?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    items: [
      { href: "/tutor/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/tutor/classes", label: "Classes", icon: CalendarDays },
      { href: "/tutor/availability", label: "Hours", icon: Clock },
      { href: "/tutor/students", label: "Students", icon: Users },
    ],
  },
  {
    heading: "Content",
    items: [
      { href: "/tutor/drills", label: "Drill Builder", icon: BookOpen },
      {
        href: "/tutor/precision-clinic",
        label: "Eklan Precision Clinic",
        icon: Target,
      },
      {
        href: "/tutor/drills/bookmarked",
        label: "Bookmark Drills",
        icon: Bookmark,
      },
      {
        href: "/tutor/simulation/scenarios",
        label: "Simulation Room",
        icon: Drama,
      },
      { href: "/tutor/drills/all", label: "Old Drill Builder", icon: List },
    ],
  },
  {
    heading: "Reviews",
    items: [
      {
        href: "/tutor/drills/sentence-reviews",
        label: "Sentence Reviews",
        icon: FileCheck,
      },
      {
        href: "/tutor/drills/grammar-reviews",
        label: "Grammar Reviews",
        icon: FileText,
      },
    ],
  },
  {
    items: [
      { href: "/tutor/analytics", label: "Analytics", icon: BarChart2 },
      { href: "/tutor/settings", label: "Settings", icon: Settings },
    ],
  },
];

/**
 * Primary mobile bottom bar (7 + More = one 4×2 grid).
 * New staff tools and Old Drill Builder sit under More.
 */
const mobilePrimaryHrefs = new Set([
  "/tutor/dashboard",
  "/tutor/classes",
  "/tutor/availability",
  "/tutor/drills",
  "/tutor/simulation/scenarios",
  "/tutor/students",
  "/tutor/settings",
]);

const allNavItems = navGroups.flatMap((g) => g.items);
const mobilePrimaryItems = allNavItems.filter((item) =>
  mobilePrimaryHrefs.has(item.href)
);
const mobileMoreItems = allNavItems.filter(
  (item) => !mobilePrimaryHrefs.has(item.href)
);

function isNavActive(
  pathname: string | null,
  href: string,
  siblings: NavItem[]
): boolean {
  if (!pathname) return false;
  const matches = pathname === href || pathname.startsWith(`${href}/`);
  if (!matches) return false;
  // Prefer a more specific sibling when paths nest (e.g. /tutor/drills vs /tutor/drills/all)
  return !siblings.some(
    (other) =>
      other.href !== href &&
      other.href.length > href.length &&
      other.href.startsWith(`${href}/`) &&
      (pathname === other.href || pathname.startsWith(`${other.href}/`))
  );
}

function navLinkClass(isActive: boolean, desktopRow = false) {
  const layout = desktopRow
    ? "md:w-full md:flex-row md:justify-start md:gap-2 md:px-6 md:py-3"
    : "";
  return `flex flex-col items-center justify-center gap-0.5 px-1 py-2.5 transition-colors ${layout} ${
    isActive
      ? "bg-green-50 text-green-600 md:border-l-4 md:border-l-green-600"
      : "text-text-secondary hover:bg-muted hover:text-foreground"
  }`;
}

export function TutorNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreSheetPathname, setMoreSheetPathname] = useState(pathname);
  if (pathname !== moreSheetPathname) {
    setMoreSheetPathname(pathname);
    if (moreOpen) setMoreOpen(false);
  }

  const moreActive = mobileMoreItems.some((item) =>
    isNavActive(pathname, item.href, allNavItems)
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:relative md:h-screen md:w-64 md:border-r md:border-t-0 md:border-border">
      {/* Mobile More sheet */}
      {moreOpen && (
        <>
          <button
            type="button"
            aria-label="Close more menu"
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-full left-0 right-0 z-50 border-t border-border bg-card px-2 py-2 shadow-lg md:hidden">
            <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              More
            </p>
            <div className="grid grid-cols-4 gap-1">
              {mobileMoreItems.map((item) => {
                const Icon = item.icon;
                const isActive = isNavActive(pathname, item.href, allNavItems);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={navLinkClass(isActive)}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="max-w-full truncate text-center text-[9px] font-medium leading-tight sm:text-[10px]">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Mobile: primary + More */}
      <div className="grid grid-cols-4 md:hidden">
        {mobilePrimaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = isNavActive(pathname, item.href, allNavItems);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={navLinkClass(isActive)}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="max-w-full truncate text-center text-[9px] font-medium leading-tight sm:text-[10px]">
                {item.label}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-label="More navigation"
          onClick={() => setMoreOpen((open) => !open)}
          className={navLinkClass(moreActive || moreOpen)}
        >
          <MoreHorizontal className="h-5 w-5 shrink-0" />
          <span className="max-w-full truncate text-center text-[9px] font-medium leading-tight sm:text-[10px]">
            More
          </span>
        </button>
      </div>

      {/* Desktop: grouped sidebar */}
      <div className="hidden md:flex md:h-full md:flex-col md:items-stretch md:justify-start md:overflow-y-auto md:py-4">
        {navGroups.map((group, groupIndex) => (
          <div
            key={group.heading ?? `group-${groupIndex}`}
            className={groupIndex === 0 ? "" : "mt-4"}
          >
            {group.heading && (
              <p className="mb-1 px-6 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                {group.heading}
              </p>
            )}
            <div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = isNavActive(pathname, item.href, allNavItems);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={navLinkClass(isActive, true)}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="truncate text-sm font-medium">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
