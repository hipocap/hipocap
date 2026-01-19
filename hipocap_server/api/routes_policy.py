"""
Governance policy management routes.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from .models import PolicyCreate, PolicyUpdate, PolicyResponse, PolicyUpdateResponse
from ..database.connection import get_db
from ..database.repositories.policy_repository import PolicyRepository
from ..database.init_db import create_default_policy
from ..auth.middleware import get_lmnr_user_info, LMNRUserInfo

router = APIRouter(prefix="/api/v1/policies", tags=["policies"])


@router.post("", response_model=PolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_policy(
    policy_data: PolicyCreate,
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> PolicyResponse:
    """Create a new governance policy."""
    # Check if policy_key already exists
    existing = PolicyRepository.get_by_key(db, policy_data.policy_key)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Policy with key '{policy_data.policy_key}' already exists"
        )
    
    # Normalize severity_rules: if None or empty dict, pass None to repository so defaults are applied
    severity_rules = policy_data.severity_rules
    if severity_rules is not None and len(severity_rules) == 0:
        severity_rules = None
    
    policy = PolicyRepository.create(
        db=db,
        policy_key=policy_data.policy_key,
        name=policy_data.name,
        owner_id=user_info.id,
        description=policy_data.description,
        roles=policy_data.roles,
        functions=policy_data.functions,
        severity_rules=severity_rules,
        output_restrictions=policy_data.output_restrictions,
        function_chaining=policy_data.function_chaining,
        context_rules=policy_data.context_rules,
        decision_thresholds=policy_data.decision_thresholds,
        custom_prompts=policy_data.custom_prompts,
        is_default=policy_data.is_default
    )
    
    return PolicyResponse(
        id=policy.id,
        policy_key=policy.policy_key,
        name=policy.name,
        description=policy.description,
        owner_id=policy.owner_id,
        roles=policy.roles,
        functions=policy.functions,
        severity_rules=policy.severity_rules,
        output_restrictions=policy.output_restrictions,
        function_chaining=policy.function_chaining,
        context_rules=policy.context_rules,
        decision_thresholds=policy.decision_thresholds,
        custom_prompts=policy.custom_prompts,
        is_active=policy.is_active,
        is_default=policy.is_default,
        created_at=policy.created_at.isoformat() if policy.created_at else "",
        updated_at=policy.updated_at.isoformat() if policy.updated_at else None
    )


@router.get("", response_model=List[PolicyResponse])
async def list_policies(
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db),
    owner_only: bool = False
) -> List[PolicyResponse]:
    """List all policies (or only current user's policies if owner_only=True)."""
    if owner_only:
        policies = PolicyRepository.get_by_owner(db, user_info.id)
    else:
        # For now, users can only see their own policies
        # Admin check can be added later if needed via LMNR user roles
        policies = PolicyRepository.get_by_owner(db, user_info.id)
    
    # Auto-create default policy if user has no policies and no default policy exists
    if not policies:
        # Check if default policy exists by key (might exist but not be set as default)
        existing_default = PolicyRepository.get_by_key(db, "default")
        if not existing_default:
            # Create default policy for this user
            try:
                create_default_policy(user_info.id)
                # Refresh policies list
                policies = PolicyRepository.get_by_owner(db, user_info.id)
            except Exception as e:
                # Log error but don't fail the request
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to auto-create default policy: {e}")
    
    return [
        PolicyResponse(
            id=policy.id,
            policy_key=policy.policy_key,
            name=policy.name,
            description=policy.description,
            owner_id=policy.owner_id,
            roles=policy.roles,
            functions=policy.functions,
            severity_rules=policy.severity_rules,
            output_restrictions=policy.output_restrictions,
            function_chaining=policy.function_chaining,
            context_rules=policy.context_rules,
            decision_thresholds=policy.decision_thresholds,
            custom_prompts=policy.custom_prompts,
            is_active=policy.is_active,
            is_default=policy.is_default,
            created_at=policy.created_at.isoformat() if policy.created_at else "",
            updated_at=policy.updated_at.isoformat() if policy.updated_at else None
        )
        for policy in policies
    ]


@router.get("/{policy_key}", response_model=PolicyResponse)
async def get_policy(
    policy_key: str,
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> PolicyResponse:
    """Get a specific policy by key."""
    policy = PolicyRepository.get_by_key(db, policy_key)
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy '{policy_key}' not found"
        )
    
    # Check permissions - only owner can access
    if policy.owner_id != user_info.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this policy"
        )
    
    return PolicyResponse(
        id=policy.id,
        policy_key=policy.policy_key,
        name=policy.name,
        description=policy.description,
        owner_id=policy.owner_id,
        roles=policy.roles,
        functions=policy.functions,
        severity_rules=policy.severity_rules,
        output_restrictions=policy.output_restrictions,
        function_chaining=policy.function_chaining,
        context_rules=policy.context_rules,
        decision_thresholds=policy.decision_thresholds,
        custom_prompts=policy.custom_prompts,
        is_active=policy.is_active,
        is_default=policy.is_default,
        created_at=policy.created_at.isoformat() if policy.created_at else "",
        updated_at=policy.updated_at.isoformat() if policy.updated_at else None
    )


