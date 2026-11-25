import React, { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";
import { useTheme } from "../../context/ThemeContext";
import { ChartCard } from "./ChartCard";

function usePlotlyInstance(data: any[], layout: Record<string, any>) {
  const { theme } = useTheme();
  const plotRef = useRef<HTMLDivElement>(null);
  const isDark = theme === "dark";

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;

    const mergedLayout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: {
        family: "Inter, system-ui, sans-serif",
        size: 11,
        color: isDark ? "#cbd5e1" : "#334155",
      },
      margin: { l: 55, r: 20, t: 20, b: 48 },
      autosize: true,
      ...layout,
      xaxis: {
        gridcolor: isDark ? "#1e293b" : "#e2e8f0",
        zerolinecolor: isDark ? "#334155" : "#cbd5e1",
        ...(layout.xaxis || {}),
      },
      yaxis: {
        gridcolor: isDark ? "#1e293b" : "#e2e8f0",
        zerolinecolor: isDark ? "#334155" : "#cbd5e1",
        ...(layout.yaxis || {}),
      },
    };

    Plotly.newPlot(el, data, mergedLayout, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["lasso2d", "select2d", "toImage"],
    });

    const ro = new ResizeObserver(() => {
      if (el) Plotly.Plots.resize(el);
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      Plotly.purge(el);
    };
  }, [data, layout, isDark]);

  const exportPng = (filename: string) => {
    if (!plotRef.current) return;
    Plotly.downloadImage(plotRef.current, {
      format: "png",
      width: 1200,
      height: 700,
      filename,
    });
  };

  return { plotRef, exportPng };
}

function PlotlyCanvas({ data, layout, plotRef }: { data: any[]; layout: Record<string, any>; plotRef: React.RefObject<HTMLDivElement> }) {
  return <div ref={plotRef} className="h-full w-full" />;
}

// 6. Missing Value Heatmap
export function MissingValueHeatmapChart({
  heatmap,
}: {
  heatmap: { x: string[]; y: string[]; z: number[][] };
}) {
  const data = React.useMemo(
    () => [
      {
        z: heatmap.z,
        x: heatmap.x,
        y: heatmap.y,
        type: "heatmap",
        colorscale: [
          [0, "#10B981"],
          [0.01, "#FDE68A"],
          [0.3, "#F59E0B"],
          [1, "#EF4444"],
        ],
        hovertemplate: "Column: %{x}<br>Block: %{y}<br>Missing: %{z}%<extra></extra>",
        colorbar: { title: "% Missing", thickness: 12 },
      },
    ],
    [heatmap]
  );

  const layout = React.useMemo(
    () => ({
      margin: { l: 95, r: 20, t: 10, b: 65 },
      xaxis: { tickangle: -25 },
    }),
    []
  );

  const { plotRef, exportPng } = usePlotlyInstance(data, layout);

  return (
    <ChartCard
      title="Missing Value Pattern Heatmap"
      subtitle="Percentage of missing values across dataset row blocks"
      filename="missing-value-heatmap"
      onExportPng={exportPng}
    >
      {() =>
        heatmap.x.length > 0 && heatmap.z.length > 0 ? (
          <PlotlyCanvas data={data} layout={layout} plotRef={plotRef} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            No rows available for missingness heatmap.
          </div>
        )
      }
    </ChartCard>
  );
}

// 7. Box Plot - Numerical outlier detection
export function OutlierBoxPlotChart({
  series,
}: {
  series: { column: string; values: number[] }[];
}) {
  const [selected, setSelected] = React.useState<string>("__ALL__");

  const filtered = React.useMemo(() => {
    if (selected === "__ALL__") return series;
    return series.filter((s) => s.column === selected);
  }, [series, selected]);

  const colors = ["#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#EC4899"];
  const data = React.useMemo(
    () =>
      filtered.map((s, idx) => ({
        y: s.values,
        type: "box",
        name: s.column,
        boxpoints: "outliers",
        marker: { color: colors[idx % colors.length], size: 4 },
        line: { width: 1.8 },
      })),
    [filtered]
  );

  const layout = React.useMemo(
    () => ({
      margin: { l: 55, r: 16, t: 16, b: 40 },
      showlegend: true,
      legend: { orientation: "h", y: -0.18 },
    }),
    []
  );

  const { plotRef, exportPng } = usePlotlyInstance(data, layout);

  return (
    <ChartCard
      title="Numerical Outlier Box Plot"
      subtitle="IQR quartiles & statistical outlier distribution"
      filename="outlier-boxplot"
      onExportPng={exportPng}
      headerControls={
        series.length > 1 ? (
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            aria-label="Filter numeric box plot column"
            className="h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 text-xs text-slate-700 dark:text-slate-200"
          >
            <option value="__ALL__">All Numeric</option>
            {series.map((s) => (
              <option key={s.column} value={s.column}>
                {s.column}
              </option>
            ))}
          </select>
        ) : null
      }
    >
      {() =>
        series.length > 0 ? (
          <PlotlyCanvas data={data} layout={layout} plotRef={plotRef} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            No numeric columns detected for outlier box plot.
          </div>
        )
      }
    </ChartCard>
  );
}

