"use client";
import { useState, useEffect, useRef } from "react";
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Sparkles, 
  HelpCircle, 
  BookOpen, 
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check
} from "lucide-react";
// Human-like word-by-word streaming simulation component
function Typewriter({ text, speed = 25, onComplete }) {
  const [displayedText, setDisplayedText] = useState("");
  
  useEffect(() => {
    const words = text.split(" ");
    setDisplayedText("");
    let idx = 0;
    
    if (words.length === 0) return;
    
    const interval = setInterval(() => {
      setDisplayedText((prev) => prev + (prev ? " " : "") + words[idx]);
      idx++;
      if (idx >= words.length) {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, speed);
    
    return () => clearInterval(interval);
  }, [text, speed]);
  
  return <span className="whitespace-pre-line leading-relaxed">{displayedText}</span>;
}
export default function ChatWithDocuments() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]); // Filter list
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDocSelector, setShowDocSelector] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [reactions, setReactions] = useState({}); // { [index]: 'like' | 'dislike' }
  const [feedbackToast, setFeedbackToast] = useState("");
  
  const messagesEndRef = useRef(null);
  // Load document list to populate scope selector
  useEffect(() => {
    async function loadDocs() {
      try {
        const res = await fetch("http://localhost:8000/documents");
        if (res.ok) {
          const data = await res.json();
          setDocuments(data);
        }
      } catch (err) {
        console.error("Failed to load documents:", err);
      }
    }
    loadDocs();
  }, []);
  // Scroll to bottom of message thread on update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);
  // Handle document scope checkbox toggle
  const toggleDocSelection = (filename) => {
    setSelectedDocs(prev => 
      prev.includes(filename)
        ? prev.filter(f => f !== filename)
        : [...prev, filename]
    );
  };
  // Submit Query to API /chat
  const handleSend = async (e) => {
    e?.preventDefault();
    const activeQuery = query.trim();
    if (!activeQuery || loading) return;
    // Add user message to thread
    const userMsg = { role: "user", text: activeQuery };
    setMessages(prev => [...prev, userMsg]);
    setQuery("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: activeQuery,
          document_ids: selectedDocs.length > 0 ? selectedDocs : null
        })
      });
      if (res.ok) {
        const data = await res.json();
        const assistantMsg = {
          role: "assistant",
          text: data.answer,
          citations: data.citations || [],
          retrieved: data.retrieved_context || [],
          mode: data.mode // 'mistral_cloud', 'ollama_local', 'offline_fallback'
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        const errData = await res.json();
        setError(errData.detail || "Search and retrieval failed.");
      }
    } catch (err) {
      setError("Cannot reach FastAPI server. Verify your backend is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };
  // Copy to clipboard action
  const handleCopyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };
  // Toggle user feedback reaction
  const handleReaction = (idx, type) => {
    setReactions(prev => {
      const current = prev[idx];
      const newReaction = current === type ? null : type;
      
      if (newReaction === "like") {
        triggerToast("Thanks! Marked as helpful response.");
      } else if (newReaction === "dislike") {
        triggerToast("Got it. We'll adjust context retrieval guidelines.");
      }
      return {
        ...prev,
        [idx]: newReaction
      };
    });
  };
  const triggerToast = (msg) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(""), 3000);
  };
  // Quick suggestion chips
  const suggestions = [
    "What are the main objectives of this research?",
    "Summarize the methodology used.",
    "Explain the primary conclusions and datasets."
  ];
  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] w-full max-w-[1200px] mx-auto relative">
      
      {/* Dynamic Toast Feedback Overlay */}
      {feedbackToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-gray-900 border border-indigo-500/30 text-indigo-300 text-xs px-4 py-2.5 rounded-full shadow-2xl z-50 flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
          <span className="font-semibold">{feedbackToast}</span>
        </div>
      )}
      {/* Top Scope Control Header */}
      <div className="bg-darkCard p-4 rounded-t-2xl border-t border-x border-darkBorder flex flex-col md:flex-row md:items-center justify-between gap-4 z-20 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <h3 className="text-base font-bold text-white">Conversational Research Assistant</h3>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Scoped queries query ChromaDB and generate context-grounded AI answers.
          </p>
        </div>
        {/* Dynamic scope selector */}
        <div className="relative">
          <button
            onClick={() => setShowDocSelector(!showDocSelector)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-xs border border-darkBorder hover:border-gray-600 transition-colors"
          >
            <span>Query Scope:</span>
            <span className="text-indigo-400 font-bold">
              {selectedDocs.length === 0 ? "All Documents" : `${selectedDocs.length} Selected`}
            </span>
            {showDocSelector ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showDocSelector && (
            <div className="absolute right-0 mt-2 w-72 bg-darkCard border border-darkBorder rounded-xl p-3 shadow-2xl z-30 space-y-2">
              <div className="flex items-center justify-between border-b border-darkBorder pb-2 mb-2">
                <span className="text-[10px] uppercase font-bold text-gray-400">Target Files</span>
                {selectedDocs.length > 0 && (
                  <button 
                    onClick={() => setSelectedDocs([])}
                    className="text-[10px] text-indigo-400 hover:underline font-semibold"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {documents.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">No documents available. Upload files first.</p>
                ) : (
                  documents.map((doc, idx) => {
                    const isUrl = doc.source_type === "url" || doc.type === "url";
                    return (
                      <label 
                        key={idx} 
                        className="flex items-center gap-2 px-1.5 py-2 rounded-lg hover:bg-gray-800/45 cursor-pointer text-xs text-gray-300 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDocs.includes(doc.filename)}
                          onChange={() => toggleDocSelection(doc.filename)}
                          className="rounded border-darkBorder text-brandPrimary focus:ring-0 bg-darkBg mr-1"
                        />
                        <span className="truncate flex-1" title={doc.filename}>
                          {isUrl ? `🌐 ${doc.title || doc.filename}` : `📄 ${doc.filename}`}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Main Messages Feed Area */}
      <div className="flex-1 bg-darkCard/25 border-x border-darkBorder p-6 overflow-y-auto space-y-6 flex flex-col min-h-0 relative">
        {messages.length === 0 ? (
          <div className="my-auto flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
              <Bot className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white mb-2">Hello, Researcher! 👋</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                I'm ready to search your local document repository. Ask me any question, and I'll find key quotes and synthesize a grounded answer for you!
              </p>
            </div>
            <div className="w-full space-y-2 mt-4">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setQuery(s)}
                  className="w-full text-left p-3 rounded-xl bg-darkCard border border-darkBorder hover:border-brandPrimary/30 hover:bg-indigo-950/5 text-xs text-gray-300 hover:text-white transition-all duration-200"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 flex-1 pr-2">
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              const isLatest = i === messages.length - 1;
              return (
                <div key={i} className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"}`}>
                  
                  {/* Left Avatar Icon */}
                  {!isUser && (
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shrink-0">
                      <Bot className="w-4 h-4 text-indigo-400 animate-pulse" />
                    </div>
                  )}
                  {/* Speech Bubble Box */}
                  <div className={`flex flex-col gap-1.5 max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
                    
                    {/* Mode Status Badge for assistant answers */}
                    {!isUser && msg.mode && (
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border tracking-wider ${
                          msg.mode === "mistral_cloud"
                            ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                            : msg.mode === "ollama_local"
                            ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                            : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                        }`}>
                          {msg.mode === "mistral_cloud" && "Mistral Cloud"}
                          {msg.mode === "ollama_local" && "Ollama Local"}
                          {msg.mode === "offline_fallback" && "Offline Fallback"}
                        </span>
                      </div>
                    )}
                    
                    {/* Content Box */}
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed border transition-all duration-200 ${
                      isUser
                        ? "bg-brandPrimary text-white border-brandPrimary/30 rounded-tr-none shadow-md shadow-indigo-500/5"
                        : "bg-darkCard text-gray-200 border-darkBorder rounded-tl-none"
                    }`}>
                      {isUser ? (
                        <p className="whitespace-pre-line">{msg.text}</p>
                      ) : isLatest ? (
                        // Typewriter on the latest AI message for organic feel
                        <Typewriter text={msg.text} />
                      ) : (
                        <p className="whitespace-pre-line">{msg.text}</p>
                      )}
                    </div>
                    {/* Reactions & Copy toolbar (Assistant Only) */}
                    {!isUser && (
                      <div className="flex items-center gap-3 px-2 text-gray-500 mt-1">
                        <button
                          onClick={() => handleReaction(i, "like")}
                          className={`p-1 hover:text-indigo-400 transition-colors ${reactions[i] === "like" ? "text-indigo-400" : ""}`}
                          title="This was helpful"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleReaction(i, "dislike")}
                          className={`p-1 hover:text-red-400 transition-colors ${reactions[i] === "dislike" ? "text-red-400" : ""}`}
                          title="This did not help"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-px h-3 bg-darkBorder/60" />
                        <button
                          onClick={() => handleCopyToClipboard(msg.text, i)}
                          className="p-1 hover:text-indigo-400 transition-colors flex items-center gap-1"
                          title="Copy response to clipboard"
                        >
                          {copiedIndex === i ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                    {/* Citations Box for AI answers */}
                    {!isUser && msg.citations && msg.citations.length > 0 && (
                      <div className="w-full mt-2 space-y-1">
                        <details className="group bg-darkBg border border-darkBorder/60 rounded-xl overflow-hidden transition-all duration-200">
                          <summary className="p-3 text-xs font-semibold text-gray-400 cursor-pointer flex items-center justify-between hover:bg-gray-800/20">
                            <span className="flex items-center gap-2">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                              View Citations ({msg.citations.length})
                            </span>
                            <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform duration-200" />
                          </summary>
                          
                          <div className="p-3 border-t border-darkBorder/40 divide-y divide-darkBorder/40 max-h-60 overflow-y-auto space-y-3 pt-3">
                            {msg.citations.map((c, cIdx) => {
                              // Find chunks related to this source to display text snippet
                              const relatedChunks = msg.retrieved.filter(ch => ch.source === c.filename);
                              return (
                                <div key={cIdx} className="text-xs space-y-1.5 pt-2 first:pt-0">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-[10px] text-indigo-400">
                                      {c.index}
                                    </span>
                                    <span className="font-semibold text-white truncate max-w-[250px] md:max-w-md" title={c.filename}>
                                      {c.filename}
                                    </span>
                                  </div>
                                  
                                  {relatedChunks.map((ch, chIdx) => (
                                    <div key={chIdx} className="pl-7 pr-2 py-2 rounded bg-black/25 text-gray-400 italic text-[11px] leading-relaxed border-l border-brandPrimary/30">
                                      "...{ch.content}..."
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                  {/* Right Avatar Icon */}
                  {isUser && (
                    <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center border border-gray-700 shrink-0">
                      <User className="w-4 h-4 text-gray-300" />
                    </div>
                  )}
                </div>
              );
            })}
            {/* Pulsing Messaging Dot Animation for active calculation */}
            {loading && (
              <div className="flex gap-4 justify-start">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shrink-0">
                  <Bot className="w-4 h-4 text-indigo-400 animate-pulse" />
                </div>

                <div className="flex flex-col gap-1.5 max-w-[80%] items-start">
                  <div className="px-5 py-4 rounded-2xl bg-darkCard text-gray-400 border border-darkBorder rounded-tl-none flex items-center gap-1.5 shadow-md">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-bounce"></span>
                  </div>

                  <span className="text-[10px] text-gray-500 font-semibold px-2 animate-pulse">
                    ResearchMate is formulating an answer...
                  </span>
                </div>
              </div>
            )}
            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2 items-center">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      {/* Dynamic Bottom Input Area */}
      <div className="bg-darkCard p-4 rounded-b-2xl border-b border-x border-darkBorder z-10 shadow-lg">
        <form onSubmit={handleSend} className="flex gap-3 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            placeholder={
              selectedDocs.length > 0
                ? `Ask a question about the ${selectedDocs.length} selected files...`
                : "Ask me anything about your uploaded papers..."
            }
            className="flex-1 px-4 py-3.5 rounded-xl bg-darkBg border border-darkBorder focus:border-brandPrimary/80 text-white placeholder-gray-500 focus:outline-none focus:ring-0 text-sm disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-5 py-3 rounded-xl bg-brandPrimary hover:bg-indigo-600 disabled:bg-gray-850 text-white disabled:text-gray-500 font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 border border-transparent disabled:border-darkBorder shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
