"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  GitCompare,
  Plus,
  X,
  Download,
  AlertTriangle,
  CheckCircle2,
  Quote,
  BookOpen,
  ArrowRight,
  ExternalLink,
  Layers,
  HelpCircle,
  Sparkles,
  Info
} from "lucide-react";

interface PaperCandidate {
  id: number;
  title: string;
  authors?: string;
  year?: number;
  page_count?: number;
}

interface CellData {
  paper_title: string;
  value: string;
  quote: string;
  page: number;
}

interface AspectRow {
  aspect: string;
  cells: Record<string, CellData>;
}

interface MetricRecord {
  paper_id: number;
  paper_title: string;
  method?: string;
  task?: string;
  dataset?: string;
  metric?: string;
  value?: string;
  unit?: string;
  conditions?: {
    shots?: number;
    hardware?: string;
    model_size?: string;
  };
  source: {
    page: number;
    quote: string;
  };
}

interface ComparisonGroup {
  task: string;
  dataset: string;
  metric: string;
  unit: string;
  is_comparable: boolean;
  reason?: string;
  records: MetricRecord[];
}

interface ComparisonResult {
  papers: PaperCandidate[];
  aspect_matrix: AspectRow[];
  comparable_groups: ComparisonGroup[];
  not_comparable_groups: ComparisonGroup[];
}