@router.put("/{policy_id}", response_model=PolicyUpdateResponse)
async def update_policy(
    policy_id: int,
    policy_data: PolicyUpdate,
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> PolicyUpdateResponse:
    """
    Update a policy with detailed change tracking.
    
    This endpoint supports partial updates and deep merging of nested structures.
    - Simple fields (name, description) are replaced
    - Nested dictionaries (roles, functions, severity_rules, etc.) are merged by default
    - Context rules are replaced entirely
    - Returns detailed information about what changed
    """
    policy = PolicyRepository.get_by_id(db, policy_id)
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy with ID {policy_id} not found"
        )
    
    # Check permissions - only owner can update
    if policy.owner_id != user_info.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this policy. Only the owner can update policies."
        )
    
    # Validate that at least one field is being updated
    update_fields = {
        "name": policy_data.name,
        "description": policy_data.description,
        "roles": policy_data.roles,
        "functions": policy_data.functions,
        "severity_rules": policy_data.severity_rules,
        "output_restrictions": policy_data.output_restrictions,
        "function_chaining": policy_data.function_chaining,
        "context_rules": policy_data.context_rules,
        "decision_thresholds": policy_data.decision_thresholds,
        "custom_prompts": policy_data.custom_prompts,
        "is_active": policy_data.is_active,
        "is_default": policy_data.is_default
    }
    
    if all(v is None for v in update_fields.values()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update. At least one field must be specified."
        )
    
    warnings = []
    
    # Check if trying to set as default when another default exists
    if policy_data.is_default and not policy.is_default:
        existing_default = PolicyRepository.get_default(db)
        if existing_default and existing_default.id != policy_id:
            warnings.append(f"Policy '{existing_default.policy_key}' was previously set as default and has been unset.")
    
    updated_policy, changes = PolicyRepository.update(
        db=db,
        policy_id=policy_id,
        name=policy_data.name,
        description=policy_data.description,
        roles=policy_data.roles,
        functions=policy_data.functions,
        severity_rules=policy_data.severity_rules,
        output_restrictions=policy_data.output_restrictions,
        function_chaining=policy_data.function_chaining,
        context_rules=policy_data.context_rules,
        decision_thresholds=policy_data.decision_thresholds,
        custom_prompts=policy_data.custom_prompts,
        is_active=policy_data.is_active,
        is_default=policy_data.is_default,
        merge_nested=True
    )
    
    if not updated_policy:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update policy"
        )
    
    policy_response = PolicyResponse(
        id=updated_policy.id,
        policy_key=updated_policy.policy_key,
        name=updated_policy.name,
        description=updated_policy.description,
        owner_id=updated_policy.owner_id,
        roles=updated_policy.roles,
        functions=updated_policy.functions,
        severity_rules=updated_policy.severity_rules,
        output_restrictions=updated_policy.output_restrictions,
        function_chaining=updated_policy.function_chaining,
        context_rules=updated_policy.context_rules,
        decision_thresholds=updated_policy.decision_thresholds,
        is_active=updated_policy.is_active,
        is_default=updated_policy.is_default,
        created_at=updated_policy.created_at.isoformat() if updated_policy.created_at else "",
        updated_at=updated_policy.updated_at.isoformat() if updated_policy.updated_at else None
    )
    
    return PolicyUpdateResponse(
        success=True,
        policy=policy_response,
        changes=changes,
        warnings=warnings if warnings else None
    )


