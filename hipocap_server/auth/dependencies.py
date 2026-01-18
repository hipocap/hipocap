"""
Authentication dependencies for FastAPI routes.

DEPRECATED: These dependencies are deprecated in favor of get_lmnr_user_info.
They are kept for backward compatibility but should not be used in new code.
"""

from fastapi import Depends, HTTPException, status
from typing import Optional
from ..auth.middleware import get_lmnr_user_info, LMNRUserInfo
from fastapi import Request


def get_current_api_key_dependency(
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info)
) -> str:
    """
    DEPRECATED: Dependency for getting current API key.
    
    This is a compatibility function that returns the API key from LMNRUserInfo.
    Use get_lmnr_user_info directly instead.
    """
    if not user_info.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key not available",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_info.api_key


def get_current_user_dependency(
    user_info: LMNRUserInfo = Depends(get_lmnr_user_info)
) -> LMNRUserInfo:
    """
    DEPRECATED: Dependency for getting current user.
    
    This is a compatibility function that returns LMNRUserInfo.
    Use get_lmnr_user_info directly instead.
    """
    return user_info


