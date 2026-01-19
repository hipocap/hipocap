"""
Pydantic models for API request/response.
"""

from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


class AnalyzeRequest(BaseModel):
    """Request model for analyze endpoint."""
    
    function_name: str = Field(..., description="Name of the function to analyze")
    function_result: Any = Field(..., description="Result from the function call")
    function_args: Optional[Any] = Field(None, description="Arguments passed to the function call")
    user_query: Optional[str] = Field(None, description="Optional user query for context")
    user_role: Optional[str] = Field(None, description="Optional user role for RBAC checking")
    target_function: Optional[str] = Field(None, description="Optional target function for function chaining checks")
    input_analysis: bool = Field(True, description="Whether to run input analysis (Stage 1: Prompt Guard)")
    llm_analysis: bool = Field(False, description="Whether to run LLM analysis agent (Stage 2: Structured LLM analysis)")
    quarantine_analysis: bool = Field(False, description="Whether to run quarantine analysis (Stage 3: Two-stage infection simulation and evaluation)")
    quick_analysis: bool = Field(False, description="If True, uses quick mode for LLM analysis (simplified output). If False, uses full detailed analysis with threat indicators, detected patterns, and function call attempts.")
    enable_keyword_detection: bool = Field(False, description="Whether to enable keyword detection for sensitive keywords")
    keywords: Optional[List[str]] = Field(None, description="Optional custom list of keywords to detect (if not provided, uses default sensitive keywords)")
    openai_model: Optional[str] = Field(None, description="OpenAI model name used for the LLM call (extracted from OpenTelemetry context)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "function_name": "get_mail",
                "function_result": {"status": "success", "message": "Email retrieved"},
                "function_args": {"mailbox": "inbox", "limit": 10},
                "user_query": "Check my emails",
                "user_role": "user",
                "target_function": None,
                "input_analysis": True,
                "llm_analysis": True,
                "quarantine_analysis": False,
                "enable_keyword_detection": True
            }
        }


class AnalyzeResponse(BaseModel):
    """Response model for analyze endpoint."""
    
    final_decision: str = Field(..., description="Final decision: ALLOWED, BLOCKED, REVIEW_REQUIRED, or ALLOWED_WITH_WARNING")
    final_score: Optional[float] = Field(None, description="Final risk score (0.0-1.0) from the analysis")
    safe_to_use: bool = Field(..., description="Whether the function result is safe to use")
    blocked_at: Optional[str] = Field(None, description="Stage where blocking occurred (if any)")
    reason: Optional[str] = Field(None, description="Reason for blocking or decision")
    input_analysis: Optional[Dict[str, Any]] = Field(None, description="Input analysis results")
    quarantine_analysis: Optional[Dict[str, Any]] = Field(None, description="Quarantine analysis results")
    llm_analysis: Optional[Dict[str, Any]] = Field(None, description="LLM analysis results")
    rbac_blocked: Optional[bool] = Field(None, description="Whether blocked by RBAC")
    chaining_blocked: Optional[bool] = Field(None, description="Whether blocked by function chaining rules")
    severity_rule: Optional[Dict[str, Any]] = Field(None, description="Severity rule that was applied")
    output_restriction: Optional[Dict[str, Any]] = Field(None, description="Output restriction that was applied")
    context_rule: Optional[Dict[str, Any]] = Field(None, description="Context rule that was applied")
    warning: Optional[str] = Field(None, description="Warning message if any")
    function_chaining_info: Optional[Dict[str, Any]] = Field(None, description="Function chaining configuration showing which functions can/cannot be called from this function's output")


class RBACUpdateRequest(BaseModel):
    """Request model for RBAC configuration update."""
    
    roles: Optional[Dict[str, Any]] = Field(None, description="Roles to add or update")
    functions: Optional[Dict[str, Any]] = Field(None, description="Function configurations to add or update")
    
    class Config:
        json_schema_extra = {
            "example": {
                "roles": {
                    "developer": {
                        "permissions": ["get_mail", "search_web", "summarize_text"],
                        "description": "Developer role with specific permissions"
                    }
                },
                "functions": {
                    "custom_function": {
                        "allowed_roles": ["developer", "admin"],
                        "description": "Custom function for developers"
                    }
                }
            }
        }


