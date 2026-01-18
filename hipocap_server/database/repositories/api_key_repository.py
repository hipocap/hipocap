"""
Repository for API key operations.

DEPRECATED: This repository is deprecated. API key management is now handled by LMNR.
All methods raise NotImplementedError to prevent usage.
"""

from sqlalchemy.orm import Session
from typing import Optional, List
import warnings


class APIKeyRepository:
    """
    Repository for API key database operations.
    
    DEPRECATED: API key management is now handled by LMNR.
    Use LMNR's API key management APIs instead.
    """
    
    @staticmethod
    def generate_key() -> str:
        """
        DEPRECATED: Generate a new API key.
        
        API key generation is now handled by LMNR.
        """
        warnings.warn(
            "APIKeyRepository.generate_key is deprecated. API key generation is handled by LMNR.",
            DeprecationWarning,
            stacklevel=2
        )
        raise NotImplementedError(
            "APIKeyRepository is deprecated. API key generation is now handled by LMNR. "
            "Use LMNR's API key management APIs instead."
        )
    
    @staticmethod
    def create(
        db: Session,
        user_id: int,
        name: str,
        expires_days: Optional[int] = None
    ):
        """
        DEPRECATED: Create a new API key.
        
        API key creation is now handled by LMNR.
        """
        warnings.warn(
            "APIKeyRepository.create is deprecated. API key creation is handled by LMNR.",
            DeprecationWarning,
            stacklevel=2
        )
        raise NotImplementedError(
            "APIKeyRepository is deprecated. API key creation is now handled by LMNR. "
            "Use LMNR's API key management APIs instead."
        )
    
    @staticmethod
    def get_by_key_hash(db: Session, key_hash: str):
        """
        DEPRECATED: Get API key by hashed key.
        
        API key retrieval is now handled by LMNR.
        """
        warnings.warn(
            "APIKeyRepository.get_by_key_hash is deprecated. API key retrieval is handled by LMNR.",
            DeprecationWarning,
            stacklevel=2
        )
        raise NotImplementedError(
            "APIKeyRepository is deprecated. API key retrieval is now handled by LMNR. "
            "Use LMNR's API key management APIs instead."
        )
    
    @staticmethod
    def get_by_id(db: Session, key_id: int):
        """
        DEPRECATED: Get API key by ID.
        
        API key retrieval is now handled by LMNR.
        """
        warnings.warn(
            "APIKeyRepository.get_by_id is deprecated. API key retrieval is handled by LMNR.",
            DeprecationWarning,
            stacklevel=2
        )
        raise NotImplementedError(
            "APIKeyRepository is deprecated. API key retrieval is now handled by LMNR. "
            "Use LMNR's API key management APIs instead."
        )
    
    @staticmethod
    def get_by_user(db: Session, user_id: int) -> List:
        """
        DEPRECATED: Get all API keys for a user.
        
        API key retrieval is now handled by LMNR.
        """
        warnings.warn(
            "APIKeyRepository.get_by_user is deprecated. API key retrieval is handled by LMNR.",
            DeprecationWarning,
            stacklevel=2
        )
        raise NotImplementedError(
            "APIKeyRepository is deprecated. API key retrieval is now handled by LMNR. "
            "Use LMNR's API key management APIs instead."
        )
    
    @staticmethod
    def validate_key(db: Session, plain_key: str):
        """
        DEPRECATED: Validate an API key.
        
        API key validation is now handled by LMNR.
        """
        warnings.warn(
            "APIKeyRepository.validate_key is deprecated. API key validation is handled by LMNR.",
            DeprecationWarning,
            stacklevel=2
        )
        raise NotImplementedError(
            "APIKeyRepository is deprecated. API key validation is now handled by LMNR. "
            "Use LMNR's API key validation APIs instead."
        )
    
    @staticmethod
    def revoke(db: Session, key_id: int) -> bool:
        """
        DEPRECATED: Revoke an API key.
        
        API key revocation is now handled by LMNR.
        """
        warnings.warn(
            "APIKeyRepository.revoke is deprecated. API key revocation is handled by LMNR.",
            DeprecationWarning,
            stacklevel=2
        )
        raise NotImplementedError(
            "APIKeyRepository is deprecated. API key revocation is now handled by LMNR. "
            "Use LMNR's API key management APIs instead."
        )
    
    @staticmethod
    def delete(db: Session, key_id: int) -> bool:
        """
        DEPRECATED: Delete an API key.
        
        API key deletion is now handled by LMNR.
        """
        warnings.warn(
            "APIKeyRepository.delete is deprecated. API key deletion is handled by LMNR.",
            DeprecationWarning,
            stacklevel=2
        )
        raise NotImplementedError(
            "APIKeyRepository is deprecated. API key deletion is now handled by LMNR. "
            "Use LMNR's API key management APIs instead."
        )

