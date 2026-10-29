"use client";

import React from "react";
import Link from "next/link";
import { X, ExternalLink, BookOpen, Quote, FileText, CheckCircle2 } from "lucide-react";

export interface CitationItem {
  n: number;
  paper_id: number;
  title: string;
  year?: number;
  authors?: string;
  page?: number;
  quote: string;
}

interface CitationPanelProps {
  citation: CitationItem | null;
  onClose: () => void;
  allCitations?: CitationItem[];
  onSelectCitation?: (cit: CitationItem) => void;
}

export default function CitationPanel({
  citation,
  onClose,
  allCitations = [],
  onSelectCitation,
}: CitationPanelProps) {
  if (!citation) return null;

  return (
    <aside className="w-96 bg-white dark:bg-[#131B2E] border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 h-full shadow-lg z-10 transition-all duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary dark:text-indigo-400 flex items-center justify-center font-mono font-bold text-xs">
            [{citation.n}]
          </div>
          <span className="font-semibold text-sm text-slate-900 dark:text-white">Citation Source</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Close source panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Multiple citations tabs/pills if message has more than 1 citation */}
      {allCitations.length > 1 && onSelectCitation && (
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto bg-[#F8F9FE] dark:bg-slate-900/30">
          <span className="text-[11px] font-mono text-slate-400 shrink-0 mr-1">Sources:</span>
          {allCitations.map((c) => {
            const isSelected = c.n === citation.n;
            return (
              <button
                key={c.n}
                onClick={() => onSelectCitation(c)}
                className={`px-2 py-0.5 rounded text-xs font-mono font-semibold transition-all ${
                  isSelected
                    ? "bg-primary text-white shadow-xs"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-primary/50"
                }`}
              >
                [{c.n}]
              </button>
            );
          })}
        </div>
      )}

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Paper Metadata Card */}
        <div className="bg-[#F8F9FE] dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-indigo-50 dark:bg-indigo-950/50 text-primary dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
              <FileText className="w-3 h-3" />
              Page {citation.page ?? "N/A"}
            </span>
            {citation.year && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {citation.year}
              </span>
            )}
            <span className="inline-flex items-center gap-1 ml-auto text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
              <CheckCircle2 className="w-3 h-3" />
              Grounded
            </span>
          </div>

          <h3 className="font-semibold text-sm text-slate-900 dark:text-white leading-snug line-clamp-3 mb-1.5">
            {citation.title}
          </h3>

          {citation.authors && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
              {citation.authors}
            </p>
          )}
        </div>

        {/* Quoted Excerpt */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 font-medium">
            <Quote className="w-3.5 h-3.5 text-primary" />
            <span>Exact Extracted Excerpt</span>
          </div>

          <blockquote className="relative p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border-l-4 border-amber-500 dark:border-amber-400 text-slate-800 dark:text-slate-200 text-xs leading-relaxed italic">
            "{citation.quote}"
          </blockquote>
          <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
            Grounding verification: passage was retrieved from document chunk on page {citation.page ?? "unknown"}.
          </p>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col gap-2">
        <Link
          href={`/viewer?id=${citation.paper_id}&page=${citation.page || 1}`}
          className="w-full py-2.5 px-3 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Open in Paper Viewer</span>
          <ExternalLink className="w-3 h-3 ml-auto opacity-70" />
        </Link>
      </div>
    </aside>
  );
}
