"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  MessageSquare,
  Download,
  Copy,
  Check,
  RefreshCw,
  FileText,
  Quote,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Layers,
  AlertCircle
} from "lucide-react";

interface StructuredSummary {
  key_contributions: Array<{ text: string; quote: string; page: number }>;
  methodology: Array<{ text: string; quote: string; page: number }>;
  datasets: Array<{ name: string; quote: string; page: number }>;
  results: Array<{ metric: string; value: string; quote: string; page: number }>;
  limitations: Array<{ text: string; quote: string; page: number }>;
}

interface ReferenceItem {
  id: number;
  raw_text: string;
  parsed: boolean;
}

function ViewerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paperId = searchParams.get("id") || "1";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);
  const initialQuote = searchParams.get("quote") || null;

  const [paper, setPaper] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [activeQuote, setActiveQuote] = useState<string | null>(initialQuote);
  const [activeTab, setActiveTab] = useState<"summary" | "insights" | "references">("summary");

  const [summary, setSummary] = useState<StructuredSummary | null>(null);
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [refCount, setRefCount] = useState(0);

  const [loadingPaper, setLoadingPaper] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch paper metadata
  useEffect(() => {
    async function loadPaper() {
      try {
        const res = await fetch(`/api/papers/${paperId}`);
        if (res.ok) {
          const data = await res.json();
          setPaper(data);
        }
      } catch (err) {
        console.error("Failed to fetch paper details:", err);
      } finally {
        setLoadingPaper(false);
      }
    }
    loadPaper();
  }, [paperId]);

  // Fetch structured summary
  const loadSummary = async (force: boolean = false) => {
    if (force) setRegenerating(true);
    else setLoadingSummary(true);

    try {
      const url = `/api/papers/${paperId}/summary`;
      const res = await fetch(url, {
        method: force ? "POST" : "GET",
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error("Failed to load summary:", err);
    } finally {
      setLoadingSummary(false);
      setRegenerating(false);
    }
  };

  useEffect(() => {
    loadSummary(false);
  }, [paperId]);

  // Fetch references when tab changes
  useEffect(() => {
    if (activeTab === "references" && references.length === 0) {
      setLoadingRefs(true);
      fetch(`/api/papers/${paperId}/references`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setReferences(data.references || []);
            setRefCount(data.count || 0);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingRefs(false));
    }
  }, [activeTab, paperId, references.length]);

  const jumpToPage = (pg: number, quote?: string) => {
    setCurrentPage(pg);
    if (quote) {
      setActiveQuote(quote);
    }
  };

  const handleCopyMarkdown = () => {
    if (!summary || !paper) return;

    let md = `# ${paper.title}\n\n`;
    md += `**Authors:** ${paper.authors || "N/A"} (${paper.year || "N/A"})\n\n`;
    md += `## Key Contributions\n`;
    summary.key_contributions.forEach((c) => {
      md += `- ${c.text} (p. ${c.page})\n  > "${c.quote}"\n`;
    });
    md += `\n## Methodology\n`;
    summary.methodology.forEach((m) => {
      md += `- ${m.text} (p. ${m.page})\n  > "${m.quote}"\n`;
    });
    md += `\n## Datasets\n`;
    summary.datasets.forEach((d) => {
      md += `- **${d.name}** (p. ${d.page})\n  > "${d.quote}"\n`;
    });
    md += `\n## Results\n`;
    summary.results.forEach((r) => {
      md += `- **${r.metric}:** ${r.value} (p. ${r.page})\n  > "${r.quote}"\n`;
    });
    md += `\n## Limitations & Future Work\n`;
    summary.limitations.forEach((l) => {
      md += `- ${l.text} (p. ${l.page})\n  > "${l.quote}"\n`;
    });

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-100 dark:bg-[#090D16]">
      {/* Top Header */}
      <header className="h-14 bg-white dark:bg-[#131B2E] border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between shrink-0 z-10 shadow-xs">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href="/library"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Library</span>
          </Link>

          <div className="h-4 w-px bg-slate-200 dark:border-slate-800 shrink-0" />

          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {paper?.title || "Loading paper..."}
            </h1>
            <p className="text-[11px] text-slate-400 truncate">
              {paper?.authors} {paper?.year ? `(${paper.year})` : ""} • {paper?.page_count || 1} pages
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href={`/chat?paper_id=${paperId}&scope=paper`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary dark:text-indigo-400 rounded-lg text-xs font-semibold transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Ask in Chat</span>
          </Link>

          <a
            href={`/api/papers/${paperId}/pdf`}
            download={`${paper?.title || "paper"}.pdf`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Download</span>
          </a>
        </div>
      </header>

      {/* Main Split Pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Interactive Document Viewer */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 dark:border-slate-800 bg-slate-200/60 dark:bg-slate-950/40 relative">
          {/* Active Citation Quote Banner */}
          {activeQuote && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 flex items-start justify-between gap-3 text-xs shrink-0 shadow-xs animate-in fade-in">
              <div className="flex items-start gap-2">
                <Quote className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-900 dark:text-amber-200">
                    Grounded Citation Quote (Page {currentPage}):
                  </span>
                  <p className="italic text-amber-800 dark:text-amber-300 mt-0.5 line-clamp-2">
                    "{activeQuote}"
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveQuote(null)}
                className="text-amber-700 dark:text-amber-400 hover:text-amber-900 text-xs font-mono font-bold px-1.5 py-0.5 rounded"
              >
                ✕
              </button>
            </div>
          )}

          {/* PDF Viewer Frame */}
          <div className="flex-1 w-full h-full overflow-hidden bg-slate-300 dark:bg-slate-900">
            <iframe
              src={`/api/papers/${paperId}/pdf#page=${currentPage}`}
              className="w-full h-full border-none"
              title="PDF Document Viewer"
            />
          </div>

          {/* Bottom Viewer Controls */}
          <div className="h-11 bg-white dark:bg-[#131B2E] border-t border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-1.5 font-mono text-slate-500 dark:text-slate-400">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>
                Page {currentPage} of {paper?.page_count || 1}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(paper?.page_count || 1, p + 1))}
                disabled={currentPage >= (paper?.page_count || 1)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">
                Source: {paper?.source || "indexed"}
              </span>
            </div>
          </div>
        </div>

        {/* Right Pane: Intelligence & Analysis Tabs */}
        <div className="w-[450px] bg-white dark:bg-[#131B2E] flex flex-col shrink-0 overflow-hidden shadow-xs">
          {/* Tab Navigation */}
          <div className="h-12 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <button
              onClick={() => setActiveTab("summary")}
              className={`h-full flex items-center gap-1.5 text-xs font-semibold border-b-2 transition-all ${
                activeTab === "summary"
                  ? "border-primary text-primary dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Summary</span>
            </button>

            <button
              onClick={() => setActiveTab("insights")}
              className={`h-full flex items-center gap-1.5 text-xs font-semibold border-b-2 transition-all ${
                activeTab === "insights"
                  ? "border-primary text-primary dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Key Insights</span>
            </button>

            <button
              onClick={() => setActiveTab("references")}
              className={`h-full flex items-center gap-1.5 text-xs font-semibold border-b-2 transition-all ${
                activeTab === "references"
                  ? "border-primary text-primary dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>References</span>
            </button>
          </div>

          {/* Tab Content Container */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {activeTab === "summary" && (
              <>
                {/* Header Action Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider">
                    Structured Analysis
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyMarkdown}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                      title="Copy structured summary to markdown"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                    <button
                      onClick={() => loadSummary(true)}
                      disabled={regenerating}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-40"
                      title="Regenerate structured summary"
                    >
                      <RefreshCw className={`w-3 h-3 ${regenerating ? "animate-spin" : ""}`} />
                      <span>Regen</span>
                    </button>
                  </div>
                </div>

                {loadingSummary ? (
                  <div className="space-y-4 animate-pulse pt-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                    <div className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4 pt-4" />
                    <div className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
                  </div>
                ) : summary ? (
                  <div className="space-y-6">
                    {/* Key Contributions */}
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        <span>Key Contributions</span>
                      </h3>
                      <div className="space-y-2">
                        {summary.key_contributions.map((c, i) => (
                          <div
                            key={i}
                            className="p-3 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5"
                          >
                            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                              {c.text}
                            </p>
                            <blockquote className="text-[11px] italic text-slate-500 dark:text-slate-400 border-l-2 border-primary/40 pl-2">
                              "{c.quote}"
                            </blockquote>
                            <div className="flex justify-end pt-1">
                              <button
                                onClick={() => jumpToPage(c.page, c.quote)}
                                className="text-[10px] font-mono font-semibold text-primary dark:text-indigo-400 hover:underline flex items-center gap-1"
                              >
                                <span>Jump to Page {c.page}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Methodology */}
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span>Methodology</span>
                      </h3>
                      <div className="space-y-2">
                        {summary.methodology.map((m, i) => (
                          <div
                            key={i}
                            className="p-3 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5"
                          >
                            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                              {m.text}
                            </p>
                            <blockquote className="text-[11px] italic text-slate-500 dark:text-slate-400 border-l-2 border-indigo-400/40 pl-2">
                              "{m.quote}"
                            </blockquote>
                            <div className="flex justify-end pt-1">
                              <button
                                onClick={() => jumpToPage(m.page, m.quote)}
                                className="text-[10px] font-mono font-semibold text-primary dark:text-indigo-400 hover:underline flex items-center gap-1"
                              >
                                <span>Jump to Page {m.page}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Datasets */}
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Evaluated Datasets</span>
                      </h3>
                      <div className="space-y-2">
                        {summary.datasets.map((d, i) => (
                          <div
                            key={i}
                            className="p-3 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1"
                          >
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {d.name}
                            </span>
                            <blockquote className="text-[11px] italic text-slate-500 dark:text-slate-400 border-l-2 border-emerald-400/40 pl-2">
                              "{d.quote}"
                            </blockquote>
                            <div className="flex justify-end pt-1">
                              <button
                                onClick={() => jumpToPage(d.page, d.quote)}
                                className="text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                              >
                                <span>Page {d.page}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Results & Limitations */}
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span>Limitations & Constraints</span>
                      </h3>
                      <div className="space-y-2">
                        {summary.limitations.map((l, i) => (
                          <div
                            key={i}
                            className="p-3 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-1"
                          >
                            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                              {l.text}
                            </p>
                            <blockquote className="text-[11px] italic text-amber-900 dark:text-amber-300 border-l-2 border-amber-400 pl-2">
                              "{l.quote}"
                            </blockquote>
                            <div className="flex justify-end pt-1">
                              <button
                                onClick={() => jumpToPage(l.page, l.quote)}
                                className="text-[10px] font-mono font-semibold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1"
                              >
                                <span>Page {l.page}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}

            {activeTab === "insights" && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Evidence-Grounded Insights</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Extracted claims, quantitative benchmarks, and empirical metrics derived directly from this document.
                  </p>
                </div>

                {summary?.results.map((r, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-[#F8F9FE] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                        {r.metric}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        Page {r.page}
                      </span>
                    </div>
                    <blockquote className="text-xs italic text-slate-600 dark:text-slate-400 border-l-2 border-primary/50 pl-2">
                      "{r.quote}"
                    </blockquote>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "references" && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Parsed bibliography: {refCount} references found.
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                    * Heuristically parsed; formatting may be imperfect.
                  </div>
                </div>

                {loadingRefs ? (
                  <div className="p-8 text-center text-xs font-mono text-slate-400">
                    Extracting bibliography...
                  </div>
                ) : references.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No references section detected.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {references.map((r) => (
                      <div
                        key={r.id}
                        className="p-3 rounded-lg bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-mono"
                      >
                        <span className="text-primary font-bold mr-1.5">[{r.id}]</span>
                        <span>{r.raw_text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ViewerPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs font-mono text-slate-400">
          Loading paper viewer...
        </div>
      }
    >
      <ViewerContent />
    </Suspense>
  );
}
