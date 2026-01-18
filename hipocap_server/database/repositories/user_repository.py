"""
Repository for user operations.

DEPRECATED: This repository is deprecated. User management is now handled by LMNR.
All methods raise NotImplementedError to prevent usage.
"""

from sqlalchemy.orm import Session
from typing import Optional
import warnings


class UserRepository:
    """
    Repository for user database operations.
    
    DEPRECATED: User management is now handled by LMNR.
    Use LMNR's user management APIs instead.
    """
    
    @staticmethod
    def get_by_username(db: Session, username: str):
        """
        DEPRECATED: Get user by username.
        
        User management is now handled by LMNR.
        """
        warnings.warn(
            "UserRepository.get_by_username is deprecated. User management is handled by LMNR.",
            DeprecationWarning,
            stacklevel=2
        )
        raise NotImplementedError(
            "UserRepository is deprecated. User management is now handled by LMNR. "
            "Use LMNR's user management APIs instead."
        )
    
    @staticmethod
    def get_by_email(db: Session, email: str):
        """
        DEPRECATED: Get user by email.
        
        User management is now handled by LMNR.
        """
        warnings.warn(
            "UserRepository.get_by_email is deprecated. User management is handled by LMNR.",
            DeprecationWarning,
            stacklevel=2
        )
        raise NotImplementedError(
            "UserRepository is deprecated. User management is now handled by LMNR. "
            "Use LMNR's user management APIs instead."
        )
    
    @staticmethod
    def get_by_id(db: Session, user_id: int):
        """
        DEPRECATED: Get user by ID.
        
        User management is now handled by LMNR.
        """
        warnings.warn(
            "UserRepository.get_by_id is deprecated. User management is handled by LMNR.",
            DeprecationWarning,
            stacklevel=2
        )
        raise NotImplementedError(
            "UserRepository is deprecated. User management is now handled by LMNR. "
            "Use LMNR's user management APIs instead."
        )
    
    @staticmethod
    def create(db: Session, username: str, email: str, password: str, is_admin: bool = False):
        """
        DEPRECATED: Create a new user.
        
        User management is now handled by LMNR.
        """
        warnings.warn(
            "UserRepository.create is deprecated. User management is handled by LMNR.",
            DeprecationWarning,
            stacklevel=2
        )
        raise NotImplementedError(
            "UserRepository is deprecated. User management is now handled by LMNR. "
            "Use LMNR's user management APIs instead."
        )
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """
        DEPRECATED: Verify password against hash.
        
        Password verification is now handled by LMNR.
        """
        warnings.warn(
            "UserRepository.verify_password is deprecated. Password verification is handled by LMNR.",
            DeprecationWarning,
            stacklevel=2
        )
        raise NotImplementedError(
            "UserRepository is deprecated. Password verification is now handled by LMNR. "
            "Use LMNR's authentication APIs instead."
        )
    
    @staticmethod
    def authenticate(db: Session, username: str, password: str):
        """
        DEPRECATED: Authenticate user with username and password.
        
        Authentication is now handled by LMNR.
        """
        warnings.warn(
            "UserRepository.authenticate is deprecated. Authentication is handled by LMNR.",
            DeprecationWarning,
            stacklevel=2
        )
        raise NotImplementedError(
            "UserRepository is deprecated. Authentication is now handled by LMNR. "
            "Use LMNR's authentication APIs instead."
        )


