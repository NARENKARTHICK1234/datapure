import React, { useEffect, useState } from "react";
import { History, RotateCcw, Trash2 } from "lucide-react";
import { useDataset } from "../context/DatasetContext";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/utils";
import { Badge, Button, Card, EmptyState, Skeleton } from "../components/ui/Primitives";
import { ConfirmDialog } from "../components/shared/ConfirmDialog";

export function ActivityHistoryPage() {
  const { activeDataset, setActivePage, refreshDatasets, dataRevision, bumpRevision, addToast } = useDataset();
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!activeDataset) return;
    let active = true;
    setLoading(true);
    api
      .getHistory(activeDataset.id)
      .then((res) => {
        if (active) setHistory(res);
      })
      .catch((err) => {
        if (active) addToast({ type: "error", title: "Failed to load history", description: err.message });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeDataset?.id, activeDataset?.current_version, dataRevision, addToast]);

  const handleRestore = async (ver: number) => {
    if (!activeDataset) return;
    try {
      await api.restoreVersion(activeDataset.id, ver);
      await refreshDatasets(activeDataset.id);
      bumpRevision();
      addToast({ type: "success", title: `Restored Version v${ver}` });
    } catch (err: any) {
      addToast({ type: "error", title: "Restore failed", description: err.message });
    }
  };

  const handleDeleteDataset = async () => {
    if (!activeDataset) return;
    setDeleting(true);
    try {
      await api.deleteDataset(activeDataset.id);
      setConfirmDelete(false);
      await refreshDatasets();
      bumpRevision();
      addToast({ type: "info", title: "Dataset & Audit History Deleted" });
    } catch (err: any) {
      addToast({ type: "error", title: "Delete failed", description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  if (!activeDataset) {
    return (
      <EmptyState
        icon={<History className="h-7 w-7" />}
        title="No Dataset Selected"
        description="Upload a dataset to view its version snapshots and full audit log."
        action={<Button onClick={() => setActivePage("upload")}>Upload Dataset</Button>}
      />
    );
  }

  if (loading && !history) {
    return <Skeleton className="h-96 w-full" />;
  }

  const versions: any[] = history?.versions || [];
  const logs: any[] = history?.audit_logs || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Activity History &amp; Version Snapshots
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Restore any previous dataset snapshot or audit every transformation applied to <strong>{activeDataset.name}</strong>.
          </p>
        </div>
        <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-3.5 w-3.5" /> Delete Dataset &amp; History
        </Button>
      </div>

      {/* Dataset Version Snapshots */}
      <Card className="p-0 overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-800 p-4">
          <h3 className="text-base font-semibold">Dataset Version History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Version</th>
                <th className="px-3 py-2.5 font-semibold">Description</th>
                <th className="px-3 py-2.5 font-semibold">Rows / Cols</th>
                <th className="px-3 py-2.5 font-semibold">Quality Score</th>
                <th className="px-3 py-2.5 font-semibold">Timestamp</th>
                <th className="px-4 py-2.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {versions.map((v) => {
                const isCurrent = v.version_number === activeDataset.current_version;
                return (
                  <tr key={v.id} className={isCurrent ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""}>
                    <td className="px-4 py-3 font-mono font-semibold">
                      v{v.version_number}{" "}
                      {isCurrent && <Badge variant="primary" className="ml-1">Active</Badge>}
                    </td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{v.description}</td>
                    <td className="px-3 py-3 tabular-nums">
                      {v.row_count.toLocaleString()} / {v.column_count}
                    </td>
                    <td className="px-3 py-3 font-semibold text-emerald-600">{v.quality_score}%</td>
                    <td className="px-3 py-3 text-slate-500">{formatDateTime(v.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isCurrent}
                        onClick={() => handleRestore(v.version_number)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Restore
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Audit Operation Log */}
      <Card className="p-0 overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-800 p-4">
          <h3 className="text-base font-semibold">Cleaning &amp; Validation Audit Log</h3>
        </div>
        <div className="overflow-x-auto max-h-[380px]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Timestamp</th>
                <th className="px-3 py-2.5 font-semibold">Action</th>
                <th className="px-3 py-2.5 font-semibold">Transition</th>
                <th className="px-3 py-2.5 font-semibold">Modified / Removed</th>
                <th className="px-4 py-2.5 font-semibold">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="cyan">{l.action_type}</Badge>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-500">
                    {l.version_from !== null ? `v${l.version_from} -> v${l.version_to}` : `v${l.version_to}`}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {l.modified_cells_count.toLocaleString()} cells / {l.removed_rows_count.toLocaleString()} rows
                  </td>
                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{l.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Dataset &amp; All History?"
        description={`This will permanently remove "${activeDataset.name}", all version snapshots, validation rules, and audit logs from SQLite and disk.`}
        confirmLabel="Permanently Delete"
        loading={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDeleteDataset}
      />
    </div>
  );
}
