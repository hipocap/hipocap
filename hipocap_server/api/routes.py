"""
API route handlers for hipocap-v1 server.
"""

from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query, Request, Header
from fastapi import status
from .models import (
    AnalyzeRequest, AnalyzeResponse, RBACUpdateRequest, RBACUpdateResponse,
    AnalysisTraceResponse, ReviewUpdateRequest, ReviewUpdateResponse, TraceListResponse,
    TraceStatsResponse, TraceTimeSeriesResponse, TraceTimeSeriesDataPoint
)
from ..pipeline import GuardPipeline, create_guard_pipeline
from ..config import Config
from ..auth.middleware import get_lmnr_user_info, LMNRUserInfo
from ..database.repositories.analysis_trace_repository import AnalysisTraceRepository
from ..database.connection import get_db
from sqlalchemy.orm import Session
from datetime import date
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


# Global pipeline instance (initialized on startup)
_pipeline: GuardPipeline = None


def get_pipeline() -> GuardPipeline:
    """Get or create the global pipeline instance."""
    global _pipeline
    if _pipeline is None:
        raise HTTPException(
            status_code=503,
            detail="Pipeline not initialized. Please ensure the server is properly configured."
        )
    return _pipeline


def initialize_pipeline(
    openai_api_key: str = None,
    openai_base_url: str = None,
    openai_model: str = None,
    infection_model: str = None,
    analysis_model: str = None,
    guard_model: str = None,
    config_path: str = "hipocap_config.json",
    hf_token: str = None,
    **kwargs
) -> None:
    """
    Initialize the global pipeline instance.
    
    Args:
        openai_api_key: OpenAI API key (or set OPENAI_API_KEY env var)
        openai_base_url: Custom base URL for OpenAI-compatible API (or set OPENAI_BASE_URL env var)
        openai_model: Default model name (or set OPENAI_MODEL env var)
        infection_model: Model for Stage 1 infection simulation (or set INFECTION_MODEL env var)
        analysis_model: Model for Stage 2 analysis/evaluation (or set ANALYSIS_MODEL env var)
        guard_model: Model for Prompt Guard (or set GUARD_MODEL env var)
        config_path: Path to configuration file (or set HIPOCAP_CONFIG_PATH env var)
        hf_token: HuggingFace token for accessing private/gated models (or set HF_TOKEN env var)
        **kwargs: Additional pipeline arguments
    """
    global _pipeline
    
    # Get from environment if not provided
    openai_api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
    openai_base_url = openai_base_url or os.getenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
    openai_model = openai_model or os.getenv("OPENAI_MODEL", "x-ai/grok-4.1-fast")
    infection_model = infection_model or os.getenv("INFECTION_MODEL")
    analysis_model = analysis_model or os.getenv("ANALYSIS_MODEL")
    guard_model = guard_model or os.getenv("GUARD_MODEL", "meta-llama/Prompt-Guard-86M")
    config_path = config_path or os.getenv("HIPOCAP_CONFIG_PATH", "hipocap_config.json")
    hf_token = hf_token or os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_TOKEN")
    
    _pipeline = create_guard_pipeline(
        openai_api_key=openai_api_key,
        openai_base_url=openai_base_url,
        openai_model=openai_model,
        infection_model=infection_model,
        analysis_model=analysis_model,
        guard_model=guard_model,
        config_path=config_path,
        hf_token=hf_token,
        verbose=False,  # Disable verbose logging in API mode
        **kwargs
    )


