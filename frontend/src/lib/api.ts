import type { CleaningOperation, DatasetMeta, ProfileResponse, ValidationRule, ValidationRunResponse } from "../types";

const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = body.detail || body.message || detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  listDatasets: () => request<DatasetMeta[]>("/datasets"),
  getDataset: (id: string) => request<{ dataset: DatasetMeta; versions: any[]; columns: string[] }>(`/datasets/${id}`),
  deleteDataset: (id: string) => request<{ status: string }>(`/datasets/${id}`, { method: "DELETE" }),
  loadSampleDataset: () => request<{ dataset: DatasetMeta }>("/datasets/sample", { method: "POST" }),

  inspectSheets: async (file: File): Promise<{ sheets: string[] }> => {
    const fd = new FormData();
    fd.append("file", file);
    return request("/datasets/inspect-sheets", { method: "POST", body: fd });
  },

  uploadDataset: (
    file: File,
    name?: string,
    sheetName?: string,
    onProgress?: (pct: number) => void
  ): Promise<{ dataset: DatasetMeta }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/datasets/upload`);
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && onProgress) {
          onProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data);
          } else {
            reject(new Error(data.detail || `Upload failed (${xhr.status})`));
          }
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload."));
      const fd = new FormData();
      fd.append("file", file);
      if (name) fd.append("name", name);
      if (sheetName) fd.append("sheet_name", sheetName);
      xhr.send(fd);
    });
  },

  getRows: (
    id: string,
    params: {
      version?: number;
      page?: number;
      page_size?: number;
      search?: string;
      sort_by?: string;
      sort_dir?: string;
      filter_col?: string;
      filter_val?: string;
    } = {}
  ) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    return request<{
      columns: string[];
      version: number;
      pagination: { page: number; page_size: number; total: number; total_pages: number };
      rows: Record<string, any>[];
    }>(`/datasets/${id}/rows?${qs.toString()}`);
  },

  getProfile: (id: string, version?: number) => {
    const q = version !== undefined ? `?version=${version}` : "";
    return request<ProfileResponse>(`/datasets/${id}/profile${q}`);
  },

  getQuality: (id: string) => request<any>(`/datasets/${id}/quality`),

  getAutoCleanPlan: (id: string) =>
    request<{ operations: CleaningOperation[]; preview: any }>(`/datasets/${id}/clean/auto-plan`, {
      method: "POST",
    }),

  previewClean: (id: string, operations: CleaningOperation[], mode: "auto" | "manual") =>
    request<any>(`/datasets/${id}/clean/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operations, mode, confirm_destructive: false }),
    }),

  applyClean: (
    id: string,
    operations: CleaningOperation[],
    mode: "auto" | "manual",
    confirmDestructive: boolean
  ) =>
    request<{
      dataset: DatasetMeta;
      version: number;
      operation_logs: any[];
      modified_cells_count: number;
      rows_removed: number;
      profile: ProfileResponse;
    }>(`/datasets/${id}/clean/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operations, mode, confirm_destructive: confirmDestructive }),
    }),

  undo: (id: string) => request<{ dataset: DatasetMeta }>(`/datasets/${id}/undo`, { method: "POST" }),
  redo: (id: string) => request<{ dataset: DatasetMeta }>(`/datasets/${id}/redo`, { method: "POST" }),
  reset: (id: string) => request<{ dataset: DatasetMeta }>(`/datasets/${id}/reset`, { method: "POST" }),
  restoreVersion: (id: string, ver: number) =>
    request<{ dataset: DatasetMeta }>(`/datasets/${id}/restore/${ver}`, { method: "POST" }),

  listValidationRules: (id: string) => request<ValidationRule[]>(`/datasets/${id}/validation/rules`),
  createValidationRule: (id: string, rule: Partial<ValidationRule>) =>
    request<ValidationRule>(`/datasets/${id}/validation/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rule),
    }),
  updateValidationRule: (id: string, ruleId: number, patch: Partial<ValidationRule>) =>
    request<ValidationRule>(`/datasets/${id}/validation/rules/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  deleteValidationRule: (id: string, ruleId: number) =>
    request<{ status: string }>(`/datasets/${id}/validation/rules/${ruleId}`, { method: "DELETE" }),
  runValidation: (id: string) =>
    request<ValidationRunResponse>(`/datasets/${id}/validation/run`, { method: "POST" }),

  getVisualizations: (
    id: string,
    params: { numeric_col?: string; scatter_x?: string; scatter_y?: string; category_col?: string } = {}
  ) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, v);
    });
    return request<any>(`/datasets/${id}/visualizations?${qs.toString()}`);
  },

  getComparison: (
    id: string,
    params: { page?: number; page_size?: number; filter_status?: string; search?: string } = {}
  ) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    });
    return request<any>(`/datasets/${id}/compare?${qs.toString()}`);
  },

  getHistory: (id: string) => request<any>(`/datasets/${id}/history`),

  exportUrl: (id: string, fmt: "csv" | "xlsx" | "json" | "pdf" | "validation-json" | "audit-json") =>
    `${API_BASE}/datasets/${id}/export/${fmt}`,

  getSettings: () => request<Record<string, any>>("/settings"),
  updateSettings: (settings: Record<string, any>) =>
    request<Record<string, any>>("/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    }),
};
