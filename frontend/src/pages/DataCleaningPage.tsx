import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Play,
  Redo2,
  RotateCcw,
  Sparkles,
  Undo2,
  Wrench,
} from "lucide-react";
import { useDataset } from "../context/DatasetContext";
import { api } from "../lib/api";
import { Badge, Button, Card, EmptyState, Skeleton } from "../components/ui/Primitives";
import { ConfirmDialog } from "../components/shared/ConfirmDialog";
import type { CleaningOperation, ProfileResponse } from "../types";

const OP_LABELS: Record<string, string> = {
  remove_empty_rows: "Remove Empty Rows",
  remove_duplicates: "Remove Duplicate Records",
  trim_whitespace: "Trim & Collapse Whitespace",
  standardize_case: "Standardize Capitalization",
  impute_missing: "Impute Missing Values",
  standardize_dates: "Standardize Date Formats",
  normalize_emails: "Normalize & Validate Emails",
  normalize_phones: "Normalize Phone Numbers",
  convert_dtype: "Convert Data Type",
  handle_outliers: "Detect & Handle Outliers",
  replace_invalid: "Correct / Nullify Invalid Values",
};

export function DataCleaningPage() {
  const { activeDataset, setActivePage, refreshDatasets, dataRevision, bumpRevision, addToast } = useDataset();

  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [autoOps, setAutoOps] = useState<CleaningOperation[]>([]);
  const [selectedAutoIdx, setSelectedAutoIdx] = useState<number[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Manual builder state
  const [manualOpType, setManualOpType] = useState<CleaningOperation["op_type"]>("trim_whitespace");
  const [manualCols, setManualCols] = useState<string[]>([]);
  const [manualStrategy, setManualStrategy] = useState("median");
  const [manualCustomVal, setManualCustomVal] = useState("");
  const [manualCaseStyle, setManualCaseStyle] = useState("title");
  const [manualDateFmt, setManualDateFmt] = useState("%Y-%m-%d");
  const [manualTargetType, setManualTargetType] = useState("numeric");
  const [manualOutlierMethod, setManualOutlierMethod] = useState("iqr");
  const [manualOutlierAction, setManualOutlierAction] = useState("cap");
  const [manualMinVal, setManualMinVal] = useState("");
  const [manualMaxVal, setManualMaxVal] = useState("");
  const [manualReplaceAction, setManualReplaceAction] = useState("nullify");

  useEffect(() => {
    if (!activeDataset) return;
    let active = true;
    setLoadingPlan(true);
    Promise.all([
      api.getProfile(activeDataset.id),
      api.getAutoCleanPlan(activeDataset.id),
    ])
      .then(([prof, plan]) => {
        if (!active) return;
        setProfile(prof);
        setAutoOps(plan.operations);
        setSelectedAutoIdx(plan.operations.map((_, i) => i));
        setPreview(plan.preview);
      })
      .catch((err) => {
        if (active) addToast({ type: "error", title: "Failed to analyze cleaning plan", description: err.message });
      })
      .finally(() => {
        if (active) setLoadingPlan(false);
      });
    return () => {
      active = false;
    };
  }, [activeDataset?.id, activeDataset?.current_version, dataRevision, addToast]);

  const buildManualOperation = (): CleaningOperation => {
    const params: Record<string, any> = {};
    if (manualOpType === "impute_missing") {
      params.strategy = manualStrategy;
      if (manualStrategy === "custom") params.custom_value = manualCustomVal;
    } else if (manualOpType === "standardize_case") {
      params.case_style = manualCaseStyle;
    } else if (manualOpType === "standardize_dates") {
      params.format = manualDateFmt;
      params.flag_invalid_as_null = true;
    } else if (manualOpType === "convert_dtype") {
      params.target_type = manualTargetType;
    } else if (manualOpType === "handle_outliers") {
      params.method = manualOutlierMethod;
      params.action = manualOutlierAction;
    } else if (manualOpType === "replace_invalid") {
      params.action = manualReplaceAction;
      if (manualReplaceAction === "replace") params.replacement = manualCustomVal;
      if (manualMinVal !== "") params.min_val = Number(manualMinVal);
      if (manualMaxVal !== "") params.max_val = Number(manualMaxVal);
    } else if (manualOpType === "normalize_emails" || manualOpType === "normalize_phones") {
      params.flag_invalid_as_null = true;
    } else if (manualOpType === "remove_duplicates") {
      params.keep = "first";
    }
    return { op_type: manualOpType, columns: manualCols, params };
  };

  const getActiveOperations = (): CleaningOperation[] => {
    if (mode === "auto") {
      return autoOps.filter((_, i) => selectedAutoIdx.includes(i));
    }
    return [buildManualOperation()];
  };

  const handlePreview = async () => {
    if (!activeDataset) return;
    const ops = getActiveOperations();
    if (ops.length === 0) {
      addToast({ type: "warning", title: "Select at least one operation" });
      return;
    }
    setPreviewing(true);
    try {
      const res = await api.previewClean(activeDataset.id, ops, mode);
      setPreview(res);
    } catch (err: any) {
      addToast({ type: "error", title: "Preview failed", description: err.message });
    } finally {
      setPreviewing(false);
    }
  };

  const handleApply = async (confirmDestructive: boolean) => {
    if (!activeDataset) return;
    const ops = getActiveOperations();
    if (ops.length === 0) return;

    setApplying(true);
    try {
      const res = await api.applyClean(activeDataset.id, ops, mode, confirmDestructive);
      await refreshDatasets(activeDataset.id);
      bumpRevision();
      setConfirmOpen(false);
      addToast({
        type: "success",
        title: `Cleaned to Version v${res.version}`,
        description: `Modified ${res.modified_cells_count.toLocaleString()} cells, removed ${res.rows_removed.toLocaleString()} rows.`,
      });
    } catch (err: any) {
      if (err.message.includes("Confirmation required")) {
        setConfirmOpen(true);
      } else {
        addToast({ type: "error", title: "Cleaning failed", description: err.message });
      }
    } finally {
      setApplying(false);
    }
  };

  const handleHistoryAction = async (action: "undo" | "redo" | "reset") => {
    if (!activeDataset) return;
    try {
      const res =
        action === "undo"
          ? await api.undo(activeDataset.id)
          : action === "redo"
          ? await api.redo(activeDataset.id)
          : await api.reset(activeDataset.id);
      await refreshDatasets(res.dataset.id);
      bumpRevision();
      addToast({
        type: "info",
        title: `Version updated to v${res.dataset.current_version}`,
      });
    } catch (err: any) {
      addToast({ type: "warning", title: "Action unavailable", description: err.message });
    }
  };

  if (!activeDataset) {
    return (
      <EmptyState
        icon={<Sparkles className="h-7 w-7" />}
        title="No Dataset Selected"
        description="Upload a dataset or load the synthetic sample dataset to start cleaning."
        action={<Button onClick={() => setActivePage("upload")}>Upload Dataset</Button>}
      />
    );
  }

  const cols = profile?.columns.map((c) => c.name) || [];

  return (
    <div className="space-y-6">
      {/* Header & Version Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Data Cleaning Engine</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Preview changes before applying. Active version: <strong>v{activeDataset.current_version}</strong> (max v{activeDataset.max_version}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={activeDataset.current_version <= 0}
            onClick={() => handleHistoryAction("undo")}
          >
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={activeDataset.current_version >= activeDataset.max_version}
            onClick={() => handleHistoryAction("redo")}
          >
            <Redo2 className="h-3.5 w-3.5" /> Redo
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={activeDataset.current_version === 0}
            onClick={() => handleHistoryAction("reset")}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset to Raw v0
          </Button>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
        <button
          type="button"
          onClick={() => setMode("auto")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            mode === "auto"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" /> Automatic Cleaning
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            mode === "manual"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Wrench className="h-3.5 w-3.5" /> Manual Column Cleaning
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Operations Config */}
        <Card className="lg:col-span-5 space-y-4">
          {mode === "auto" ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Recommended Pipeline</h3>
                <Badge variant="primary">{selectedAutoIdx.length}/{autoOps.length} selected</Badge>
              </div>
              {loadingPlan ? (
                <Skeleton className="h-48 w-full" />
              ) : autoOps.length === 0 ? (
                <div className="py-10 text-center text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                  Dataset is already clean! No automatic operations needed.
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {autoOps.map((op, idx) => {
                    const checked = selectedAutoIdx.includes(idx);
                    return (
                      <label
                        key={idx}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs transition ${
                          checked
                            ? "border-indigo-300 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/30"
                            : "border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedAutoIdx((prev) =>
                              prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                            )
                          }
                          className="mt-0.5 rounded border-slate-300 text-indigo-600"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {OP_LABELS[op.op_type] || op.op_type}
                          </p>
                          <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                            {op.columns.length > 0 ? `Columns: ${op.columns.join(", ")}` : "Applies to entire table"}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <h3 className="text-base font-semibold">Manual Operation Builder</h3>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Cleaning Operation
                </label>
                <select
                  value={manualOpType}
                  onChange={(e) => setManualOpType(e.target.value as CleaningOperation["op_type"])}
                  className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs"
                >
                  {Object.entries(OP_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {manualOpType !== "remove_empty_rows" && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      Target Columns ({manualCols.length === 0 ? "All Columns" : `${manualCols.length} selected`})
                    </label>
                    {manualCols.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setManualCols([])}
                        className="text-[11px] text-indigo-600 hover:underline"
                      >
                        Reset to All
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 p-2">
                    {cols.map((c) => (
                      <label key={c} className="flex items-center gap-1.5 text-xs cursor-pointer truncate">
                        <input
                          type="checkbox"
                          checked={manualCols.includes(c)}
                          onChange={() =>
                            setManualCols((prev) =>
                              prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                            )
                          }
                          className="rounded border-slate-300 text-indigo-600"
                        />
                        <span className="truncate">{c}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Contextual Parameters */}
              {manualOpType === "impute_missing" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Strategy</label>
                    <select
                      value={manualStrategy}
                      onChange={(e) => setManualStrategy(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
                    >
                      <option value="median">Median</option>
                      <option value="mean">Mean</option>
                      <option value="mode">Mode</option>
                      <option value="custom">Custom Value</option>
                    </select>
                  </div>
                  {manualStrategy === "custom" && (
                    <div>
                      <label className="block text-xs font-medium mb-1">Custom Value</label>
                      <input
                        type="text"
                        value={manualCustomVal}
                        onChange={(e) => setManualCustomVal(e.target.value)}
                        placeholder="e.g. Unknown or 0"
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
                      />
                    </div>
                  )}
                </div>
              )}

              {manualOpType === "standardize_case" && (
                <div>
                  <label className="block text-xs font-medium mb-1">Case Style</label>
                  <select
                    value={manualCaseStyle}
                    onChange={(e) => setManualCaseStyle(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
                  >
                    <option value="title">Title Case</option>
                    <option value="lower">lowercase</option>
                    <option value="upper">UPPERCASE</option>
                  </select>
                </div>
              )}

              {manualOpType === "standardize_dates" && (
                <div>
                  <label className="block text-xs font-medium mb-1">Target Format</label>
                  <select
                    value={manualDateFmt}
                    onChange={(e) => setManualDateFmt(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
                  >
                    <option value="%Y-%m-%d">YYYY-MM-DD (ISO)</option>
                    <option value="%m/%d/%Y">MM/DD/YYYY</option>
                    <option value="%d-%m-%Y">DD-MM-YYYY</option>
                  </select>
                </div>
              )}

              {manualOpType === "convert_dtype" && (
                <div>
                  <label className="block text-xs font-medium mb-1">Target Data Type</label>
                  <select
                    value={manualTargetType}
                    onChange={(e) => setManualTargetType(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
                  >
                    <option value="numeric">Numeric (Float)</option>
                    <option value="int">Integer (Rounded)</option>
                    <option value="string">String</option>
                    <option value="datetime">Date (YYYY-MM-DD)</option>
                  </select>
                </div>
              )}

              {manualOpType === "handle_outliers" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Detection Method</label>
                    <select
                      value={manualOutlierMethod}
                      onChange={(e) => setManualOutlierMethod(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
                    >
                      <option value="iqr">IQR (1.5x)</option>
                      <option value="zscore">Z-Score (3.0σ)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Action</label>
                    <select
                      value={manualOutlierAction}
                      onChange={(e) => setManualOutlierAction(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
                    >
                      <option value="cap">Cap at Bounds (Safe)</option>
                      <option value="remove">Remove Rows (Destructive)</option>
                    </select>
                  </div>
                </div>
              )}

              {manualOpType === "replace_invalid" && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">Action</label>
                    <select
                      value={manualReplaceAction}
                      onChange={(e) => setManualReplaceAction(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs"
                    >
                      <option value="nullify">Set Null</option>
                      <option value="replace">Replace</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Min Valid</label>
                    <input
                      type="number"
                      value={manualMinVal}
                      onChange={(e) => setManualMinVal(e.target.value)}
                      placeholder="Optional"
                      className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Max Valid</label>
                    <input
                      type="number"
                      value={manualMaxVal}
                      onChange={(e) => setManualMaxVal(e.target.value)}
                      placeholder="Optional"
                      className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={handlePreview} disabled={previewing || applying}>
              <Eye className="h-4 w-4" />
              {previewing ? "Simulating..." : "Preview Changes"}
            </Button>
            <Button
              variant="primary"
              onClick={() => handleApply(false)}
              disabled={applying || (mode === "auto" && selectedAutoIdx.length === 0)}
            >
              <Play className="h-4 w-4" />
              {applying ? "Applying..." : "Apply Cleaning"}
            </Button>
          </div>
        </Card>

        {/* Right: Live Diff Preview */}
        <Card className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Cleaning Impact Preview
              </h3>
              <p className="text-xs text-slate-500">
                Simulated diff before committing a new version
              </p>
            </div>
            {preview?.requires_confirmation && (
              <Badge variant="warning">
                <AlertTriangle className="h-3 w-3" /> Confirmation Required
              </Badge>
            )}
          </div>

          {preview ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                  <p className="text-[11px] text-slate-500">Modified Cells</p>
                  <p className="mt-0.5 text-lg font-bold text-indigo-600">
                    {preview.modified_cells_count.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                  <p className="text-[11px] text-slate-500">Rows Removed</p>
                  <p className="mt-0.5 text-lg font-bold text-red-600">
                    {preview.rows_removed.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                  <p className="text-[11px] text-slate-500">Score Before</p>
                  <p className="mt-0.5 text-lg font-bold text-slate-700 dark:text-slate-200">
                    {preview.quality_before.overall_score}%
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 p-3">
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Projected Score</p>
                  <p className="mt-0.5 text-lg font-bold text-emerald-600">
                    {preview.quality_after.overall_score}%
                  </p>
                </div>
              </div>

              {preview.sample_changes && preview.sample_changes.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-[300px]">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Row ID</th>
                        <th className="px-3 py-2 font-semibold">Column</th>
                        <th className="px-3 py-2 font-semibold">Before</th>
                        <th className="px-3 py-2 font-semibold">After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {preview.sample_changes.map((chg: any, i: number) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-mono text-slate-400">#{chg.row_id + 1}</td>
                          <td className="px-3 py-2 font-medium">{chg.column}</td>
                          <td className="px-3 py-2 text-red-600 dark:text-red-400 line-through">
                            {chg.before === null ? "NULL" : String(chg.before)}
                          </td>
                          <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-medium">
                            {chg.after === null ? "NULL" : String(chg.after)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-500">
                  {preview.rows_removed > 0
                    ? `${preview.rows_removed.toLocaleString()} duplicate/empty rows will be removed; no individual cell text changes in remaining rows.`
                    : "No cell modifications detected for the selected operation."}
                </div>
              )}
            </>
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Record Deletion / Destructive Cleaning"
        description="One or more selected cleaning operations will permanently remove rows from the new dataset version. Your raw v0 dataset remains preserved and you can Undo anytime."
        bullets={preview?.destructive_reasons || []}
        confirmLabel="Confirm & Clean"
        loading={applying}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => handleApply(true)}
      />
    </div>
  );
}
