"use client";

import React from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-[#F9FAFB]">
      <div className="flex h-full min-h-0 shrink-0">
        <Sidebar />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
