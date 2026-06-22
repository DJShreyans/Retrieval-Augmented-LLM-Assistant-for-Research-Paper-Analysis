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
  Award,
  Cpu,
  ChevronDown
} from "lucide-react";

// Helper to extract values from comparison objects robustly, supporting case-insensitive keys
function getCellValue(sectionObj, docIndex) {
  if (!sectionObj || typeof sectionObj !== "object") return "Not specified.";
  const keys = Object.keys(sectionObj);
  if (keys.length === 0) return "Not specified.";
  
  // 1. Try to find a key matching "doc1" / "doc2" case-insensitively or containing the index
  const matchKey = keys.find(k => {
    const lk = k.toLowerCase();
    return lk.includes(`doc${docIndex}`) || lk.includes(`document${docIndex}`) || lk.endsWith(docIndex.toString());
  });
  if (matchKey) {
    return sectionObj[matchKey];
  }
  
  // 2. Fall back to insertion order: first key for doc1, second key for doc2
  if (docIndex === 1 && keys.length > 0) return sectionObj[keys[0]];
  if (docIndex === 2 && keys.length > 1) return sectionObj[keys[1]];
  
  return "Not specified.";
}

export default function CompareDocuments() {
  const [documents, setDocuments] = useState([]);
  const [doc1, setDoc1] = useState("");
  const [doc2, setDoc2] = useState("");
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeListLoading, setActiveListLoading] = useState(true);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");

  // Load available documents for dropdown menus
  useEffect(() => {
    async function loadDocs() {
      try {
        const res = await fetch("http://127.0.0.1:8000/documents");
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
    
    async function loadModels() {
      try {
        const res = await fetch("http://127.0.0.1:8000/models");
        if (res.ok) {
          const data = await res.json();
          setModels(data.models);
          const firstAvailable = data.models.find(m => m.available);
          if (firstAvailable) {
            setSelectedModel(firstAvailable.id);
          } else if (data.models.length > 0) {
            setSelectedModel(data.models[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load models list:", err);
      }
    }
    
    loadDocs();
    loadModels();
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
      const res = await fetch("http://127.0.0.1:8000/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc1_id: doc1,
          doc2_id: doc2,
          model: selectedModel || null
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
          <div className="space-y-6">
            {/* Model Selector Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-darkBorder pb-4">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Analysis Model</span>
              </div>
              <div className="relative w-full md:w-64">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-darkBg border border-darkBorder focus:border-brandPrimary/85 text-white text-xs focus:outline-none focus:ring-0 appearance-none cursor-pointer"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id} disabled={!m.available}>
                      {m.name} {!m.available ? " (Unavailable)" : ""}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Document Selectors Row */}
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
              comparison.mode === "nvidia_cloud"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-sm shadow-emerald-500/5"
                : comparison.mode === "ollama_local"
                ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
            }`}>
              {comparison.mode === "nvidia_cloud" && (comparison.model === "moonshotai/kimi-k2.6" ? "NVIDIA Cloud (Kimi K2.6)" : "NVIDIA Cloud (Llama-3.3)")}
              {comparison.mode === "ollama_local" && "Ollama Local"}
              {comparison.mode === "offline_fallback" && "Offline Fallback"}
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
                  const sectionObj = comparison[sec.key];
                  const doc1_val = getCellValue(sectionObj, 1);
                  const doc2_val = getCellValue(sectionObj, 2);
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
