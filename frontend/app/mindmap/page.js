"use client";

import { useState, useEffect } from "react";
import { 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  FileText, 
  Database,
  Award,
  Link2,
  GitFork
} from "lucide-react";

export default function DocumentMindMap() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState("");
  const [mindmapData, setMindmapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeListLoading, setActiveListLoading] = useState(true);

  // Load available documents for menu selector
  useEffect(() => {
    async function loadDocs() {
      try {
        const res = await fetch("http://localhost:8000/documents");
        if (res.ok) {
          const data = await res.json();
          setDocuments(data);
          if (data.length >= 1) {
            setSelectedDoc(data[0].filename);
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

  // Fetch mind map data from API
  const handleGenerateMindMap = async () => {
    if (!selectedDoc) {
      setError("Please select a document to generate its mind map.");
      return;
    }

    setLoading(true);
    setError(null);
    setMindmapData(null);

    try {
      const res = await fetch("http://localhost:8000/mindmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_id: selectedDoc
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMindmapData(data);
      } else {
        const errDetail = await res.json();
        setError(errDetail.detail || "Failed to generate conceptual mind map.");
      }
    } catch (err) {
      setError("Could not connect to backend server on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 flex flex-col w-full h-full pb-12">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          Conceptual Mind Mapper
        </h2>
        <p className="text-sm text-gray-400 mt-1 max-w-xl">
          Extract a structural hierarchical mind map of any local paper or website. The Online Synthesizer will outline the document's objectives, methods, and findings.
        </p>
      </div>

      {/* Selectors Panel */}
      <div className="bg-darkCard p-6 rounded-2xl border border-darkBorder shadow-xl">
        {activeListLoading ? (
          <div className="p-4 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 text-brandPrimary animate-spin" />
            <span>Retrieving active index...</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center gap-3">
            <GitFork className="w-10 h-10 text-indigo-400 stroke-[1.5]" />
            <p className="text-sm font-semibold text-white">Your repository is empty.</p>
            <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
              ResearchMate requires at least one uploaded document or web resource to generate conceptual mind maps.
            </p>
            <a href="/upload" className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline mt-1">
              Go upload or index resources
            </a>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            {/* Target Select */}
            <div className="flex-1 space-y-2">
              <label className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Select Target Resource</label>
              <div className="relative">
                <select
                  value={selectedDoc}
                  onChange={(e) => setSelectedDoc(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-darkBg border border-darkBorder focus:border-brandPrimary/85 text-white text-sm focus:outline-none focus:ring-0 appearance-none cursor-pointer pr-10"
                >
                  {documents.map((doc, idx) => {
                    const isUrl = doc.source_type === "url" || doc.type === "url";
                    return (
                      <option key={idx} value={doc.filename}>
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

            {/* Run Button */}
            <button
              onClick={handleGenerateMindMap}
              disabled={loading}
              className="mt-6 px-6 py-3.5 rounded-xl bg-brandPrimary hover:bg-indigo-600 disabled:bg-gray-850 text-white disabled:text-gray-500 font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                  Generating Map...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  Generate Mind Map
                </>
              )}
            </button>
          </div>
        )}

        {/* Validation Errors */}
        {error && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2 items-center">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="p-24 text-center flex flex-col items-center justify-center gap-4 bg-darkCard/30 rounded-2xl border border-darkBorder border-dashed animate-pulse">
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
          <div>
            <h4 className="font-bold text-white mb-1">Constructing Concept Hierarchy</h4>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              Scanning core contents, identifying main branches, and formulating concept nodes...
            </p>
          </div>
        </div>
      )}

      {/* Concept Tree Flow Diagram Output */}
      {mindmapData && (
        <div className="space-y-4">
          
          {/* Header Metadata */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4.5 h-4.5 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">Concept Visual Tree</h3>
            </div>
            
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
              mindmapData.mode === "offline_fallback"
                ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                : "bg-purple-500/10 border-purple-500/20 text-purple-400"
            }`}>
              {mindmapData.mode === "offline_fallback" ? "Offline Synthesizer" : "Online Synthesizer"}
            </span>
          </div>

          {/* Node Graph Box */}
          <div className="p-8 bg-black/40 border border-darkBorder rounded-2xl overflow-x-auto min-w-full flex items-center justify-start gap-8 py-16 relative scroll-smooth shadow-2xl">
            
            {/* Level 1 Node: Root Document Topic */}
            <div className="shrink-0 flex items-center justify-center p-6 rounded-2xl bg-indigo-500/10 border-2 border-brandPrimary text-white font-extrabold text-xs max-w-[220px] text-center relative shadow-lg">
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-400">Target</span>
                <span className="truncate max-w-[180px]">{mindmapData.name}</span>
              </div>
              {/* Line connector to column 2 */}
              <div className="absolute right-0 top-1/2 w-8 h-0.5 bg-indigo-500/30 -mr-8"></div>
            </div>
            
            {/* Level 2 Nodes: Main Branches */}
            <div className="flex flex-col gap-8 shrink-0 relative pl-8 border-l border-indigo-500/25">
              {mindmapData.children.map((branch, bIdx) => (
                <div key={bIdx} className="flex items-center gap-8 relative py-2">
                  {/* Left connector to parent line */}
                  <div className="absolute left-0 top-1/2 w-8 h-0.5 bg-indigo-500/20 -ml-8"></div>
                  
                  {/* Branch Card */}
                  <div className="shrink-0 p-4.5 rounded-xl bg-emerald-500/5 border border-emerald-500/35 text-indigo-300 font-bold text-xs max-w-[200px] shadow-lg relative">
                    {branch.name}
                    {branch.children && branch.children.length > 0 && (
                      <div className="absolute right-0 top-1/2 w-8 h-0.5 bg-emerald-500/20 -mr-8"></div>
                    )}
                  </div>
                  
                  {/* Level 3 Nodes: Sub-details list */}
                  {branch.children && branch.children.length > 0 && (
                    <div className="flex flex-col gap-3 shrink-0 pl-8 border-l border-emerald-500/15">
                      {branch.children.map((sub, sIdx) => (
                        <div key={sIdx} className="p-3 rounded-xl bg-darkCard border border-darkBorder hover:border-gray-500 text-gray-300 text-xs leading-relaxed max-w-[260px] shadow-md relative hover:shadow-indigo-500/5 transition-all duration-200">
                          {/* Left connector to branch */}
                          <div className="absolute left-0 top-1/2 w-8 h-0.5 bg-emerald-500/15 -ml-8"></div>
                          {sub.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
