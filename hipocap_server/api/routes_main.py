"""
API route handlers for hipocap-v1 server.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Request, Header
from fastapi import status
from sqlalchemy.orm import Session
from .models import AnalyzeRequest, AnalyzeResponse, RBACUpdateRequest, RBACUpdateResponse
from ..pipeline import GuardPipeline, create_guard_pipeline
from ..config import Config
from ..database.connection import get_db
from ..database.repositories import AuditRepository
from ..auth.dependencies import get_current_api_key, get_current_instance
from ..auth.middleware import get_lmnr_user_info, LMNRUserInfo
import os
import time
from datetime import date
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Global pipeline configuration (for default/fallback)
# These are loaded from environment variables with defaults
_default_openai_api_key: str = os.getenv("OPENAI_API_KEY")
_default_openai_base_url: str = os.getenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
_default_openai_model: str = os.getenv("OPENAI_MODEL", "x-ai/grok-4.1-fast")
_default_infection_model: str = os.getenv("INFECTION_MODEL")
_default_analysis_model: str = os.getenv("ANALYSIS_MODEL")
_default_guard_model: str = os.getenv("GUARD_MODEL", "meta-llama/Prompt-Guard-86M")


def initialize_pipeline(
    openai_api_key: str = None,
    openai_base_url: str = None,
    openai_model: str = None,
    infection_model: str = None,
    analysis_model: str = None,
    guard_model: str = None,
    **kwargs
) -> None:
    """
    Initialize global pipeline configuration (not the pipeline itself).
    
    Args:
        openai_api_key: OpenAI API key (or set OPENAI_API_KEY env var)
        openai_base_url: Custom base URL for OpenAI-compatible API (or set OPENAI_BASE_URL env var)
        openai_model: Default model name (or set OPENAI_MODEL env var)
        infection_model: Model for Stage 1 infection simulation (or set INFECTION_MODEL env var)
        analysis_model: Model for Stage 2 analysis/evaluation (or set ANALYSIS_MODEL env var)
        guard_model: Model for Prompt Guard (or set GUARD_MODEL env var)
        config_path: Path to configuration file (for fallback)
        **kwargs: Additional pipeline arguments
    """
    global _default_openai_api_key, _default_openai_base_url, _default_openai_model
    global _default_infection_model, _default_analysis_model, _default_guard_model
    
    # Get from environment if not provided
    _default_openai_api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
    _default_openai_base_url = openai_base_url or os.getenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
    _default_openai_model = openai_model or os.getenv("OPENAI_MODEL", "x-ai/grok-4.1-fast")
    _default_infection_model = infection_model or os.getenv("INFECTION_MODEL")
    _default_analysis_model = analysis_model or os.getenv("ANALYSIS_MODEL")
    _default_guard_model = guard_model or os.getenv("GUARD_MODEL", "meta-llama/Prompt-Guard-86M")


def get_pipeline_for_instance(
    instance_config: Dict[str, Any],
    db: Session,
    openai_api_key: str = None,
    openai_base_url: str = None,
    openai_model: str = None,
    infection_model: str = None,
    analysis_model: str = None,
    guard_model: str = None
) -> GuardPipeline:
    """
    Create a pipeline instance for a specific instance configuration.
    
    Args:
        instance_config: Instance configuration (config_json from database)
        db: Database session
        openai_api_key: OpenAI API key (uses default if not provided)
        openai_base_url: Custom base URL (uses default if not provided)
        openai_model: Default model name (uses default if not provided)
        infection_model: Model for Stage 1 infection simulation (uses default if not provided)
        analysis_model: Model for Stage 2 analysis/evaluation (uses default if not provided)
        guard_model: Model for Prompt Guard (uses default if not provided)
        
    Returns:
        GuardPipeline instance configured for the instance
    """
    # Use defaults if not provided
    api_key = openai_api_key or _default_openai_api_key
    base_url = openai_base_url or _default_openai_base_url
    model = openai_model or _default_openai_model
    infection = infection_model or _default_infection_model
    analysis = analysis_model or _default_analysis_model
    guard = guard_model or _default_guard_model
    
    # Merge instance config with default config structure
    # Instance config should contain: roles, functions, severity_rules, etc.
    config_dict = instance_config or {}
    
    # Create Config object from instance config
    config = Config(config_dict=config_dict)
    
    # Create pipeline with instance-specific config
    # Pass config via kwargs since create_guard_pipeline accepts **kwargs
    pipeline = create_guard_pipeline(
        openai_api_key=api_key,
        openai_base_url=base_url,
        openai_model=model,
        infection_model=infection,
        analysis_model=analysis,
        guard_model=guard,
        config=config,  # Pass config object via kwargs
        verbose=False
    )
    
    return pipeline


# Create router
router = APIRouter(prefix="/api/v1", tags=["analysis"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    request: AnalyzeRequest,
    http_request: Request,
    api_key = Depends(get_current_api_key),
    instance = Depends(get_current_instance),
    db: Session = Depends(get_db)
) -> AnalyzeResponse:
    """
    Analyze a function call for security threats.
    
    Requires API key authentication. Uses instance-specific configuration.
    Logs all requests to audit logs and updates usage analytics.
    
    Args:
        request: Analysis request with function details
        http_request: HTTP request object (for IP address and user agent)
        api_key: Validated API key (injected dependency)
        instance: Instance associated with the API key (injected dependency)
        db: Database session (injected dependency)
        
    Returns:
        Analysis response with decision and details
    """
    start_time = time.time()
    
    try:
        # Get instance configuration
        instance_config = instance.config_json or {}
        
        # Create pipeline for this instance
        pipeline = get_pipeline_for_instance(
            instance_config=instance_config,
            db=db,
            openai_api_key=_default_openai_api_key,
            openai_base_url=_default_openai_base_url,
            openai_model=_default_openai_model
        )
        
        # Perform analysis
        result = pipeline.analyze(
            function_name=request.function_name,
            function_result=request.function_result,
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
        
        # Calculate response time
        response_time = time.time() - start_time
        
        # Prepare response
        response = AnalyzeResponse(
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
        
        # Get client IP and user agent
        client_ip = http_request.client.host if http_request.client else None
        user_agent = http_request.headers.get("user-agent")
        
        # Log to audit logs
        AuditRepository.create_audit_log(
            db=db,
            instance_id=instance.id,
            api_key_id=api_key.id,
            action="analyze",
            function_name=request.function_name,
            request_data={
                "function_name": request.function_name,
                "user_query": request.user_query,
                "user_role": request.user_role,
                "target_function": request.target_function,
                "input_analysis": request.input_analysis,
                "llm_analysis": request.llm_analysis,
                "quarantine_analysis": request.quarantine_analysis,
                "quick_analysis": request.quick_analysis,
                "enable_keyword_detection": request.enable_keyword_detection
            },
            response_data={
                "final_decision": response.final_decision,
                "safe_to_use": response.safe_to_use,
                "blocked_at": response.blocked_at,
                "reason": response.reason
            },
            ip_address=client_ip,
            user_agent=user_agent
        )
        
        # Update usage analytics
        today = date.today()
        analytics = AuditRepository.get_or_create_analytics(
            db=db,
            instance_id=instance.id,
            analytics_date=today,
            function_name=request.function_name
        )
        
        # Update analytics counts
        request_count = 1
        blocked_count = 1 if response.final_decision == "BLOCKED" else 0
        allowed_count = 1 if response.final_decision in ["ALLOWED", "ALLOWED_WITH_WARNING"] else 0
        
        AuditRepository.update_analytics(
            db=db,
            analytics=analytics,
            request_count=request_count,
            blocked_count=blocked_count,
            allowed_count=allowed_count,
            response_time=response_time
        )
        
        return response
        
    except Exception as e:
        # Log error to audit logs
        client_ip = http_request.client.host if http_request.client else None
        user_agent = http_request.headers.get("user-agent")
        
        try:
            AuditRepository.create_audit_log(
                db=db,
                instance_id=instance.id,
                api_key_id=api_key.id,
                action="analyze_error",
                function_name=request.function_name,
                request_data={
                    "function_name": request.function_name,
                    "error": str(e)
                },
                ip_address=client_ip,
                user_agent=user_agent
            )
        except:
            pass  # Don't fail if audit logging fails
        
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
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
    api_key = Depends(get_current_api_key),
    instance = Depends(get_current_instance),
    db: Session = Depends(get_db)
) -> RBACUpdateResponse:
    """
    Update RBAC configuration dynamically for the current instance.
    
    Args:
        request: RBAC update request with roles and/or functions
        api_key: Validated API key (injected dependency)
        instance: Instance associated with the API key (injected dependency)
        db: Database session (injected dependency)
        
    Returns:
        Update response with status and counts
    """
    try:
        # Get current instance configuration
        instance_config = instance.config_json or {}
        
        # Create a temporary Config object to use update_rbac method
        config = Config(config_dict=instance_config)
        
        # Update RBAC configuration
        config.update_rbac(
            roles=request.roles,
            functions=request.functions
        )
        
        # Update instance config in database
        from ..database.repositories import InstanceRepository
        InstanceRepository.update(db, instance, config_json=config.config)
        
        # Log the update
        AuditRepository.create_audit_log(
            db=db,
            instance_id=instance.id,
            api_key_id=api_key.id,
            action="rbac_update",
            request_data={"roles": request.roles, "functions": request.functions}
        )
        
        return RBACUpdateResponse(
            success=True,
            message="RBAC configuration updated successfully",
            roles_count=len(config.get_all_roles()),
            functions_count=len(config.get_all_functions())
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update RBAC configuration: {str(e)}"
        )

