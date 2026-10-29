"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Sparkles,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Quote,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
  ArrowRight,
  Database
} from "lucide-react";

interface CitationItem {
  n: number;
  paper_id: number;
  title: string;
  authors?: string;
  year?: number;
  page: number;
  quote: string;
}

interface ReviewSection {
  heading: string;
  content: string;
}

interface CoverageLog {
  queries_run: string[];
  total_queries: number;
  total_passages_retrieved: number;
  passages_used: number;
  papers_referenced_count: number;
  papers_used: Array<{ id: number; title: string; year?: number }>;
  abstract_only_or_poor_text: string[];
}

interface LitReviewResult {
  topic: string;
  sections: ReviewSection[];
  citations: CitationItem[];
  coverage_log: CoverageLog;
}

const STARTER_TOPICS = [
  "Attention mechanisms and transformer scaling laws",
  "Graph neural network representation bounds and node classification",
  "Self-supervised contrastive learning vs generative pretraining",
  "Diffusion model sampling efficiency and distillation methods"
];

export default function LitReviewPage() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<LitReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [showCoverage, setShowCoverage] = useState(true);
  const [activeCitation, setActiveCitation] = useState<CitationItem | null>(null);

  const handleGenerate = async (topicToUse?: string) => {
    const q = (topicToUse || topic).trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setActiveCitation(null);

    try {
      const res = await fetch("/api/litreview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: q }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to generate literature review");
      }

      const data = await res.json();
      setReview(data);
    } catch (err: any) {
      setError(err.message || "Failed to generate review");
    } finally {
      setLoading(false);
    }
  };

  const getMarkdownText = () => {
    if (!review) return "";
    let md = `# Literature Review: ${review.topic}\n\n`;
    review.sections.forEach((s) => {
      md += `## ${s.heading}\n\n${s.content}\n\n`;
    });
    md += `## References & Evidence Citations\n\n`;
    review.citations.forEach((c) => {
      md += `[${c.n}] **${c.title}** (${c.year || "2023"}), p. ${c.page}\n> "${c.quote}"\n\n`;
    });
    return md;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getMarkdownText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const md = getMarkdownText();
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `litreview_${review?.topic.slice(0, 30).replace(/\s+/g, "_")}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSectionText = (text: string) => {
    if (!review) return text;
    const parts = text.split(/(\[\d+\])/g);
    return (
      <span>
        {parts.map((p, idx) => {
          const match = p.match(/^\[(\d+)\]$/);
          if (match) {
            const n = parseInt(match[1], 10);
            const cit = review.citations.find((c) => c.n === n);
            return (
              <button
                key={idx}
                onClick={() => cit && setActiveCitation(cit)}
                className={`inline-flex items-center justify-center px-1.5 py-0.2 rounded font-mono font-bold text-[11px] mx-0.5 transition-all ${
                  activeCitation?.n === n
                    ? "bg-primary text-white shadow-xs"
                    : "bg-primary/10 text-primary dark:text-indigo-400 hover:bg-primary hover:text-white"
                }`}
                title={cit ? `${cit.title} (Page ${cit.page})` : `Citation [${n}]`}
              >
                [{n}]
              </button>
            );
          }
          return <span key={idx}>{p}</span>;
        })}
      </span>
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-primary" />
          <span>Automated Literature Review</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Decomposes your research topic into sub-questions, executes multi-stage retrieval, and writes a cited synthesis with a full coverage log.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Input Box & Topic Chips */}
      <div className="bg-white dark:bg-[#131B2E] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <label className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Research Topic or Question
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                placeholder="e.g. Attention mechanisms and parameter-efficient fine-tuning..."
                className="w-full bg-[#F8F9FE] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
              />
            </div>
            <button
              onClick={() => handleGenerate()}
              disabled={!topic.trim() || loading}
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors disabled:opacity-40 shrink-0"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Synthesize Review</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Suggested Topics */}
        <div className="pt-2">
          <span className="text-[11px] font-mono text-slate-400 block mb-2">
            Suggested starter topics:
          </span>
          <div className="flex flex-wrap gap-2">
            {STARTER_TOPICS.map((t, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setTopic(t);
                  handleGenerate(t);
                }}
                className="px-3 py-1 rounded-lg bg-[#F8F9FE] dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-primary/50 text-[11px] text-slate-700 dark:text-slate-300 transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Review Synthesis Output */}
      {loading ? (
        <div className="p-16 text-center bg-white dark:bg-[#131B2E] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Decomposing Sub-Questions & Executing Multi-Hop Retrieval...
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Retrieving passages across hybrid vector + FTS5 index, deduplicating findings, and verifying page-level grounding.
          </p>
        </div>
      ) : review ? (
        <div className="space-y-6">
          {/* Action Toolbar */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Literature Review: {review.topic}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary dark:text-indigo-400 font-semibold">
                {review.citations.length} Citations Grounded
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy Markdown"}</span>
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .md</span>
              </button>
            </div>
          </div>

          {/* Synthesized Review Sections */}
          <div className="bg-white dark:bg-[#131B2E] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-8">
            {review.sections.map((sec, idx) => (
              <div key={idx} className="space-y-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wider pb-1 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span>{sec.heading}</span>
                </h2>
                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal whitespace-pre-line">
                  {renderSectionText(sec.content)}
                </div>
              </div>
            ))}
          </div>

          {/* Active Citation Quote Popover Card */}
          {activeCitation && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 shadow-xs flex items-start justify-between gap-4 animate-in fade-in">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100">
                    [{activeCitation.n}] Page {activeCitation.page}
                  </span>
                  <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                    {activeCitation.title}
                  </span>
                </div>
                <blockquote className="text-xs italic text-amber-900 dark:text-amber-300 border-l-2 border-amber-400 pl-2">
                  "{activeCitation.quote}"
                </blockquote>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/viewer?id=${activeCitation.paper_id}&page=${activeCitation.page}&quote=${encodeURIComponent(
                    activeCitation.quote
                  )}`}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1"
                >
                  <span>Viewer</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <button
                  onClick={() => setActiveCitation(null)}
                  className="text-amber-700 hover:text-amber-900 text-xs px-1"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Coverage Log Accordion */}
          <div className="bg-white dark:bg-[#131B2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <button
              onClick={() => setShowCoverage(!showCoverage)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                  Audit Coverage Log ({review.coverage_log.total_passages_retrieved} passages retrieved across {review.coverage_log.papers_referenced_count} papers)
                </span>
              </div>
              {showCoverage ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {showCoverage && (
              <div className="p-5 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-4 text-xs">
                <div>
                  <span className="font-mono text-slate-400 block mb-1.5 font-semibold">
                    Sub-Queries Executed:
                  </span>
                  <div className="space-y-1">
                    {review.coverage_log.queries_run.map((q, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 font-mono text-[11px] text-slate-700 dark:text-slate-300"
                      >
                        • {q}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-mono text-slate-400 block mb-1.5 font-semibold">
                    Papers Included in Synthesis:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {review.coverage_log.papers_used.map((p) => (
                      <Link
                        key={p.id}
                        href={`/viewer?id=${p.id}`}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-[#F8F9FE] dark:bg-slate-900 text-[11px] hover:border-primary text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                      >
                        <span className="truncate max-w-[200px]">{p.title}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
