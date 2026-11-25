import React, { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns,
  Filter,
  Search,
} from "lucide-react";
import { api } from "../../lib/api";
import { Skeleton } from "../ui/Primitives";

interface DataTableProps {
  datasetId: string;
  version?: number;
  revision?: number;
  externalSearch?: string;
  pageSize?: number;
  title?: string;
}

export function DataTable({
  datasetId,
  version,
  revision = 0,
  externalSearch = "",
  pageSize = 15,
  title = "Dataset Preview",
}: DataTableProps) {
  const [columns, setColumns] = useState<string[]>([]);
  const [visibleCols, setVisibleCols] = useState<string[]>([]);
  const [showColMenu, setShowColMenu] = useState(false);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState(externalSearch);
  const [sortBy, setSortBy] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterCol, setFilterCol] = useState<string>("");
  const [filterVal, setFilterVal] = useState<string>("");

  useEffect(() => {
    setSearch(externalSearch);
    setPage(1);
  }, [externalSearch]);

  useEffect(() => {
    setPage(1);
  }, [datasetId, version, revision]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getRows(datasetId, {
        version,
        page,
        page_size: pageSize,
        search,
        sort_by: sortBy || undefined,
        sort_dir: sortDir,
        filter_col: filterCol || undefined,
        filter_val: filterVal || undefined,
      })
      .then((res) => {
        if (!active) return;
        setColumns(res.columns);
        setVisibleCols((prev) => {
          const valid = prev.filter((c) => res.columns.includes(c));
          return valid.length > 0 ? valid : res.columns;
        });
        setRows(res.rows);
        setTotalPages(res.pagination.total_pages);
        setTotal(res.pagination.total);
      })
      .catch(() => {
        if (active) setRows([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [datasetId, version, revision, page, pageSize, search, sortBy, sortDir, filterCol, filterVal]);

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  };

  const toggleColVisibility = (col: string) => {
    setVisibleCols((prev) =>
      prev.includes(col)
        ? prev.length > 1
          ? prev.filter((c) => c !== col)
          : prev
        : [...prev, col]
    );
  };

  return (
    <div className="saas-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-800 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {rows.length} of {total.toLocaleString()} matching records
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
              placeholder="Search rows..."
              className="h-8 w-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 pl-8 pr-3 text-xs text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-2 h-8">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={filterCol}
              onChange={(e) => {
                setFilterCol(e.target.value);
                setPage(1);
              }}
              aria-label="Filter column"
              className="bg-transparent text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="">Filter column...</option>
              {columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {filterCol && (
              <input
                type="text"
                value={filterVal}
                onChange={(e) => {
                  setFilterVal(e.target.value);
                  setPage(1);
                }}
                placeholder="Value or __MISSING__"
                className="w-28 bg-transparent border-l border-slate-200 dark:border-slate-700 pl-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColMenu((s) => !s)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Columns className="h-3.5 w-3.5" />
              Columns ({visibleCols.length}/{columns.length})
            </button>
            {showColMenu && (
              <div className="absolute right-0 z-30 mt-1.5 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl max-h-64 overflow-y-auto">
                {columns.map((c) => (
                  <label
                    key={c}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={visibleCols.includes(c)}
                      onChange={() => toggleColVisibility(c)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="truncate text-slate-700 dark:text-slate-200">{c}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            No matching rows found for the current filters.
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                <th className="px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 w-14">#</th>
                {visibleCols.map((col) => (
                  <th
                    key={col}
                    onClick={() => toggleSort(col)}
                    className="cursor-pointer select-none whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    <div className="flex items-center gap-1">
                      <span>{col}</span>
                      {sortBy === col ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3 w-3 text-indigo-600" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-indigo-600" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-35" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {rows.map((r, idx) => (
                <tr
                  key={r._row_id ?? idx}
                  className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors"
                >
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-400">
                    {r._row_id !== undefined ? r._row_id + 1 : idx + 1}
                  </td>
                  {visibleCols.map((col) => {
                    const val = r[col];
                    const isEmpty = val === null || val === undefined || String(val).trim() === "";
                    return (
                      <td
                        key={col}
                        className="max-w-[220px] truncate px-3 py-2 text-slate-700 dark:text-slate-300"
                        title={isEmpty ? "Missing" : String(val)}
                      >
                        {isEmpty ? (
                          <span className="inline-flex rounded bg-amber-100/80 dark:bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                            NULL
                          </span>
                        ) : (
                          String(val)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
        <span>
          Page <strong className="text-slate-800 dark:text-slate-200">{page}</strong> of{" "}
          <strong className="text-slate-800 dark:text-slate-200">{totalPages}</strong>
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
