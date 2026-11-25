import React from "react";

export function DataPureLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-cyan-500 shadow-md shadow-indigo-500/25">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M4 7C4 5.34315 7.58172 4 12 4C16.4183 4 20 5.34315 20 7C20 8.65685 16.4183 10 12 10C7.58172 10 4 8.65685 4 7Z"
            stroke="white"
            strokeWidth="2"
          />
          <path
            d="M4 12C4 13.6569 7.58172 15 12 15C16.4183 15 20 13.6569 20 12"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M4 7V17C4 18.6569 7.58172 20 12 20C16.4183 20 20 18.6569 20 17V7"
            stroke="white"
            strokeWidth="2"
          />
          <circle cx="17.5" cy="17.5" r="4" fill="#10B981" stroke="white" strokeWidth="1.5" />
          <path d="M16 17.5L17 18.5L19 16.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {!compact && (
        <div className="flex flex-col leading-tight">
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
            Data<span className="text-indigo-600 dark:text-indigo-400">Pure</span>
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Analytics Engine
          </span>
        </div>
      )}
    </div>
  );
}
