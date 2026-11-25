import React, { useEffect, useState } from "react";
import { BarChart3, Info } from "lucide-react";
import { useDataset } from "../context/DatasetContext";
import { api } from "../lib/api";
import { scoreBadgeClass } from "../lib/utils";
import { Badge, Button, Card, EmptyState, Skeleton } from "../components/ui/Primitives";
import {
  BeforeAfterGroupedBarChart,
  CategoricalTreemapChart,
  IssueDonutChart,
  MissingByColumnBarChart,
  QualityDimensionsRadarChart,
  QualityRadialGaugeChart,
  QualityStageAreaChart,
  QualityTimelineLineChart,
  StackedColumnHealthChart,
} from "../components/charts/RechartsCharts";
import {
  CleaningFunnelChart,
  CorrelationHeatmapChart,
  MissingValueHeatmapChart,
  NumericalHistogramChart,
  NumericalScatterChart,
  OutlierBoxPlotChart,
  RetentionWaterfallChart,
} from "../components/charts/PlotlyCharts";

type AnalyticsTab = "overview" | "quality" | "distribution" | "correlation" | "outliers";

const TABS: { key: AnalyticsTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "quality", label: "Data Quality" },
  { key: "distribution", label: "Distribution Analysis" },
  { key: "correlation", label: "Correlation Analysis" },
  { key: "outliers", label: "Outlier Analysis" },
];

export function VisualAnalyticsPage() {
  const { activeDataset, setActivePage, dataRevision, addToast } = useDataset();
  const [tab, setTab] = useState<AnalyticsTab>("overview");
  const [viz, setViz] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [numericCol, setNumericCol] = useState<string>("");
  const [scatterX, setScatterX] = useState<string>("");
  const [scatterY, setScatterY] = useState<string>("");
  const [categoryCol, setCategoryCol] = useState<string>("");

  useEffect(() => {
    if (!activeDataset) return;
    let active = true;
    setLoading(true);
    api
      .getVisualizations(activeDataset.id, {
        numeric_col: numericCol || undefined,
        scatter_x: scatterX || undefined,
        scatter_y: scatterY || undefined,
        category_col: categoryCol || undefined,
      })
      .then((res) => {
        if (active) setViz(res);
      })
      .catch((err) => {
        if (active) addToast({ type: "error", title: "Failed to load visualizations", description: err.message });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    activeDataset?.id,
    activeDataset?.current_version,
    dataRevision,
    numericCol,
    scatterX,
    scatterY,
    categoryCol,
    addToast,
  ]);

  if (!activeDataset) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-7 w-7" />}
        title="No Dataset Selected"
        description="Upload a dataset or load the sample customer dataset to explore all 16 interactive charts."
        action={<Button onClick={() => setActivePage("upload")}>Upload Dataset</Button>}
      />
    );
  }

  if (loading && !viz) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-96" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  const charts = viz?.charts;
  const avail = viz?.available_columns;
  const qBefore = viz?.quality_before;
  const qAfter = viz?.quality_after;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Interactive Visual Analytics Studio
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            16 real-time Recharts &amp; Plotly.js visualizations with zoom, pan, column selectors, fullscreen, and PNG export.
          </p>
        </div>

        {/* 5 Organized Tabs */}
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === t.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Overview */}
      {tab === "overview" && charts && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <QualityRadialGaugeChart {...charts.radial_gauge} />
            <IssueDonutChart data={charts.donut_issues} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <RetentionWaterfallChart waterfall={charts.waterfall} />
            <CleaningFunnelChart funnel={charts.funnel} />
          </div>
          <QualityTimelineLineChart data={charts.quality_timeline} />
        </div>
      )}

      {/* Tab 2: Data Quality (Includes 4-Dimension Methodology & Circular Progress) */}
      {tab === "quality" && charts && qAfter && (
        <div className="space-y-6">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold">4-Dimension Data Quality Score Breakdown</h3>
                <p className="text-xs text-slate-500">{qAfter.formula}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="neutral">Before: {qBefore.overall_score}%</Badge>
                <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${scoreBadgeClass(qAfter.classification)}`}>
                  After: {qAfter.overall_score}% ({qAfter.classification})
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(["completeness", "uniqueness", "validity", "consistency"] as const).map((key) => {
                const dim = qAfter.dimensions[key];
                const beforeDim = qBefore.dimensions[key];
                const pct = dim.score;
                const r = 28;
                const circ = 2 * Math.PI * r;
                const dash = circ - (pct / 100) * circ;
                return (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-4"
                  >
                    <svg width="70" height="70" className="shrink-0 -rotate-90">
                      <circle cx="35" cy="35" r={r} strokeWidth="6" className="fill-none stroke-slate-200 dark:stroke-slate-800" />
                      <circle
                        cx="35"
                        cy="35"
                        r={r}
                        strokeWidth="6"
                        strokeDasharray={circ}
                        strokeDashoffset={dash}
                        strokeLinecap="round"
                        className="fill-none stroke-indigo-600 transition-all duration-500"
                      />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {key}
                      </p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">
                        {dim.calculable ? `${dim.score}%` : "N/A"}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate" title={dim.details}>
                        Before: {beforeDim.calculable ? `${beforeDim.score}%` : "N/A"}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate" title={dim.formula}>
                        {dim.formula}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/60 p-3 text-xs text-indigo-900 dark:text-indigo-200">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
              <div>
                <span className="font-semibold">Methodology Note: </span>
                {qAfter.adjustment_note} {qAfter.note}
              </div>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <BeforeAfterGroupedBarChart data={charts.grouped_before_after} />
            <QualityDimensionsRadarChart data={charts.radar_dimensions} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <MissingByColumnBarChart data={charts.missing_by_column} />
            <StackedColumnHealthChart data={charts.stacked_column_health} />
          </div>
          <QualityStageAreaChart data={charts.quality_timeline} />
        </div>
      )}

      {/* Tab 3: Distribution Analysis */}
      {tab === "distribution" && charts && (
        <div className="grid gap-6 lg:grid-cols-2">
          <NumericalHistogramChart
            histogram={charts.histogram}
            numericColumns={avail?.numeric || []}
            onSelectColumn={(col) => setNumericCol(col)}
          />
          <CategoricalTreemapChart
            data={charts.treemap}
            categories={avail?.categorical || []}
            selectedCategory={avail?.selected_category || null}
            onSelectCategory={(col) => setCategoryCol(col)}
          />
        </div>
      )}

      {/* Tab 4: Correlation Analysis */}
      {tab === "correlation" && charts && (
        <div className="grid gap-6 lg:grid-cols-2">
          <CorrelationHeatmapChart corr={charts.correlation_heatmap} />
          <NumericalScatterChart
            scatter={charts.scatter}
            numericColumns={avail?.numeric || []}
            onChangeAxes={(x, y) => {
              setScatterX(x);
              setScatterY(y);
            }}
          />
        </div>
      )}

      {/* Tab 5: Outlier Analysis */}
      {tab === "outliers" && charts && (
        <div className="grid gap-6 lg:grid-cols-2">
          <OutlierBoxPlotChart series={charts.boxplot} />
          <MissingValueHeatmapChart heatmap={charts.missing_heatmap} />
        </div>
      )}
    </div>
  );
}
