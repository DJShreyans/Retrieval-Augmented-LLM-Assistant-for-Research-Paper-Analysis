"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  FileText, 
  UploadCloud, 
  MessageSquare, 
  GitCompare,
  ArrowRight,
  Sparkles,
  Database,
  Cpu
} from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalDocs: 0,
    pdfCount: 0,
    docxCount: 0,
    totalSize: 0,
  });
  const [recentDocs, setRecentDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch document lists to calculate dashboard metrics
  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const res = await fetch("http://localhost:8000/documents");
        if (res.ok) {
          const docs = await res.json();
          setRecentDocs(docs.slice(0, 3)); // Display top 3 recent papers
          
          // Calculate counts
          const pdfs = docs.filter(d => d.type === "pdf").length;
          const docxs = docs.filter(d => d.type === "docx").length;
          const size = docs.reduce((acc, d) => acc + d.size_mb, 0);

          setStats({
            totalDocs: docs.length,
            pdfCount: pdfs,
            docxCount: docxs,
            totalSize: round(size, 2)
          });
        }
      } catch (err) {
        console.error("Dashboard failed to retrieve active documents:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const round = (val, dec) => Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec);

  const quickActions = [
    {
      title: "Upload Papers",
      desc: "Ingest PDF or DOCX research documents into the local ChromaDB database.",
      link: "/upload",
      icon: UploadCloud,
      color: "from-blue-500/20 to-indigo-500/20 border-indigo-500/30 text-indigo-400 hover:shadow-indigo-500/10",
    },
    {
      title: "Chat with Documents",
      desc: "Ask contextual questions and receive answers grounded strictly in your papers.",
      link: "/chat",
      icon: MessageSquare,
      color: "from-purple-500/20 to-pink-500/20 border-pink-500/30 text-pink-400 hover:shadow-pink-500/10",
    },
    {
      title: "Compare Materials",
      desc: "Select two active documents to analyze objectives, methodologies, and findings.",
      link: "/compare",
      icon: GitCompare,
      color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400 hover:shadow-emerald-500/10",
    }
  ];

  return (
    <div className="space-y-8 flex flex-col w-full h-full">
      {/* Welcome Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-darkCard to-indigo-950/20 p-6 rounded-2xl border border-darkBorder shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span className="text-xs uppercase font-bold text-indigo-400 tracking-widest">Workspace Overview</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Welcome to ResearchMate
          </h2>
          <p className="text-sm text-gray-400 mt-1 max-w-xl">
            Your offline research command center. Upload academic publications or SOPs, perform semantic queries, and extract analytical comparison matrixes locally.
          </p>
        </div>
        <Link 
          href="/upload" 
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-brandPrimary hover:bg-indigo-600 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-indigo-600/20 shrink-0 self-start md:self-center"
        >
          <UploadCloud className="w-4 h-4" />
          Ingest Files
        </Link>
      </div>

      {/* Numerical Performance Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-darkCard p-6 rounded-2xl border border-darkBorder flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
            <FileText className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase">Active Papers</p>
            <h3 className="text-2xl font-bold text-white mt-0.5">{stats.totalDocs}</h3>
          </div>
        </div>

        <div className="bg-darkCard p-6 rounded-2xl border border-darkBorder flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <FileText className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase">PDF Documents</p>
            <h3 className="text-2xl font-bold text-white mt-0.5">{stats.pdfCount}</h3>
          </div>
        </div>

        <div className="bg-darkCard p-6 rounded-2xl border border-darkBorder flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <FileText className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase">Word DOCX Files</p>
            <h3 className="text-2xl font-bold text-white mt-0.5">{stats.docxCount}</h3>
          </div>
        </div>

        <div className="bg-darkCard p-6 rounded-2xl border border-darkBorder flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Database className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase">Ingested Volume</p>
            <h3 className="text-2xl font-bold text-white mt-0.5">{stats.totalSize} MB</h3>
          </div>
        </div>
      </div>

      {/* Main Grid: Quick Actions + Recent Uploads */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Interactive Nav Modules */}
        <div className="lg:col-span-7 space-y-6">
          <h4 className="text-lg font-bold text-white flex items-center gap-2 border-b border-darkBorder pb-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            Core Capabilities
          </h4>
          
          <div className="grid grid-cols-1 gap-4">
            {quickActions.map((action, i) => {
              const Icon = action.icon;
              return (
                <Link
                  key={i}
                  href={action.link}
                  className={`group p-5 rounded-2xl border bg-gradient-to-r flex gap-5 items-start transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${action.color}`}
                >
                  <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 mt-0.5 shrink-0 group-hover:scale-105 transition-transform duration-200">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-base text-white group-hover:text-indigo-200 transition-colors">
                        {action.title}
                      </h5>
                      <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform opacity-70" />
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {action.desc}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right Side: Recent Ingestions */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center justify-between border-b border-darkBorder pb-2">
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              Recent Ingestions
            </h4>
            <Link href="/upload" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
              Manage All
            </Link>
          </div>

          <div className="bg-darkCard rounded-2xl border border-darkBorder overflow-hidden shadow-xl">
            {loading ? (
              <div className="p-12 text-center text-sm text-gray-400">Loading recent files...</div>
            ) : recentDocs.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center gap-3">
                <UploadCloud className="w-10 h-10 text-gray-500 stroke-[1.5]" />
                <p className="text-xs text-gray-500">No documents uploaded yet.</p>
                <Link href="/upload" className="text-xs text-brandPrimary hover:underline font-semibold mt-1">
                  Upload your first paper
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-darkBorder">
                {recentDocs.map((doc, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-800/20 transition-colors">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold uppercase shrink-0 ${
                        doc.type === "pdf" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}>
                        {doc.type}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate max-w-[200px] md:max-w-[280px]">
                          {doc.filename}
                        </p>
                        <span className="text-[10px] text-gray-500 font-medium">
                          Size: {doc.size_mb} MB • Uploaded: {doc.uploaded_at.split(" ")[0]}
                        </span>
                      </div>
                    </div>
                    <Link
                      href="/chat"
                      className="p-2 rounded-lg bg-gray-800 hover:bg-brandPrimary/10 border border-darkBorder hover:border-brandPrimary/20 text-gray-400 hover:text-indigo-400 transition-colors"
                      title="Ask questions about this document"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
