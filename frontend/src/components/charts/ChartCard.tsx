import React, { useRef, useState } from "react";
import { Download, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTheme } from "../../context/ThemeContext";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  filename?: string;
  headerControls?: React.ReactNode;
  onExportPng?: (filename: string) => void;
  heightClass?: string;
  children: (isFullscreen: boolean) => React.ReactNode;
}

export function exportSvgElementToPng(container: HTMLElement | null, filename: string, isDark: boolean) {
  if (!container) return;
  const svg = container.querySelector("svg");
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const w = Math.max(rect.width, 600);
  const h = Math.max(rect.height, 320);
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = isDark ? "#0f172a" : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      const a = document.createElement("a");
      a.download = `${filename}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    }
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

export function ChartCard({
  title,
  subtitle,
  filename = "datapure-chart",
  headerControls,
  onExportPng,
  heightClass = "h-[310px]",
  children,
}: ChartCardProps) {
  const { theme } = useTheme();
  const [fullscreen, setFullscreen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (onExportPng) {
      onExportPng(filename);
    } else {
      exportSvgElementToPng(bodyRef.current, filename, theme === "dark");
    }
  };

  const cardInner = (fs: boolean) => (
    <div
      className={cn(
        "saas-card flex flex-col p-4 lg:p-5",
        fs ? "h-full w-full max-w-6xl max-h-[90vh] shadow-2xl" : "h-full"
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{title}</h4>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {headerControls}
          <button
            type="button"
            onClick={handleDownload}
            title="Export chart as PNG"
            aria-label="Export chart as PNG"
            className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFullscreen((f) => !f)}
            title={fs ? "Exit full screen" : "Full screen"}
            aria-label={fs ? "Exit full screen" : "Full screen"}
            className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            {fs ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div ref={fs ? undefined : bodyRef} className={cn("w-full flex-1 min-h-0", fs ? "h-[72vh]" : heightClass)}>
        {children(fs)}
      </div>
    </div>
  );

  return (
    <>
      {cardInner(false)}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFullscreen(false);
          }}
        >
          {cardInner(true)}
        </div>
      )}
    </>
  );
}
