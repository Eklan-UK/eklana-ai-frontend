"use client";

import React from "react";
import Link from "next/link";
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
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
    { name: "Learners", icon: Users, path: "/admin/Learners" },
    { name: "Discovery Calls", icon: PhoneCall, path: "/admin/discovery-call" },
    { name: "Drill Builder", icon: Hammer, path: "/admin/drill" },
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
        <div className="text-[#3d8c40]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L9.5 7.5L4 10L9.5 12.5L12 18L14.5 12.5L20 10L14.5 7.5L12 2Z" />
          </svg>
        </div>
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
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-emerald-50 text-[#3d8c40]"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              <item.icon className="w-5 h-5" />
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
