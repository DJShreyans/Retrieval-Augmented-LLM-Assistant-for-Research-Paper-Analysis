"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Library,
  UploadCloud,
  MessageSquare,
  GitCompare,
  BookOpen,
  Sparkles,
  TrendingUp,
  FileText,
  Clock,
  ArrowRight,
  Database,
  ExternalLink,
  ChevronRight
} from "lucide-react";

interface DashboardStats {
  total_papers: number;
  total_chunks: number;
  total_chats: number;
  topics: Array<{ name: string; count: number }>;
  recent_papers: Array<{
    id: number;
    title: string;
    authors?: string;
    year?: number;
    page_count: number;
    added_at: string;
  }>;
  suggested_papers: Array<{
    id: number;
    title: string;
    authors?: string;
    year?: number;
    page_count: number;
    thumbnail_url: string;
  }>;
  recent_chats: Array<{
    id: number;
    title: string;
    paper_id?: number | null;
    updated_at: string;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/dashboard/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <span>Research Dashboard</span>
            <span className="text-xs font-mono font-medium py-1 px-2.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
              Corpus Active
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Overview of indexed scientific literature, retrieval indexes, and synthesis tools.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/chat"
            className="flex items-center gap-2 px-3.5 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>New Analysis</span>
          </Link>
          <Link
            href="/upload"
            className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors"
          >
            <UploadCloud className="w-3.5 h-3.5 text-primary" />
            <span>Upload PDF</span>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">
              Total Papers
            </span>
            <Library className="w-4 h-4 text-primary" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-mono">
            {loading ? "..." : stats?.total_papers || 0}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Deduplicated by SHA-256</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">
              Indexed Chunks
            </span>
            <Database className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-mono">
            {loading ? "..." : stats?.total_chunks || 0}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>FAISS + SQLite FTS5 BM25</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">
              Chat Inquiries
            </span>
            <MessageSquare className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-mono">
            {loading ? "..." : stats?.total_chats || 0}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Strict Page Grounding</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">
              Research Clusters
            </span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-mono">
            {loading ? "..." : stats?.topics.length || 0}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>TF-IDF / K-Means Tagged</span>
          </div>
        </div>
      </div>

      {/* Suggested For You */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Suggested for You</span>
          </h2>
          <Link
            href="/library"
            className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
          >
            <span>View all in Library</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stats?.suggested_papers.map((p) => (
            <div
              key={p.id}
              className="group bg-white dark:bg-[#131B2E] rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/40 hover:shadow-xs p-4 flex flex-col justify-between transition-all"
            >
              <div>
                <div className="w-full h-36 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden mb-3 border border-slate-100 dark:border-slate-800">
                  <img
                    src={p.thumbnail_url}
                    alt={p.title}
                    className="w-full h-full object-cover object-top group-hover:scale-102 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
                <h3 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                  {p.title}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                  {p.authors || "Unknown Authors"}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">{p.year || "2023"}</span>
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/chat?paper_id=${p.id}&scope=paper`}
                    className="p-1 rounded text-slate-500 hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Ask in chat"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    href={`/viewer?id=${p.id}`}
                    className="p-1 rounded text-slate-500 hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Open viewer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Grid: Topic Distribution + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Topic Breakdown */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
              Topic Clusters
            </h3>
            <span className="text-[11px] font-mono text-slate-400">Library Distribution</span>
          </div>

          <div className="space-y-2.5">
            {stats?.topics.map((t, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[240px]">
                  {t.name}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                  {t.count} papers
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Additions */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
              Recent Additions
            </h3>
            <span className="text-[11px] font-mono text-slate-400">Live Corpus</span>
          </div>

          <div className="space-y-3">
            {stats?.recent_papers.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 text-xs p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
              >
                <div className="min-w-0">
                  <Link
                    href={`/viewer?id=${p.id}`}
                    className="font-semibold text-slate-900 dark:text-white truncate block hover:text-primary transition-colors"
                  >
                    {p.title}
                  </Link>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {p.added_at} • {p.page_count} pages
                  </span>
                </div>
                <Link
                  href={`/viewer?id=${p.id}`}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-primary shrink-0"
                >
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
