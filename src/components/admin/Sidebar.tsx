"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  PhoneCall,
  Hammer,
  BarChart2,
  Settings,
  LogOut,
  Sun,
  Moon,
  Layout,
  Mic,
  FileCheck,
  FileText,
  BookOpen,
  CalendarDays,
  CreditCard,
  UserPlus,
  Video,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
    { name: "Daily Focus", icon: CalendarDays, path: "/admin/daily-focus" },
    { name: "Learners", icon: Users, path: "/admin/Learners" },
    { name: "Subscriptions", icon: CreditCard, path: "/admin/subscriptions" },
    { name: "Discovery Calls", icon: PhoneCall, path: "/admin/discovery-call" },
    { name: "Drill Builder", icon: Hammer, path: "/admin/drill" },
    { name: "Classes", icon: Video, path: "/admin/classes" },
    { name: "Tutor", icon: UserPlus, path: "/admin/tutor" },
    { name: "Sentence Reviews", icon: FileCheck, path: "/admin/drills/sentence-reviews" },
    { name: "Grammar Reviews", icon: FileText, path: "/admin/drills/grammar-reviews" },
    { name: "Summary Reviews", icon: BookOpen, path: "/admin/drills/summary-reviews" },
    { name: "Pronunciations", icon: Mic, path: "/admin/pronunciations" },
    { name: "Analytics", icon: BarChart2, path: "/admin/analytics" },
    { name: "Settings", icon: Settings, path: "/admin/settings" },
  ];

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      router.push("/admin/auth/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-6 flex items-center gap-2">
        <Image
          src="/logo2.png"
          alt="eklan Logo"
          width={32}
          height={32}
          className="rounded-lg"
        />
        <span className="text-xl font-bold text-gray-800">eklan</span>
        <Layout className="ml-auto w-4 h-4 text-gray-400" />
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.path || pathname?.startsWith(item.path + "/");
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`group flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-emerald-50 font-bold text-[#3d8c40]"
                  : "font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800"
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
                      ? "text-[#3d8c40]"
                      : "text-gray-500 group-hover:text-gray-800"
                  }`}
                />
              )}
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="bg-gray-50 p-1 rounded-xl flex items-center justify-around mb-4">
          <button className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium bg-white shadow-sm rounded-lg text-gray-700">
            <Sun className="w-4 h-4" />
            Light
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium text-gray-500">
            <Moon className="w-4 h-4" />
            Dark
          </button>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Log out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
