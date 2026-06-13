"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  UploadCloud, 
  MessageSquare, 
  Sparkles, 
  GitCompare,
  Database,
  Dot,
  GitFork
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const [apiOnline, setApiOnline] = useState(false);
  const [checking, setChecking] = useState(true);

  // Poll API health on mount to show server status
  useEffect(() => {
    async function checkApiHealth() {
      try {
        const res = await fetch("http://localhost:8000/", { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          setApiOnline(true);
        } else {
          setApiOnline(false);
        }
      } catch (err) {
        setApiOnline(false);
      } finally {
        setChecking(false);
      }
    }

    checkApiHealth();
    const interval = setInterval(checkApiHealth, 5000); // Check every 5s
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Upload Documents", path: "/upload", icon: UploadCloud },
    { name: "Chat With Documents", path: "/chat", icon: MessageSquare },
    { name: "Compare Documents", path: "/compare", icon: GitCompare },
    { name: "Mind Map", path: "/mindmap", icon: GitFork }
  ];

  return (
    <aside className="w-64 bg-darkCard border-r border-darkBorder flex flex-col h-screen shrink-0 justify-between text-gray-300">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-darkBorder flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brandPrimary to-brandSecondary flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              ResearchMate
            </h1>
            <span className="text-xs text-indigo-400 font-semibold tracking-wider">LOCAL RAG MVP</span>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="p-4 space-y-1.5 flex-1">
          <p className="text-[10px] uppercase font-bold text-gray-500 px-3 mb-2 tracking-widest">Navigation</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-brandPrimary/15 text-indigo-400 border border-brandPrimary/30 shadow-md shadow-indigo-500/5 font-semibold"
                    : "hover:bg-gray-800/40 hover:text-white border border-transparent"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-indigo-400" : "text-gray-400 group-hover:text-white"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Backend Status Footer */}
      <div className="p-4 border-t border-darkBorder bg-[#111624]/60">
        <div className="flex flex-col gap-2 p-3 rounded-xl bg-darkBg border border-darkBorder">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Service Health</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full relative flex`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  apiOnline ? "bg-emerald-400" : "bg-red-400"
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  apiOnline ? "bg-emerald-500" : "bg-red-500"
                }`}></span>
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wide ${
                apiOnline ? "text-emerald-400" : "text-red-400"
              }`}>
                {checking ? "Checking" : apiOnline ? "Online" : "Offline"}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-1 border-t border-darkBorder/40 pt-2 text-[11px] text-gray-500">
            <Database className="w-3.5 h-3.5" />
            <span>ChromaDB Vector Store</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