class RBACUpdateResponse(BaseModel):
    """Response model for RBAC configuration update."""
    
    success: bool = Field(..., description="Whether the update was successful")
    message: str = Field(..., description="Status message")
    roles_count: int = Field(..., description="Number of roles after update")
    functions_count: int = Field(..., description="Number of functions after update")


# Authentication models
class UserCreate(BaseModel):
    """Request model for user creation."""
    
    username: str = Field(..., min_length=3, max_length=100)
    email: str = Field(..., pattern=r'^[^@]+@[^@]+\.[^@]+$')
    password: str = Field(..., min_length=8)
    is_admin: bool = Field(False, description="Whether user is an admin")


class UserResponse(BaseModel):
    """Response model for user."""
    
    id: int
    username: str
    email: str
    is_active: bool
    is_admin: bool
    created_at: str
    
    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    """Request model for login."""
    
    username: str
    password: str


class LoginResponse(BaseModel):
    """Response model for login."""
    
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class APIKeyCreate(BaseModel):
    """Request model for API key creation."""
    
    name: str = Field(..., min_length=1, max_length=255, description="Human-readable name for the key")
    expires_days: Optional[int] = Field(None, description="Number of days until expiration (None for no expiration)")


class APIKeyResponse(BaseModel):
    """Response model for API key (without the actual key)."""
    
    id: int
    name: str
    is_active: bool
    last_used_at: Optional[str]
    expires_at: Optional[str]
    created_at: str
    
    class Config:
        from_attributes = True


class APIKeyCreateResponse(BaseModel):
    """Response model for API key creation (includes the key once)."""
    
    id: int
    name: str
    key: str = Field(..., description="The API key (shown only once)")
    expires_at: Optional[str]
    created_at: str
    message: str = Field("Save this key securely. It will not be shown again.")


# Policy models
class PolicyCreate(BaseModel):
    """Request model for policy creation."""
    
    policy_key: str = Field(..., min_length=1, max_length=255, description="Unique identifier for the policy")
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    roles: Optional[Dict[str, Any]] = None
    functions: Optional[Dict[str, Any]] = None
    severity_rules: Optional[Dict[str, Any]] = None
    output_restrictions: Optional[Dict[str, Any]] = None
    function_chaining: Optional[Dict[str, Any]] = None
    context_rules: Optional[List[Dict[str, Any]]] = None
    decision_thresholds: Optional[Dict[str, Any]] = None
    custom_prompts: Optional[Dict[str, str]] = None
    is_default: bool = Field(False, description="Set as default policy")


class PolicyResponse(BaseModel):
    """Response model for policy."""
    
    id: int
    policy_key: str
    name: str
    description: Optional[str] = None
    owner_id: str  # Changed to UUID string (LMNR user ID)
    roles: Optional[Dict[str, Any]] = None
    functions: Optional[Dict[str, Any]] = None
    severity_rules: Optional[Dict[str, Any]] = None
    output_restrictions: Optional[Dict[str, Any]] = None
    function_chaining: Optional[Dict[str, Any]] = None
    context_rules: Optional[List[Dict[str, Any]]] = None
    decision_thresholds: Optional[Dict[str, Any]] = None
    custom_prompts: Optional[Dict[str, str]] = None
    is_active: bool
    is_default: bool
    created_at: str
    updated_at: Optional[str] = None
    
    class Config:
        from_attributes = True


