import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, GitCompare, Search } from "lucide-react";
import { useDataset } from "../context/DatasetContext";
import { api } from "../lib/api";
import { Badge, Button, Card, EmptyState, Skeleton } from "../components/ui/Primitives";
import {
  BeforeAfterGroupedBarChart,
  QualityDimensionsRadarChart,
} from "../components/charts/RechartsCharts";

export function ComparisonPage() {
  const { activeDataset, setActivePage, dataRevision, addToast } = useDataset();
  const [cmp, setCmp] = useState<any>(null);
  const [viz, setViz] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!activeDataset) return;
    let active = true;
    setLoading(true);
    Promise.all([
      api.getComparison(activeDataset.id, { page, page_size: 20, filter_status: filterStatus, search }),
      api.getVisualizations(activeDataset.id),
    ])
      .then(([cRes, vRes]) => {
        if (!active) return;
        setCmp(cRes);
        setViz(vRes);
      })
      .catch((err) => {
        if (active) addToast({ type: "error", title: "Comparison failed", description: err.message });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeDataset?.id, activeDataset?.current_version, dataRevision, page, filterStatus, search, addToast]);

  if (!activeDataset) {
    return (
      <EmptyState
        icon={<GitCompare className="h-7 w-7" />}
        title="No Dataset Selected"
        description="Upload a dataset and run cleaning operations to compare raw v0 against the cleaned version."
        action={<Button onClick={() => setActivePage("upload")}>Upload Dataset</Button>}
      />
    );
  }

  if (loading && !cmp) {
    return <Skeleton className="h-96 w-full" />;
  }

  const m = cmp?.metrics;
  const cols: string[] = cmp?.columns || [];
  const rows: any[] = cmp?.rows || [];
  const pag = cmp?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Before vs After Comparison</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Side-by-side record audit comparing Raw v0 with Active Version v{activeDataset.current_version} via stable row IDs.
        </p>
      </div>

      {m && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Card className="p-4">
            <p className="text-xs text-slate-500">Missing Reduction</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">{m.missing_reduction_pct}%</p>
            <p className="text-[11px] text-slate-400">{m.missing_before.toLocaleString()} → {m.missing_after.toLocaleString()}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">Duplicate Reduction</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">{m.duplicate_reduction_pct}%</p>
            <p className="text-[11px] text-slate-400">{m.duplicates_before.toLocaleString()} → {m.duplicates_after.toLocaleString()}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">Invalid Reduction</p>
            <p className="mt-1 text-xl font-bold text-indigo-600">{m.invalid_reduction_pct}%</p>
            <p className="text-[11px] text-slate-400">{m.invalid_before.toLocaleString()} → {m.invalid_after.toLocaleString()}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">Modified Cells</p>
            <p className="mt-1 text-xl font-bold text-cyan-600">{m.modified_cells.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400">Across {m.modified_rows.toLocaleString()} rows</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">Record Retention</p>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{m.retention_percentage}%</p>
            <p className="text-[11px] text-slate-400">{m.rows_removed.toLocaleString()} removed</p>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-indigo-50/80 to-emerald-50/70 dark:from-indigo-950/30 dark:to-emerald-950/30">
            <p className="text-xs text-slate-600 dark:text-slate-300">Quality Gain</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">
              {m.quality_gain >= 0 ? "+" : ""}
              {m.quality_gain} pts
            </p>
            <p className="text-[11px] text-slate-500">{m.quality_before}% → {m.quality_after}%</p>
          </Card>
        </div>
      )}

      {viz?.charts && (
        <div className="grid gap-6 lg:grid-cols-2">
          <BeforeAfterGroupedBarChart data={viz.charts.grouped_before_after} />
          <QualityDimensionsRadarChart data={viz.charts.radar_dimensions} />
        </div>
      )}

      {/* Side-by-Side Comparison Table */}
      <Card className="p-0 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold">Side-by-Side Record Diff</h3>
            <p className="text-xs text-slate-500">
              Green cells show updated values; red rows indicate records removed during cleaning.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search records..."
                className="h-8 w-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-3 text-xs"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              aria-label="Filter diff status"
              className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs"
            >
              <option value="all">All Records</option>
              <option value="modified">Modified Only</option>
              <option value="removed">Removed Only</option>
              <option value="unchanged">Unchanged Only</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="px-3 py-2.5 font-semibold">Row ID</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                {cols.slice(0, 7).map((col) => (
                  <th key={col} className="px-3 py-2.5 font-semibold whitespace-nowrap">
                    {col} (Raw → Clean)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <tr
                  key={r.row_id}
                  className={
                    r.status === "removed"
                      ? "bg-red-50/60 dark:bg-red-950/20"
                      : r.status === "modified"
                      ? "bg-indigo-50/25 dark:bg-indigo-950/15"
                      : ""
                  }
                >
                  <td className="px-3 py-2 font-mono text-slate-400">#{r.row_id + 1}</td>
                  <td className="px-3 py-2">
                    {r.status === "removed" && <Badge variant="error">Removed</Badge>}
                    {r.status === "modified" && <Badge variant="primary">Modified</Badge>}
                    {r.status === "unchanged" && <Badge variant="neutral">Unchanged</Badge>}
                  </td>
                  {cols.slice(0, 7).map((col) => {
                    const isMod = r.modified_columns.includes(col);
                    const rawVal = r.raw[col];
                    const cleanVal = r.cleaned ? r.cleaned[col] : null;
                    return (
                      <td key={col} className="px-3 py-2 max-w-[200px]">
                        {r.status === "removed" ? (
                          <span className="line-through text-red-600 dark:text-red-400">
                            {rawVal === null ? "NULL" : String(rawVal)}
                          </span>
                        ) : isMod ? (
                          <div className="space-y-0.5 rounded-md bg-emerald-50/90 dark:bg-emerald-950/40 px-2 py-1 border border-emerald-200/80 dark:border-emerald-800/70">
                            <div className="text-[10px] text-red-500 line-through truncate">
                              {rawVal === null ? "NULL" : String(rawVal)}
                            </div>
                            <div className="font-semibold text-emerald-700 dark:text-emerald-300 truncate">
                              {cleanVal === null ? "NULL" : String(cleanVal)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600 dark:text-slate-300 truncate block">
                            {cleanVal === null ? "NULL" : String(cleanVal)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pag && (
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs text-slate-500">
            <span>
              Page <strong>{pag.page}</strong> of <strong>{pag.total_pages}</strong> ({pag.total.toLocaleString()} records)
            </span>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <Button size="sm" variant="outline" disabled={page >= pag.total_pages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
