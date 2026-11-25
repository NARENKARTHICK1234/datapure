import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { DatasetMeta, PageKey } from "../types";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  description?: string;
}

interface DatasetContextValue {
  datasets: DatasetMeta[];
  activeDataset: DatasetMeta | null;
  activePage: PageKey;
  setActivePage: (p: PageKey) => void;
  selectDataset: (id: string) => Promise<void>;
  refreshDatasets: (preferredId?: string) => Promise<void>;
  loadSample: () => Promise<DatasetMeta | null>;
  loadingDatasets: boolean;
  globalSearch: string;
  setGlobalSearch: (s: string) => void;
  toasts: ToastMessage[];
  addToast: (t: Omit<ToastMessage, "id">) => void;
  dismissToast: (id: string) => void;
  dataRevision: number;
  bumpRevision: () => void;
}

const DatasetContext = createContext<DatasetContextValue | null>(null);

export function DatasetProvider({ children }: { children: React.ReactNode }) {
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [activeDataset, setActiveDataset] = useState<DatasetMeta | null>(null);
  const [activePage, setActivePage] = useState<PageKey>("landing");
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [dataRevision, setDataRevision] = useState(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (t: Omit<ToastMessage, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
      setTimeout(() => dismissToast(id), 4500);
    },
    [dismissToast]
  );

  const bumpRevision = useCallback(() => setDataRevision((r) => r + 1), []);

  const refreshDatasets = useCallback(async (preferredId?: string) => {
    setLoadingDatasets(true);
    try {
      const list = await api.listDatasets();
      setDatasets(list);
      setActiveDataset((prev) => {
        const targetId = preferredId || prev?.id;
        if (targetId) {
          const found = list.find((d) => d.id === targetId);
          if (found) return found;
        }
        return list[0] || null;
      });
    } catch (err: any) {
      // Backend might be booting on first render
      console.error("Failed to fetch datasets:", err);
    } finally {
      setLoadingDatasets(false);
    }
  }, []);

  useEffect(() => {
    refreshDatasets();
  }, [refreshDatasets]);

  const selectDataset = useCallback(
    async (id: string) => {
      const found = datasets.find((d) => d.id === id);
      if (found) {
        setActiveDataset(found);
        bumpRevision();
      } else {
        await refreshDatasets(id);
        bumpRevision();
      }
    },
    [datasets, refreshDatasets, bumpRevision]
  );

  const loadSample = useCallback(async () => {
    try {
      const res = await api.loadSampleDataset();
      await refreshDatasets(res.dataset.id);
      setActiveDataset(res.dataset);
      bumpRevision();
      addToast({
        type: "success",
        title: "Synthetic Sample Dataset Loaded",
        description: "5,000 customer records with realistic quality issues are ready for inspection.",
      });
      return res.dataset;
    } catch (err: any) {
      addToast({ type: "error", title: "Failed to load sample dataset", description: err.message });
      return null;
    }
  }, [refreshDatasets, bumpRevision, addToast]);

  return (
    <DatasetContext.Provider
      value={{
        datasets,
        activeDataset,
        activePage,
        setActivePage,
        selectDataset,
        refreshDatasets,
        loadSample,
        loadingDatasets,
        globalSearch,
        setGlobalSearch,
        toasts,
        addToast,
        dismissToast,
        dataRevision,
        bumpRevision,
      }}
    >
      {children}
    </DatasetContext.Provider>
  );
}

export function useDataset() {
  const ctx = useContext(DatasetContext);
  if (!ctx) throw new Error("useDataset must be used inside DatasetProvider");
  return ctx;
}
