"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Library,
  UploadCloud,
  MessageSquare,
  GitCompare,
  BookOpen,
  TrendingUp,
  Lightbulb,
  Settings,
  HelpCircle,
  User,
  Plus,
  Atom,
  LogOut
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "My Library", href: "/library", icon: Library },
  { name: "Upload", href: "/upload", icon: UploadCloud },
  { name: "Chat", href: "/chat", icon: MessageSquare },
  { name: "Comparison", href: "/compare", icon: GitCompare },
  { name: "Lit Review", href: "/litreview", icon: BookOpen },
  { name: "Research Gaps", href: "/gaps", icon: TrendingUp },
  { name: "Ideas", href: "/ideas", icon: Lightbulb },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (e) {
      router.push("/login");
    }
  };

  return (
    <aside className="w-64 bg-white dark:bg-[#131B2E] border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 h-screen sticky top-0">
      <div>
        {/* Brand Header */}
        <div className="p-6 pb-4">
          <Link href="/library" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-sm">
              <Atom className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-lg text-slate-900 dark:text-white leading-tight">ResearchMate</div>
              <div className="text-[11px] text-slate-400 font-medium">AI Research Assistant</div>
            </div>
          </Link>
        </div>

        {/* New Analysis Button */}
        <div className="px-5 mb-4">
          <Link
            href="/chat"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-lg shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Analysis</span>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                  isActive
                    ? "bg-[#EEF2FF] dark:bg-slate-800 text-primary dark:text-indigo-400 font-semibold"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-primary rounded-r-full" />
                )}
                <Icon className={`w-4 h-4 ${isActive ? "text-primary dark:text-indigo-400" : "text-slate-400"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Navigation */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-1 text-slate-600 dark:text-slate-400 text-sm">
        <button
          onClick={() => alert("ResearchMate v1.0. For assistance, contact support@researchmate.local")}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-slate-400" />
          <span>Support</span>
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center justify-between px-3 py-2 w-full rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-600 hover:text-red-600 transition-colors"
        >
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-slate-400" />
            <span>Account</span>
          </div>
          <LogOut className="w-3.5 h-3.5 opacity-60" />
        </button>
      </div>
    </aside>
  );
}
