import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  FileDown,
  GitCompare,
  History,
  Home,
  LayoutDashboard,
  Menu,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  UploadCloud,
  X,
  AlertCircle,
  Info,
} from "lucide-react";
import { useDataset } from "../../context/DatasetContext";
import { useTheme } from "../../context/ThemeContext";
import type { PageKey } from "../../types";
import { cn } from "../../lib/utils";
import { DataPureLogo } from "./Logo";
import { Badge, Button } from "../ui/Primitives";

const NAV_ITEMS: { key: PageKey; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Overview Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: "upload", label: "Upload Dataset", icon: <UploadCloud className="h-4 w-4" /> },
  { key: "profiling", label: "Data Profiling", icon: <Database className="h-4 w-4" /> },
  { key: "cleaning", label: "Data Cleaning", icon: <Sparkles className="h-4 w-4" /> },
  { key: "validation", label: "Structural Validation", icon: <ShieldCheck className="h-4 w-4" /> },
  { key: "analytics", label: "Visual Analytics", icon: <BarChart3 className="h-4 w-4" /> },
  { key: "comparison", label: "Before vs After", icon: <GitCompare className="h-4 w-4" /> },
  { key: "reports", label: "Reports & Export", icon: <FileDown className="h-4 w-4" /> },
  { key: "history", label: "Activity History", icon: <History className="h-4 w-4" /> },
  { key: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    datasets,
    activeDataset,
    activePage,
    setActivePage,
    selectDataset,
    globalSearch,
    setGlobalSearch,
    toasts,
    dismissToast,
  } = useDataset();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-[#0F172A] dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 sticky top-0 h-screen z-30",
          collapsed ? "w-[74px]" : "w-64"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4">
          <button
            type="button"
            onClick={() => setActivePage("landing")}
            className="text-left focus:outline-none"
            title="Return to Landing Page"
          >
            <DataPureLogo compact={collapsed} />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <button
            type="button"
            onClick={() => setActivePage("landing")}
            className={cn(
              "w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            )}
          >
            <Home className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">Home / Landing</span>}
          </button>

          <div className="my-2 border-t border-slate-100 dark:border-slate-800" />

          {NAV_ITEMS.map((item) => {
            const active = activePage === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActivePage(item.key)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-200"
                )}
              >
                <span className={cn("shrink-0", active && "text-indigo-600 dark:text-indigo-400")}>
                  {item.icon}
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {!collapsed && activeDataset && (
          <div className="m-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                {activeDataset.name}
              </span>
              <Badge variant="primary">v{activeDataset.current_version}</Badge>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span>{activeDataset.row_count.toLocaleString()} rows</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {activeDataset.current_quality?.overall_score ?? 0}% quality
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="fixed inset-0 bg-slate-950/50" onClick={() => setMobileOpen(false)} />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              className="relative flex h-full w-64 flex-col bg-white dark:bg-slate-900 p-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <DataPureLogo />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-4 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActivePage(item.key);
                      setMobileOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                      activePage === item.key
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
                        : "text-slate-600 dark:text-slate-400"
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Column */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800/80 glass-panel px-4 lg:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Global search across active table..."
                className="h-9 w-56 lg:w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/80 pl-9 pr-3 text-xs text-slate-800 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {datasets.length > 0 && (
              <select
                aria-label="Active dataset selector"
                value={activeDataset?.id || ""}
                onChange={(e) => selectDataset(e.target.value)}
                className="h-9 max-w-[200px] sm:max-w-[260px] truncate rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-indigo-500 focus:outline-none"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} (v{d.current_version})
                  </option>
                ))}
              </select>
            )}

            <Button
              size="sm"
              variant="primary"
              onClick={() => setActivePage("upload")}
              className="hidden sm:inline-flex"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              Upload Dataset
            </Button>

            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle dark/light theme"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-400" />}
            </button>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Toast Stack */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="pointer-events-auto saas-card flex items-start gap-3 p-3.5 shadow-xl border-l-4 border-l-indigo-500"
            >
              {t.type === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />}
              {t.type === "error" && <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />}
              {t.type === "warning" && <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />}
              {t.type === "info" && <Info className="h-5 w-5 text-cyan-500 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
