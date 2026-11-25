import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface KpiCardProps {
  title: string;
  value: number;
  suffix?: string;
  decimals?: number;
  icon: React.ReactNode;
  accent?: "indigo" | "cyan" | "emerald" | "amber" | "red" | "violet";
  deltaText?: string;
  deltaPositive?: boolean;
  subtitle?: string;
}

export function KpiCard({
  title,
  value,
  suffix = "",
  decimals = 0,
  icon,
  accent = "indigo",
  deltaText,
  deltaPositive,
  subtitle,
}: KpiCardProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const duration = 550;
    const from = display;
    const target = Number.isFinite(value) ? value : 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const accentBg = {
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400",
    cyan: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/70 dark:text-cyan-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400",
    red: "bg-red-50 text-red-600 dark:bg-red-950/70 dark:text-red-400",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-950/70 dark:text-violet-400",
  }[accent];

  const formatted = display.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="saas-card-hover p-4 flex flex-col justify-between gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", accentBg)}>
          {icon}
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
          {formatted}
          {suffix}
        </span>
        {deltaText && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              deltaPositive === true &&
                "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
              deltaPositive === false &&
                "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300",
              deltaPositive === undefined &&
                "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            )}
          >
            {deltaPositive === true && <ArrowUpRight className="h-3 w-3" />}
            {deltaPositive === false && <ArrowDownRight className="h-3 w-3" />}
            {deltaText}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>
      )}
    </motion.div>
  );
}
