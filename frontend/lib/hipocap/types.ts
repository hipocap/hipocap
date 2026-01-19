/**
 * TypeScript types for Hipocap Analysis API
 * These match the backend Pydantic models
 */

export interface HipocapAnalysisRequest {
  function_name: string;
  function_result: any;
  function_args?: any;
  user_query?: string;
  user_role?: string;
  target_function?: string;
  input_analysis?: boolean;
  llm_analysis?: boolean;
  quarantine_analysis?: boolean;
  quick_analysis?: boolean;
  enable_keyword_detection?: boolean;
  keywords?: string[];
  openai_model?: string;
  policy_key?: string;
}

export interface HipocapAnalysisResponse {
  final_decision: string; // "ALLOWED", "BLOCKED", "REVIEW_REQUIRED", "ALLOWED_WITH_WARNING"
  final_score?: number | null; // 0.0-1.0
  safe_to_use: boolean;
  blocked_at?: string | null;
  reason?: string | null;
  input_analysis?: {
    decision?: string;
    score?: number;
    phase?: string;
    combined_severity?: string;
    recommendation?: string;
    analysis?: {
      name_analysis?: {
        score?: number;
        severity?: string;
      };
      args_analysis?: {
        score?: number;
        severity?: string;
        result_preview?: string;
      };
      result_analysis?: {
        score?: number;
        severity?: string;
        result_preview?: string;
      };
    };
  } | null;
  quarantine_analysis?: {
    decision?: string;
    score?: number;
    phase?: string;
    severity?: string;
    recommendation?: string;
  } | null;
  llm_analysis?: {
    decision?: string;
    score?: number;
    phase?: string;
    severity?: string;
    summary?: string;
    details?: string;
    reason?: string;
    threats_found?: string[];
    threat_indicators?: string[];
    detected_patterns?: string[];
    function_call_attempts?: string[];
    policy_violations?: string[];
  } | null;
  keyword_detection?: {
    detected?: boolean;
    keywords?: string[];
  } | null;
  rbac_blocked?: boolean | null;
  chaining_blocked?: boolean | null;
  severity_rule?: Record<string, any> | null;
  output_restriction?: Record<string, any> | null;
  context_rule?: Record<string, any> | null;
  warning?: string | null;
  function_chaining_info?: Record<string, any> | null;
}

/**
 * Hipocap Analysis Trace - represents a stored analysis result
 * Matches AnalysisTraceResponse from backend
 */
export interface HipocapTrace {
  id: number;
  user_id: string; // UUID string
  api_key_id?: string | null;
  function_name: string;
  user_query?: string | null;
  user_role?: string | null;
  target_function?: string | null;
  require_quarantine: boolean;
  quick_analysis: boolean;
  policy_key?: string | null;
  analysis_response: Record<string, any>;
  final_decision: string; // "ALLOWED", "BLOCKED", "REVIEW_REQUIRED", etc.
  safe_to_use: boolean;
  blocked_at?: string | null;
  reason?: string | null;
  review_required: boolean;
  hitl_reason?: string | null;
  input_score?: number | null;
  quarantine_score?: number | null;
  llm_score?: number | null;
  review_status: string; // "pending", "approved", "rejected", "reviewed"
  reviewed_by?: string | null; // UUID string
  reviewed_at?: string | null; // ISO datetime string
  review_notes?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string; // ISO datetime string
  updated_at?: string | null; // ISO datetime string
}

/**
 * Response from /api/v1/traces endpoint
 */
export interface HipocapTraceListResponse {
  traces: HipocapTrace[];
  total: number;
  limit: number;
  offset: number;
}


