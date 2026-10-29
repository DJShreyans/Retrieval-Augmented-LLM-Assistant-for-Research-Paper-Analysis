import Link from "next/link";
import {
  Atom,
  UploadCloud,
  FileText,
  MessageSquare,
  GitCompare,
  BookOpen,
  TrendingUp,
  ArrowRight
} from "lucide-react";

export default function LandingPage() {
  const features = [
    {
      icon: UploadCloud,
      title: "Upload PDFs",
      desc: "Securely parse complex multi-column layouts, charts, and equations with high fidelity."
    },
    {
      icon: FileText,
      title: "Smart Summaries",
      desc: "Instantly extract key findings, methodologies, and conclusions without losing context."
    },
    {
      icon: MessageSquare,
      title: "Q&A Chat",
      desc: "Interrogate the text. Ask specific questions and get answers cited directly from the paper."
    },
    {
      icon: GitCompare,
      title: "Compare Papers",
      desc: "Select multiple documents to contrast methodologies, sample sizes, and outcomes side-by-side."
    },
    {
      icon: BookOpen,
      title: "Literature Reviews",
      desc: "Generate comprehensive overviews of a specific topic by synthesizing dozens of sources."
    },
    {
      icon: TrendingUp,
      title: "Research Gaps",
      desc: "Identify contradictory findings and areas needing further study across your literature corpus."
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex flex-col justify-between">
      {/* Navbar */}
      <header className="border-b border-slate-100 dark:border-slate-800/80 px-8 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
            <Atom className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">ResearchMate</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
          <a href="#features" className="hover:text-primary transition-colors">Features</a>
          <a href="#about" className="hover:text-primary transition-colors">About</a>
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors px-3 py-2"
          >
            Log in
          </Link>
          <Link
            href="/library"
            className="text-sm font-semibold bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg shadow-sm transition-all"
          >
            Open Library
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-8 pt-16 pb-20 w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-24">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-medium">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Academic Research Intelligence
            </div>

            <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.12]">
              Understand Research Papers in Minutes, <span className="text-primary">Not Hours</span>
            </h1>

            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              Read smarter. Research faster. Grounded in verifiable evidence. Query scientific literature,
              compare benchmarks side-by-side, and extract actionable research gaps with page-level citations.
            </p>

            <div className="flex items-center gap-4 pt-2">
              <Link
                href="/library"
                className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold px-6 py-3.5 rounded-xl shadow-md transition-all text-sm"
              >
                <span>Browse Shared Library</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/chat"
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold px-6 py-3.5 rounded-xl transition-all text-sm"
              >
                <span>Ask a Research Question</span>
              </Link>
            </div>
          </div>

          {/* Hero Mockup Card */}
          <div className="lg:col-span-5 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-900 dark:to-slate-800 p-8 rounded-2xl border border-indigo-100 dark:border-slate-800 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="w-3 h-3 rounded-full bg-green-400" />
            </div>

            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="h-3 bg-primary/20 rounded w-1/3 mb-2" />
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-full mb-1" />
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-4/5" />
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="h-3 bg-accent-green/20 rounded w-1/4 mb-2" />
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-full mb-1" />
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>Grounding: 100% Page Quotes</span>
              <span className="text-accent-green font-semibold">Ready</span>
            </div>
          </div>
        </div>

        {/* Section Heading */}
        <div id="features" className="text-center max-w-2xl mx-auto mb-16 pt-8 border-t border-slate-100 dark:border-slate-800">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
            Academic Rigor Meets AI Efficiency
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Tools designed specifically for the unique structure and complexity of peer-reviewed scientific literature.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-primary/40 dark:hover:border-primary/40 transition-all hover:shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-primary-light dark:bg-indigo-950/50 flex items-center justify-center text-primary dark:text-indigo-400 mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">{f.desc}</p>
                </div>
                <Link
                  href="/library"
                  className="text-xs font-semibold text-primary dark:text-indigo-400 inline-flex items-center gap-1.5 hover:gap-2 transition-all"
                >
                  <span>Learn more</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      </main>

      {/* Honest Footer */}
      <footer className="border-t border-slate-100 dark:border-slate-800 px-8 py-6 max-w-7xl mx-auto w-full flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Atom className="w-4 h-4 text-primary" />
          <span className="font-semibold text-slate-600 dark:text-slate-300">ResearchMate AI</span>
        </div>
        <div>(c) 2026 ResearchMate. All research text is strictly verified with direct citations.</div>
      </footer>
    </div>
  );
}
