"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Lightbulb,
  ArrowLeft,
  Copy,
  Check,
  Sparkles,
  BookOpen,
  Layers,
  Database,
  TrendingUp,
  AlertCircle
} from "lucide-react";

interface StudyIdea {
  gap_id: number;
  gap_title: string;
  theme: string;
  hypothesis: string;
  study_outline: {
    working_title: string;
    problem_statement: string;
    proposed_methodology: string;
    required_datasets: string;
    expected_metrics: string;
  };
  disclaimer: string;
}

function IdeaContent() {
  const searchParams = useSearchParams();
  const gapId = searchParams.get("gap_id") || "1";

  const [idea, setIdea] = useState<StudyIdea | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadIdea() {
      try {
        const res = await fetch(`/api/gaps/${gapId}/idea`);
        if (res.ok) {
          const data = await res.json();
          setIdea(data);
        }
      } catch (e) {
        console.error("Failed to load study idea", e);
      } finally {
        setLoading(false);
      }
    }
    loadIdea();
  }, [gapId]);

  const handleCopy = () => {
    if (!idea) return;
    const outline = idea.study_outline;
    const text = `# Proposed Study Outline: ${outline.working_title}\n\n` +
      `**Research Theme:** ${idea.theme}\n` +
      `**Target Gap:** ${idea.gap_title}\n\n` +
      `## Problem Statement\n${outline.problem_statement}\n\n` +
      `## Proposed Methodology\n${outline.proposed_methodology}\n\n` +
      `## Required Datasets & Benchmarks\n${outline.required_datasets}\n\n` +
      `## Target Evaluation Metrics\n${outline.expected_metrics}\n\n` +
      `---\n*${idea.disclaimer}*`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Link
          href="/gaps"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Research Gaps</span>
        </Link>

        {idea && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors shadow-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy Outline"}</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-16 text-center bg-white dark:bg-[#131B2E] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Formulating suggested study outline...</p>
        </div>
      ) : idea ? (
        <div className="bg-white dark:bg-[#131B2E] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          {/* Disclaimer Header */}
          <div className="p-3.5 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20 flex items-center justify-between">
            <span className="text-[11px] font-mono text-primary dark:text-indigo-400 font-semibold flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{idea.disclaimer}</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/80 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
              {idea.theme}
            </span>
          </div>

          <div>
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-1">
              Working Title
            </span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
              {idea.study_outline.working_title}
            </h1>
          </div>

          {/* Underpinning Hypothesis */}
          <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border-l-4 border-amber-500 text-xs text-slate-800 dark:text-slate-200 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400 block">
              Underpinning Research Gap
            </span>
            <p className="italic leading-relaxed">{idea.hypothesis}</p>
          </div>

          {/* Structured Outline Sections */}
          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wider">
                1. Problem Statement & Motivation
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed p-3.5 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                {idea.study_outline.problem_statement}
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wider">
                2. Proposed Experimental Methodology
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed p-3.5 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                {idea.study_outline.proposed_methodology}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wider">
                  3. Recommended Benchmark Datasets
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed p-3.5 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  {idea.study_outline.required_datasets}
                </p>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wider">
                  4. Target Evaluation Metrics
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed p-3.5 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  {idea.study_outline.expected_metrics}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function IdeasPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs font-mono text-slate-400">
          Loading study outline...
        </div>
      }
    >
      <IdeaContent />
    </Suspense>
  );
}
