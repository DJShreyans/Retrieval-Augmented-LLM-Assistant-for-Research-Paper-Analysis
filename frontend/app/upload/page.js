"use client";

import { useState, useEffect } from "react";
import { 
  UploadCloud, 
  FileText, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  FileCheck,
  Globe,
  Link2
} from "lucide-react";

export default function UploadDocuments() {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  // URL Scraping states
  const [urlInput, setUrlInput] = useState("");
  const [urlIngesting, setUrlIngesting] = useState(false);

  // Fetch all active papers and URLs from API on mount
  const fetchDocuments = async () => {
    try {
      const res = await fetch("http://localhost:8000/documents");
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch (err) {
      console.error("Failed to load documents list:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Handle Drag Over events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle Drop events
  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      await uploadFileList(droppedFiles);
    }
  };

  // Handle Input selection
  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFiles = Array.from(e.target.files);
      await uploadFileList(selectedFiles);
    }
  };

  // Send files to FastAPI upload endpoint
  const uploadFileList = async (filesToUpload) => {
    setUploading(true);
    setStatusMessage(null);

    // Support sequential file uploads
    for (const file of filesToUpload) {
      const ext = file.name.split(".").pop().toLowerCase();
      if (ext !== "pdf" && ext !== "docx" && ext !== "doc") {
        setStatusMessage({
          type: "error",
          text: `File '${file.name}' rejected. Only .pdf, .docx, and .doc file formats are supported.`
        });
        continue;
      }

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("http://localhost:8000/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setStatusMessage({
            type: "success",
            text: `'${file.name}' successfully parsed, chunked (${data.chunks_created} vectors), and indexed in ChromaDB.`
          });
          await fetchDocuments(); // Reload active list
        } else {
          const errDetail = await res.json();
          setStatusMessage({
            type: "error",
            text: `Failed to upload '${file.name}': ${errDetail.detail || "Server error"}`
          });
        }
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: `Failed to connect to the backend server. Make sure FastAPI is running on localhost:8000.`
        });
      }
    }
    setUploading(false);
  };

  // Web Crawler ingestion handler
  const handleUrlIngestion = async (e) => {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url) return;

    setUrlIngesting(true);
    setStatusMessage(null);

    try {
      const res = await fetch("http://localhost:8000/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });

      if (res.ok) {
        const data = await res.json();
        setStatusMessage({
          type: "success",
          text: `Website content parsed successfully! Indexed ${data.chunks_created} vectors into ChromaDB for "${data.title}".`
        });
        setUrlInput("");
        await fetchDocuments(); // Refresh document list
      } else {
        const errDetail = await res.json();
        setStatusMessage({
          type: "error",
          text: `Failed to ingest URL: ${errDetail.detail || "Server error"}`
        });
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: `Failed to connect to the backend. Verify FastAPI is running.`
      });
    } finally {
      setUrlIngesting(false);
    }
  };

  // Delete Document handler
  const handleDelete = async (filename) => {
    if (!confirm(`Are you sure you want to permanently delete '${filename}'? This wipes all text vectors from ChromaDB.`)) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:8000/documents/${encodeURIComponent(filename)}`, {
        method: "DELETE"
      });

      if (res.ok) {
        setStatusMessage({
          type: "success",
          text: `Resource '${filename}' completely removed.`
        });
        await fetchDocuments();
      } else {
        const errDetail = await res.json();
        setStatusMessage({
          type: "error",
          text: `Failed to delete: ${errDetail.detail || "Server error"}`
        });
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: `Failed to contact backend to delete document.`
      });
    }
  };

  return (
    <div className="space-y-8 flex flex-col w-full h-full">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          Document Manager
        </h2>
        <p className="text-sm text-gray-400 mt-1 max-w-xl">
          Ingest local files (.pdf, .docx, .doc) or scrape website pages. All content will be chunked, embedded, and stored locally in ChromaDB.
        </p>
      </div>

      {/* Upload Drag Area & Notifications */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Upload Modules Area */}
        <div className="xl:col-span-5 flex flex-col gap-5">
          
          {/* File Drag Box */}
          <form 
            onDragEnter={handleDrag} 
            onDragOver={handleDrag} 
            onDragLeave={handleDrag} 
            onDrop={handleDrop}
            className={`w-full p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center transition-all duration-300 relative bg-darkCard/50 ${
              dragActive 
                ? "border-brandPrimary bg-brandPrimary/10 shadow-lg shadow-indigo-500/10 scale-[1.01]" 
                : "border-darkBorder hover:border-gray-600"
            }`}
          >
            <input 
              type="file" 
              id="file-upload-input" 
              multiple 
              onChange={handleFileChange}
              accept=".pdf,.docx,.doc"
              className="hidden" 
            />
            
            <div className="p-4 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-4 animate-bounce">
              <UploadCloud className="w-8 h-8 text-indigo-400" />
            </div>
            
            <h4 className="text-base font-bold text-white mb-1">
              Drag & Drop files here
            </h4>
            <p className="text-xs text-gray-400 mb-6 max-w-xs leading-relaxed">
              Supports **PDF**, **Word DOCX**, or legacy **DOC** files. Maximum 15MB.
            </p>
            
            <label 
              htmlFor="file-upload-input" 
              className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-sm border border-darkBorder hover:border-gray-600 transition-colors cursor-pointer"
            >
              Browse Local Files
            </label>
            
            {uploading && (
              <div className="absolute inset-0 bg-darkBg/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-brandPrimary animate-spin" />
                <span className="text-sm font-semibold text-white">Extracting text & vectorizing chunks...</span>
              </div>
            )}
          </form>

          {/* Web URL Crawler Card */}
          <div className="w-full p-6 rounded-2xl border border-darkBorder bg-darkCard/30 flex flex-col gap-4">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Globe className="w-4.5 h-4.5 text-indigo-400 animate-pulse" />
              Ingest Website URL
            </h3>
            <p className="text-xs text-gray-400 leading-normal">
              Input a web page link (e.g. docs, wikis, blogs) to fetch text body content and embed it.
            </p>
            
            <form onSubmit={handleUrlIngestion} className="flex gap-2.5">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/research-abstract"
                disabled={urlIngesting}
                required
                className="flex-1 px-4 py-2.5 rounded-xl bg-darkBg border border-darkBorder focus:border-brandPrimary text-white placeholder-gray-500 text-xs focus:outline-none focus:ring-0 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={urlIngesting || !urlInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-brandPrimary hover:bg-indigo-600 disabled:bg-gray-800 text-white font-semibold text-xs transition-colors shrink-0 flex items-center gap-1.5"
              >
                {urlIngesting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5" />
                    Index URL
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Status Banners */}
          {statusMessage && (
            <div className={`p-4 rounded-xl border flex gap-3 items-start ${
              statusMessage.type === "success" 
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}>
              {statusMessage.type === "success" ? (
                <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              )}
              <div className="text-xs leading-relaxed">
                <p className="font-bold mb-0.5">{statusMessage.type === "success" ? "Ingestion Success" : "Failed Operation"}</p>
                <p className="opacity-90">{statusMessage.text}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Active Files Table */}
        <div className="xl:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-400" />
              Ingested Repository ({files.length})
            </h3>
            <button 
              onClick={fetchDocuments}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              Refresh Table
            </button>
          </div>

          <div className="bg-darkCard rounded-2xl border border-darkBorder overflow-hidden shadow-xl">
            {loading ? (
              <div className="p-20 text-center text-sm text-gray-400 flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 text-brandPrimary animate-spin" />
                <span>Scanning server storage...</span>
              </div>
            ) : files.length === 0 ? (
              <div className="p-20 text-center flex flex-col items-center gap-3">
                <FileText className="w-12 h-12 text-gray-500 stroke-[1.5]" />
                <p className="text-sm font-semibold text-gray-400">Your research repository is empty.</p>
                <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                  Drag and drop files (.pdf, .docx, .doc) or index a website URL to begin querying context.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/20 border-b border-darkBorder text-[10px] uppercase font-bold tracking-widest text-gray-400">
                      <th className="py-4 px-6">Source Details</th>
                      <th className="py-4 px-6">Storage / Size</th>
                      <th className="py-4 px-6">Ingestion Date</th>
                      <th className="py-4 px-6 text-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-darkBorder">
                    {files.map((file, i) => {
                      const isUrl = file.source_type === "url" || file.type === "url";
                      return (
                        <tr key={i} className="hover:bg-gray-800/20 transition-colors text-sm">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold uppercase shrink-0 ${
                                isUrl
                                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                                  : file.type === "pdf" 
                                  ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                                  : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              }`}>
                                {isUrl ? "url" : file.type}
                              </span>
                              <div className="min-w-0">
                                <p className="font-semibold text-white truncate max-w-[200px] md:max-w-[300px]" title={file.filename}>
                                  {isUrl ? (file.title || file.filename) : file.filename}
                                </p>
                                <span className="text-[10px] text-gray-500 font-semibold tracking-wide uppercase flex items-center gap-1 mt-0.5">
                                  {isUrl ? (
                                    <>
                                      <Link2 className="w-3 h-3 text-indigo-400 shrink-0" />
                                      <span className="truncate max-w-[150px] md:max-w-[220px]" title={file.filename}>{file.filename}</span>
                                    </>
                                  ) : (
                                    "Local Storage"
                                  )}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-gray-300 font-medium">
                            {file.size_mb >= 0.0001 ? `${file.size_mb} MB` : "< 0.01 MB"}
                          </td>
                          <td className="py-4 px-6 text-gray-400 text-xs">{file.uploaded_at}</td>
                          <td className="py-4 px-6 text-center">
                            <button
                              onClick={() => handleDelete(file.filename)}
                              className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200"
                              title="Delete source & vectors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