function CompareContent() {
  const searchParams = useSearchParams();
  const initialIds = searchParams.get("ids")
    ? searchParams
        .get("ids")!
        .split(",")
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id))
    : [];

  const [candidates, setCandidates] = useState<PaperCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>(initialIds);
  const [selectedAspects, setSelectedAspects] = useState<string[]>([
    "Methodology / Approach",
    "Benchmark Datasets",
    "Primary Task",
    "Key Quantitative Results",
    "Limitations & Boundary Conditions",
  ]);

  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active quote popover state
  const [activePopover, setActivePopover] = useState<{
    title: string;
    quote: string;
    page: number;
    paperId: number;
  } | null>(null);

  // Fetch paper candidates
  useEffect(() => {
    async function loadCandidates() {
      try {
        const res = await fetch("/api/compare/candidates?limit=20");
        if (res.ok) {
          const data = await res.json();
          setCandidates(data);
          // If no initial ids passed, select first 3
          if (selectedIds.length === 0 && data.length >= 2) {
            setSelectedIds(data.slice(0, 3).map((p: PaperCandidate) => p.id));
          }
        }
      } catch (err) {
        console.error("Failed to load candidates", err);
      }
    }
    loadCandidates();
  }, []);

  // Fetch comparison whenever selectedIds change (if >= 2)
  useEffect(() => {
    if (selectedIds.length < 2) {
      setComparison(null);
      return;
    }

    async function loadComparison() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paper_ids: selectedIds,
            aspects: selectedAspects,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Failed to compare papers");
        }

        const data = await res.json();
        setComparison(data);
      } catch (err: any) {
        setError(err.message || "Comparison failed");
      } finally {
        setLoading(false);
      }
    }

    loadComparison();
  }, [selectedIds]);

  const togglePaperId = (id: number) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 2) {
        setError("You must select at least 2 papers for comparison.");
        return;
      }
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      if (selectedIds.length >= 6) {
        setError("Maximum 6 papers can be compared simultaneously.");
        return;
      }
      setError(null);
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleExportCSV = () => {
    if (!comparison) return;

    let csv = "Section,Aspect/Metric,Paper Title,Value,Unit,Directly Comparable,Comparability Note,Source Page,Exact Quote\n";

    // 1. Aspect Matrix rows
    comparison.aspect_matrix.forEach((row) => {
      Object.entries(row.cells).forEach(([pId, cell]) => {
        const cleanVal = `"${cell.value.replace(/"/g, '""')}"`;
        const cleanQuote = `"${cell.quote.replace(/"/g, '""')}"`;
        const cleanTitle = `"${cell.paper_title.replace(/"/g, '""')}"`;
        csv += `Aspect Matrix,"${row.aspect}",${cleanTitle},${cleanVal},,N/A,,${cell.page},${cleanQuote}\n`;
      });
    });

    // 2. Comparable Metrics
    comparison.comparable_groups.forEach((grp) => {
      grp.records.forEach((r) => {
        const cleanTitle = `"${r.paper_title.replace(/"/g, '""')}"`;
        const cleanQuote = `"${r.source.quote.replace(/"/g, '""')}"`;
        csv += `Benchmark Evaluation,"${grp.metric} (${grp.dataset})",${cleanTitle},"${r.value || ""}",${r.unit || ""},YES,"Directly Comparable",${r.source.page},${cleanQuote}\n`;
      });
    });

    // 3. Not Comparable Metrics
    comparison.not_comparable_groups.forEach((grp) => {
      grp.records.forEach((r) => {
        const cleanTitle = `"${r.paper_title.replace(/"/g, '""')}"`;
        const cleanQuote = `"${r.source.quote.replace(/"/g, '""')}"`;
        const cleanReason = `"${(grp.reason || "Different benchmark").replace(/"/g, '""')}"`;
        csv += `Non-Comparable Benchmarks,"${grp.metric} (${grp.dataset})",${cleanTitle},"${r.value || ""}",${r.unit || ""},NO,${cleanReason},${r.source.page},${cleanQuote}\n`;
      });
    });

    // Download CSV
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `researchmate_comparison_${selectedIds.join("_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <span>Paper Comparison Matrix</span>
            <span className="text-xs font-mono font-medium py-1 px-2.5 rounded-full bg-primary/10 text-primary dark:text-indigo-400 border border-primary/20">
              Rule-Based Grounding
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Side-by-side evidence matrix with source quote tooltips and rigorous comparability verification.
          </p>
        </div>

        {comparison && (
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export Comparison (CSV)</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Paper Selector Card */}
      <div className="bg-white dark:bg-[#131B2E] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
              Select 2 to 6 Papers to Compare ({selectedIds.length}/6)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (candidates.length >= 3) {
                  setSelectedIds(candidates.slice(0, 3).map((p) => p.id));
                }
              }}
              className="text-[11px] font-mono text-primary hover:underline"
            >
              Select First 3
            </button>
          </div>
        </div>

        {/* Selected Paper Chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          {selectedIds.map((id) => {
            const paper = candidates.find((c) => c.id === id);
            return (
              <div
                key={id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary dark:text-indigo-300 font-medium"
              >
                <span className="truncate max-w-[220px]">
                  {paper?.title || `Paper #${id}`}
                </span>
                <button
                  onClick={() => togglePaperId(id)}
                  className="hover:text-red-500 transition-colors ml-1"
                  title="Remove from comparison"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Candidate Selector Dropdown / Pills */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 mb-2 block">
            Add from indexed library:
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
            {candidates
              .filter((c) => !selectedIds.includes(c.id))
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => togglePaperId(c.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-[#F8F9FE] dark:bg-slate-900/60 hover:border-primary/40 text-slate-700 dark:text-slate-300 text-xs transition-colors"
                >
                  <Plus className="w-3 h-3 text-primary" />
                  <span className="truncate max-w-[240px]">{c.title}</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    ({c.year || "2023"})
                  </span>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Main Comparison Matrix Display */}
      {loading ? (
        <div className="p-16 text-center bg-white dark:bg-[#131B2E] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Extracting Aspect Evidence & Evaluating Comparability...
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Mining passages, identifying metrics and conditions, and verifying consistency across papers.
          </p>
        </div>
      ) : comparison ? (
        <div className="space-y-8">
          {/* Section 1: Side-by-Side Aspect Table */}
          <div className="bg-white dark:bg-[#131B2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                  Aspect Synthesis Matrix
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Click any cell to view exact source quotation
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8F9FE] dark:bg-slate-900/40">
                    <th className="p-4 w-52 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Aspect
                    </th>
                    {comparison.papers.map((p) => (
                      <th
                        key={p.id}
                        className="p-4 min-w-[280px] max-w-[320px] text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <div className="space-y-1">
                          <Link
                            href={`/viewer?id=${p.id}`}
                            className="hover:text-primary transition-colors line-clamp-2 leading-snug"
                          >
                            {p.title}
                          </Link>
                          <div className="text-[11px] font-mono text-slate-400 font-normal">
                            {p.year || "2023"} • {p.page_count} pages
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {comparison.aspect_matrix.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors"
                    >
                      <td className="p-4 font-mono font-semibold text-slate-900 dark:text-slate-200 bg-slate-50/40 dark:bg-slate-900/20 align-top">
                        {row.aspect}
                      </td>
                      {comparison.papers.map((p) => {
                        const cell = row.cells[p.id.toString()];
                        if (!cell) {
                          return (
                            <td key={p.id} className="p-4 text-slate-400 italic">
                              Not stated
                            </td>
                          );
                        }
                        return (
                          <td key={p.id} className="p-4 align-top space-y-2">
                            <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                              {cell.value}
                            </p>

                            {cell.quote && (
                              <button
                                onClick={() =>
                                  setActivePopover({
                                    title: p.title,
                                    quote: cell.quote,
                                    page: cell.page,
                                    paperId: p.id,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-primary/10 text-primary dark:text-indigo-400 hover:bg-primary hover:text-white transition-colors"
                              >
                                <Quote className="w-2.5 h-2.5" />
                                <span>Quote (p.{cell.page})</span>
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Metric Comparability Breakdown */}
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>Quantitative Comparability Breakdown</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Rule-based alignment: metrics are directly comparable only when task, dataset, metric, and evaluation conditions match.
              </p>
            </div>

            {/* Sub-section A: Directly Comparable Groups */}
            {comparison.comparable_groups.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                    Directly Comparable ({comparison.comparable_groups.length})
                  </span>
                  <span className="text-xs text-slate-400">
                    Shared benchmark datasets, matching evaluation metrics & consistent conditions
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {comparison.comparable_groups.map((grp, i) => (
                    <div
                      key={i}
                      className="p-5 rounded-2xl bg-white dark:bg-[#131B2E] border border-emerald-200 dark:border-emerald-900/50 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                            {grp.metric}
                          </span>
                          <span className="text-xs text-slate-400 ml-1.5">
                            on {grp.dataset}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-200">
                          {grp.unit || "score"}
                        </span>
                      </div>

                      <div className="space-y-2 pt-1">
                        {grp.records.map((r, rIdx) => (
                          <div
                            key={rIdx}
                            className="p-3 rounded-xl bg-emerald-50/30 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {r.paper_title.slice(0, 35)}...
                              </span>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Method: {r.method || "N/A"}
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {r.value} {r.unit || ""}
                              </span>
                              <div>
                                <button
                                  onClick={() =>
                                    setActivePopover({
                                      title: r.paper_title,
                                      quote: r.source.quote,
                                      page: r.source.page,
                                      paperId: r.paper_id,
                                    })
                                  }
                                  className="text-[10px] font-mono text-primary hover:underline"
                                >
                                  Quote (p.{r.source.page})
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-section B: Not Directly Comparable Groups */}
            {comparison.not_comparable_groups.length > 0 && (
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                    Not Directly Comparable ({comparison.not_comparable_groups.length})
                  </span>
                  <span className="text-xs text-slate-400">
                    Mismatched datasets, different evaluation metrics, or conflicting experimental setups
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {comparison.not_comparable_groups.map((grp, i) => (
                    <div
                      key={i}
                      className="p-5 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                            {grp.metric}
                          </span>
                          <span className="text-xs text-slate-400 ml-1.5">
                            ({grp.dataset})
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/50">
                          Mismatch
                        </span>
                      </div>

                      {/* Reason Alert */}
                      <div className="p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                        <span>{grp.reason}</span>
                      </div>

                      <div className="space-y-2">
                        {grp.records.map((r, rIdx) => (
                          <div
                            key={rIdx}
                            className="p-2.5 rounded-lg bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs"
                          >
                            <span className="truncate max-w-[200px] font-medium text-slate-700 dark:text-slate-300">
                              {r.paper_title}
                            </span>
                            <div className="text-right">
                              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                                {r.value} {r.unit || ""}
                              </span>
                              <div>
                                <button
                                  onClick={() =>
                                    setActivePopover({
                                      title: r.paper_title,
                                      quote: r.source.quote,
                                      page: r.source.page,
                                      paperId: r.paper_id,
                                    })
                                  }
                                  className="text-[10px] font-mono text-primary hover:underline"
                                >
                                  p.{r.source.page}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-16 text-center bg-white dark:bg-[#131B2E] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <GitCompare className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Select At Least 2 Papers
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Pick between 2 and 6 papers from your library to generate a side-by-side aspect comparison and comparability report.
          </p>
        </div>
      )}

      {/* Floating Quote Modal / Popover */}
      {activePopover && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#131B2E] max-w-lg w-full rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-primary/10 text-primary dark:text-indigo-400">
                    Page {activePopover.page}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Grounded Source Quote
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                  {activePopover.title}
                </h4>
              </div>
              <button
                onClick={() => setActivePopover(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <blockquote className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border-l-4 border-amber-500 text-xs italic text-slate-800 dark:text-slate-200 leading-relaxed">
              "{activePopover.quote}"
            </blockquote>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <Link
                href={`/viewer?id=${activePopover.paperId}&page=${activePopover.page}&quote=${encodeURIComponent(
                  activePopover.quote
                )}`}
                className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Open in Viewer</span>
                <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
              </Link>
              <button
                onClick={() => setActivePopover(null)}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs font-mono text-slate-400">
          Loading comparison matrix...
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
