import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Database, Search, Sparkles } from "lucide-react";
import { useDataset } from "../context/DatasetContext";
import { api } from "../lib/api";
import { formatNumber } from "../lib/utils";
import { Badge, Button, Card, EmptyState, Skeleton } from "../components/ui/Primitives";
import { MissingByColumnBarChart } from "../components/charts/RechartsCharts";
import type { ProfileResponse } from "../types";

export function DataProfilingPage() {
  const { activeDataset, setActivePage, dataRevision, addToast } = useDataset();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortField, setSortField] = useState<"name" | "missing_percentage" | "unique_count" | "outliers_count">("missing_percentage");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    if (!activeDataset) return;
    let active = true;
    setLoading(true);
    api
      .getProfile(activeDataset.id)
      .then((res) => {
        if (active) setProfile(res);
      })
      .catch((err) => {
        if (active) addToast({ type: "error", title: "Profiling error", description: err.message });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeDataset?.id, activeDataset?.current_version, dataRevision, addToast]);

  const filteredCols = useMemo(() => {
    if (!profile) return [];
    const q = search.trim().toLowerCase();
    return [...profile.columns]
      .filter((c) => {
        if (roleFilter !== "all" && c.semantic_role !== roleFilter) return false;
        if (q && !c.name.toLowerCase().includes(q) && !c.issues.join(" ").toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const av = a[sortField];
        const bv = b[sortField];
        if (typeof av === "string" && typeof bv === "string") {
          return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
      });
  }, [profile, search, roleFilter, sortField, sortAsc]);

  if (!activeDataset) {
    return (
      <EmptyState
        icon={<Database className="h-7 w-7" />}
        title="No Dataset Selected"
        description="Upload a dataset or load the sample customer dataset to run column-level profiling."
        action={<Button onClick={() => setActivePage("upload")}>Upload Dataset</Button>}
      />
    );
  }

  if (loading && !profile) {
    return <Skeleton className="h-96 w-full" />;
  }

  const s = profile?.summary;
  const roles = Array.from(new Set((profile?.columns || []).map((c) => c.semantic_role)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Data Profiling &amp; Issue Analysis</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Automated detection of missing values, duplicates, invalid emails/phones/dates, outliers, and type mismatches.
          </p>
        </div>
        <Button variant="primary" onClick={() => setActivePage("cleaning")}>
          <Sparkles className="h-4 w-4" /> Proceed to Cleaning
        </Button>
      </div>

      {s && (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-6">
          {[
            { label: "Missing Cells", val: s.missing_values, variant: s.missing_values > 0 ? "warning" : "success" },
            { label: "Duplicate Rows", val: s.duplicate_rows, variant: s.duplicate_rows > 0 ? "error" : "success" },
            { label: "Empty Rows", val: s.empty_rows, variant: s.empty_rows > 0 ? "error" : "success" },
            { label: "Invalid Emails / Phones / Dates", val: (s.invalid_emails || 0) + (s.invalid_phones || 0) + (s.invalid_dates || 0), variant: "warning" },
            { label: "Outliers Detected", val: s.outliers_detected, variant: s.outliers_detected > 0 ? "primary" : "success" },
            { label: "Whitespace & Format Issues", val: s.whitespace_issues + s.inconsistent_formats, variant: "cyan" },
          ].map((item) => (
            <Card key={item.label} className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  {item.val.toLocaleString()}
                </span>
                <Badge variant={item.variant as any}>{item.val === 0 ? "Clean" : "Detected"}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Column-Level Statistics Table */}
      <Card className="p-0 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Column-Level Statistics &amp; Diagnostics
            </h3>
            <p className="text-xs text-slate-500">
              {filteredCols.length} of {profile?.columns.length || 0} columns shown
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search columns or issues..."
                className="h-8 w-52 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-3 text-xs"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filter semantic role"
              className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs"
            >
              <option value="all">All Roles</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300">
                <th
                  onClick={() => {
                    setSortField("name");
                    setSortAsc((a) => !a);
                  }}
                  className="cursor-pointer px-4 py-3 font-semibold"
                >
                  <span className="inline-flex items-center gap-1">Column <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="px-3 py-3 font-semibold">Role / Type</th>
                <th
                  onClick={() => {
                    setSortField("missing_percentage");
                    setSortAsc((a) => !a);
                  }}
                  className="cursor-pointer px-3 py-3 font-semibold"
                >
                  <span className="inline-flex items-center gap-1">Missing % <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th
                  onClick={() => {
                    setSortField("unique_count");
                    setSortAsc((a) => !a);
                  }}
                  className="cursor-pointer px-3 py-3 font-semibold"
                >
                  <span className="inline-flex items-center gap-1">Unique <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="px-3 py-3 font-semibold">Mean / Median</th>
                <th className="px-3 py-3 font-semibold">Min / Max</th>
                <th className="px-3 py-3 font-semibold">Std Dev</th>
                <th
                  onClick={() => {
                    setSortField("outliers_count");
                    setSortAsc((a) => !a);
                  }}
                  className="cursor-pointer px-3 py-3 font-semibold"
                >
                  <span className="inline-flex items-center gap-1">Outliers <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="px-4 py-3 font-semibold">Detected Issues &amp; Samples</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCols.map((c) => (
                <tr key={c.name} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {c.name}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="primary">{c.semantic_role}</Badge>
                      <span className="text-[11px] text-slate-400">{c.dtype}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className={c.missing_percentage > 0 ? "font-semibold text-amber-600" : "text-emerald-600"}>
                      {c.missing_percentage}% ({c.missing_count})
                    </span>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{c.unique_count.toLocaleString()}</td>
                  <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                    {c.stats.mean !== null ? `${formatNumber(c.stats.mean, 2)} / ${formatNumber(c.stats.median, 2)}` : "—"}
                  </td>
                  <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                    {c.stats.min !== null ? `${formatNumber(c.stats.min, 1)} .. ${formatNumber(c.stats.max, 1)}` : "—"}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {c.stats.std !== null ? formatNumber(c.stats.std, 2) : "—"}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {c.outliers_count > 0 ? (
                      <Badge variant="warning">{c.outliers_count}</Badge>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 mb-1">
                      {c.issues.length === 0 ? (
                        <Badge variant="success">No issues</Badge>
                      ) : (
                        c.issues.map((iss, idx) => (
                          <Badge key={idx} variant="error">
                            {iss}
                          </Badge>
                        ))
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate max-w-xs">
                      Samples: {c.sample_values.slice(0, 3).map((v) => String(v ?? "null")).join(", ")}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {profile && (
        <MissingByColumnBarChart
          data={[...profile.columns]
            .sort((a, b) => b.missing_count - a.missing_count)
            .map((c) => ({
              column: c.name,
              missing: c.missing_count,
              missing_pct: c.missing_percentage,
            }))}
        />
      )}
    </div>
  );
}
