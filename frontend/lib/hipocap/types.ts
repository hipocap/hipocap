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