# Create router
router = APIRouter(prefix="/api/v1", tags=["analysis"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    request: AnalyzeRequest,
    http_request: Request,
    pipeline: GuardPipeline = Depends(get_pipeline),
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    policy_key: Optional[str] = Query(None, description="Policy key to use (defaults to user's default policy)")
) -> AnalyzeResponse:
    """
    Analyze a function call for security threats.
    
    Requires API key authentication. Optionally specify a policy_key to use a specific governance policy.
    
    Args:
        request: Analysis request with function details
        pipeline: GuardPipeline instance (injected dependency)
        api_key: API key from authentication
        policy_key: Optional policy key to use (if not provided, uses default policy)
        
    Returns:
        Analysis response with decision and details
    """
    try:
        # Load policy from database if specified or use default
        from ..database.connection import get_db
        from ..database.repositories.policy_repository import PolicyRepository
        
        db_gen = get_db()
        db = next(db_gen)
        try:
            policy = None
            
            if policy_key:
                # Load specific policy for this owner
                policy = PolicyRepository.get_by_key(db, policy_key, owner_id=user_info.id)
                
                # If 'default' policy is requested but missing, create it automatically
                if not policy and policy_key == "default":
                    policy = PolicyRepository.create(
                        db=db,
                        policy_key="default",
                        name="Default Policy",
                        owner_id=user_info.id,
                        description="Automatically created default policy with standard security settings.",
                        is_default=True
                    )
                
                if not policy:
                    # Check if a policy with this key exists regardless of owner (e.g., system policies)
                    policy = PolicyRepository.get_by_key(db, policy_key)
                    
                if not policy:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Policy '{policy_key}' not found"
                    )
            else:
                # Load default policy for this owner
                policy = PolicyRepository.get_default(db, owner_id=user_info.id)
                
                # If owner has no default, look for global default
                if not policy:
                    policy = PolicyRepository.get_default(db)
                
                # If STILL no default exists (even global), create one for this owner
                if not policy:
                    policy = PolicyRepository.create(
                        db=db,
                        policy_key="default",
                        name="Default Policy",
                        owner_id=user_info.id,
                        description="Automatically created default policy with standard security settings.",
                        is_default=True
                    )
            
            # Debug log to verify policy used
            if policy:
                print(f"DEBUG: Using policy: {policy.policy_key} (owner: {policy.owner_id})")
            
            # Check permissions if policy exists
            if policy:
                if not policy.is_active:
                    raise HTTPException(
                        status_code=403,
                        detail="Policy is not active"
                    )
                
                # Check if user is owner or if it's a global policy
                is_owner = policy.owner_id == user_info.id
                
                # We allow users to use any active policy for analysis,
                # but if we wanted to enforce strictly private policies, we would check is_owner here.
                # For now, let's just ensure they are active (checked above).
                # To be safe, if a specific policy_key was requested, we allow it.
                # Load policy config into pipeline
                policy_config = PolicyRepository.to_config_dict(policy)
                
                # Set custom prompts from policy
                original_custom_prompts = pipeline.custom_prompts
                if policy.custom_prompts:
                    pipeline.custom_prompts = policy.custom_prompts
                
                if policy_config:
                    # Create or update pipeline config
                    original_config = None
                    config_was_none = False
                    
                    if pipeline.config is None:
                        # Create a new Config object from policy config
                        from ..config import Config
                        pipeline.config = Config(config_dict=policy_config)
                        config_was_none = True
                    else:
                        # Temporarily update existing pipeline config
                        original_config = pipeline.config.config.copy()
                        # Deep merge to preserve existing structure
                        for key, value in policy_config.items():
                            if key in original_config and isinstance(original_config[key], dict) and isinstance(value, dict):
                                # Special handling for functions to merge nested function configs
                                if key == "functions":
                                    for func_name, func_config in value.items():
                                        if func_name in original_config[key] and isinstance(original_config[key][func_name], dict):
                                            # Merge function configs (e.g., preserve allowed_roles, add quarantine_exclude)
                                            original_config[key][func_name].update(func_config)
                                        else:
                                            original_config[key][func_name] = func_config
                                else:
                                    original_config[key].update(value)
                            else:
                                original_config[key] = value
                        
                        pipeline.config.config = original_config
                    
                    try:
                        result = pipeline.analyze(
                            function_name=request.function_name,
                            function_result=request.function_result,
                            function_args=request.function_args,
                            user_query=request.user_query,
                            user_role=request.user_role,
                            target_function=request.target_function,
                            input_analysis=request.input_analysis,
                            llm_analysis=request.llm_analysis,
                            quarantine_analysis=request.quarantine_analysis,
                            quick_analysis=request.quick_analysis,
                            enable_keyword_detection=request.enable_keyword_detection,
                            keywords=request.keywords
                        )
                    finally:
                        # Restore original config if it existed
                        if config_was_none:
                            pipeline.config = None
                        elif original_config is not None:
                            pipeline.config.config = original_config.copy()
                        # Restore original custom prompts
                        pipeline.custom_prompts = original_custom_prompts
                    
                    # Format response
                    response = _format_analyze_response(result)
                    
                    # Save trace to database
                    # Initialize trace_policy_key before try block
                    trace_policy_key = policy_key if policy_key else (policy.policy_key if policy else None)
                    
                    try:
                        # Get client IP and user agent
                        client_ip = http_request.client.host if http_request.client else None
                        user_agent = http_request.headers.get("user-agent")
                        
                        request_data = {
                            "function_name": request.function_name,
                            "user_query": request.user_query,
                            "user_role": request.user_role,
                            "target_function": request.target_function,
                            "input_analysis": request.input_analysis,
                            "llm_analysis": request.llm_analysis,
                            "quarantine_analysis": request.quarantine_analysis,
                            "quick_analysis": request.quick_analysis,
                            "enable_keyword_detection": request.enable_keyword_detection
                        }
                        response_dict = response.model_dump(mode='json')
                        
                        AnalysisTraceRepository.create_trace(
                            db=db,
                            user_id=user_info.id,
                            api_key_id=user_info.api_key,
                            request_data=request_data,
                            response_data=response_dict,
                            ip_address=client_ip,
                            user_agent=user_agent,
                            policy_key=trace_policy_key
                        )
                    except Exception as e:
                        # Don't fail the request if trace saving fails, but log the error with details
                        import logging
                        import traceback
                        logging.error(f"Failed to save analysis trace: {str(e)}")
                        logging.error(f"Traceback: {traceback.format_exc()}")
                        logging.error(f"Policy key: {trace_policy_key}, User ID: {user_info.id}, API Key: {user_info.api_key}")
                    
                    return response
            
            # Use default pipeline config if no policy found
            result = pipeline.analyze(
                function_name=request.function_name,
                function_result=request.function_result,
                user_query=request.user_query,
                user_role=request.user_role,
                target_function=request.target_function,
                input_analysis=request.input_analysis,
                llm_analysis=request.llm_analysis,
                quarantine_analysis=request.quarantine_analysis,
                enable_keyword_detection=request.enable_keyword_detection,
                keywords=request.keywords
            )
            
            # Format response
            response = _format_analyze_response(result)
            
            # Save trace to database
            # Initialize trace_policy_key before try block
            trace_policy_key = policy_key if policy_key else None
            
            try:
                # Get client IP and user agent
                client_ip = http_request.client.host if http_request.client else None
                user_agent = http_request.headers.get("user-agent")
                
                request_data = {
                    "function_name": request.function_name,
                    "user_query": request.user_query,
                    "user_role": request.user_role,
                    "target_function": request.target_function,
                    "input_analysis": request.input_analysis,
                    "llm_analysis": request.llm_analysis,
                    "quarantine_analysis": request.quarantine_analysis,
                    "quick_analysis": request.quick_analysis,
                    "enable_keyword_detection": request.enable_keyword_detection
                }
                response_dict = response.model_dump(mode='json')
                
                AnalysisTraceRepository.create_trace(
                    db=db,
                    user_id=user_info.id,
                    api_key_id=user_info.api_key,
                    request_data=request_data,
                    response_data=response_dict,
                    ip_address=client_ip,
                    user_agent=user_agent,
                    policy_key=trace_policy_key
                )
            except Exception as e:
                # Don't fail the request if trace saving fails, but log the error with details
                import logging
                import traceback
                logging.error(f"Failed to save analysis trace: {str(e)}")
                logging.error(f"Traceback: {traceback.format_exc()}")
                logging.error(f"Policy key: {trace_policy_key}, User ID: {user_info.id}, API Key: {user_info.api_key}")
            
            return response
        finally:
            db.close()
    except Exception as e:
        print(str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )


