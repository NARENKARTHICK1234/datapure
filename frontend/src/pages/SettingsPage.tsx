import React, { useEffect, useState } from "react";
import { BookOpen, Moon, Save, Sun } from "lucide-react";
import { useDataset } from "../context/DatasetContext";
import { useTheme } from "../context/ThemeContext";
import { api } from "../lib/api";
import { Button, Card } from "../components/ui/Primitives";

export function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { addToast, bumpRevision } = useDataset();
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      bumpRevision();
      addToast({ type: "success", title: "Settings Saved", description: "Profiling & cleaning defaults updated." });
    } catch (err: any) {
      addToast({ type: "error", title: "Save failed", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings &amp; Documentation</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configure appearance, outlier sensitivity, data quality thresholds, and review methodology.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-5">
          <h3 className="text-base font-semibold">Workspace Preferences &amp; Engine Defaults</h3>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div>
              <p className="text-sm font-medium">Color Theme</p>
              <p className="text-xs text-slate-500">Switch between Light Slate and Dark Analytics mode</p>
            </div>
            <Button variant="outline" onClick={toggleTheme}>
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-400" />}
              {theme === "light" ? "Dark Mode" : "Light Mode"}
            </Button>
          </div>

          {settings && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Default Outlier Method</label>
                  <select
                    value={settings.outlier_method}
                    onChange={(e) => setSettings({ ...settings, outlier_method: e.target.value })}
                    className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs"
                  >
                    <option value="iqr">IQR Fence</option>
                    <option value="zscore">Z-Score</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">IQR Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.iqr_multiplier}
                    onChange={(e) => setSettings({ ...settings, iqr_multiplier: Number(e.target.value) })}
                    className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Z-Score Threshold (σ)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.zscore_threshold}
                    onChange={(e) => setSettings({ ...settings, zscore_threshold: Number(e.target.value) })}
                    className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Standard Date Format</label>
                  <select
                    value={settings.date_format}
                    onChange={(e) => setSettings({ ...settings, date_format: e.target.value })}
                    className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs"
                  >
                    <option value="%Y-%m-%d">YYYY-MM-DD</option>
                    <option value="%m/%d/%Y">MM/DD/YYYY</option>
                    <option value="%d-%m-%Y">DD-MM-YYYY</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Default Numeric Imputation</label>
                  <select
                    value={settings.default_numeric_imputation}
                    onChange={(e) => setSettings({ ...settings, default_numeric_imputation: e.target.value })}
                    className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs"
                  >
                    <option value="median">Median</option>
                    <option value="mean">Mean</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Excellent Quality Cutoff (%)</label>
                  <input
                    type="number"
                    value={settings.quality_excellent_min}
                    onChange={(e) => setSettings({ ...settings, quality_excellent_min: Number(e.target.value) })}
                    className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs"
                  />
                </div>
              </div>

              <Button variant="primary" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Engine Settings"}
              </Button>
            </div>
          )}
        </Card>

        {/* Help & Documentation */}
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-semibold">Help &amp; Quality Score Documentation</h3>
          </div>
          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
              <p className="font-semibold text-slate-900 dark:text-white">Data Quality Score Formula</p>
              <p className="mt-1 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                Overall Score = (Completeness + Uniqueness + Validity + Consistency) / 4
              </p>
              <ul className="mt-2 space-y-1 list-disc pl-4">
                <li><strong>Completeness:</strong> 100 × (1 − missing_cells / total_cells)</li>
                <li><strong>Uniqueness:</strong> 100 × (1 − duplicate_rows / total_rows)</li>
                <li><strong>Validity:</strong> 100 × (1 − invalid_domain_cells / validated_cells)</li>
                <li><strong>Consistency:</strong> 100 × (1 − format_or_casing_inconsistencies / applicable_cells)</li>
              </ul>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
              <p className="font-semibold text-slate-900 dark:text-white">Data Integrity &amp; Non-Destructive Guarantee</p>
              <p className="mt-1">
                Every uploaded dataset is locked as immutable snapshot <code>v0</code>. Cleaning operations create
                incremental versions (<code>v1, v2, ...</code>) with stable row identifiers so Before vs After comparisons,
                Undo/Redo, and full version restoration remain exact.
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
              <p className="font-semibold text-slate-900 dark:text-white">Structural Validation vs Factual Accuracy</p>
              <p className="mt-1">
                Pandera and regex validation verify schema contracts, data types, ranges, and formatting conventions.
                Passing structural validation confirms structural integrity and does not guarantee real-world factual truth.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
