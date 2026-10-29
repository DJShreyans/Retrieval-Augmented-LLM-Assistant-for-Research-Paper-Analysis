"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, Moon, Sun } from "lucide-react";

export default function Topbar() {
  const router = useRouter();
  const [searchVal, setSearchVal] = useState("");
  const [isDark, setIsDark] = useState(false);
  const [userName, setUserName] = useState("Alex");

  useEffect(() => {
    // Check initial dark mode
    if (typeof window !== "undefined") {
      const isDarkMode = localStorage.getItem("theme") === "dark" || document.documentElement.classList.contains("dark");
      setIsDark(isDarkMode);
      if (isDarkMode) {
        document.documentElement.classList.add("dark");
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchVal.trim()) {
      router.push(`/library?search=${encodeURIComponent(searchVal.trim())}`);
    }
  };

  return (
    <header className="h-16 bg-white dark:bg-[#131B2E] border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Global Search */}
      <div className="relative w-full max-w-lg">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search across papers, authors, or tags..."
          className="w-full bg-[#F8F9FE] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button
          className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-primary absolute top-2 right-2" />
        </button>

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Toggle Dark Mode"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Avatar */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 text-primary dark:text-indigo-400 font-bold text-xs flex items-center justify-center border border-primary/20">
            {userName[0]}
          </div>
        </div>
      </div>
    </header>
  );
}