@router.patch("/{policy_key}", response_model=PolicyUpdateResponse)
async def patch_policy_by_key(
    policy_key: str,
    policy_data: PolicyUpdate,
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> PolicyUpdateResponse:
    """
    Partially update a policy by policy_key with detailed change tracking.
    
    This is a convenience endpoint that allows updating by policy_key instead of ID.
    Supports the same deep merging behavior as PUT /{policy_id}.
    """
    policy = PolicyRepository.get_by_key(db, policy_key)
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy with key '{policy_key}' not found"
        )
    
    # Check permissions - only owner can update
    if policy.owner_id != user_info.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this policy. Only the owner can update policies."
        )
    
    # Validate that at least one field is being updated
    update_fields = {
        "name": policy_data.name,
        "description": policy_data.description,
        "roles": policy_data.roles,
        "functions": policy_data.functions,
        "severity_rules": policy_data.severity_rules,
        "output_restrictions": policy_data.output_restrictions,
        "function_chaining": policy_data.function_chaining,
        "context_rules": policy_data.context_rules,
        "decision_thresholds": policy_data.decision_thresholds,
        "custom_prompts": policy_data.custom_prompts,
        "is_active": policy_data.is_active,
        "is_default": policy_data.is_default
    }
    
    if all(v is None for v in update_fields.values()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update. At least one field must be specified."
        )
    
    warnings = []
    
    # Check if trying to set as default when another default exists
    if policy_data.is_default and not policy.is_default:
        existing_default = PolicyRepository.get_default(db)
        if existing_default and existing_default.id != policy.id:
            warnings.append(f"Policy '{existing_default.policy_key}' was previously set as default and has been unset.")
    
    updated_policy, changes = PolicyRepository.update(
        db=db,
        policy_id=policy.id,
        name=policy_data.name,
        description=policy_data.description,
        roles=policy_data.roles,
        functions=policy_data.functions,
        severity_rules=policy_data.severity_rules,
        output_restrictions=policy_data.output_restrictions,
        function_chaining=policy_data.function_chaining,
        context_rules=policy_data.context_rules,
        decision_thresholds=policy_data.decision_thresholds,
        custom_prompts=policy_data.custom_prompts,
        is_active=policy_data.is_active,
        is_default=policy_data.is_default,
        merge_nested=True
    )
    
    if not updated_policy:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update policy"
        )
    
    policy_response = PolicyResponse(
        id=updated_policy.id,
        policy_key=updated_policy.policy_key,
        name=updated_policy.name,
        description=updated_policy.description,
        owner_id=updated_policy.owner_id,
        roles=updated_policy.roles,
        functions=updated_policy.functions,
        severity_rules=updated_policy.severity_rules,
        output_restrictions=updated_policy.output_restrictions,
        function_chaining=updated_policy.function_chaining,
        context_rules=updated_policy.context_rules,
        decision_thresholds=updated_policy.decision_thresholds,
        is_active=updated_policy.is_active,
        is_default=updated_policy.is_default,
        created_at=updated_policy.created_at.isoformat() if updated_policy.created_at else "",
        updated_at=updated_policy.updated_at.isoformat() if updated_policy.updated_at else None
    )
    
    return PolicyUpdateResponse(
        success=True,
        policy=policy_response,
        changes=changes,
        warnings=warnings if warnings else None
    )


@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_policy(
    policy_id: int,
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
):
    """Delete a policy."""
    policy = PolicyRepository.get_by_id(db, policy_id)
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy not found"
        )
    
    # Check permissions - only owner can delete
    if policy.owner_id != user_info.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this policy"
        )
    
    PolicyRepository.delete(db, policy_id)


