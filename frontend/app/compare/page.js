"use client";

import { useState, useEffect } from "react";
import { 
  GitCompare, 
  ArrowRight, 
  FileText, 
  Sparkles, 
  Loader2, 
  AlertCircle,
  FileCheck,
  Award
} from "lucide-react";

export default function CompareDocuments() {
  const [documents, setDocuments] = useState([]);
  const [doc1, setDoc1] = useState("");
  const [doc2, setDoc2] = useState("");
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeListLoading, setActiveListLoading] = useState(true);

  // Load available documents for dropdown menus
  useEffect(() => {
    async function loadDocs() {
      try {
        const res = await fetch("http://localhost:8000/documents");
        if (res.ok) {
          const data = await res.json();
          setDocuments(data);
          if (data.length >= 2) {
            setDoc1(data[0].filename);
            setDoc2(data[1].filename);
          }
        }
      } catch (err) {
        console.error("Failed to load documents list:", err);
      } finally {
        setActiveListLoading(false);
      }
    }
    loadDocs();
  }, []);

  // Trigger FastAPI comparison endpoint
  const handleCompare = async () => {
    if (!doc1 || !doc2) {
      setError("Please select two separate documents to generate a comparison matrix.");
      return;
    }
    if (doc1 === doc2) {
      setError("Document 1 and Document 2 must be different files.");
      return;
    }

    setLoading(true);
    setError(null);
    setComparison(null);

    try {
      const res = await fetch("http://localhost:8000/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc1_id: doc1,
          doc2_id: doc2
        })
      });

      if (res.ok) {
        const data = await res.json();
        setComparison(data);
      } else {
        const errDetail = await res.json();
        setError(errDetail.detail || "Failed to compare the selected documents.");
      }
    } catch (err) {
      setError("Could not establish connection to backend on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const getDocDisplayName = (filename) => {
    const doc = documents.find(d => d.filename === filename);
    if (doc && (doc.source_type === "url" || doc.type === "url")) {
      return doc.title || filename;
    }
    return filename;
  };

  // Sections required for comparison matrix
  const matrixSections = [
    { key: "objectives", label: "Objectives", desc: "Primary goals, research hypotheses, or purposes of the paper." },
    { key: "methodology", label: "Methodology", desc: "Scientific processes, formulas, algorithms, frameworks, or models." },
    { key: "datasets", label: "Datasets", desc: "Data inputs, experimental datasets, benchmarks, or corporas evaluated." },
    { key: "conclusions", label: "Conclusions", desc: "Core results, summaries of performance improvements, or recommendations." }
  ];

  return (
    <div className="space-y-8 flex flex-col w-full h-full">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          Document Comparison Matrix
        </h2>
        <p className="text-sm text-gray-400 mt-1 max-w-xl">
          Perform a side-by-side structural analysis of two ingested papers. An AI pipeline will automatically parse both files and construct a comprehensive comparison table.
        </p>
      </div>

      {/* Selectors Panel */}
      <div className="bg-darkCard p-6 rounded-2xl border border-darkBorder shadow-xl">
        {activeListLoading ? (
          <div className="p-4 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 text-brandPrimary animate-spin" />
            <span>Retrieving paper index...</span>
          </div>
        ) : documents.length < 2 ? (
          <div className="p-8 text-center flex flex-col items-center gap-3">
            <AlertCircle className="w-10 h-10 text-amber-400 stroke-[1.5]" />
            <p className="text-sm font-semibold text-white">Insufficient documents in repository.</p>
            <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
              ResearchMate requires **at least two** uploaded papers to execute side-by-side comparison analysis.
            </p>
            <a href="/upload" className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline mt-1">
              Go upload papers first
            </a>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            {/* Dropdown 1 */}
            <div className="flex-1 space-y-2">
              <label className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Document A</label>
              <div className="relative">
                <select
                  value={doc1}
                  onChange={(e) => setDoc1(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-darkBg border border-darkBorder focus:border-brandPrimary/85 text-white text-sm focus:outline-none focus:ring-0 appearance-none cursor-pointer pr-10"
                >
                  {documents.map((doc, idx) => {
                    const isUrl = doc.source_type === "url" || doc.type === "url";
                    return (
                      <option key={idx} value={doc.filename} disabled={doc.filename === doc2}>
                        {isUrl ? `🌐 ${doc.title || doc.filename}` : `📄 ${doc.filename}`}
                      </option>
                    );
                  })}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Visual Icon */}
            <div className="hidden md:flex items-center justify-center mt-6 p-3 rounded-xl bg-gray-800 border border-darkBorder text-gray-400">
              <GitCompare className="w-5 h-5 animate-pulse" />
            </div>

            {/* Dropdown 2 */}
            <div className="flex-1 space-y-2">
              <label className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Document B</label>
              <div className="relative">
                <select
                  value={doc2}
                  onChange={(e) => setDoc2(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-darkBg border border-darkBorder focus:border-brandPrimary/85 text-white text-sm focus:outline-none focus:ring-0 appearance-none cursor-pointer pr-10"
                >
                  {documents.map((doc, idx) => {
                    const isUrl = doc.source_type === "url" || doc.type === "url";
                    return (
                      <option key={idx} value={doc.filename} disabled={doc.filename === doc1}>
                        {isUrl ? `🌐 ${doc.title || doc.filename}` : `📄 ${doc.filename}`}
                      </option>
                    );
                  })}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Compare Trigger Button */}
            <button
              onClick={handleCompare}
              disabled={loading}
              className="mt-6 md:mt-6 px-6 py-3.5 rounded-xl bg-brandPrimary hover:bg-indigo-600 disabled:bg-gray-850 text-white disabled:text-gray-500 font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                  Analyzing Files...
                </>
              ) : (
                <>
                  <GitCompare className="w-4 h-4 text-white" />
                  Generate Matrix
                </>
              )}
            </button>
          </div>
        )}

        {/* Local Selection Validation Errors */}
        {error && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2 items-center">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Comparison Loading Screen Overlay */}
      {loading && (
        <div className="p-20 text-center flex flex-col items-center justify-center gap-4 bg-darkCard/30 rounded-2xl border border-darkBorder border-dashed">
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
          <div>
            <h4 className="font-bold text-white mb-1">Running Comparative Extraction Pipeline</h4>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              Scanning structural objectives, scientific methods, evaluation datasets, and final conclusions from both documents...
            </p>
          </div>
        </div>
      )}

      {/* Structured Matrix Table Output */}
      {comparison && (
        <div className="space-y-4">
          
          {/* Mode Indicator Tag */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Comparative Matrix</h3>
            </div>
            
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
              comparison.mode === "mistral_cloud"
                ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                : comparison.mode === "ollama_local"
                ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
            }`}>
              {comparison.mode === "mistral_cloud" && "Online Synthesizer"}
              {comparison.mode === "ollama_local" && "Ollama Local"}
              {comparison.mode === "offline_fallback" && "Offline Synthesizer"}
            </span>
          </div>

          {/* Grid Layout Table */}
          <div className="bg-darkCard rounded-2xl border border-darkBorder overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-black/35 border-b border-darkBorder text-sm text-white">
                  <th className="py-4 px-6 w-1/4 font-bold border-r border-darkBorder">Analysis parameter</th>
                  <th className="py-4 px-6 w-3/8 font-bold border-r border-darkBorder text-indigo-300">
                    <div className="flex items-center gap-2 truncate">
                      <FileCheck className="w-4 h-4 shrink-0 text-indigo-400" />
                      <span className="truncate" title={doc1}>{getDocDisplayName(doc1)}</span>
                    </div>
                  </th>
                  <th className="py-4 px-6 w-3/8 font-bold text-emerald-300">
                    <div className="flex items-center gap-2 truncate">
                      <FileCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span className="truncate" title={doc2}>{getDocDisplayName(doc2)}</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-darkBorder">
                {matrixSections.map((sec, idx) => {
                  const doc1_val = comparison[sec.key]?.doc1 || "Not specified.";
                  const doc2_val = comparison[sec.key]?.doc2 || "Not specified.";
                  return (
                    <tr key={idx} className="hover:bg-gray-800/10 transition-colors text-sm align-top">
                      
                      {/* Left Header Feature */}
                      <td className="py-5 px-6 border-r border-darkBorder bg-black/10">
                        <h4 className="font-bold text-white mb-0.5">{sec.label}</h4>
                        <p className="text-[11px] text-gray-500 leading-normal font-medium">{sec.desc}</p>
                      </td>

                      {/* Doc 1 Cell */}
                      <td className="py-5 px-6 border-r border-darkBorder leading-relaxed text-gray-300 bg-indigo-950/[0.03]">
                        {doc1_val}
                      </td>

                      {/* Doc 2 Cell */}
                      <td className="py-5 px-6 leading-relaxed text-gray-300 bg-emerald-950/[0.03]">
                        {doc2_val}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