class PolicyUpdate(BaseModel):
    """Request model for policy update."""
    
    name: Optional[str] = Field(None, description="Policy name")
    description: Optional[str] = Field(None, description="Policy description")
    roles: Optional[Dict[str, Any]] = Field(None, description="Roles configuration (will merge with existing)")
    functions: Optional[Dict[str, Any]] = Field(None, description="Functions configuration (will merge with existing)")
    severity_rules: Optional[Dict[str, Any]] = Field(None, description="Severity rules (will merge with existing)")
    output_restrictions: Optional[Dict[str, Any]] = Field(None, description="Output restrictions (will merge with existing)")
    function_chaining: Optional[Dict[str, Any]] = Field(None, description="Function chaining rules (will merge with existing)")
    context_rules: Optional[List[Dict[str, Any]]] = Field(None, description="Context rules (will replace existing)")
    decision_thresholds: Optional[Dict[str, Any]] = Field(None, description="Decision thresholds (will merge with existing)")
    custom_prompts: Optional[Dict[str, str]] = Field(None, description="Custom prompts configuration (will merge with existing)")
    is_active: Optional[bool] = Field(None, description="Whether policy is active")
    is_default: Optional[bool] = Field(None, description="Whether this is the default policy")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Updated Policy Name",
                "description": "Updated description",
                "functions": {
                    "send_mail": {
                        "allowed_roles": ["developer"],
                        "quarantine_exclude": "Exclude anything with a mail address"
                    }
                }
            }
        }


class PolicyUpdateResponse(BaseModel):
    """Detailed response model for policy update showing what changed."""
    
    success: bool = Field(..., description="Whether the update was successful")
    policy: PolicyResponse = Field(..., description="Updated policy")
    changes: Dict[str, Any] = Field(..., description="Detailed information about what changed")
    warnings: Optional[List[str]] = Field(None, description="Any warnings during update")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "policy": {
                    "id": 1,
                    "policy_key": "my_policy",
                    "name": "Updated Policy"
                },
                "changes": {
                    "name": {"old": "Old Name", "new": "Updated Policy"},
                    "functions": {
                        "added": ["send_mail"],
                        "updated": ["get_mail"],
                        "removed": []
                    }
                },
                "warnings": []
            }
        }


# Analysis Trace Models
class AnalysisTraceResponse(BaseModel):
    """Response model for analysis trace."""
    
    id: int
    user_id: str  # Changed to string (UUID) to match database schema
    api_key_id: Optional[str] = None  # Changed to string to match database schema
    function_name: str
    user_query: Optional[str] = None
    user_role: Optional[str] = None
    target_function: Optional[str] = None
    require_quarantine: bool
    quick_analysis: bool
    policy_key: Optional[str] = None
    analysis_response: Dict[str, Any]
    final_decision: str
    safe_to_use: bool
    blocked_at: Optional[str] = None
    reason: Optional[str] = None
    review_required: bool
    hitl_reason: Optional[str] = None
    input_score: Optional[float] = None
    quarantine_score: Optional[float] = None
    llm_score: Optional[float] = None
    review_status: str
    reviewed_by: Optional[str] = None  # Changed to string (UUID) to match database schema
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ReviewUpdateRequest(BaseModel):
    """Request model for updating review status."""
    
    status: str = Field(..., description="Review status: approved, rejected, or reviewed")
    notes: Optional[str] = Field(None, description="Optional review notes")
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "approved",
                "notes": "Content reviewed and approved for use"
            }
        }


class ReviewUpdateResponse(BaseModel):
    """Response model for review update."""
    
    success: bool = Field(..., description="Whether the update was successful")
    message: str = Field(..., description="Status message")
    trace: AnalysisTraceResponse = Field(..., description="Updated trace")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Review status updated successfully",
                "trace": {
                    "id": 1,
                    "review_status": "approved",
                    "reviewed_by": 1,
                    "reviewed_at": "2024-01-15T10:30:00Z"
                }
            }
        }


class TraceListResponse(BaseModel):
    """Paginated response model for trace list."""
    
    traces: List[AnalysisTraceResponse] = Field(..., description="List of traces")
    total: int = Field(..., description="Total number of traces")
    limit: int = Field(..., description="Limit used")
    offset: int = Field(..., description="Offset used")
    
    class Config:
        json_schema_extra = {
            "example": {
                "traces": [],
                "total": 100,
                "limit": 50,
                "offset": 0
            }
        }


class TraceStatsResponse(BaseModel):
    """Response model for trace statistics."""
    
    total: int = Field(..., description="Total number of traces")
    blocked: int = Field(..., description="Number of blocked traces")
    allowed: int = Field(..., description="Number of allowed traces")
    review_required: int = Field(..., description="Number of traces requiring review")
    by_function: Dict[str, Dict[str, int]] = Field(
        default_factory=dict,
        description="Statistics grouped by function name"
    )


