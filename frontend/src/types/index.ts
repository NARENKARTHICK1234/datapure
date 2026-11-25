export interface QualityDimension {
  score: number;
  calculable: boolean;
  formula: string;
  details: string;
}

export interface QualityReport {
  overall_score: number;
  classification: "Excellent" | "Good" | "Fair" | "Poor";
  formula: string;
  adjusted: boolean;
  adjustment_note: string;
  note?: string;
  dimensions: {
    completeness: QualityDimension;
    uniqueness: QualityDimension;
    validity: QualityDimension;
    consistency: QualityDimension;
  };
}

export interface DatasetMeta {
  id: string;
  name: string;
  original_filename: string;
  file_format: string;
  file_size_bytes: number;
  sheet_name?: string | null;
  is_synthetic: number;
  created_at: string;
  updated_at: string;
  current_version: number;
  max_version: number;
  row_count: number;
  column_count: number;
  semantic_roles: Record<string, string>;
  initial_quality: QualityReport;
  current_quality: QualityReport;
}

export interface ColumnProfile {
  name: string;
  dtype: string;
  raw_dtype: string;
  semantic_role: string;
  non_null_count: number;
  missing_count: number;
  missing_percentage: number;
  unique_count: number;
  whitespace_issues: number;
  invalid_count: number;
  mixed_type_count: number;
  outliers_count: number;
  stats: {
    mean: number | null;
    median: number | null;
    min: number | null;
    max: number | null;
    std: number | null;
    q1: number | null;
    q3: number | null;
    iqr_outliers: number;
    zscore_outliers: number;
  };
  issues: string[];
  sample_values: any[];
}

export interface CleaningOperation {
  op_type:
    | "remove_duplicates"
    | "remove_empty_rows"
    | "trim_whitespace"
    | "standardize_case"
    | "impute_missing"
    | "standardize_dates"
    | "normalize_emails"
    | "normalize_phones"
    | "convert_dtype"
    | "handle_outliers"
    | "replace_invalid";
  columns: string[];
  params: Record<string, any>;
}

export interface Recommendation {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  affected_columns: string[];
  affected_records: number;
  recommended_action: string;
  operation: CleaningOperation;
}

export interface ProfileResponse {
  dataset: DatasetMeta;
  version: number;
  summary: {
    total_rows: number;
    total_columns: number;
    missing_values: number;
    missing_percentage: number;
    duplicate_rows: number;
    empty_rows: number;
    invalid_records: number;
    invalid_cells: number;
    invalid_emails?: number;
    invalid_phones?: number;
    invalid_dates?: number;
    outliers_detected: number;
    whitespace_issues: number;
    inconsistent_formats: number;
    mixed_type_cells: number;
    total_issues: number;
  };
  quality: QualityReport;
  columns: ColumnProfile[];
  issue_breakdown: { name: string; count: number; color: string }[];
  recommendations: Recommendation[];
  semantic_roles: Record<string, string>;
}

export interface ValidationRule {
  id: number;
  dataset_id: string;
  name: string;
  column_name: string | null;
  rule_type: string;
  params: Record<string, any>;
  severity: "error" | "warning";
  enabled: boolean;
  created_at: string;
}

export interface ValidationRunResponse {
  version: number;
  summary: {
    total_rules: number;
    passed: number;
    failed: number;
    warnings: number;
    pass_rate: number;
  };
  results: {
    rule_id: number | null;
    name: string;
    column_name: string | null;
    rule_type: string;
    severity: "error" | "warning";
    status: "passed" | "failed" | "warning";
    failing_count: number;
    message: string;
    suggestion: string;
    sample_failures: { row_id: number; column: string; value: any }[];
  }[];
  row_errors: {
    row_id: number;
    rule_name: string;
    column: string | null;
    severity: string;
    value: any;
    message: string;
  }[];
}

export type PageKey =
  | "landing"
  | "overview"
  | "upload"
  | "profiling"
  | "cleaning"
  | "validation"
  | "analytics"
  | "comparison"
  | "reports"
  | "history"
  | "settings";
