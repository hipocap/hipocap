"""
Shield management routes.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from .models import (
    ShieldCreate, ShieldUpdate, ShieldResponse, ShieldUpdateResponse,
    ShieldAnalyzeRequest, ShieldAnalyzeResponse
)
from ..database.connection import get_db
from ..database.repositories.shield_repository import ShieldRepository
from ..auth.middleware import get_lmnr_user_info, LMNRUserInfo
from ..pipeline import GuardPipeline
from .routes import get_pipeline

router = APIRouter(prefix="/api/v1/shields", tags=["shields"])


@router.post("", response_model=ShieldResponse, status_code=status.HTTP_201_CREATED)
async def create_shield(
    shield_data: ShieldCreate,
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> ShieldResponse:
    """Create a new shield."""
    # Check if shield_key already exists
    existing = ShieldRepository.get_by_key(db, shield_data.shield_key)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Shield with key '{shield_data.shield_key}' already exists"
        )
    
    try:
        shield = ShieldRepository.create(
            db=db,
            shield_key=shield_data.shield_key,
            name=shield_data.name,
            owner_id=user_info.id,
            content=shield_data.content,
            description=shield_data.description
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    return ShieldResponse(
        id=shield.id,
        shield_key=shield.shield_key,
        name=shield.name,
        description=shield.description,
        prompt_description=shield.prompt_description,
        what_to_block=shield.what_to_block,
        what_not_to_block=shield.what_not_to_block,
        owner_id=shield.owner_id,
        is_active=shield.is_active,
        created_at=shield.created_at.isoformat() if shield.created_at else "",
        updated_at=shield.updated_at.isoformat() if shield.updated_at else None
    )


@router.get("", response_model=List[ShieldResponse])
async def list_shields(
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db),
    owner_only: bool = False
) -> List[ShieldResponse]:
    """List all shields (or only current user's shields if owner_only=True)."""
    if owner_only:
        shields = ShieldRepository.get_by_owner(db, user_info.id)
    else:
        # For now, users can only see their own shields
        shields = ShieldRepository.get_by_owner(db, user_info.id)
    
    return [
        ShieldResponse(
            id=shield.id,
            shield_key=shield.shield_key,
            name=shield.name,
            description=shield.description,
            prompt_description=shield.prompt_description,
            what_to_block=shield.what_to_block,
            what_not_to_block=shield.what_not_to_block,
            owner_id=shield.owner_id,
            is_active=shield.is_active,
            created_at=shield.created_at.isoformat() if shield.created_at else "",
            updated_at=shield.updated_at.isoformat() if shield.updated_at else None
        )
        for shield in shields
    ]


@router.get("/{shield_key}", response_model=ShieldResponse)
async def get_shield(
    shield_key: str,
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> ShieldResponse:
    """Get a specific shield by key."""
    shield = ShieldRepository.get_by_key(db, shield_key)
    if not shield:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shield '{shield_key}' not found"
        )
    
    # Check permissions - only owner can access
    if shield.owner_id != user_info.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this shield"
        )
    
    return ShieldResponse(
        id=shield.id,
        shield_key=shield.shield_key,
        name=shield.name,
        description=shield.description,
        prompt_description=shield.prompt_description,
        what_to_block=shield.what_to_block,
        what_not_to_block=shield.what_not_to_block,
        owner_id=shield.owner_id,
        is_active=shield.is_active,
        created_at=shield.created_at.isoformat() if shield.created_at else "",
        updated_at=shield.updated_at.isoformat() if shield.updated_at else None
    )


@router.put("/{shield_id}", response_model=ShieldUpdateResponse)
async def update_shield(
    shield_id: int,
    shield_data: ShieldUpdate,
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> ShieldUpdateResponse:
    """
    Update a shield with detailed change tracking.
    
    This endpoint supports partial updates.
    """
    shield = ShieldRepository.get_by_id(db, shield_id)
    if not shield:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shield with ID {shield_id} not found"
        )
    
    # Check permissions - only owner can update
    if shield.owner_id != user_info.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this shield. Only the owner can update shields."
        )
    
    # Validate that at least one field is being updated
    update_fields = {
        "name": shield_data.name,
        "description": shield_data.description,
        "content": shield_data.content,
        "is_active": shield_data.is_active
    }
    
    if all(v is None for v in update_fields.values()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update. At least one field must be specified."
        )
    
    try:
        updated_shield, changes = ShieldRepository.update(
            db=db,
            shield_id=shield_id,
            name=shield_data.name,
            description=shield_data.description,
            content=shield_data.content,
            is_active=shield_data.is_active
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    if not updated_shield:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update shield"
        )
    
    shield_response = ShieldResponse(
        id=updated_shield.id,
        shield_key=updated_shield.shield_key,
        name=updated_shield.name,
        description=updated_shield.description,
        prompt_description=updated_shield.prompt_description,
        what_to_block=updated_shield.what_to_block,
        what_not_to_block=updated_shield.what_not_to_block,
        owner_id=updated_shield.owner_id,
        is_active=updated_shield.is_active,
        created_at=updated_shield.created_at.isoformat() if updated_shield.created_at else "",
        updated_at=updated_shield.updated_at.isoformat() if updated_shield.updated_at else None
    )
    
    return ShieldUpdateResponse(
        success=True,
        shield=shield_response,
        changes=changes
    )