@router.get("/default/active", response_model=PolicyResponse)
async def get_default_policy(
    db: Session = Depends(get_db)
) -> PolicyResponse:
    """Get the default active policy (public endpoint, no auth required for reading)."""
    policy = PolicyRepository.get_default(db)
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No default policy found"
        )
    
    return PolicyResponse(
        id=policy.id,
        policy_key=policy.policy_key,
        name=policy.name,
        description=policy.description,
        owner_id=policy.owner_id,
        roles=policy.roles,
        functions=policy.functions,
        severity_rules=policy.severity_rules,
        output_restrictions=policy.output_restrictions,
        function_chaining=policy.function_chaining,
        context_rules=policy.context_rules,
        decision_thresholds=policy.decision_thresholds,
        custom_prompts=policy.custom_prompts,
        is_active=policy.is_active,
        is_default=policy.is_default,
        created_at=policy.created_at.isoformat() if policy.created_at else "",
        updated_at=policy.updated_at.isoformat() if policy.updated_at else None
    )


@router.delete("/{policy_id}/roles/{role_name}", response_model=PolicyResponse)
async def delete_role(
    policy_id: int,
    role_name: str,
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> PolicyResponse:
    """Delete a role from a policy."""
    policy = PolicyRepository.get_by_id(db, policy_id)
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy with ID {policy_id} not found"
        )
    
    # Check permissions - only owner can delete
    if policy.owner_id != user_info.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this policy"
        )
    
    updated_policy = PolicyRepository.delete_role(db, policy_id, role_name)
    if not updated_policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role '{role_name}' not found in policy"
        )
    
    return PolicyResponse(
        id=updated_policy.id,
        policy_key=updated_policy.policy_key,
        name=updated_policy.name,
        description=updated_policy.description,
        owner_id=updated_policy.owner_id,
        roles=updated_policy.roles,
        functions=updated_policy.functions,
        severity_rules=updated_policy.severity_rules,
        output_restrictions=updated_policy.output_restrictions,
        function_chaining=updated_policy.function_chaining,
        context_rules=updated_policy.context_rules,
        decision_thresholds=updated_policy.decision_thresholds,
        is_active=updated_policy.is_active,
        is_default=updated_policy.is_default,
        created_at=updated_policy.created_at.isoformat() if updated_policy.created_at else "",
        updated_at=updated_policy.updated_at.isoformat() if updated_policy.updated_at else None
    )


@router.delete("/{policy_id}/functions/{function_name}", response_model=PolicyResponse)
async def delete_function(
    policy_id: int,
    function_name: str,
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> PolicyResponse:
    """Delete a function from a policy."""
    policy = PolicyRepository.get_by_id(db, policy_id)
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy with ID {policy_id} not found"
        )
    
    # Check permissions - only owner can delete
    if policy.owner_id != user_info.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this policy"
        )
    
    updated_policy = PolicyRepository.delete_function(db, policy_id, function_name)
    if not updated_policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Function '{function_name}' not found in policy"
        )
    
    return PolicyResponse(
        id=updated_policy.id,
        policy_key=updated_policy.policy_key,
        name=updated_policy.name,
        description=updated_policy.description,
        owner_id=updated_policy.owner_id,
        roles=updated_policy.roles,
        functions=updated_policy.functions,
        severity_rules=updated_policy.severity_rules,
        output_restrictions=updated_policy.output_restrictions,
        function_chaining=updated_policy.function_chaining,
        context_rules=updated_policy.context_rules,
        decision_thresholds=updated_policy.decision_thresholds,
        is_active=updated_policy.is_active,
        is_default=updated_policy.is_default,
        created_at=updated_policy.created_at.isoformat() if updated_policy.created_at else "",
        updated_at=updated_policy.updated_at.isoformat() if updated_policy.updated_at else None
    )


