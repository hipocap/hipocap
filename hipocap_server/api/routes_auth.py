"""
Authentication and user management routes.

DEPRECATED: These routes are deprecated. User and API key management is now handled by LMNR.
All endpoints return 410 GONE status.
"""

from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


def _deprecated_response(detail: str = "This endpoint is deprecated. User and API key management is now handled by LMNR."):
    """Return a 410 GONE response for deprecated endpoints."""
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=detail
    )


@router.post("/register", status_code=status.HTTP_410_GONE)
async def register():
    """
    DEPRECATED: Register a new user.
    
    User registration is now handled by LMNR.
    """
    _deprecated_response("User registration is now handled by LMNR.")


@router.post("/login", status_code=status.HTTP_410_GONE)
async def login():
    """
    DEPRECATED: Login with username and password.
    
    Authentication is now handled by LMNR.
    """
    _deprecated_response("Authentication is now handled by LMNR.")


@router.get("/me", status_code=status.HTTP_410_GONE)
async def get_current_user_info():
    """
    DEPRECATED: Get current user information.
    
    User information is now available through LMNR's user management APIs.
    """
    _deprecated_response("User information is now available through LMNR's user management APIs.")


# API Key Management
@router.post("/api-keys", status_code=status.HTTP_410_GONE)
async def create_api_key():
    """
    DEPRECATED: Create a new API key for the current user.
    
    API key creation is now handled by LMNR.
    """
    _deprecated_response("API key creation is now handled by LMNR.")


@router.get("/api-keys", status_code=status.HTTP_410_GONE)
async def list_api_keys():
    """
    DEPRECATED: List all API keys for the current user.
    
    API key listing is now handled by LMNR.
    """
    _deprecated_response("API key listing is now handled by LMNR.")


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_410_GONE)
async def revoke_api_key(key_id: int):
    """
    DEPRECATED: Revoke an API key.
    
    API key revocation is now handled by LMNR.
    """
    _deprecated_response("API key revocation is now handled by LMNR.")