@router.patch("/{shield_key}", response_model=ShieldUpdateResponse)
async def patch_shield_by_key(
    shield_key: str,
    shield_data: ShieldUpdate,
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> ShieldUpdateResponse:
    """
    Partially update a shield by shield_key with detailed change tracking.
    
    This is a convenience endpoint that allows updating by shield_key instead of ID.
    """
    shield = ShieldRepository.get_by_key(db, shield_key)
    if not shield:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shield with key '{shield_key}' not found"
        )
    
    # Check permissions - only owner can update
    if shield.owner_id != user_info.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this shield. Only the owner can update shields."
        )
    
    # Validate that at least one field is being updated
    update_fields = {
        "name": shield_data.name,
        "description": shield_data.description,
        "content": shield_data.content,
        "is_active": shield_data.is_active
    }
    
    if all(v is None for v in update_fields.values()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update. At least one field must be specified."
        )
    
    try:
        updated_shield, changes = ShieldRepository.update(
            db=db,
            shield_id=shield.id,
            name=shield_data.name,
            description=shield_data.description,
            content=shield_data.content,
            is_active=shield_data.is_active
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    if not updated_shield:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update shield"
        )
    
    shield_response = ShieldResponse(
        id=updated_shield.id,
        shield_key=updated_shield.shield_key,
        name=updated_shield.name,
        description=updated_shield.description,
        prompt_description=updated_shield.prompt_description,
        what_to_block=updated_shield.what_to_block,
        what_not_to_block=updated_shield.what_not_to_block,
        owner_id=updated_shield.owner_id,
        is_active=updated_shield.is_active,
        created_at=updated_shield.created_at.isoformat() if updated_shield.created_at else "",
        updated_at=updated_shield.updated_at.isoformat() if updated_shield.updated_at else None
    )
    
    return ShieldUpdateResponse(
        success=True,
        shield=shield_response,
        changes=changes
    )


@router.delete("/{shield_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shield(
    shield_id: int,
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
):
    """Delete a shield."""
    shield = ShieldRepository.get_by_id(db, shield_id)
    if not shield:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shield not found"
        )
    
    # Check permissions - only owner can delete
    if shield.owner_id != user_info.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this shield"
        )
    
    ShieldRepository.delete(db, shield_id)


@router.post("/{shield_key}/analyze", response_model=ShieldAnalyzeResponse)
async def analyze_with_shield(
    shield_key: str,
    request: ShieldAnalyzeRequest,
    http_request: Request,
    pipeline: GuardPipeline = Depends(get_pipeline),
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> ShieldAnalyzeResponse:
    """
    Analyze any text content using a shield's custom blocking rules.
    
    Uses the shield's prompt_description, what_to_block, and what_not_to_block
    to create a custom analysis prompt. Returns a simple BLOCK or ALLOW decision
    with an optional one-liner reason.
    
    Args:
        shield_key: The shield key to use for analysis
        request: Analysis request with content to analyze
        pipeline: GuardPipeline instance (injected dependency)
        user_info: Authenticated user information
        db: Database session
        
    Returns:
        ShieldAnalyzeResponse with BLOCK/ALLOW decision and optional reason
    """
    # Load shield from database
    shield = ShieldRepository.get_by_key(db, shield_key)
    if not shield:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shield '{shield_key}' not found"
        )
    
    # Check permissions - only owner can use
    if shield.owner_id != user_info.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to use this shield"
        )
    
    # Check if shield is active
    if not shield.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Shield is not active"
        )
    
    # Build custom prompt from shield content
    custom_prompt = f"""You are a security analysis agent. Analyze the provided content based on the following custom rules.

PROMPT DESCRIPTION:
{shield.prompt_description}

WHAT TO BLOCK:
{shield.what_to_block}

WHAT NOT TO BLOCK:
{shield.what_not_to_block}

Your task:
1. Analyze the provided content against the blocking rules above
2. Determine if the content matches anything in "WHAT TO BLOCK" (excluding items in "WHAT NOT TO BLOCK")
3. Return a decision: "BLOCK" if content should be blocked, "ALLOW" if content is safe
4. If blocking, provide a brief one-line reason explaining why

Be precise and only block content that clearly matches the blocking criteria while respecting the exceptions."""
    
    # Store original custom prompts
    original_custom_prompts = pipeline.custom_prompts or {}
    
    # Set custom prompt for LLM analysis
    pipeline.custom_prompts = {
        "llm_agent_system_prompt": custom_prompt
    }
    
    try:
        # Perform analysis using the pipeline with custom shield prompt
        # Pass content as function_result with a generic function name for pipeline compatibility
        result = pipeline.analyze(
            function_name="user_input",  # Generic function name for any text input
            function_result=request.content,  # The content to analyze
            function_args=None,
            user_query=request.user_query,
            input_analysis=False,  # Skip input analysis for shield-based analysis
            llm_analysis=True,  # Use LLM analysis with custom prompt
            quarantine_analysis=False,  # Skip quarantine for simplicity
            quick_analysis=True  # Use quick mode for simpler output
        )
        
        # Extract decision from result
        final_decision = result.get("final_decision", "ALLOWED")
        safe_to_use = result.get("safe_to_use", True)
        
        # Convert to BLOCK/ALLOW format
        if final_decision in ["BLOCKED", "BLOCK"] or not safe_to_use:
            decision = "BLOCK"
        else:
            decision = "ALLOW"
        
        # Extract reason if needed
        reason = None
        if request.require_reason:
            # Get reason from analysis result
            reason = result.get("reason") or result.get("llm_analysis", {}).get("summary")
            if not reason:
                # Generate a simple reason based on decision
                if decision == "BLOCK":
                    reason = "Content matches blocking criteria defined in shield"
                else:
                    reason = "Content does not match blocking criteria"
        
        return ShieldAnalyzeResponse(
            decision=decision,
            reason=reason
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )
    
    finally:
        # Restore original custom prompts
        pipeline.custom_prompts = original_custom_prompts

