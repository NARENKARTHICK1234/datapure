import React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { ChartCard } from "./ChartCard";

function useChartPalette() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return {
    isDark,
    grid: isDark ? "#1e293b" : "#e2e8f0",
    tick: isDark ? "#94a3b8" : "#64748b",
    tooltipBg: isDark ? "#0f172a" : "#ffffff",
    tooltipBorder: isDark ? "#334155" : "#e2e8f0",
    text: isDark ? "#f8fafc" : "#0f172a",
  };
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      {label !== undefined && (
        <p className="mb-1 font-semibold text-slate-900 dark:text-white">{label}</p>
      )}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color || entry.payload?.color || "#4F46E5" }}
            />
            {entry.name}
          </span>
          <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
            {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// 1. Interactive Donut Chart - Data issue distribution
export function IssueDonutChart({ data }: { data: { name: string; count: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const nonZero = data.filter((d) => d.count > 0);
  const displayData = nonZero.length > 0 ? nonZero : [{ name: "Clean (0 Issues)", count: 1, color: "#10B981" }];

  return (
    <ChartCard
      title="Data Issue Distribution"
      subtitle={`${total.toLocaleString()} total detected anomalies`}
      filename="issue-distribution-donut"
    >
      {() => (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={displayData}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="48%"
              innerRadius="55%"
              outerRadius="82%"
              paddingAngle={3}
              stroke="none"
            >
              {displayData.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// 2. Grouped Bar Chart - Before vs After cleaning
export function BeforeAfterGroupedBarChart({
  data,
}: {
  data: { metric: string; Before: number; After: number }[];
}) {
  const pal = useChartPalette();
  return (
    <ChartCard
      title="Before vs After Cleaning"
      subtitle="Issue count comparison from raw v0 to current version"
      filename="before-vs-after-bar"
    >
      {() => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={pal.grid} vertical={false} />
            <XAxis dataKey="metric" tick={{ fill: pal.tick, fontSize: 11 }} />
            <YAxis tick={{ fill: pal.tick, fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Bar dataKey="Before" fill="#EF4444" radius={[6, 6, 0, 0]} />
            <Bar dataKey="After" fill="#10B981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// 3. Horizontal Bar Chart - Missing values by column
export function MissingByColumnBarChart({
  data,
}: {
  data: { column: string; missing: number; missing_pct: number }[];
}) {
  const pal = useChartPalette();
  return (
    <ChartCard
      title="Missing Values by Column"
      subtitle="Column-level completeness gaps"
      filename="missing-by-column"
    >
      {() => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.slice(0, 14)} layout="vertical" margin={{ top: 4, right: 20, left: 30, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={pal.grid} horizontal={false} />
            <XAxis type="number" tick={{ fill: pal.tick, fontSize: 11 }} />
            <YAxis dataKey="column" type="category" width={115} tick={{ fill: pal.tick, fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="missing" name="Missing Cells" fill="#F59E0B" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// 4. Line Chart - Data quality improvement
export function QualityTimelineLineChart({ data }: { data: any[] }) {
  const pal = useChartPalette();
  return (
    <ChartCard
      title="Data Quality Improvement"
      subtitle="Score progression across dataset versions"
      filename="quality-improvement-line"
    >
      {() => (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={pal.grid} />
            <XAxis dataKey="stage" tick={{ fill: pal.tick, fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: pal.tick, fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Line
              type="monotone"
              dataKey="overall_score"
              name="Overall Score (%)"
              stroke="#4F46E5"
              strokeWidth={3}
              dot={{ r: 4, fill: "#4F46E5" }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="validity"
              name="Validity (%)"
              stroke="#06B6D4"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="completeness"
              name="Completeness (%)"
              stroke="#10B981"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// 5. Radar Chart - Data quality dimensions
export function QualityDimensionsRadarChart({
  data,
}: {
  data: { dimension: string; Before: number; After: number }[];
}) {
  const pal = useChartPalette();
  return (
    <ChartCard
      title="Data Quality Dimensions Radar"
      subtitle="Completeness, Uniqueness, Validity, Consistency & Retention"
      filename="quality-radar"
    >
      {() => (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="74%" data={data}>
            <PolarGrid stroke={pal.grid} />
            <PolarAngleAxis dataKey="dimension" tick={{ fill: pal.tick, fontSize: 11 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: pal.tick, fontSize: 10 }} />
            <Radar name="Initial (v0)" dataKey="Before" stroke="#94A3B8" fill="#94A3B8" fillOpacity={0.25} />
            <Radar name="Current" dataKey="After" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.45} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// 11. Stacked Bar Chart - Valid, Missing, and Invalid values per column
export function StackedColumnHealthChart({
  data,
}: {
  data: { column: string; Valid: number; Missing: number; Invalid: number }[];
}) {
  const pal = useChartPalette();
  return (
    <ChartCard
      title="Column-Level Validity & Completeness"
      subtitle="Valid vs Missing vs Invalid cells across columns"
      filename="column-health-stacked"
    >
      {() => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={pal.grid} vertical={false} />
            <XAxis
              dataKey="column"
              tick={{ fill: pal.tick, fontSize: 10 }}
              interval={0}
              angle={-22}
              textAnchor="end"
              height={55}
            />
            <YAxis tick={{ fill: pal.tick, fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Bar dataKey="Valid" stackId="a" fill="#10B981" />
            <Bar dataKey="Missing" stackId="a" fill="#F59E0B" />
            <Bar dataKey="Invalid" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// 12. Radial Gauge Chart - Overall Data Quality Score
export function QualityRadialGaugeChart({
  before,
  after,
  classification,
  improvement,
}: {
  before: number;
  after: number;
  classification: string;
  improvement: number;
}) {
  const color =
    after >= 90 ? "#10B981" : after >= 75 ? "#06B6D4" : after >= 50 ? "#F59E0B" : "#EF4444";
  const gaugeData = [
    { name: "Max", value: 100, fill: "transparent" },
    { name: "Quality Score", value: after, fill: color },
  ];

  return (
    <ChartCard
      title="Overall Data Quality Gauge"
      subtitle={`Initial: ${before}% • Gain: ${improvement >= 0 ? "+" : ""}${improvement} pts`}
      filename="quality-radial-gauge"
    >
      {() => (
        <div className="relative h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="58%"
              innerRadius="62%"
              outerRadius="95%"
              barSize={20}
              data={gaugeData}
              startAngle={210}
              endAngle={-30}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar background={{ fill: "#e2e8f0" }} dataKey="value" cornerRadius={12} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-4">
            <span className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {after.toFixed(1)}%
            </span>
            <span
              className="mt-1 rounded-full px-3 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {classification}
            </span>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

// 13. Treemap - Categorical data distribution
function TreemapContent(props: any) {
  const { x, y, width, height, name, size, fill } = props;
  if (width < 28 || height < 22) return null;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        ry={6}
        style={{ fill: fill || "#4F46E5", stroke: "#ffffff", strokeWidth: 2 }}
      />
      {width > 65 && height > 38 && (
        <>
          <text x={x + 8} y={y + 20} fill="#ffffff" fontSize={11} fontWeight={600}>
            {String(name).slice(0, 16)}
          </text>
          <text x={x + 8} y={y + 35} fill="#e2e8f0" fontSize={10}>
            {Number(size).toLocaleString()}
          </text>
        </>
      )}
    </g>
  );
}

export function CategoricalTreemapChart({
  data,
  categories,
  selectedCategory,
  onSelectCategory,
}: {
  data: { name: string; size: number; fill: string }[];
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory?: (col: string) => void;
}) {
  return (
    <ChartCard
      title="Categorical Distribution Treemap"
      subtitle={selectedCategory ? `Breakdown by ${selectedCategory}` : "No categorical columns"}
      filename="categorical-treemap"
      headerControls={
        categories.length > 0 && onSelectCategory ? (
          <select
            value={selectedCategory || ""}
            onChange={(e) => onSelectCategory(e.target.value)}
            aria-label="Select categorical column"
            className="h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 text-xs text-slate-700 dark:text-slate-200"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : null
      }
    >
      {() =>
        data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={data}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="#fff"
              content={<TreemapContent />}
            >
              <Tooltip content={<CustomTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            No categorical columns detected in this dataset.
          </div>
        )
      }
    </ChartCard>
  );
}

// 16. Area Chart - Data quality improvement across cleaning stages
export function QualityStageAreaChart({ data }: { data: any[] }) {
  const pal = useChartPalette();
  return (
    <ChartCard
      title="Quality Progression Across Stages"
      subtitle="Multi-dimension improvement area curve"
      filename="quality-stage-area"
    >
      {() => (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="gradIndigo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradCyan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={pal.grid} />
            <XAxis dataKey="stage" tick={{ fill: pal.tick, fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: pal.tick, fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Area
              type="monotone"
              dataKey="overall_score"
              name="Overall Score"
              stroke="#4F46E5"
              strokeWidth={2.5}
              fill="url(#gradIndigo)"
            />
            <Area
              type="monotone"
              dataKey="consistency"
              name="Consistency"
              stroke="#06B6D4"
              strokeWidth={2}
              fill="url(#gradCyan)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
