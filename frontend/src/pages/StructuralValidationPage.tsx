import React, { useEffect, useState } from "react";
import { CheckCircle2, Play, Plus, ShieldAlert, ShieldCheck, Trash2, AlertTriangle } from "lucide-react";
import { useDataset } from "../context/DatasetContext";
import { api } from "../lib/api";
import { Badge, Button, Card, EmptyState } from "../components/ui/Primitives";
import type { ValidationRule, ValidationRunResponse } from "../types";

const RULE_TYPES = [
  { value: "required_column", label: "Required Column" },
  { value: "dtype", label: "Data Type (Pandera)" },
  { value: "unique", label: "Unique ID" },
  { value: "not_null", label: "Mandatory (Not Null)" },
  { value: "min_max", label: "Min / Max Range" },
  { value: "email", label: "Email Format" },
  { value: "phone", label: "Phone Format" },
  { value: "date", label: "Date Parseable" },
  { value: "regex", label: "Regular Expression" },
  { value: "allowed_values", label: "Allowed Categorical Values" },
  { value: "custom_expression", label: "Custom Constraint" },
];

export function StructuralValidationPage() {
  const { activeDataset, setActivePage, dataRevision, addToast } = useDataset();
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [runResult, setRunResult] = useState<ValidationRunResponse | null>(null);
  const [running, setRunning] = useState(false);

  // New rule builder
  const [ruleName, setRuleName] = useState("");
  const [ruleCol, setRuleCol] = useState("");
  const [ruleType, setRuleType] = useState("not_null");
  const [severity, setSeverity] = useState<"error" | "warning">("error");
  const [paramText, setParamText] = useState("");
  const [minVal, setMinVal] = useState("");
  const [maxVal, setMaxVal] = useState("");
  const [expectedDtype, setExpectedDtype] = useState("numeric");

  const loadRulesAndRun = async () => {
    if (!activeDataset) return;
    setRunning(true);
    try {
      const [dsInfo, rList, vRes] = await Promise.all([
        api.getDataset(activeDataset.id),
        api.listValidationRules(activeDataset.id),
        api.runValidation(activeDataset.id),
      ]);
      setColumns(dsInfo.columns);
      if (dsInfo.columns.length > 0 && !ruleCol) setRuleCol(dsInfo.columns[0]);
      setRules(rList);
      setRunResult(vRes);
    } catch (err: any) {
      addToast({ type: "error", title: "Validation error", description: err.message });
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (activeDataset) {
      loadRulesAndRun();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDataset?.id, activeDataset?.current_version, dataRevision]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDataset || !ruleName.trim()) return;
    const params: Record<string, any> = {};
    if (ruleType === "min_max") {
      if (minVal !== "") params.min = Number(minVal);
      if (maxVal !== "") params.max = Number(maxVal);
    } else if (ruleType === "dtype") {
      params.expected_type = expectedDtype;
    } else if (ruleType === "regex") {
      params.pattern = paramText || ".*";
    } else if (ruleType === "allowed_values") {
      params.values = paramText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (ruleType === "custom_expression") {
      params.mode = "min_length";
      params.length = Number(paramText) || 2;
    }

    try {
      await api.createValidationRule(activeDataset.id, {
        name: ruleName.trim(),
        column_name: ruleCol || null,
        rule_type: ruleType,
        params,
        severity,
        enabled: true,
      });
      setRuleName("");
      setParamText("");
      addToast({ type: "success", title: "Validation rule created" });
      await loadRulesAndRun();
    } catch (err: any) {
      addToast({ type: "error", title: "Failed to add rule", description: err.message });
    }
  };

  const toggleRule = async (r: ValidationRule) => {
    if (!activeDataset) return;
    await api.updateValidationRule(activeDataset.id, r.id, { enabled: !r.enabled });
    await loadRulesAndRun();
  };

  const deleteRule = async (ruleId: number) => {
    if (!activeDataset) return;
    await api.deleteValidationRule(activeDataset.id, ruleId);
    await loadRulesAndRun();
  };

  if (!activeDataset) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-7 w-7" />}
        title="No Dataset Selected"
        description="Upload or load a dataset to configure and run structural validation rules."
        action={<Button onClick={() => setActivePage("upload")}>Upload Dataset</Button>}
      />
    );
  }

  const sum = runResult?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Structural Validation Engine
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Powered by Pandera &amp; custom domain contracts. Evaluates schema, types, uniqueness, ranges, and regex patterns.
          </p>
        </div>
        <Button variant="primary" onClick={loadRulesAndRun} disabled={running}>
          <Play className="h-4 w-4" />
          {running ? "Validating..." : "Re-Run Validation"}
        </Button>
      </div>

      {/* Summary Strip */}
      {sum && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="p-4">
            <p className="text-xs text-slate-500">Rules Evaluated</p>
            <p className="mt-1 text-2xl font-bold">{sum.total_rules}</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-emerald-500">
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Passed</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{sum.passed}</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-red-500">
            <p className="text-xs text-red-600 dark:text-red-400">Failed</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{sum.failed}</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-amber-500">
            <p className="text-xs text-amber-600 dark:text-amber-400">Warnings</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{sum.warnings}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">Schema Pass Rate</p>
            <p className="mt-1 text-2xl font-bold text-indigo-600">{sum.pass_rate}%</p>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Create Rule Form */}
        <Card className="lg:col-span-4 space-y-4">
          <h3 className="text-base font-semibold">Add Validation Rule</h3>
          <form onSubmit={handleCreateRule} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">Rule Name</label>
              <input
                type="text"
                required
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="e.g. Valid Purchase Bounds"
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1">Rule Type</label>
                <select
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs"
                >
                  {RULE_TYPES.map((rt) => (
                    <option key={rt.value} value={rt.value}>
                      {rt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Target Column</label>
                <select
                  value={ruleCol}
                  onChange={(e) => setRuleCol(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs"
                >
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {ruleType === "min_max" && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={minVal}
                  onChange={(e) => setMinVal(e.target.value)}
                  placeholder="Min value"
                  className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
                />
                <input
                  type="number"
                  value={maxVal}
                  onChange={(e) => setMaxVal(e.target.value)}
                  placeholder="Max value"
                  className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
                />
              </div>
            )}

            {ruleType === "dtype" && (
              <select
                value={expectedDtype}
                onChange={(e) => setExpectedDtype(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
              >
                <option value="numeric">numeric</option>
                <option value="string">string</option>
                <option value="datetime">datetime</option>
              </select>
            )}

            {(ruleType === "regex" || ruleType === "allowed_values" || ruleType === "custom_expression") && (
              <input
                type="text"
                value={paramText}
                onChange={(e) => setParamText(e.target.value)}
                placeholder={
                  ruleType === "regex"
                    ? "Regex e.g. ^CUST-\\d+$"
                    : ruleType === "allowed_values"
                    ? "Comma-separated e.g. Active, Inactive, VIP"
                    : "Min string length (e.g. 2)"
                }
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs"
              />
            )}

            <div>
              <label className="block text-xs font-medium mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as "error" | "warning")}
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
              >
                <option value="error">Error (Fail)</option>
                <option value="warning">Warning</option>
              </select>
            </div>

            <Button type="submit" variant="primary" className="w-full">
              <Plus className="h-4 w-4" /> Add Rule
            </Button>
          </form>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <p className="text-xs font-semibold text-slate-500">Configured Rules ({rules.length})</p>
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {rules.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 dark:border-slate-800 px-2.5 py-2 text-xs"
                >
                  <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={() => toggleRule(r)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span className={`truncate ${!r.enabled && "line-through text-slate-400"}`}>{r.name}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => deleteRule(r.id)}
                    className="text-slate-400 hover:text-red-500"
                    aria-label="Delete rule"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Rule Execution Results */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-slate-200 dark:border-slate-800 p-4">
              <h3 className="text-base font-semibold">Validation Summary &amp; Suggested Corrections</h3>
            </div>
            <div className="overflow-x-auto max-h-[380px]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Rule</th>
                    <th className="px-3 py-2.5 font-semibold">Column</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Failures</th>
                    <th className="px-4 py-2.5 font-semibold">Diagnostic &amp; Suggestion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(runResult?.results || []).map((res, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2.5 font-medium">{res.name}</td>
                      <td className="px-3 py-2.5 text-slate-500">{res.column_name || "—"}</td>
                      <td className="px-3 py-2.5">
                        {res.status === "passed" && (
                          <Badge variant="success">
                            <CheckCircle2 className="h-3 w-3" /> Passed
                          </Badge>
                        )}
                        {res.status === "failed" && (
                          <Badge variant="error">
                            <ShieldAlert className="h-3 w-3" /> Failed
                          </Badge>
                        )}
                        {res.status === "warning" && (
                          <Badge variant="warning">
                            <AlertTriangle className="h-3 w-3" /> Warning
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums font-semibold">
                        {res.failing_count.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-slate-700 dark:text-slate-300">{res.message}</p>
                        {res.suggestion && (
                          <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                            Suggestion: {res.suggestion}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Row-Level Error Details */}
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Row-Level Error Details</h3>
                <p className="text-xs text-slate-500">Showing up to 250 sample failing row diagnostics</p>
              </div>
              <Badge variant={runResult?.row_errors.length ? "error" : "success"}>
                {runResult?.row_errors.length || 0} logged errors
              </Badge>
            </div>
            {runResult && runResult.row_errors.length > 0 ? (
              <div className="overflow-x-auto max-h-[300px]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Row ID</th>
                      <th className="px-3 py-2 font-semibold">Column</th>
                      <th className="px-3 py-2 font-semibold">Observed Value</th>
                      <th className="px-4 py-2 font-semibold">Rule Violated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {runResult.row_errors.map((err, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 font-mono text-slate-400">#{err.row_id + 1}</td>
                        <td className="px-3 py-2 font-medium">{err.column}</td>
                        <td className="px-3 py-2 text-red-600 dark:text-red-400 font-mono">
                          {err.value === null ? "NULL" : String(err.value)}
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{err.rule_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-emerald-600 dark:text-emerald-400">
                Zero row-level validation violations detected!
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