@router.delete("/{policy_id}/severity-rules/{severity_level}", response_model=PolicyResponse)
async def delete_severity_rule(
    policy_id: int,
    severity_level: str,
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> PolicyResponse:
    """Delete a severity rule from a policy."""
    policy = PolicyRepository.get_by_id(db, policy_id)
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy with ID {policy_id} not found"
        )
    
    # Check permissions - only owner can delete
    if policy.owner_id != user_info.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this policy"
        )
    
    updated_policy = PolicyRepository.delete_severity_rule(db, policy_id, severity_level)
    if not updated_policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Severity rule '{severity_level}' not found in policy"
        )
    
    return PolicyResponse(
        id=updated_policy.id,
        policy_key=updated_policy.policy_key,
        name=updated_policy.name,
        description=updated_policy.description,
        owner_id=updated_policy.owner_id,
        roles=updated_policy.roles,
        functions=updated_policy.functions,
        severity_rules=updated_policy.severity_rules,
        output_restrictions=updated_policy.output_restrictions,
        function_chaining=updated_policy.function_chaining,
        context_rules=updated_policy.context_rules,
        decision_thresholds=updated_policy.decision_thresholds,
        is_active=updated_policy.is_active,
        is_default=updated_policy.is_default,
        created_at=updated_policy.created_at.isoformat() if updated_policy.created_at else "",
        updated_at=updated_policy.updated_at.isoformat() if updated_policy.updated_at else None
    )


@router.delete("/{policy_id}/function-chaining/{source_function}", response_model=PolicyResponse)
async def delete_function_chaining(
    policy_id: int,
    source_function: str,
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> PolicyResponse:
    """Delete a function chaining rule from a policy."""
    policy = PolicyRepository.get_by_id(db, policy_id)
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy with ID {policy_id} not found"
        )
    
    # Check permissions - only owner can delete
    if policy.owner_id != user_info.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this policy"
        )
    
    updated_policy = PolicyRepository.delete_function_chaining(db, policy_id, source_function)
    if not updated_policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Function chaining rule for '{source_function}' not found in policy"
        )
    
    return PolicyResponse(
        id=updated_policy.id,
        policy_key=updated_policy.policy_key,
        name=updated_policy.name,
        description=updated_policy.description,
        owner_id=updated_policy.owner_id,
        roles=updated_policy.roles,
        functions=updated_policy.functions,
        severity_rules=updated_policy.severity_rules,
        output_restrictions=updated_policy.output_restrictions,
        function_chaining=updated_policy.function_chaining,
        context_rules=updated_policy.context_rules,
        decision_thresholds=updated_policy.decision_thresholds,
        is_active=updated_policy.is_active,
        is_default=updated_policy.is_default,
        created_at=updated_policy.created_at.isoformat() if updated_policy.created_at else "",
        updated_at=updated_policy.updated_at.isoformat() if updated_policy.updated_at else None
    )


@router.delete("/{policy_id}/context-rules/{rule_index}", response_model=PolicyResponse)
async def delete_context_rule(
    policy_id: int,
    rule_index: int,
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info),
    db: Session = Depends(get_db)
) -> PolicyResponse:
    """Delete a context rule from a policy by index."""
    policy = PolicyRepository.get_by_id(db, policy_id)
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy with ID {policy_id} not found"
        )
    
    # Check permissions - only owner can delete
    if policy.owner_id != user_info.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this policy"
        )
    
    updated_policy = PolicyRepository.delete_context_rule(db, policy_id, rule_index)
    if not updated_policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Context rule at index {rule_index} not found in policy"
        )
    
    return PolicyResponse(
        id=updated_policy.id,
        policy_key=updated_policy.policy_key,
        name=updated_policy.name,
        description=updated_policy.description,
        owner_id=updated_policy.owner_id,
        roles=updated_policy.roles,
        functions=updated_policy.functions,
        severity_rules=updated_policy.severity_rules,
        output_restrictions=updated_policy.output_restrictions,
        function_chaining=updated_policy.function_chaining,
        context_rules=updated_policy.context_rules,
        decision_thresholds=updated_policy.decision_thresholds,
        is_active=updated_policy.is_active,
        is_default=updated_policy.is_default,
        created_at=updated_policy.created_at.isoformat() if updated_policy.created_at else "",
        updated_at=updated_policy.updated_at.isoformat() if updated_policy.updated_at else None
    )


