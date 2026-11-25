import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Columns,
  Copy,
  Database,
  FileWarning,
  Layers,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import { useDataset } from "../context/DatasetContext";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/utils";
import { Badge, Button, Card, EmptyState, Skeleton } from "../components/ui/Primitives";
import { KpiCard } from "../components/shared/KpiCard";
import { DataTable } from "../components/shared/DataTable";
import { ConfirmDialog } from "../components/shared/ConfirmDialog";
import {
  BeforeAfterGroupedBarChart,
  IssueDonutChart,
  QualityDimensionsRadarChart,
  QualityRadialGaugeChart,
  QualityTimelineLineChart,
  StackedColumnHealthChart,
} from "../components/charts/RechartsCharts";
import {
  MissingValueHeatmapChart,
  OutlierBoxPlotChart,
} from "../components/charts/PlotlyCharts";
import type { CleaningOperation, Recommendation } from "../types";

export function OverviewDashboard() {
  const {
    activeDataset,
    setActivePage,
    loadSample,
    refreshDatasets,
    dataRevision,
    bumpRevision,
    globalSearch,
    addToast,
  } = useDataset();

  const [viz, setViz] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [applyingRec, setApplyingRec] = useState<Recommendation | null>(null);
  const [confirmRec, setConfirmRec] = useState<Recommendation | null>(null);

  useEffect(() => {
    if (!activeDataset) {
      setViz(null);
      return;
    }
    let active = true;
    setLoading(true);
    api
      .getVisualizations(activeDataset.id)
      .then((res) => {
        if (active) setViz(res);
      })
      .catch((err) => {
        if (active) addToast({ type: "error", title: "Failed to load dashboard", description: err.message });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeDataset?.id, activeDataset?.current_version, dataRevision, addToast]);

  const executeRecommendation = async (rec: Recommendation, confirmDestructive: boolean) => {
    if (!activeDataset) return;
    setApplyingRec(rec);
    try {
      const ops: CleaningOperation[] = [rec.operation];
      await api.applyClean(activeDataset.id, ops, "manual", confirmDestructive);
      await refreshDatasets(activeDataset.id);
      bumpRevision();
      addToast({ type: "success", title: "Cleaning Applied", description: rec.recommended_action });
      setConfirmRec(null);
    } catch (err: any) {
      if (err.message.includes("Confirmation required")) {
        setConfirmRec(rec);
      } else {
        addToast({ type: "error", title: "Cleaning failed", description: err.message });
      }
    } finally {
      setApplyingRec(null);
    }
  };

  if (!activeDataset) {
    return (
      <EmptyState
        icon={<Database className="h-7 w-7" />}
        title="No Dataset Loaded Yet"
        description="Upload a CSV, Excel, or JSON dataset—or load our 5,000-record synthetic customer dataset to explore the full DataPure pipeline."
        action={
          <>
            <Button variant="primary" onClick={() => setActivePage("upload")}>
              <UploadCloud className="h-4 w-4" /> Upload Dataset
            </Button>
            <Button variant="outline" onClick={() => loadSample()}>
              <Sparkles className="h-4 w-4 text-cyan-600" /> Load Sample Dataset
            </Button>
          </>
        }
      />
    );
  }

  if (loading && !viz) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const kpis = viz?.kpis;
  const charts = viz?.charts;
  const recs: Recommendation[] = viz?.recommendations || [];
  const activities: any[] = viz?.recent_activities || [];

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600 p-6 text-white shadow-lg">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm">
                Active Version v{activeDataset.current_version}
              </span>
              {activeDataset.is_synthetic === 1 && (
                <span className="rounded-full bg-cyan-400/25 px-2.5 py-0.5 text-xs font-semibold">
                  Synthetic Sample Dataset
                </span>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">{activeDataset.name}</h1>
            <p className="mt-1 text-sm text-indigo-100">
              File: {activeDataset.original_filename} &bull; Real-time quality &amp; structural telemetry calculated directly from Pandas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={() => setActivePage("analytics")}
            >
              Open Full Visual Studio
            </Button>
            <Button
              className="bg-white text-indigo-700 hover:bg-indigo-50"
              onClick={() => setActivePage("cleaning")}
            >
              <Sparkles className="h-4 w-4" /> Clean Dataset
            </Button>
          </div>
        </div>
      </div>

      {/* First Row: 10 Animated KPI Cards */}
      {kpis && (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            title="Total Records"
            value={kpis.total_records}
            icon={<Database className="h-4 w-4" />}
            accent="indigo"
            subtitle={`Initial: ${kpis.initial_records.toLocaleString()}`}
          />
          <KpiCard
            title="Total Columns"
            value={kpis.total_columns}
            icon={<Columns className="h-4 w-4" />}
            accent="cyan"
            subtitle="Schema preserved"
          />
          <KpiCard
            title="Missing Values"
            value={kpis.missing_values}
            icon={<FileWarning className="h-4 w-4" />}
            accent="amber"
            deltaText={`Initial: ${kpis.initial_missing_values.toLocaleString()}`}
            deltaPositive={kpis.missing_values <= kpis.initial_missing_values}
          />
          <KpiCard
            title="Duplicate Records"
            value={kpis.duplicate_records}
            icon={<Copy className="h-4 w-4" />}
            accent="red"
            deltaText={`Initial: ${kpis.initial_duplicate_records.toLocaleString()}`}
            deltaPositive={kpis.duplicate_records === 0}
          />
          <KpiCard
            title="Invalid Records"
            value={kpis.invalid_records}
            icon={<ShieldAlert className="h-4 w-4" />}
            accent="violet"
            deltaText={`Initial: ${kpis.initial_invalid_records.toLocaleString()}`}
            deltaPositive={kpis.invalid_records <= kpis.initial_invalid_records}
          />
          <KpiCard
            title="Outliers Detected"
            value={kpis.outliers_detected}
            icon={<AlertTriangle className="h-4 w-4" />}
            accent="amber"
            deltaText={`Initial: ${kpis.initial_outliers_detected.toLocaleString()}`}
          />
          <KpiCard
            title="Issues Resolved"
            value={kpis.issues_resolved}
            icon={<CheckCircle2 className="h-4 w-4" />}
            accent="emerald"
            deltaPositive={true}
            deltaText="Cleaned"
          />
          <KpiCard
            title="Records Retained"
            value={kpis.retention_pct}
            suffix="%"
            decimals={1}
            icon={<Layers className="h-4 w-4" />}
            accent="cyan"
            subtitle={`${kpis.records_retained.toLocaleString()} rows kept`}
          />
          <KpiCard
            title="Initial Quality Score"
            value={kpis.initial_quality_score}
            suffix="%"
            decimals={1}
            icon={<Activity className="h-4 w-4" />}
            accent="indigo"
            subtitle="Raw baseline (v0)"
          />
          <KpiCard
            title="Final Quality Score"
            value={kpis.final_quality_score}
            suffix="%"
            decimals={1}
            icon={<TrendingUp className="h-4 w-4" />}
            accent="emerald"
            deltaText={`${kpis.quality_gain >= 0 ? "+" : ""}${kpis.quality_gain} pts`}
            deltaPositive={kpis.quality_gain >= 0}
          />
        </div>
      )}

      {/* Second Row: Circular Quality Gauge & Data Issues Donut */}
      {charts && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <QualityRadialGaugeChart {...charts.radial_gauge} />
            <IssueDonutChart data={charts.donut_issues} />
          </div>

          {/* Third Row: Before vs After Grouped Bar & Quality Improvement Line */}
          <div className="grid gap-6 lg:grid-cols-2">
            <BeforeAfterGroupedBarChart data={charts.grouped_before_after} />
            <QualityTimelineLineChart data={charts.quality_timeline} />
          </div>

          {/* Fourth Row: Missing Value Heatmap & Column-Level Issue Distribution */}
          <div className="grid gap-6 lg:grid-cols-2">
            <MissingValueHeatmapChart heatmap={charts.missing_heatmap} />
            <StackedColumnHealthChart data={charts.stacked_column_health} />
          </div>

          {/* Fifth Row: Outlier Analysis & Data Quality Radar */}
          <div className="grid gap-6 lg:grid-cols-2">
            <OutlierBoxPlotChart series={charts.boxplot} />
            <QualityDimensionsRadarChart data={charts.radar_dimensions} />
          </div>
        </>
      )}

      {/* Sixth Row: Smart Cleaning Recommendations & Recent Activities */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Smart Cleaning Recommendations
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Prioritized actions derived from current dataset profiling
              </p>
            </div>
            <Badge variant={recs.length > 0 ? "warning" : "success"}>
              {recs.length} {recs.length === 1 ? "Action" : "Actions"}
            </Badge>
          </div>

          {recs.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8 mb-2" />
              All automated recommendations have been resolved!
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {recs.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-800/30"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          rec.severity === "high"
                            ? "error"
                            : rec.severity === "medium"
                            ? "warning"
                            : "cyan"
                        }
                      >
                        {rec.severity.toUpperCase()}
                      </Badge>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {rec.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{rec.description}</p>
                    <p className="text-[11px] text-slate-400">
                      Affects {rec.affected_records.toLocaleString()} items &bull;{" "}
                      {rec.affected_columns.slice(0, 3).join(", ")}
                      {rec.affected_columns.length > 3 ? ` +${rec.affected_columns.length - 3}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={applyingRec?.id === rec.id}
                    onClick={() => executeRecommendation(rec, false)}
                    className="shrink-0"
                  >
                    {applyingRec?.id === rec.id ? "Applying..." : "Apply"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Recent Cleaning Activities
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                SQLite audit trail for versioned integrity
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setActivePage("history")}>
              View All
            </Button>
          </div>

          <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
            {activities.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-800 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="primary">{a.action_type}</Badge>
                    {a.version_to !== null && (
                      <span className="text-[11px] font-mono text-slate-400">
                        {a.version_from !== null ? `v${a.version_from} -> ` : ""}v{a.version_to}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">{a.summary}</p>
                </div>
                <span className="shrink-0 text-[11px] text-slate-400">
                  {formatDateTime(a.created_at)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Final Section: Interactive Dataset Preview Table */}
      <DataTable
        datasetId={activeDataset.id}
        version={activeDataset.current_version}
        revision={dataRevision}
        externalSearch={globalSearch}
        title={`Interactive Dataset Preview (v${activeDataset.current_version})`}
      />

      <ConfirmDialog
        open={Boolean(confirmRec)}
        title="Confirm Destructive Cleaning Operation"
        description={
          confirmRec
            ? `Applying "${confirmRec.recommended_action}" will delete records from the active version. Your original v0 upload remains intact.`
            : ""
        }
        confirmLabel="Confirm & Apply"
        loading={Boolean(applyingRec)}
        onCancel={() => setConfirmRec(null)}
        onConfirm={() => confirmRec && executeRecommendation(confirmRec, true)}
      />
    </div>
  );
}
