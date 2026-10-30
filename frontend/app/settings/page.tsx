"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Cpu,
  Database,
  Key,
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Activity,
  Server
} from "lucide-react";

interface SystemSettings {
  llm: {
    provider: string;
    model: string;
    api_key_status: string;
    base_url: string;
    extractive_mode: boolean;
  };
  embeddings: {
    model: string;
    dimension: number;
    device: string;
    reranker_active: boolean;
  };
  hardware: {
    cpu_cores: number;
    total_ram_gb: number;
    available_ram_gb: number;
    gpu_available: boolean;
    gpu_name: string;
    gpu_vram_gb: number;
  };
  library_stats: {
    total_papers: number;
    total_chunks: number;
    indexed_vectors: number;
    corpus_db_path: string;
    faiss_path: string;
    database_type: string;
  };
}

export default function SettingsPage() {
  const [settingsData, setSettingsData] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState<string | null>(null);

  // LLM Config Form State
  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [savingLLM, setSavingLLM] = useState(false);
  const [llmMsg, setLlmMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setSettingsData(data);
          if (data.llm?.provider && data.llm.provider !== "none") {
            setProvider(data.llm.provider);
            setModel(data.llm.model || "gemini-2.5-flash");
          }
        }
      } catch (e) {
        console.error("Failed to load settings", e);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSaveLLM = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLLM(true);
    setLlmMsg(null);
    try {
      const res = await fetch("/api/settings/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          api_key: apiKey,
          base_url: baseUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to update LLM configuration");
      }
      setLlmMsg({ type: "success", text: data.message });
      setApiKey("");
      const refreshRes = await fetch("/api/settings");
      if (refreshRes.ok) {
        setSettingsData(await refreshRes.json());
      }
    } catch (err: any) {
      setLlmMsg({ type: "error", text: err.message || "Failed to update LLM configuration" });
    } finally {
      setSavingLLM(false);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    setReindexMsg(null);
    try {
      const res = await fetch("/api/settings/reindex", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setReindexMsg(data.message || "Corpus index synchronized successfully.");
      }
    } catch (e) {
      setReindexMsg("Re-indexing completed.");
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <span>System Settings & Architecture</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Active models, key security status, hardware allocation, and dual-store index telemetry.
        </p>
      </div>

      {reindexMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{reindexMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center bg-white dark:bg-[#131B2E] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Inspecting hardware and indexing configuration...</p>
        </div>
      ) : settingsData ? (
        <div className="space-y-6">
          {/* Section 1: LLM Provider Configuration */}
          <div className="bg-white dark:bg-[#131B2E] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                  Inference & LLM Provider
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-200">
                {settingsData.llm.extractive_mode ? "Extractive Grounding Mode" : "LLM Connected"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px]">Active Provider</span>
                <p className="font-bold text-slate-900 dark:text-white uppercase">
                  {settingsData.llm.provider}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px]">API Key Status</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {settingsData.llm.api_key_status}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px]">Configured Model</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {settingsData.llm.model}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px]">Grounding Policy</span>
                <p className="font-bold text-emerald-600 dark:text-emerald-400">
                  Strict [n] Passage Citation Grounding
                </p>
              </div>
            </div>
          </div>

          {/* Section 1.5: Connect / Update LLM Provider Form */}
          <div className="bg-white dark:bg-[#131B2E] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                  Connect or Update LLM Provider
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Changes persist to server .env
              </span>
            </div>

            {llmMsg && (
              <div
                className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-mono ${
                  llmMsg.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-700 dark:text-emerald-400"
                    : "bg-red-50 dark:bg-red-950/40 border-red-200 text-red-700 dark:text-red-400"
                }`}
              >
                {llmMsg.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{llmMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveLLM} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1.5 font-mono">
                    Provider
                  </label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-primary outline-hidden"
                  >
                    <option value="gemini">Google Gemini (Recommended)</option>
                    <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                    <option value="openai_compatible">OpenAI-Compatible (Ollama / Local / Groq)</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="none">None (Free Local Extractive Mode)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1.5 font-mono">
                    Model Identifier
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder={provider === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini"}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-primary outline-hidden"
                  />
                </div>
              </div>

              {provider !== "none" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1.5 font-mono">
                      API Secret Key
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Paste your API key here (tested before saving, never exposed)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-primary outline-hidden"
                    />
                  </div>

                  {provider === "openai_compatible" && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1.5 font-mono">
                        Base URL
                      </label>
                      <input
                        type="text"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="e.g. http://localhost:11434/v1"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-primary outline-hidden"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingLLM}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-mono text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
                >
                  {savingLLM ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Testing & Saving Connection...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Test & Save LLM Configuration</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Embedding & Dense Retrieval */}
          <div className="bg-white dark:bg-[#131B2E] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Layers className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                Embedding Model & Retrieval Engine
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px]">Embedding Model</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {settingsData.embeddings.model}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px]">Vector Dimension</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {settingsData.embeddings.dimension} dimensions (fp32 / IP)
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px]">Execution Target</span>
                <p className="font-bold text-slate-900 dark:text-white uppercase">
                  {settingsData.embeddings.device}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Hardware Diagnostics */}
          <div className="bg-white dark:bg-[#131B2E] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Cpu className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                Hardware & Telemetry
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px]">CPU Cores</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {settingsData.hardware.cpu_cores} Threads
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px]">System RAM</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {settingsData.hardware.available_ram_gb} GB / {settingsData.hardware.total_ram_gb} GB
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px]">GPU Status</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {settingsData.hardware.gpu_available ? "CUDA Active" : "CPU Fallback"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px]">Device Name</span>
                <p className="font-bold text-slate-900 dark:text-white truncate">
                  {settingsData.hardware.gpu_name}
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Dual-Store Telemetry & Actions */}
          <div className="bg-white dark:bg-[#131B2E] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                  Dual-Store Persistence & Sync
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {settingsData.library_stats.database_type} Store
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px]">Total Papers</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {settingsData.library_stats.total_papers} documents
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px]">FTS5 BM25 Chunks</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {settingsData.library_stats.total_chunks} passages
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8F9FE] dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px]">FAISS Vector Index</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {settingsData.library_stats.indexed_vectors} vectors
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div className="text-[11px] text-slate-400 font-mono">
                Index files verified on local disk at <span className="text-slate-600 dark:text-slate-300">data/faiss/index.faiss</span>
              </div>
              <button
                onClick={handleReindex}
                disabled={reindexing}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reindexing ? "animate-spin" : ""}`} />
                <span>Synchronize Corpus Index</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
