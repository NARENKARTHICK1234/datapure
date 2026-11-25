import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  FileJson,
  FileSpreadsheet,
  FileText,
  GitCompare,
  Layers,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  UploadCloud,
  Zap,
} from "lucide-react";
import { useDataset } from "../context/DatasetContext";
import { useTheme } from "../context/ThemeContext";
import { DataPureLogo } from "../components/layout/Logo";
import { Badge, Button } from "../components/ui/Primitives";

export function LandingPage() {
  const { setActivePage, loadSample } = useDataset();
  const { theme, toggleTheme } = useTheme();
  const [loadingSample, setLoadingSample] = useState(false);
  const [previewTab, setPreviewTab] = useState<"before" | "after">("after");

  const handleTrySample = async () => {
    setLoadingSample(true);
    const ds = await loadSample();
    setLoadingSample(false);
    if (ds) setActivePage("overview");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-[#0F172A] dark:text-slate-100">
      {/* Sticky Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 glass-panel">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <DataPureLogo />
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400">Features</a>
            <a href="#workflow" className="hover:text-indigo-600 dark:hover:text-indigo-400">Workflow</a>
            <a href="#formats" className="hover:text-indigo-600 dark:hover:text-indigo-400">Formats</a>
            <a href="#benefits" className="hover:text-indigo-600 dark:hover:text-indigo-400">Benefits</a>
          </nav>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
              aria-label="Toggle theme"
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-400" />}
            </button>
            <Button variant="outline" size="sm" onClick={handleTrySample} disabled={loadingSample}>
              {loadingSample ? "Generating..." : "Try Sample Dataset"}
            </Button>
            <Button variant="primary" size="sm" onClick={() => setActivePage("overview")}>
              Get Started <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-200/70 dark:border-slate-800/70">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(79,70,229,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_left,_rgba(6,182,212,0.10),transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-22">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="lg:col-span-6 space-y-6"
            >
              <Badge variant="primary" className="px-3 py-1">
                <Sparkles className="h-3.5 w-3.5" />
                Enterprise Data Quality &amp; Structural Validation
              </Badge>

              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl leading-[1.12]">
                Transform Raw Data into{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-transparent">
                  Reliable Insights.
                </span>
              </h1>

              <p className="max-w-xl text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                DataPure profiles messy CSV, Excel, and JSON datasets with Pandas &amp; Pandera,
                detects duplicates, outliers, and schema violations, previews every change before
                committing, and exports audit-ready clean data and PDF quality reports.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button size="lg" variant="primary" onClick={() => setActivePage("upload")}>
                  <UploadCloud className="h-4 w-4" />
                  Get Started — Upload Dataset
                </Button>
                <Button size="lg" variant="outline" onClick={handleTrySample} disabled={loadingSample}>
                  <Database className="h-4 w-4 text-cyan-600" />
                  {loadingSample ? "Generating 5,000 Rows..." : "Try Sample Dataset (5,000 Rows)"}
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">16 Charts</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Recharts &amp; Plotly.js</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">4-Axis Score</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Deterministic Quality Index</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">Zero Data Loss</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Immutable Raw v0 Backup</p>
                </div>
              </div>
            </motion.div>

            {/* Interactive Dashboard Preview */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="lg:col-span-6"
            >
              <div className="saas-card overflow-hidden shadow-2xl border-slate-200/90 dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Interactive Preview — Quality Monitor
                    </span>
                  </div>
                  <div className="inline-flex rounded-lg bg-slate-200/70 dark:bg-slate-800 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewTab("before")}
                      className={`rounded-md px-2.5 py-1 font-medium transition ${
                        previewTab === "before"
                          ? "bg-white dark:bg-slate-900 text-red-600 shadow-sm"
                          : "text-slate-500"
                      }`}
                    >
                      Raw State
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab("after")}
                      className={`rounded-md px-2.5 py-1 font-medium transition ${
                        previewTab === "after"
                          ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-sm"
                          : "text-slate-500"
                      }`}
                    >
                      Cleaned State
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-4 bg-white dark:bg-slate-900">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3">
                      <p className="text-[11px] text-slate-500">Quality Score</p>
                      <p className={`mt-1 text-2xl font-bold ${previewTab === "after" ? "text-emerald-600" : "text-amber-500"}`}>
                        {previewTab === "after" ? "97.4%" : "71.8%"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3">
                      <p className="text-[11px] text-slate-500">Duplicates</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                        {previewTab === "after" ? "0" : "220"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3">
                      <p className="text-[11px] text-slate-500">Missing Cells</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                        {previewTab === "after" ? "0" : "1,640"}
                      </p>
                    </div>
                  </div>

                  {/* Animated Bar Preview */}
                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span>Dimension Health Breakdown</span>
                      <span className="text-indigo-600 dark:text-indigo-400">
                        {previewTab === "after" ? "+25.6 pts improvement" : "Issues Detected"}
                      </span>
                    </div>
                    {[
                      { label: "Completeness", before: 78, after: 99 },
                      { label: "Uniqueness", before: 95, after: 100 },
                      { label: "Validity", before: 64, after: 96 },
                      { label: "Consistency", before: 50, after: 95 },
                    ].map((bar) => {
                      const pct = previewTab === "after" ? bar.after : bar.before;
                      return (
                        <div key={bar.label} className="space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                            <span>{bar.label}</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{pct}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <motion.div
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.45 }}
                              className={`h-full rounded-full ${
                                previewTab === "after"
                                  ? "bg-gradient-to-r from-indigo-600 to-emerald-500"
                                  : "bg-gradient-to-r from-amber-500 to-red-500"
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Badge variant="cyan">Platform Capabilities</Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Built for Analytical Rigor &amp; Data Integrity
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Every step runs on real Python Pandas, NumPy, and Pandera pipelines with full versioned audit history.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: <Database className="h-5 w-5 text-indigo-600" />,
              title: "Deep Automated Profiling",
              desc: "Detects missing cells, duplicates, mixed types, IQR/Z-score outliers, invalid emails/phones, and date inconsistencies.",
            },
            {
              icon: <Sparkles className="h-5 w-5 text-cyan-600" />,
              title: "Auto & Manual Cleaning Engine",
              desc: "Preview exact cell diffs before applying changes, confirm destructive row deletions, and undo/redo anytime.",
            },
            {
              icon: <ShieldCheck className="h-5 w-5 text-emerald-600" />,
              title: "Pandera Structural Validation",
              desc: "Enforce required columns, data types, unique IDs, min/max bounds, regex, and allowed categorical sets.",
            },
            {
              icon: <BarChart3 className="h-5 w-5 text-violet-600" />,
              title: "16 Interactive Visualizations",
              desc: "Heatmaps, box plots, correlation matrices, waterfalls, funnels, radar charts, and PNG exports.",
            },
            {
              icon: <GitCompare className="h-5 w-5 text-amber-600" />,
              title: "Before vs After Diffing",
              desc: "Stable row IDs track every modified cell and removed record side-by-side against the raw v0 backup.",
            },
            {
              icon: <FileText className="h-5 w-5 text-rose-600" />,
              title: "Executive PDF & Multi-Format Export",
              desc: "Download cleaned CSV, styled Excel, JSON, validation reports, audit trails, and PDF Quality Reports.",
            },
          ].map((f) => (
            <div key={f.title} className="saas-card-hover p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                {f.icon}
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{f.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works & Data Cleaning Workflow */}
      <section id="workflow" className="border-y border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="primary">End-to-End Pipeline</Badge>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              How It Works — Data Cleaning Workflow
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            {[
              { step: "01", title: "Upload & Backup", desc: "Ingest CSV, Excel, or JSON and lock an immutable v0 raw backup." },
              { step: "02", title: "Profile & Score", desc: "Analyze column statistics, anomalies, and 4-dimension quality score." },
              { step: "03", title: "Preview & Clean", desc: "Inspect diff previews, apply auto or manual fixes with undo/redo." },
              { step: "04", title: "Validate Schema", desc: "Run Pandera and custom rules with row-level failure diagnostics." },
              { step: "05", title: "Compare & Export", desc: "Review before-vs-after gains, charts, and download clean files & PDF." },
            ].map((s) => (
              <div key={s.step} className="saas-card p-5 relative">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">STEP {s.step}</span>
                <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{s.title}</h3>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported Formats & Benefits */}
      <section id="formats" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2 items-start">
          <div className="saas-card p-6 space-y-4">
            <Badge variant="cyan">Supported File Formats</Badge>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Ingest &amp; Export Seamlessly</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Upload datasets up to 50 MB with automatic delimiter, encoding, and Excel sheet detection.
            </p>
            <div className="grid gap-3 sm:grid-cols-3 pt-2">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center space-y-2">
                <FileText className="h-7 w-7 mx-auto text-indigo-600" />
                <p className="text-sm font-semibold">CSV (.csv)</p>
                <p className="text-xs text-slate-500">UTF-8 &amp; Latin-1 auto-fallback</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center space-y-2">
                <FileSpreadsheet className="h-7 w-7 mx-auto text-emerald-600" />
                <p className="text-sm font-semibold">Excel (.xlsx)</p>
                <p className="text-xs text-slate-500">Multi-sheet picker &amp; styled export</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center space-y-2">
                <FileJson className="h-7 w-7 mx-auto text-cyan-600" />
                <p className="text-sm font-semibold">JSON (.json)</p>
                <p className="text-xs text-slate-500">Record arrays &amp; nested lists</p>
              </div>
            </div>
          </div>

          <div id="benefits" className="saas-card p-6 space-y-4">
            <Badge variant="success">Why Clean Data Matters</Badge>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Benefits of Structured Data Cleaning</h3>
            <ul className="space-y-3 pt-1">
              {[
                { icon: <TrendingUp className="h-4 w-4 text-emerald-500" />, text: "Eliminates skewed averages and broken BI dashboards caused by duplicates and outliers." },
                { icon: <CheckCircle2 className="h-4 w-4 text-indigo-500" />, text: "Prevents silent downstream pipeline crashes with enforced Pandera schema contracts." },
                { icon: <Layers className="h-4 w-4 text-cyan-500" />, text: "Preserves original raw snapshots and full audit logs for compliance & reproducibility." },
                { icon: <Zap className="h-4 w-4 text-amber-500" />, text: "Cuts manual spreadsheet wrangling from hours down to seconds with smart recommendations." },
              ].map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <span className="mt-0.5 shrink-0">{b.icon}</span>
                  <span>{b.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <DataPureLogo />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            DataPure — Intelligent Data Cleaning &amp; Structural Validation. Powered by FastAPI, Pandas, Pandera, React &amp; Plotly.
          </p>
          <Button size="sm" variant="primary" onClick={() => setActivePage("overview")}>
            Launch Workspace
          </Button>
        </div>
      </footer>
    </div>
  );
}
