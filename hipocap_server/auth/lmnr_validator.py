"""
LMNR authentication validator.

Validates API keys and retrieves user information from LMNR database.
"""

import os
from typing import Optional, Dict, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from fastapi import HTTPException, status
import hashlib

# LMNR database connection
_lmnr_engine = None
_lmnr_session_factory = None


def _running_in_docker() -> bool:
    return os.path.exists("/.dockerenv") or os.getenv("RUNNING_IN_DOCKER") == "1"


def get_lmnr_db() -> Session:
    """Get LMNR database session."""
    global _lmnr_engine, _lmnr_session_factory
    
    if _lmnr_engine is None:
        # Use environment variable if provided, otherwise construct from individual env vars or defaults
        lmnr_db_url = os.getenv("LMNR_DATABASE_URL")
        
        if not lmnr_db_url:
            # Construct from individual environment variables or defaults
            default_host = os.getenv("DB_HOST", "postgres" if _running_in_docker() else "localhost")
            # Inside Docker, use internal port 5432; outside Docker, use host port 5433
            default_port = os.getenv("DB_PORT", "5432" if _running_in_docker() else "5433")
            default_db = os.getenv("POSTGRES_DB", "postgres")
            default_user = os.getenv("POSTGRES_USER", "postgres")
            default_password = os.getenv("POSTGRES_PASSWORD", "postgres")
            lmnr_db_url = f"postgresql://{default_user}:{default_password}@{default_host}:{default_port}/{default_db}"
        
        # Ensure postgresql:// (not postgres://) for SQLAlchemy compatibility
        if lmnr_db_url.startswith("postgres://"):
            lmnr_db_url = lmnr_db_url.replace("postgres://", "postgresql://", 1)
        
        _lmnr_engine = create_engine(
            lmnr_db_url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            connect_args={
                "connect_timeout": 10,  # 10 second connection timeout
                "options": "-c statement_timeout=30000"  # 30 second statement timeout
            }
        )
        _lmnr_session_factory = sessionmaker(autocommit=False, autoflush=False, bind=_lmnr_engine)
    
    return _lmnr_session_factory()


def hash_api_key(api_key: str) -> str:
    """
    Hash API key using SHA3-256 (same as LMNR project API keys).
    
    Args:
        api_key: Raw API key string
        
    Returns:
        Hex string of the hash
    """
    hasher = hashlib.sha3_256()
    hasher.update(api_key.encode('utf-8'))
    return hasher.hexdigest()


def validate_lmnr_api_key(api_key: str) -> bool:
    """
    Validate API key against LMNR database.
    Checks both user API keys (api_keys table) and project API keys (project_api_keys table).
    
    Args:
        api_key: API key to validate (the actual key value, not name)
        
    Returns:
        True if valid, False otherwise. Returns True (lenient) if database connection fails.
    """
    if not api_key:
        return False
    
    try:
        db = get_lmnr_db()
        try:
            # First check user API keys (stored as plain text)
            result = db.execute(
                text("""
                    SELECT api_key, user_id, name, created_at
                    FROM api_keys
                    WHERE api_key = :key_value
                    LIMIT 1
                """),
                {"key_value": api_key}
            ).fetchone()
            
            if result is not None:
                return True
            
            # If not found, check project API keys (stored as hash)
            api_key_hash = hash_api_key(api_key)
            result = db.execute(
                text("""
                    SELECT hash, project_id, name, shorthand
                    FROM project_api_keys
                    WHERE hash = :key_hash
                    LIMIT 1
                """),
                {"key_hash": api_key_hash}
            ).fetchone()
            
            return result is not None
        finally:
            db.close()
    except Exception as e:
        # Log warning but allow request to proceed (lenient behavior during database outages)
        import warnings
        warnings.warn(f"Database error during API key validation: {e}. Allowing request to proceed.", UserWarning)
        print(f"Warning: Error validating LMNR API key (database may be unavailable): {e}")
        # Return True to allow request when database is unavailable
        return True


def get_lmnr_user_by_api_key(api_key: str) -> Optional[Dict[str, Any]]:
    """
    Get user information from LMNR database based on API key.
    
    Args:
        api_key: API key value
        
    Returns:
        User dict with id, email, name, or None if not found
    """
    if not api_key:
        return None
    
    try:
        db = get_lmnr_db()
        try:
            # Get user info via API key
            # LMNR schema: api_keys table has api_key (primary key), user_id, name
            result = db.execute(
                text("""
                    SELECT u.id, u.email, u.name
                    FROM users u
                    INNER JOIN api_keys ak ON ak.user_id = u.id
                    WHERE ak.api_key = :key_value
                    LIMIT 1
                """),
                {"key_value": api_key}
            ).fetchone()
            
            if result:
                return {
                    "id": str(result[0]),  # Convert UUID to string
                    "email": result[1],
                    "name": result[2]
                }
            
            return None
        finally:
            db.close()
    except Exception as e:
        print(f"Error getting LMNR user by API key: {e}")
        return None


def get_lmnr_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get user information from LMNR database by user ID.
    
    Args:
        user_id: User UUID string
        
    Returns:
        User dict with id, email, name, or None if not found
    """
    if not user_id:
        return None
    
    # Optional: Quick check for UUID format to avoid DB error with non-UUID strings
    # if userId column in Postgres is UUID type
    import uuid
    is_uuid = False
    try:
        uuid.UUID(user_id)
        is_uuid = True
    except ValueError:
        is_uuid = False

    if not is_uuid:
        # If not a UUID, it definitely won't match in a UUID column
        # and would cause an error in Postgres
        return None
    
    try:
        db = get_lmnr_db()
        try:
            result = db.execute(
                text("""
                    SELECT id, email, name
                    FROM users
                    WHERE id = :user_id
                    LIMIT 1
                """),
                {"user_id": user_id}
            ).fetchone()
            
            if result:
                return {
                    "id": str(result[0]),
                    "email": result[1],
                    "name": result[2]
                }
            
            return None
        finally:
            db.close()
    except Exception as e:
        print(f"Error getting LMNR user by ID: {e}")
        return None

