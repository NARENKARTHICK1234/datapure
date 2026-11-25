import React from "react";
import { cn } from "../../lib/utils";

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
}) {
  const variants = {
    primary:
      "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 disabled:bg-indigo-400",
    secondary:
      "bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm shadow-cyan-600/20",
    outline:
      "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800",
    ghost:
      "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
    danger:
      "bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-600/20",
    success:
      "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5 rounded-lg",
    md: "px-4 py-2 text-sm gap-2 rounded-lg",
    lg: "px-5 py-2.5 text-sm gap-2 rounded-xl",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("saas-card p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: "primary" | "cyan" | "success" | "warning" | "error" | "neutral";
  className?: string;
  children: React.ReactNode;
}) {
  const styles = {
    primary: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    error: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
    neutral: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-800/80",
        className
      )}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="saas-card flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {action && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{action}</div>}
    </div>
  );
}