class TraceTimeSeriesDataPoint(BaseModel):
    """Single data point in time series."""
    
    timestamp: str = Field(..., description="ISO timestamp")
    blocked: int = Field(..., description="Number of blocked functions in this interval")
    allowed: int = Field(..., description="Number of allowed functions in this interval")


class TraceTimeSeriesResponse(BaseModel):
    """Response model for time-series trace statistics."""
    
    items: List[TraceTimeSeriesDataPoint] = Field(..., description="Time-series data points")


# Shield models
class ShieldCreate(BaseModel):
    """Request model for shield creation."""
    
    shield_key: str = Field(..., min_length=1, max_length=255, description="Unique identifier for the shield")
    name: str = Field(..., min_length=1, max_length=255, description="Human-readable name")
    description: Optional[str] = Field(None, description="Optional description")
    content: str = Field(..., description="JSON string containing prompt_description, what_to_block, what_not_to_block")
    
    class Config:
        json_schema_extra = {
            "example": {
                "shield_key": "email_shield",
                "name": "Email Protection Shield",
                "description": "Shield to protect against email-based prompt injection",
                "content": '{"prompt_description": "Email content analysis", "what_to_block": "Suspicious email patterns", "what_not_to_block": "Legitimate email content"}'
            }
        }


class ShieldResponse(BaseModel):
    """Response model for shield."""
    
    id: int
    shield_key: str
    name: str
    description: Optional[str] = None
    prompt_description: str
    what_to_block: str
    what_not_to_block: str
    owner_id: str  # LMNR user UUID as string
    is_active: bool
    created_at: str
    updated_at: Optional[str] = None
    
    class Config:
        from_attributes = True


class ShieldUpdate(BaseModel):
    """Request model for shield update."""
    
    name: Optional[str] = Field(None, description="Shield name")
    description: Optional[str] = Field(None, description="Shield description")
    content: Optional[str] = Field(None, description="JSON string containing prompt_description, what_to_block, what_not_to_block")
    is_active: Optional[bool] = Field(None, description="Whether shield is active")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Updated Shield Name",
                "description": "Updated description",
                "content": '{"prompt_description": "Updated description", "what_to_block": "Updated blocking rules", "what_not_to_block": "Updated exceptions"}'
            }
        }


class ShieldUpdateResponse(BaseModel):
    """Detailed response model for shield update showing what changed."""
    
    success: bool = Field(..., description="Whether the update was successful")
    shield: ShieldResponse = Field(..., description="Updated shield")
    changes: Dict[str, Any] = Field(..., description="Detailed information about what changed")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "shield": {
                    "id": 1,
                    "shield_key": "email_shield",
                    "name": "Updated Shield"
                },
                "changes": {
                    "name": {"old": "Old Name", "new": "Updated Shield"},
                    "content": {
                        "what_to_block": {"old": "Old rules", "new": "New rules"}
                    }
                }
            }
        }


# Shield Analysis Models
class ShieldAnalyzeRequest(BaseModel):
    """Request model for shield-based analysis."""
    
    content: str = Field(..., description="The text content to analyze (can be any input - email content, document text, user message, etc.)")
    user_query: Optional[str] = Field(None, description="Optional user query for context")
    require_reason: bool = Field(False, description="If True, include a one-liner reason for the decision")
    
    class Config:
        json_schema_extra = {
            "example": {
                "content": "This is the text content to analyze. It can be any input from the user.",
                "user_query": "Optional context about what the user was trying to do",
                "require_reason": True
            }
        }


class ShieldAnalyzeResponse(BaseModel):
    """Response model for shield-based analysis."""
    
    decision: str = Field(..., description="Final decision: BLOCK or ALLOW")
    reason: Optional[str] = Field(None, description="One-liner reason for the decision (only if require_reason=True)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "decision": "BLOCK",
                "reason": "Content contains suspicious patterns matching blocked criteria"
            }
        }