def _format_analyze_response(result: Dict[str, Any]) -> AnalyzeResponse:
    """Format analysis result into response model."""
    return AnalyzeResponse(
        final_decision=result.get("final_decision", "ALLOWED"),
        final_score=result.get("final_score"),
        safe_to_use=result.get("safe_to_use", True),
        blocked_at=result.get("blocked_at"),
        reason=result.get("reason"),
        input_analysis=result.get("input_analysis"),
        quarantine_analysis=result.get("quarantine_analysis"),
        llm_analysis=result.get("llm_analysis"),
        keyword_detection=result.get("keyword_detection"),
        rbac_blocked=result.get("rbac_blocked"),
        chaining_blocked=result.get("chaining_blocked"),
        severity_rule=result.get("severity_rule"),
        output_restriction=result.get("output_restriction"),
        context_rule=result.get("context_rule"),
        warning=result.get("warning"),
        function_chaining_info=result.get("function_chaining_info")
    )


@router.get("/health")
async def health_check() -> Dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy", "service": "hipocap-v1"}


@router.get("/user-info")
async def get_user_info(
    request: Request,
    authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    Get current user information from API key.
    
    Returns user ID and email associated with the API key.
    """
    from ..auth.lmnr_validator import get_lmnr_user_by_api_key
    
    # Extract API key from Authorization header
    api_key = None
    if authorization:
        if authorization.startswith("Bearer "):
            api_key = authorization[7:]
        else:
            api_key = authorization
    
    # Also check X-API-Key header
    if not api_key:
        api_key = request.headers.get("X-API-Key")
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key is required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user info from API key
    user_info = get_lmnr_user_by_api_key(api_key)
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key or user not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return {
        "user_id": user_info["id"],
        "email": user_info["email"],
        "name": user_info.get("name")
    }


@router.post("/config/rbac", response_model=RBACUpdateResponse)
async def update_rbac(
    request: RBACUpdateRequest,
    pipeline: GuardPipeline = Depends(get_pipeline),
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info)
) -> RBACUpdateResponse:
    """
    Update RBAC configuration dynamically.
    
    Args:
        request: RBAC update request with roles and/or functions
        pipeline: GuardPipeline instance (injected dependency)
        
    Returns:
        Update response with status and counts
    """
    try:
        if not pipeline.config:
            raise HTTPException(
                status_code=400,
                detail="Pipeline does not have a configuration loaded"
            )
        
        # Update RBAC configuration
        pipeline.config.update_rbac(
            roles=request.roles,
            functions=request.functions
        )
        
        return RBACUpdateResponse(
            success=True,
            message="RBAC configuration updated successfully",
            roles_count=len(pipeline.config.get_all_roles()),
            functions_count=len(pipeline.config.get_all_functions())
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update RBAC configuration: {str(e)}"
        )


# Analysis Trace and Review Management Endpoints

@router.get("/traces/review-required", response_model=TraceListResponse)
async def get_review_required_traces(
    status: Optional[str] = Query(None, description="Filter by review status (pending, approved, rejected, reviewed)"),
    function_name: Optional[str] = Query(None, description="Filter by function name"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> TraceListResponse:
    """
    Get all traces that require review for the current user.
    
    Returns paginated list of review_required traces, sorted by created_at DESC.
    """
    try:
        # Get review required traces
        traces = AnalysisTraceRepository.get_review_required(
            db=db,
            user_id=user_info.id,
            status=status,
            limit=limit,
            offset=offset
        )
        
        # Get total count
        total = AnalysisTraceRepository.count_review_required(
            db=db,
            user_id=user_info.id,
            status=status
        )
        
        return TraceListResponse(
            traces=[AnalysisTraceResponse.model_validate(trace) for trace in traces],
            total=total,
            limit=limit,
            offset=offset
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch review required traces: {str(e)}"
        )


@router.get("/traces/stats", response_model=TraceStatsResponse)
async def get_trace_stats(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> TraceStatsResponse:
    """
    Get statistics about traces grouped by final_decision.
    
    Returns counts of blocked, allowed, and review_required traces,
    along with statistics grouped by function name.
    """
    try:
        # Get stats by decision
        stats_by_decision = AnalysisTraceRepository.get_stats_by_decision(
            db=db,
            user_id=user_info.id,
            start_date=start_date,
            end_date=end_date
        )
        
        # Get stats by function
        stats_by_function = AnalysisTraceRepository.get_stats_by_function(
            db=db,
            user_id=user_info.id,
            start_date=start_date,
            end_date=end_date
        )
        
        return TraceStatsResponse(
            total=stats_by_decision["total"],
            blocked=stats_by_decision["blocked"],
            allowed=stats_by_decision["allowed"],
            review_required=stats_by_decision["review_required"],
            by_function=stats_by_function
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch trace statistics: {str(e)}"
        )


# IMPORTANT: This route must be defined BEFORE /traces/{trace_id} to avoid route conflicts
# FastAPI matches routes in order, so specific paths must come before parameterized paths
@router.get("/traces/timeseries", response_model=TraceTimeSeriesResponse)
async def get_trace_timeseries(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    interval: str = Query("hour", description="Time interval: minute, hour, or day"),
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> TraceTimeSeriesResponse:
    """
    Get time-series statistics for blocked and allowed functions.
    
    Returns data points grouped by time intervals showing blocked and allowed counts over time.
    """
    try:
        # Validate interval
        valid_intervals = ["minute", "hour", "day"]
        if interval not in valid_intervals:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid interval. Must be one of: {', '.join(valid_intervals)}"
            )
        
        # Get time-series data
        time_series_data = AnalysisTraceRepository.get_time_series_stats(
            db=db,
            user_id=user_info.id,
            start_date=start_date,
            end_date=end_date,
            interval=interval
        )
        
        # Convert to response model
        items = [
            TraceTimeSeriesDataPoint(
                timestamp=item["timestamp"],
                blocked=item["blocked"],
                allowed=item["allowed"]
            )
            for item in time_series_data
        ]
        
        return TraceTimeSeriesResponse(items=items)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch time-series statistics: {str(e)}"
        )


@router.get("/traces/{trace_id}", response_model=AnalysisTraceResponse)
async def get_trace(
    trace_id: int,
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> AnalysisTraceResponse:
    """
    Get a specific trace by ID.
    
    Users can only view their own traces.
    """
    try:
        trace = AnalysisTraceRepository.get_by_id(db, trace_id)
        if not trace:
            raise HTTPException(status_code=404, detail="Trace not found")
        
        # Check permissions: user must own the trace
        if trace.user_id != user_info.id:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to view this trace"
            )
        
        return AnalysisTraceResponse.model_validate(trace)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch trace: {str(e)}"
        )


@router.post("/traces/{trace_id}/review", response_model=ReviewUpdateResponse)
async def update_review_status(
    trace_id: int,
    review_update: ReviewUpdateRequest,
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> ReviewUpdateResponse:
    """
    Update the review status of a trace.
    
    Valid statuses: approved, rejected, reviewed
    """
    try:
        # Validate status
        valid_statuses = ["approved", "rejected", "reviewed"]
        if review_update.status not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )
        
        trace = AnalysisTraceRepository.get_by_id(db, trace_id)
        if not trace:
            raise HTTPException(status_code=404, detail="Trace not found")
        
        # Check permissions: user must own the trace
        if trace.user_id != user_info.id:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to review this trace"
            )
        
        # Update review status
        updated_trace = AnalysisTraceRepository.update_review_status(
            db=db,
            trace_id=trace_id,
            status=review_update.status,
            reviewed_by=user_info.id,
            notes=review_update.notes
        )
        
        if not updated_trace:
            raise HTTPException(status_code=500, detail="Failed to update review status")
        
        return ReviewUpdateResponse(
            success=True,
            message=f"Review status updated to '{review_update.status}'",
            trace=AnalysisTraceResponse.model_validate(updated_trace)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update review status: {str(e)}"
        )


@router.get("/traces", response_model=TraceListResponse)
async def list_traces(
    function_name: Optional[str] = Query(None, description="Filter by function name"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    final_decision: Optional[str] = Query(None, description="Filter by final decision"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> TraceListResponse:
    """
    List all traces for the current user (for compliance queries).
    
    Returns paginated list sorted by created_at DESC.
    """
    try:
        # Get traces for compliance
        traces = AnalysisTraceRepository.get_for_compliance(
            db=db,
            user_id=user_info.id,
            start_date=start_date,
            end_date=end_date,
            function_name=function_name,
            final_decision=final_decision,
            limit=limit,
            offset=offset
        )
        
        # Get total count
        total = AnalysisTraceRepository.count_by_user(db, user_info.id)
        
        return TraceListResponse(
            traces=[AnalysisTraceResponse.model_validate(trace) for trace in traces],
            total=total,
            limit=limit,
            offset=offset
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch traces: {str(e)}"
        )
