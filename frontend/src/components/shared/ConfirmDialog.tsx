import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "../ui/Primitives";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  bullets?: string[];
  confirmLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  bullets = [],
  confirmLabel = "Confirm & Proceed",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="saas-card w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Original raw data remains safely backed up at v0.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{description}</p>

        {bullets.length > 0 && (
          <ul className="mt-3 space-y-1.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/60 p-3 text-xs text-amber-800 dark:text-amber-200">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={loading}>
            {loading ? "Processing..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
