"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Lightbulb,
  FileText,
  Quote,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Sparkles,
  Layers
} from "lucide-react";

interface SupportingQuote {
  quote: string;
  page: number;
  paper_id: number;
  paper_title: string;
}

interface ResearchGap {
  id: number;
  theme: string;
  title: string;
  hypothesis: string;
  supporting_quotes: SupportingQuote[];
  study_outline: {
    working_title: string;
    problem_statement: string;
    proposed_methodology: string;
    required_datasets: string;
    expected_metrics: string;
  };
}

export default function ResearchGapsPage() {
  const [gaps, setGaps] = useState<ResearchGap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGaps() {
      try {
        const res = await fetch("/api/gaps");
        if (res.ok) {
          const data = await res.json();
          setGaps(data);
        }
      } catch (err) {
        console.error("Failed to load gaps", err);
      } finally {
        setLoading(false);
      }
    }
    loadGaps();
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-primary" />
          <span>Research Gaps & Future Directions</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Synthesized from published limitations and future work sections across your indexed research papers.
        </p>
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="p-16 text-center bg-white dark:bg-[#131B2E] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Mining limitations and clustering research gaps...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {gaps.map((gap) => (
            <div
              key={gap.id}
              className="bg-white dark:bg-[#131B2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary dark:text-indigo-400 border border-primary/20">
                    {gap.theme}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Gap #{gap.id}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {gap.title}
                </h3>

                {/* Prominently labeled hypothesis */}
                <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border-l-4 border-amber-500 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                  {gap.hypothesis}
                </div>

                {/* Supporting Evidence Quotes */}
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-mono text-slate-400 block font-semibold">
                    Published Limitations Evidence:
                  </span>
                  {gap.supporting_quotes.map((q, qIdx) => (
                    <div
                      key={qIdx}
                      className="p-2.5 rounded-lg bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1"
                    >
                      <blockquote className="italic text-slate-600 dark:text-slate-400 text-[11px] line-clamp-2">
                        "{q.quote}"
                      </blockquote>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5">
                        <span className="truncate max-w-[200px]">{q.paper_title}</span>
                        <Link
                          href={`/viewer?id=${q.paper_id}&page=${q.page}`}
                          className="text-primary hover:underline"
                        >
                          Page {q.page}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button to Study Idea */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <Link
                  href={`/ideas?gap_id=${gap.id}`}
                  className="w-full py-2.5 px-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Generate Study Outline</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
