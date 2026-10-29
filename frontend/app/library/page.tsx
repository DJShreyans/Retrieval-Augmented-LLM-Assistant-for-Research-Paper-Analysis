"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Filter,
  Grid,
  List,
  Calendar,
  FileText,
  MessageSquare,
  ExternalLink,
  BookOpen,
  ArrowUpDown,
  Tag as TagIcon,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  X
} from "lucide-react";

interface PaperItem {
  id: number;
  title: string;
  authors?: string;
  abstract?: string;
  year?: number;
  page_count: number;
  has_text: boolean;
  text_quality: string;
  source: string;
  visibility: string;
  status: string;
  added_at: string;
  thumbnail_url: string;
  tags: string[];
}

interface TagItem {
  id: number;
  name: string;
}

function LibraryContent() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";

  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);

  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [selectedTag, setSelectedTag] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<string>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(true);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on search change
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch tags once
  useEffect(() => {
    async function loadTags() {
      try {
        const res = await fetch("/api/papers/tags");
        if (res.ok) {
          const data = await res.json();
          setTags(data);
        }
      } catch (err) {
        console.error("Failed to load tags:", err);
      }
    }
    loadTags();
  }, []);

  // Fetch papers on state changes
  useEffect(() => {
    let isCancelled = false;

    async function loadPapers() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.append("page", page.toString());
        params.append("page_size", pageSize.toString());
        params.append("sort_by", sortBy);
        if (debouncedSearch.trim()) {
          params.append("search", debouncedSearch.trim());
        }
        if (selectedTag) {
          params.append("tag_id", selectedTag.toString());
        }

        const res = await fetch(`/api/papers?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch papers");
        const data = await res.json();

        if (!isCancelled) {
          setPapers(data.papers || []);
          setTotal(data.total || 0);
          setTotalPages(data.total_pages || 1);
        }
      } catch (err) {
        console.error("Error loading papers:", err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadPapers();
    return () => {
      isCancelled = true;
    };
  }, [page, pageSize, sortBy, selectedTag, debouncedSearch]);

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setSelectedTag(null);
    setSortBy("newest");
    setPage(1);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <span>My Library</span>
            <span className="text-xs font-mono font-medium py-1 px-2.5 rounded-full bg-primary/10 text-primary dark:text-indigo-400 border border-primary/20">
              {total} papers
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Browse, filter, and interrogate your indexed research literature
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
          >
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
            <span>Ask Corpus</span>
          </Link>
          <Link
            href="/upload"
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold shadow-xs transition-all"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload PDF</span>
          </Link>
        </div>
      </div>

      {/* Filter and Control Toolbar */}
      <div className="bg-white dark:bg-[#131B2E] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles, authors, abstracts..."
            className="w-full bg-[#F8F9FE] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tag Filter */}
          <div className="flex items-center gap-1.5">
            <TagIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedTag || ""}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value, 10) : null;
                setSelectedTag(val);
                setPage(1);
              }}
              className="bg-[#F8F9FE] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Topics</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="bg-[#F8F9FE] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="newest">Newest Added</option>
              <option value="oldest">Oldest Added</option>
              <option value="year">Publication Year</option>
              <option value="title">Title (A-Z)</option>
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-[#F8F9FE] dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1 rounded ${
                viewMode === "grid"
                  ? "bg-white dark:bg-slate-800 text-primary shadow-xs"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1 rounded ${
                viewMode === "list"
                  ? "bg-white dark:bg-slate-800 text-primary shadow-xs"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Active Filter Pills */}
      {(debouncedSearch || selectedTag) && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-mono">Filters active:</span>
          {debouncedSearch && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
              Query: "{debouncedSearch}"
              <button onClick={() => setSearch("")} className="hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {selectedTag && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary dark:text-indigo-400 text-[11px]">
              Topic: {tags.find((t) => t.id === selectedTag)?.name}
              <button onClick={() => setSelectedTag(null)} className="hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            onClick={resetFilters}
            className="text-[11px] font-mono text-primary hover:underline ml-2"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Papers Grid or List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#131B2E] rounded-xl border border-slate-200 dark:border-slate-800 p-4 animate-pulse space-y-3"
            >
              <div className="w-full h-44 bg-slate-100 dark:bg-slate-800/80 rounded-lg" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
              <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-1/2" />
              <div className="space-y-1.5 pt-2">
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800/40 rounded w-full" />
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800/40 rounded w-5/6" />
              </div>
            </div>
          ))}
        </div>
      ) : papers.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#131B2E] rounded-2xl border border-slate-200 dark:border-slate-800">
          <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No papers found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search terms, selecting a different topic tag, or clearing your active filters.
          </p>
          <button
            onClick={resetFilters}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-hover transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {papers.map((p) => (
            <div
              key={p.id}
              className="group bg-white dark:bg-[#131B2E] rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/40 dark:hover:border-primary/40 hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden"
            >
              {/* Thumbnail Header */}
              <div className="relative w-full h-48 bg-slate-50 dark:bg-slate-900 overflow-hidden border-b border-slate-100 dark:border-slate-800">
                <img
                  src={p.thumbnail_url}
                  alt={p.title}
                  className="w-full h-full object-cover object-top group-hover:scale-102 transition-transform duration-300"
                  onError={(e) => {
                    // Fallback to stylized placeholder if thumbnail fails
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
                  {p.tags.slice(0, 1).map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-white/95 dark:bg-[#131B2E]/95 text-primary dark:text-indigo-400 shadow-xs backdrop-blur-xs border border-primary/20"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="absolute top-2.5 right-2.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-900/80 text-white backdrop-blur-xs">
                    {p.year || "2023"}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3
                    className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-primary transition-colors"
                    title={p.title}
                  >
                    {p.title}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                    {p.authors || "Authors not listed"}
                  </p>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2.5 line-clamp-3 leading-relaxed">
                    {p.abstract || "Abstract not available for this indexed paper."}
                  </p>
                </div>

                {/* Card Meta & Actions */}
                <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {p.page_count}p
                    </span>
                    <span>•</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {p.text_quality === "high" ? "High Quality" : "Indexed"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Link
                      href={`/chat?paper_id=${p.id}&scope=paper`}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Ask questions about this paper"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Link>
                    <Link
                      href={`/viewer?id=${p.id}`}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/10 transition-colors"
                      title="View PDF"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="space-y-3">
          {papers.map((p) => (
            <div
              key={p.id}
              className="group bg-white dark:bg-[#131B2E] rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/40 hover:shadow-xs p-4 flex items-center gap-5 transition-all"
            >
              <div className="w-20 h-28 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-800">
                <img
                  src={p.thumbnail_url}
                  alt={p.title}
                  className="w-full h-full object-cover object-top"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-primary/10 text-primary dark:text-indigo-400">
                    {p.tags[0] || "AI / Machine Learning"}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{p.year || "2023"}</span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-[11px] font-mono text-slate-400">{p.page_count} pages</span>
                </div>

                <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors">
                  {p.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                  {p.authors || "Unknown authors"}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-1.5 leading-relaxed">
                  {p.abstract}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2 pl-4 border-l border-slate-100 dark:border-slate-800">
                <Link
                  href={`/chat?paper_id=${p.id}&scope=paper`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary dark:text-indigo-400 rounded-lg text-xs font-semibold transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chat</span>
                </Link>
                <Link
                  href={`/viewer?id=${p.id}`}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Open viewer"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pt-4 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-mono">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} papers
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-mono font-medium text-slate-700 dark:text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs font-mono text-slate-400">
          Loading library...
        </div>
      }
    >
      <LibraryContent />
    </Suspense>
  );
}
