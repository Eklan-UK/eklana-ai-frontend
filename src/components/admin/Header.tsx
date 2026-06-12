"use client";

import React from 'react';
import { Search, Bell } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 z-10">
      <div className="relative w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input 
          type="text" 
          placeholder="Search learners, calls, notes..."
          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      <div className="flex items-center gap-6">
        <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 border-2 border-white rounded-full"></span>
        </button>
        
        <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
          <img 
            src="https://picsum.photos/seed/admin/40" 
            alt="User" 
            className="w-10 h-10 rounded-full border border-gray-200"
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
