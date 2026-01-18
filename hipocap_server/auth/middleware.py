"""
Authentication middleware for LMNR proxy authentication.

Reads user information from HTTP headers sent by LMNR proxy routes.
"""

from fastapi import Depends, HTTPException, status, Header, Request
from typing import Optional, Dict, Any
from dataclasses import dataclass
from ..auth.lmnr_validator import validate_lmnr_api_key, get_lmnr_user_by_api_key, get_lmnr_user_by_id


@dataclass
class LMNRUserInfo:
    """User information from LMNR."""
    id: str  # UUID string
    email: str
    name: str
    api_key: Optional[str] = None


def get_lmnr_user_info(
    request: Request,
    x_lmnr_user_id: Optional[str] = Header(None, alias="X-LMNR-User-Id"),
    x_lmnr_user_email: Optional[str] = Header(None, alias="X-LMNR-User-Email"),
    x_lmnr_user_name: Optional[str] = Header(None, alias="X-LMNR-User-Name"),
    x_lmnr_api_key: Optional[str] = Header(None, alias="X-LMNR-API-Key"),
    authorization: Optional[str] = Header(None)
) -> LMNRUserInfo:
    """
    Get user information from LMNR proxy headers.
    
    Args:
        request: FastAPI request object
        x_lmnr_user_id: User ID from LMNR (UUID string)
        x_lmnr_user_email: User email from LMNR
        x_lmnr_user_name: User name from LMNR
        x_lmnr_api_key: API key from LMNR for validation
        authorization: Authorization header (Bearer token) as fallback
        
    Returns:
        LMNRUserInfo object with user details
        
    Raises:
        HTTPException: If headers are missing or invalid
    """
    # Extract API key from Authorization header if not in custom header
    api_key = x_lmnr_api_key
    if not api_key and authorization:
        if authorization.startswith("Bearer "):
            api_key = authorization[7:]
        else:
            api_key = authorization
    
    # Validate API key if provided
    if api_key:
        # Note: validate_lmnr_api_key returns True (lenient) if database is unavailable
        # This prevents 401 errors during database outages
        if not validate_lmnr_api_key(api_key):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # If we have API key but missing user info, try to get from database
        if not x_lmnr_user_id:
            user_info = get_lmnr_user_by_api_key(api_key)
            if user_info:
                return LMNRUserInfo(
                    id=user_info["id"],
                    email=user_info["email"],
                    name=user_info["name"],
                    api_key=api_key
                )
    
    # Check if we have user info from headers
    if not x_lmnr_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing user information. X-LMNR-User-Id header is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Validate user exists in LMNR database (optional but recommended)
    user_info = get_lmnr_user_by_id(x_lmnr_user_id)
    if not user_info:
        # If user not found in DB, use header values (trust the proxy)
        if not x_lmnr_user_email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing user email. X-LMNR-User-Email header is required.",
            )
        return LMNRUserInfo(
            id=x_lmnr_user_id,
            email=x_lmnr_user_email,
            name=x_lmnr_user_name or "Unknown",
            api_key=api_key
        )
    
    # Use database values (more reliable)
    return LMNRUserInfo(
        id=user_info["id"],
        email=user_info["email"],
        name=user_info["name"],
        api_key=api_key
    )
