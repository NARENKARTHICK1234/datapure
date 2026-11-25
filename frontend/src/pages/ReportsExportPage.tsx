import React from "react";
import {
  BarChart3,
  ClipboardCheck,
  FileDown,
  FileJson,
  FileSpreadsheet,
  FileText,
  History,
} from "lucide-react";
import { useDataset } from "../context/DatasetContext";
import { api } from "../lib/api";
import { Badge, Button, Card, EmptyState } from "../components/ui/Primitives";

export function ReportsExportPage() {
  const { activeDataset, setActivePage, addToast } = useDataset();

  if (!activeDataset) {
    return (
      <EmptyState
        icon={<FileDown className="h-7 w-7" />}
        title="No Dataset Selected"
        description="Upload a dataset or load the sample customer dataset to download cleaned files and reports."
        action={<Button onClick={() => setActivePage("upload")}>Upload Dataset</Button>}
      />
    );
  }

  const triggerDownload = (fmt: "csv" | "xlsx" | "json" | "pdf" | "validation-json" | "audit-json", label: string) => {
    const url = api.exportUrl(activeDataset.id, fmt);
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    addToast({ type: "success", title: `Downloading ${label}`, description: `Version v${activeDataset.current_version}` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports &amp; Export Center</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            All downloads reflect the actual processed data at active version <strong>v{activeDataset.current_version}</strong>.
          </p>
        </div>
        <Badge variant="primary">{activeDataset.row_count.toLocaleString()} rows &bull; {activeDataset.column_count} cols</Badge>
      </div>

      {/* Cleaned Dataset Downloads */}
      <div className="grid gap-5 md:grid-cols-3">
        <Card className="saas-card-hover flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold">Cleaned CSV Dataset</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              UTF-8 comma-separated file stripped of internal tracking columns, ready for BI tools or ML pipelines.
            </p>
          </div>
          <Button variant="primary" onClick={() => triggerDownload("csv", "Cleaned CSV")}>
            <FileDown className="h-4 w-4" /> Download .CSV
          </Button>
        </Card>

        <Card className="saas-card-hover flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold">Cleaned Excel Workbook</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Styled OpenPyXL .xlsx workbook with formatted headers and auto-fitted column widths.
            </p>
          </div>
          <Button variant="success" onClick={() => triggerDownload("xlsx", "Cleaned Excel")}>
            <FileDown className="h-4 w-4" /> Download .XLSX
          </Button>
        </Card>

        <Card className="saas-card-hover flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-400">
              <FileJson className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold">Cleaned JSON Records</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Structured JSON record array ideal for APIs, NoSQL ingestion, and modern web applications.
            </p>
          </div>
          <Button variant="secondary" onClick={() => triggerDownload("json", "Cleaned JSON")}>
            <FileDown className="h-4 w-4" /> Download .JSON
          </Button>
        </Card>
      </div>

      {/* Executive Reports */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="saas-card-hover flex flex-col justify-between gap-4 border-indigo-200 dark:border-indigo-900/60">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="primary">Executive PDF</Badge>
              <span className="text-xs text-slate-400">Includes Matplotlib Charts</span>
            </div>
            <h3 className="text-lg font-semibold">Professional PDF Data Quality Report</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Multi-page report containing dataset summary, detected issues, cleaning operations applied,
              Pandera structural validation results, before-vs-after comparisons, embedded visual charts,
              remaining issues, and final recommendations.
            </p>
          </div>
          <Button variant="primary" onClick={() => triggerDownload("pdf", "PDF Quality Report")}>
            <FileDown className="h-4 w-4" /> Generate &amp; Download PDF Report
          </Button>
        </Card>

        <Card className="flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Governance, Validation &amp; Chart Exports</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Download machine-readable compliance reports or jump to Visual Analytics to export any chart as high-res PNG.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
              <Button variant="outline" onClick={() => triggerDownload("validation-json", "Validation Report")}>
                <ClipboardCheck className="h-4 w-4 text-emerald-600" /> Validation Report (.JSON)
              </Button>
              <Button variant="outline" onClick={() => triggerDownload("audit-json", "Cleaning Audit Report")}>
                <History className="h-4 w-4 text-indigo-600" /> Cleaning Audit (.JSON)
              </Button>
            </div>
          </div>
          <Button variant="ghost" onClick={() => setActivePage("analytics")} className="justify-start px-0 text-indigo-600 dark:text-indigo-400">
            <BarChart3 className="h-4 w-4" /> Open Visual Analytics to Export Individual Chart PNGs →
          </Button>
        </Card>
      </div>
    </div>
  );
}
