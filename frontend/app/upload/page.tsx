"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  BookOpen,
  MessageSquare,
  Sparkles,
  Layers,
  RefreshCw,
  X,
  FileCheck
} from "lucide-react";

interface UploadDraft {
  status: "draft" | "duplicate";
  file_hash: string;
  paper_id?: number;
  message?: string;
  title: string;
  authors?: string;
  abstract?: string;
  year?: number;
  page_count?: number;
  has_text?: boolean;
  thumbnail_url?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Draft review state
  const [draft, setDraft] = useState<UploadDraft | null>(null);
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [abstract, setAbstract] = useState("");
  const [year, setYear] = useState<string>("");
  const [visibility, setVisibility] = useState<"shared" | "private">("shared");

  // Indexing progress state
  const [indexing, setIndexing] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [jobStatus, setJobStatus] = useState<string>("queued");
  const [indexedPaperId, setIndexedPaperId] = useState<number | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith(".pdf")) {
        startUploadFile(file);
      } else {
        setUploadError("Please select a valid PDF file.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      startUploadFile(e.target.files[0]);
    }
  };

  const startUploadFile = async (file: File) => {
    setSelectedFile(file);
    setUploadError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/papers/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to upload file");
      }

      setDraft(data);
      setTitle(data.title || file.name.replace(/\.pdf$/i, ""));
      setAuthors(data.authors || "");
      setAbstract(data.abstract || "");
      setYear(data.year ? data.year.toString() : new Date().getFullYear().toString());
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmIndex = async () => {
    if (!draft) return;
    setIndexing(true);
    setUploadError(null);
    setProgress(10);
    setJobStatus("Starting background indexing...");

    try {
      const res = await fetch("/api/papers/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_hash: draft.file_hash,
          title: title.trim(),
          authors: authors.trim() || undefined,
          abstract: abstract.trim() || undefined,
          year: year ? parseInt(year, 10) : undefined,
          visibility,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to start indexing");
      }

      const pId = data.paper_id;
      setIndexedPaperId(pId);

      if (data.status === "exists") {
        setProgress(100);
        setJobStatus("completed");
        return;
      }

      const jId = data.job_id;
      setJobId(jId);

      // Poll job status
      const pollTimer = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/jobs/${jId}`);
          if (pollRes.ok) {
            const jobData = await pollRes.json();
            setProgress(jobData.progress || 20);

            if (jobData.status === "completed") {
              clearInterval(pollTimer);
              setProgress(100);
              setJobStatus("completed");
            } else if (jobData.status === "failed") {
              clearInterval(pollTimer);
              setJobStatus("failed");
              setUploadError(jobData.error || "Indexing failed in background worker.");
            } else {
              setJobStatus("Extracting passages & embedding vectors...");
            }
          }
        } catch (e) {
          // Poll retry
        }
      }, 1000);
    } catch (err: any) {
      setUploadError(err.message || "Failed to confirm and index paper");
      setIndexing(false);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setDraft(null);
    setTitle("");
    setAuthors("");
    setAbstract("");
    setYear("");
    setIndexing(false);
    setProgress(0);
    setJobStatus("queued");
    setIndexedPaperId(null);
    setUploadError(null);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Upload Research Paper
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Upload scientific PDFs to extract metadata, chunk into passages, embed vectors, and index for cited chat.
        </p>
      </div>

      {uploadError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-3 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Step 1: Upload Zone (if no file chosen yet) */}
      {!draft && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            dragActive
              ? "border-primary bg-primary/5 dark:bg-primary/10 scale-101"
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B2E] hover:border-primary/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary dark:text-indigo-400 flex items-center justify-center mx-auto mb-4">
            {uploading ? (
              <RefreshCw className="w-7 h-7 animate-spin" />
            ) : (
              <UploadCloud className="w-7 h-7" />
            )}
          </div>

          <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
            {uploading ? "Extracting PDF Metadata..." : "Click or drag PDF paper here"}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Supports standard 2-column or single-column academic PDFs. Deduplication runs automatically via SHA-256 hash.
          </p>

          <button
            type="button"
            className="mt-6 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            Select PDF File
          </button>
        </div>
      )}

      {/* Step 2: Duplicate Notice */}
      {draft && draft.status === "duplicate" && (
        <div className="bg-white dark:bg-[#131B2E] p-6 rounded-2xl border border-amber-200 dark:border-amber-900/60 shadow-xs space-y-4">
          <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 font-bold text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Paper Already in Library</span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            This document matches an existing record in your corpus with the exact same SHA-256 hash:
          </p>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">{draft.title}</h4>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">Hash: {draft.file_hash}</p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Link
              href={`/viewer?id=${draft.paper_id}`}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Open in Paper Viewer</span>
            </Link>
            <Link
              href={`/chat?paper_id=${draft.paper_id}&scope=paper`}
              className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary dark:text-indigo-400 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Ask in Chat</span>
            </Link>
            <button
              onClick={resetUpload}
              className="px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-medium"
            >
              Upload another
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Metadata Review Form (when draft extracted) */}
      {draft && draft.status === "draft" && !indexing && (
        <div className="bg-white dark:bg-[#131B2E] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-500" />
                <span>Review Extracted Metadata</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Verify or edit the extracted metadata before chunking and embedding.
              </p>
            </div>
            <button
              onClick={resetUpload}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              title="Cancel upload"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Paper Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-[#F8F9FE] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Authors
                </label>
                <input
                  type="text"
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  placeholder="e.g. Ashish Vaswani, Noam Shazeer"
                  className="w-full bg-[#F8F9FE] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Publication Year
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="2023"
                  className="w-full bg-[#F8F9FE] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Abstract
              </label>
              <textarea
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                rows={4}
                placeholder="Paste or edit the paper abstract..."
                className="w-full bg-[#F8F9FE] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Visibility
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    checked={visibility === "shared"}
                    onChange={() => setVisibility("shared")}
                    className="text-primary focus:ring-primary"
                  />
                  <span>Shared (visible across workspace)</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    checked={visibility === "private"}
                    onChange={() => setVisibility("private")}
                    className="text-primary focus:ring-primary"
                  />
                  <span>Private (only visible to me)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={resetUpload}
              className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmIndex}
              disabled={!title.trim()}
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors disabled:opacity-40"
            >
              <span>Confirm & Index Paper</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Indexing Progress Bar */}
      {indexing && (
        <div className="bg-white dark:bg-[#131B2E] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary dark:text-indigo-400 flex items-center justify-center">
              {progress >= 100 ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              ) : (
                <RefreshCw className="w-5 h-5 animate-spin" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {progress >= 100 ? "Indexing Completed Successfully!" : "Indexing Paper..."}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{jobStatus}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>Extract & Chunk &gt; Embed &gt; FAISS Index</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Action buttons upon completion */}
          {progress >= 100 && indexedPaperId && (
            <div className="pt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 dark:border-slate-800">
              <Link
                href={`/viewer?id=${indexedPaperId}`}
                className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                <span>Open in Paper Viewer</span>
              </Link>
              <Link
                href={`/chat?paper_id=${indexedPaperId}&scope=paper`}
                className="px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary dark:text-indigo-400 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Ask in Chat</span>
              </Link>
              <button
                onClick={resetUpload}
                className="px-4 py-2.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium ml-auto"
              >
                Upload another PDF
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
