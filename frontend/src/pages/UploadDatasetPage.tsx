import React, { useRef, useState } from "react";
import {
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Sparkles,
  UploadCloud,
  AlertCircle,
} from "lucide-react";
import { useDataset } from "../context/DatasetContext";
import { api } from "../lib/api";
import { formatBytes } from "../lib/utils";
import { Badge, Button, Card } from "../components/ui/Primitives";
import { DataTable } from "../components/shared/DataTable";

const MAX_MB = 50;
const ALLOWED_EXTS = [".csv", ".xlsx", ".xls", ".json"];

export function UploadDatasetPage() {
  const {
    activeDataset,
    refreshDatasets,
    setActivePage,
    loadSample,
    addToast,
    bumpRevision,
    dataRevision,
  } = useDataset();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChosen = async (file: File) => {
    setErrorMsg(null);
    const lower = file.name.toLowerCase();
    const extValid = ALLOWED_EXTS.some((ext) => lower.endsWith(ext));
    if (!extValid) {
      setErrorMsg("Unsupported file format. Please upload CSV, Excel (.xlsx/.xls), or JSON.");
      return;
    }
    if (file.size === 0) {
      setErrorMsg("Selected file is empty (0 bytes).");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrorMsg(`File exceeds the ${MAX_MB} MB upload limit.`);
      return;
    }

    setSelectedFile(file);
    setDatasetName(file.name.replace(/\.[^/.]+$/, ""));
    setSheets([]);
    setSelectedSheet("");

    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      try {
        const res = await api.inspectSheets(file);
        setSheets(res.sheets || []);
        if (res.sheets && res.sheets.length > 0) {
          setSelectedSheet(res.sheets[0]);
        }
      } catch (err: any) {
        setErrorMsg(err.message);
      }
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setProgress(5);
    setErrorMsg(null);
    try {
      const res = await api.uploadDataset(
        selectedFile,
        datasetName.trim() || undefined,
        selectedSheet || undefined,
        (pct) => setProgress(pct)
      );
      await refreshDatasets(res.dataset.id);
      bumpRevision();
      addToast({
        type: "success",
        title: "Dataset Uploaded & Profiled",
        description: `${res.dataset.row_count.toLocaleString()} rows and ${res.dataset.column_count} columns detected. Original v0 backup preserved.`,
      });
      setSelectedFile(null);
      setSheets([]);
    } catch (err: any) {
      setErrorMsg(err.message);
      addToast({ type: "error", title: "Upload Failed", description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleLoadSample = async () => {
    setLoadingSample(true);
    await loadSample();
    setLoadingSample(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Upload Dataset</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ingest CSV, Excel, or JSON files. DataPure preserves your raw file untouched as v0.
          </p>
        </div>
        <Button variant="secondary" onClick={handleLoadSample} disabled={loadingSample}>
          <Sparkles className="h-4 w-4" />
          {loadingSample ? "Generating 5,000 Rows..." : "Load Sample Dataset (Synthetic 5,000 Rows)"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7 space-y-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFileChosen(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
              dragOver
                ? "border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30"
                : "border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileChosen(f);
              }}
            />
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
              <UploadCloud className="h-7 w-7" />
            </div>
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              Drag &amp; drop your dataset here, or click to browse
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Supports CSV, Excel (.xlsx, .xls), and JSON &bull; Max file size {MAX_MB} MB
            </p>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {selectedFile && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <FileSpreadsheet className="h-5 w-5 text-indigo-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-500">{formatBytes(selectedFile.size)}</p>
                  </div>
                </div>
                <Badge variant="primary">Ready</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Dataset Display Name
                  </label>
                  <input
                    type="text"
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
                  />
                </div>
                {sheets.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Excel Sheet Selection
                    </label>
                    <select
                      value={selectedSheet}
                      onChange={(e) => setSelectedSheet(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
                    >
                      {sheets.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {uploading && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Uploading &amp; running automatic profiling...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-600 to-cyan-500 transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedFile(null);
                    setSheets([]);
                  }}
                  disabled={uploading}
                >
                  Clear
                </Button>
                <Button variant="primary" onClick={handleUploadSubmit} disabled={uploading}>
                  {uploading ? "Processing..." : "Upload & Profile Dataset"}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Automatic Column & Type Detection Summary */}
        <Card className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Active Dataset Schema Detection
            </h3>
            {activeDataset && <Badge variant="success">v{activeDataset.current_version} Active</Badge>}
          </div>

          {activeDataset ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                  <p className="text-xs text-slate-500">Total Rows</p>
                  <p className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">
                    {activeDataset.row_count.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                  <p className="text-xs text-slate-500">Total Columns</p>
                  <p className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">
                    {activeDataset.column_count}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {Object.entries(activeDataset.semantic_roles || {}).map(([col, role]) => (
                  <div
                    key={col}
                    className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{col}</span>
                    <Badge variant="cyan">{role}</Badge>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="primary" onClick={() => setActivePage("profiling")}>
                  Inspect Data Profiling
                </Button>
                <Button size="sm" variant="outline" onClick={() => setActivePage("overview")}>
                  Go to Dashboard
                </Button>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <Database className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p>Upload a file or click "Load Sample Dataset" to inspect detected columns and semantic types.</p>
            </div>
          )}
        </Card>
      </div>

      {activeDataset && (
        <DataTable
          datasetId={activeDataset.id}
          version={activeDataset.current_version}
          revision={dataRevision}
          title={`Dataset Preview — ${activeDataset.name}`}
        />
      )}
    </div>
  );
}
