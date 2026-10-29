"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  MessageSquare,
  Send,
  Plus,
  Trash2,
  Atom,
  FileText,
  BookOpen,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Search,
  CheckCircle2,
  Layers,
  Database
} from "lucide-react";
import CitationPanel, { CitationItem } from "@/components/CitationPanel";

interface MessageItem {
  id?: number;
  sender: "user" | "assistant";
  content: string;
  citations?: CitationItem[];
  created_at?: string;
  isStreaming?: boolean;
}

interface ChatSession {
  id: number;
  title: string;
  paper_id?: number | null;
  created_at: string;
  updated_at: string;
}

interface GroupedHistory {
  today: ChatSession[];
  yesterday: ChatSession[];
  last_7_days: ChatSession[];
  older: ChatSession[];
}

const STARTER_PROMPTS = [
  "Summarize key findings across attention mechanisms and transformer architectures",
  "What are the common evaluation benchmarks used in natural language processing?",
  "How do diffusion models compare against generative adversarial networks?",
  "What limitations and future directions are frequently cited in computer vision?"
];

function ChatContent() {
  const searchParams = useSearchParams();
  const initialPaperId = searchParams.get("paper_id") ? parseInt(searchParams.get("paper_id")!, 10) : null;
  const initialScope = searchParams.get("scope") || (initialPaperId ? "paper" : "library");

  const [history, setHistory] = useState<GroupedHistory>({
    today: [],
    yesterday: [],
    last_7_days: [],
    older: [],
  });

  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Scope: 'library' or 'paper'
  const [scope, setScope] = useState<"library" | "paper">(initialScope as any);
  const [selectedPaperId, setSelectedPaperId] = useState<number | null>(initialPaperId);
  const [paperTitle, setPaperTitle] = useState<string | null>(null);

  // Citation inspection panel
  const [activeCitation, setActiveCitation] = useState<CitationItem | null>(null);
  const [currentMessageCitations, setCurrentMessageCitations] = useState<CitationItem[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Fetch paper metadata if paper_id is selected
  useEffect(() => {
    if (selectedPaperId) {
      fetch(`/api/papers/${selectedPaperId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setPaperTitle(data.title);
        })
        .catch(() => {});
    } else {
      setPaperTitle(null);
    }
  }, [selectedPaperId]);

  // Load chat sessions history
  const loadHistory = async () => {
    try {
      const res = await fetch("/api/chat/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error("Failed to load chat history", e);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Load selected chat session
  const selectChat = async (id: number) => {
    setActiveChatId(id);
    setActiveCitation(null);
    try {
      const res = await fetch(`/api/chat/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(
          data.messages.map((m: any) => ({
            id: m.id,
            sender: m.sender,
            content: m.content,
            citations: m.citations || [],
            created_at: m.created_at,
          }))
        );
        if (data.paper_id) {
          setScope("paper");
          setSelectedPaperId(data.paper_id);
        }
      }
    } catch (e) {
      console.error("Failed to load chat detail", e);
    }
  };

  // Start new chat
  const handleNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setActiveCitation(null);
    setCurrentMessageCitations([]);
  };

  // Delete chat
  const handleDeleteChat = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await fetch(`/api/chat/${id}`, { method: "DELETE" });
      if (activeChatId === id) {
        handleNewChat();
      }
      loadHistory();
    } catch (err) {
      console.error("Failed to delete chat", err);
    }
  };

  // Submit message
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isGenerating) return;

    setInput("");
    setActiveCitation(null);

    // Append user message
    const userMsg: MessageItem = { sender: "user", content: query };
    const initialAssistantMsg: MessageItem = {
      sender: "assistant",
      content: "",
      citations: [],
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, initialAssistantMsg]);
    setIsGenerating(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          chat_id: activeChatId,
          scope,
          paper_id: scope === "paper" ? selectedPaperId : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Chat request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No readable stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let finalCitations: CitationItem[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const dataStr = part.slice(6).trim();
          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            if (data.chat_id && !activeChatId) {
              setActiveChatId(data.chat_id);
              loadHistory();
            }

            if (data.token) {
              fullContent += data.token;
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.sender === "assistant") {
                  last.content = fullContent;
                }
                return next;
              });
            }

            if (data.done) {
              finalCitations = data.citations || [];
              if (data.full_answer) {
                fullContent = data.full_answer;
              }
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.sender === "assistant") {
                  last.content = fullContent;
                  last.citations = finalCitations;
                  last.isStreaming = false;
                }
                return next;
              });
              setCurrentMessageCitations(finalCitations);
              loadHistory();
            }
          } catch (e) {
            // Json parse error from chunk
          }
        }
      }
    } catch (err: any) {
      console.error("Stream error:", err);
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.sender === "assistant") {
          last.content =
            last.content ||
            "An error occurred while communicating with the retrieval engine. Please verify the backend is active.";
          last.isStreaming = false;
        }
        return next;
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Render text with clickable citation chips [n]
  const renderMessageContent = (msg: MessageItem) => {
    const content = msg.content;
    const citations = msg.citations || [];

    // Split text by [n]
    const parts = content.split(/(\[\d+\])/g);

    return (
      <div className="space-y-3">
        <p className="whitespace-pre-wrap leading-relaxed text-sm">
          {parts.map((part, idx) => {
            const match = part.match(/^\[(\d+)\]$/);
            if (match) {
              const n = parseInt(match[1], 10);
              const cit = citations.find((c) => c.n === n);
              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (cit) {
                      setActiveCitation(cit);
                      setCurrentMessageCitations(citations);
                    }
                  }}
                  className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded font-mono font-bold text-[11px] mx-0.5 align-baseline transition-all cursor-pointer ${
                    activeCitation?.n === n
                      ? "bg-primary text-white shadow-xs"
                      : "bg-primary/10 text-primary dark:text-indigo-400 hover:bg-primary hover:text-white"
                  }`}
                  title={cit ? `Source: ${cit.title} (Page ${cit.page})` : `Citation [${n}]`}
                >
                  [{n}]
                </button>
              );
            }
            return <span key={idx}>{part}</span>;
          })}
          {msg.isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-primary align-middle animate-pulse" />
          )}
        </p>

        {/* Citations footer pills if present */}
        {citations.length > 0 && !msg.isStreaming && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <div className="text-[11px] font-mono text-slate-400 mb-1.5 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Grounded Citations ({citations.length}):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {citations.map((c) => (
                <button
                  key={c.n}
                  onClick={() => {
                    setActiveCitation(c);
                    setCurrentMessageCitations(citations);
                  }}
                  className={`text-left px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all ${
                    activeCitation?.n === c.n
                      ? "border-primary bg-primary/10 text-primary dark:text-indigo-300 font-medium"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-primary/40"
                  }`}
                >
                  <span className="font-mono font-bold text-[10px] text-primary">[{c.n}]</span>
                  <span className="truncate max-w-[180px] font-medium">{c.title}</span>
                  <span className="font-mono text-[10px] text-slate-400 shrink-0">p.{c.page}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const allHistorySessions = [
    ...history.today,
    ...history.yesterday,
    ...history.last_7_days,
    ...history.older,
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Column 2: Chat Sessions Sidebar */}
      <div className="w-72 bg-white dark:bg-[#131B2E] border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
        {/* New Chat Button */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#F8F9FE] dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span>New Chat Session</span>
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {allHistorySessions.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 font-mono">
              No previous chats yet
            </div>
          ) : (
            <>
              {history.today.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2 mb-1.5 font-semibold">
                    Today
                  </div>
                  <div className="space-y-1">
                    {history.today.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => selectChat(s.id)}
                        className={`group flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-all ${
                          activeChatId === s.id
                            ? "bg-primary/10 text-primary dark:text-indigo-400 font-semibold"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                          <span className="truncate">{s.title}</span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteChat(e, s.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {history.yesterday.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2 mb-1.5 font-semibold">
                    Yesterday
                  </div>
                  <div className="space-y-1">
                    {history.yesterday.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => selectChat(s.id)}
                        className={`group flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-all ${
                          activeChatId === s.id
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                          <span className="truncate">{s.title}</span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteChat(e, s.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {history.last_7_days.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2 mb-1.5 font-semibold">
                    Previous 7 Days
                  </div>
                  <div className="space-y-1">
                    {history.last_7_days.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => selectChat(s.id)}
                        className={`group flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-all ${
                          activeChatId === s.id
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                          <span className="truncate">{s.title}</span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteChat(e, s.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Column 3: Main Chat Pane */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F8F9FE] dark:bg-[#090D16]">
        {/* Chat Header Bar */}
        <div className="h-14 bg-white dark:bg-[#131B2E] border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary dark:text-indigo-400 flex items-center justify-center">
              <Atom className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Literature Research Assistant</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
                  Strict Grounding Active
                </span>
              </div>
            </div>
          </div>

          {/* Scope Selector Pills */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">Scope:</span>
            <div className="flex items-center bg-[#F8F9FE] dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setScope("library")}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  scope === "library"
                    ? "bg-white dark:bg-slate-800 text-primary shadow-xs font-semibold"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                }`}
              >
                All Papers
              </button>
              <button
                onClick={() => setScope("paper")}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  scope === "paper"
                    ? "bg-white dark:bg-slate-800 text-primary shadow-xs font-semibold"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                }`}
              >
                This Paper
              </button>
            </div>

            {scope === "paper" && (
              <div className="max-w-[200px] truncate text-[11px] font-mono text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20">
                {paperTitle || `Paper #${selectedPaperId || "Not selected"}`}
              </div>
            )}
          </div>
        </div>

        {/* Message History List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            /* Empty State */
            <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary dark:text-indigo-400 flex items-center justify-center mx-auto shadow-sm">
                <Atom className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Ask ResearchMate
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                  Ask synthesis and analysis questions grounded directly in your indexed papers.
                  Answers provide interactive citation chips linking to exact source pages.
                </p>
              </div>

              {/* Starter Question Chips */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left pt-2">
                {STARTER_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="p-3.5 rounded-xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 hover:border-primary/50 dark:hover:border-primary/50 text-xs text-slate-700 dark:text-slate-300 hover:text-primary transition-all text-left shadow-xs flex items-start gap-2.5 group"
                  >
                    <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                    <span className="leading-snug">{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3.5 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.sender === "assistant" && (
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shrink-0 shadow-xs mt-0.5">
                      <Atom className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl p-4 shadow-xs ${
                      m.sender === "user"
                        ? "bg-primary text-white rounded-tr-xs"
                        : "bg-white dark:bg-[#131B2E] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-tl-xs"
                    }`}
                  >
                    {m.sender === "user" ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    ) : (
                      renderMessageContent(m)
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white dark:bg-[#131B2E] border-t border-slate-200 dark:border-slate-800 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8F9FE] dark:bg-slate-900 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all p-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder={
                  scope === "library"
                    ? "Ask a question across all indexed papers in library... (Press Enter to send)"
                    : `Ask a question about ${paperTitle || "this paper"}...`
                }
                className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none resize-none px-2 py-1 leading-relaxed"
              />

              <div className="flex items-center justify-between pt-2 px-2 border-t border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                  <Database className="w-3 h-3 text-primary" />
                  <span>
                    {scope === "library"
                      ? "Corpus: All papers"
                      : `Target: ${paperTitle ? paperTitle.slice(0, 30) + "..." : "Selected paper"}`}
                  </span>
                </div>

                <button
                  onClick={() => handleSendMessage()}
                  disabled={!input.trim() || isGenerating}
                  className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-40"
                >
                  {isGenerating ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Send</span>
                      <Send className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Column 4: Side Citation Panel */}
      {activeCitation && (
        <CitationPanel
          citation={activeCitation}
          allCitations={currentMessageCitations}
          onSelectCitation={(cit) => setActiveCitation(cit)}
          onClose={() => setActiveCitation(null)}
        />
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs font-mono text-slate-400">
          Loading chat interface...
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