// 8. Histogram - Numerical data distribution
export function NumericalHistogramChart({
  histogram,
  numericColumns,
  onSelectColumn,
}: {
  histogram: { column: string | null; values: number[] };
  numericColumns: string[];
  onSelectColumn?: (col: string) => void;
}) {
  const data = React.useMemo(
    () => [
      {
        x: histogram.values,
        type: "histogram",
        nbinsx: 28,
        marker: {
          color: "#4F46E5",
          line: { color: "#818CF8", width: 1 },
        },
        opacity: 0.88,
      },
    ],
    [histogram]
  );

  const layout = React.useMemo(
    () => ({
      margin: { l: 50, r: 16, t: 16, b: 42 },
      xaxis: { title: histogram.column || "Value" },
      yaxis: { title: "Frequency" },
      bargap: 0.05,
    }),
    [histogram.column]
  );

  const { plotRef, exportPng } = usePlotlyInstance(data, layout);

  return (
    <ChartCard
      title="Numerical Distribution Histogram"
      subtitle={histogram.column ? `Frequency distribution of ${histogram.column}` : "No numeric columns"}
      filename="numerical-histogram"
      onExportPng={exportPng}
      headerControls={
        numericColumns.length > 0 && onSelectColumn ? (
          <select
            value={histogram.column || ""}
            onChange={(e) => onSelectColumn(e.target.value)}
            aria-label="Select histogram column"
            className="h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 text-xs text-slate-700 dark:text-slate-200"
          >
            {numericColumns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : null
      }
    >
      {() =>
        histogram.values.length > 0 ? (
          <PlotlyCanvas data={data} layout={layout} plotRef={plotRef} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            No numerical data available for histogram.
          </div>
        )
      }
    </ChartCard>
  );
}

// 9. Scatter Plot - Relationship between numerical columns
export function NumericalScatterChart({
  scatter,
  numericColumns,
  onChangeAxes,
}: {
  scatter: { x_col: string | null; y_col: string | null; color_col?: string | null; x?: number[]; y?: number[]; categories?: string[] };
  numericColumns: string[];
  onChangeAxes?: (xCol: string, yCol: string) => void;
}) {
  const palette = ["#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6"];
  const data = React.useMemo(() => {
    const xs = scatter.x || [];
    const ys = scatter.y || [];
    const cats = scatter.categories || [];
    const grouped: Record<string, { x: number[]; y: number[] }> = {};
    xs.forEach((xv, i) => {
      const c = cats[i] || "Record";
      if (!grouped[c]) grouped[c] = { x: [], y: [] };
      grouped[c].x.push(xv);
      grouped[c].y.push(ys[i]);
    });
    return Object.entries(grouped).slice(0, 8).map(([cat, pts], idx) => ({
      x: pts.x,
      y: pts.y,
      mode: "markers",
      type: "scatter",
      name: cat,
      marker: { size: 6, opacity: 0.72, color: palette[idx % palette.length] },
    }));
  }, [scatter]);

  const layout = React.useMemo(
    () => ({
      margin: { l: 55, r: 16, t: 14, b: 45 },
      xaxis: { title: scatter.x_col || "X" },
      yaxis: { title: scatter.y_col || "Y" },
      legend: { orientation: "h", y: -0.22 },
    }),
    [scatter.x_col, scatter.y_col]
  );

  const { plotRef, exportPng } = usePlotlyInstance(data, layout);

  return (
    <ChartCard
      title="Numerical Feature Scatter Plot"
      subtitle={`${scatter.x_col || "X"} vs ${scatter.y_col || "Y"}`}
      filename="scatter-plot"
      onExportPng={exportPng}
      headerControls={
        numericColumns.length > 0 && onChangeAxes ? (
          <div className="flex items-center gap-1">
            <select
              value={scatter.x_col || ""}
              onChange={(e) => onChangeAxes(e.target.value, scatter.y_col || e.target.value)}
              aria-label="Scatter X column"
              className="h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 text-xs text-slate-700 dark:text-slate-200"
            >
              {numericColumns.map((c) => (
                <option key={c} value={c}>
                  X: {c}
                </option>
              ))}
            </select>
            <select
              value={scatter.y_col || ""}
              onChange={(e) => onChangeAxes(scatter.x_col || e.target.value, e.target.value)}
              aria-label="Scatter Y column"
              className="h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 text-xs text-slate-700 dark:text-slate-200"
            >
              {numericColumns.map((c) => (
                <option key={c} value={c}>
                  Y: {c}
                </option>
              ))}
            </select>
          </div>
        ) : null
      }
    >
      {() =>
        (scatter.x?.length || 0) > 0 ? (
          <PlotlyCanvas data={data} layout={layout} plotRef={plotRef} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            Insufficient numeric pairs for scatter plot.
          </div>
        )
      }
    </ChartCard>
  );
}

// 10. Correlation Heatmap
export function CorrelationHeatmapChart({
  corr,
}: {
  corr: { columns: string[]; z: number[][] };
}) {
  const data = React.useMemo(
    () => [
      {
        z: corr.z,
        x: corr.columns,
        y: corr.columns,
        type: "heatmap",
        colorscale: "RdBu",
        zmin: -1,
        zmax: 1,
        text: corr.z.map((row) => row.map((v) => v.toFixed(2))),
        texttemplate: "%{text}",
        hovertemplate: "%{x} vs %{y}: r = %{z}<extra></extra>",
      },
    ],
    [corr]
  );

  const layout = React.useMemo(
    () => ({
      margin: { l: 100, r: 20, t: 16, b: 60 },
      xaxis: { tickangle: -20 },
    }),
    []
  );

  const { plotRef, exportPng } = usePlotlyInstance(data, layout);

  return (
    <ChartCard
      title="Pearson Correlation Heatmap"
      subtitle="Linear correlation across numeric features"
      filename="correlation-heatmap"
      onExportPng={exportPng}
    >
      {() =>
        corr.columns.length > 0 ? (
          <PlotlyCanvas data={data} layout={layout} plotRef={plotRef} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            Need at least one numeric column for correlation matrix.
          </div>
        )
      }
    </ChartCard>
  );
}

// 14. Waterfall Chart - Record removal and retention
export function RetentionWaterfallChart({
  waterfall,
}: {
  waterfall: { labels: string[]; measures: string[]; values: number[] };
}) {
  const data = React.useMemo(
    () => [
      {
        type: "waterfall",
        orientation: "v",
        measure: waterfall.measures,
        x: waterfall.labels,
        y: waterfall.values,
        textposition: "outside",
        text: waterfall.values.map((v) => (v > 0 ? `${v.toLocaleString()}` : `${v.toLocaleString()}`)),
        decreasing: { marker: { color: "#EF4444" } },
        increasing: { marker: { color: "#10B981" } },
        totals: { marker: { color: "#4F46E5" } },
        connector: { line: { color: "#94a3b8", width: 1.5, dash: "dot" } },
      },
    ],
    [waterfall]
  );

  const layout = React.useMemo(
    () => ({
      margin: { l: 50, r: 16, t: 24, b: 60 },
      xaxis: { tickangle: -15 },
    }),
    []
  );

  const { plotRef, exportPng } = usePlotlyInstance(data, layout);

  return (
    <ChartCard
      title="Record Retention Waterfall"
      subtitle="Step-by-step record drops & final retained count"
      filename="retention-waterfall"
      onExportPng={exportPng}
    >
      {() => <PlotlyCanvas data={data} layout={layout} plotRef={plotRef} />}
    </ChartCard>
  );
}

// 15. Funnel Chart - Data cleaning workflow
export function CleaningFunnelChart({
  funnel,
}: {
  funnel: { stages: string[]; values: number[] };
}) {
  const data = React.useMemo(
    () => [
      {
        type: "funnel",
        y: funnel.stages,
        x: funnel.values,
        textinfo: "value+percent initial",
        marker: {
          color: ["#6366F1", "#4F46E5", "#06B6D4", "#0EA5E9", "#10B981"],
        },
        connector: { line: { color: "#cbd5e1", width: 1 } },
      },
    ],
    [funnel]
  );

  const layout = React.useMemo(
    () => ({
      margin: { l: 155, r: 20, t: 10, b: 20 },
    }),
    []
  );

  const { plotRef, exportPng } = usePlotlyInstance(data, layout);

  return (
    <ChartCard
      title="Data Cleaning Workflow Funnel"
      subtitle="Pipeline progression from raw ingestion to validated records"
      filename="cleaning-funnel"
      onExportPng={exportPng}
    >
      {() => <PlotlyCanvas data={data} layout={layout} plotRef={plotRef} />}
    </ChartCard>
  );
}
