"""
Database initialization script.
Creates tables and optionally creates an admin user.
"""

import sys
import os
from sqlalchemy.orm import Session

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from hipocap_server.database.connection import init_db, SessionLocal, engine
from hipocap_server.database.models import GovernancePolicy, AnalysisTrace
from hipocap_server.database.repositories.policy_repository import PolicyRepository


def create_admin_user(username: str = "admin", email: str = "admin@hipocap.local", password: str = "admin123"):
    """
    DEPRECATED: Create an admin user.
    
    User creation is now handled by LMNR. This function is kept for backward compatibility
    but will raise NotImplementedError.
    """
    print("WARNING: User creation is deprecated. User management is now handled by LMNR.")
    print("Please create users through LMNR's user management system.")
    raise NotImplementedError(
        "User creation is deprecated. User management is now handled by LMNR. "
        "Please create users through LMNR's user management system."
    )


def create_default_policy(owner_id: str):
    """Create a default governance policy."""
    db = SessionLocal()
    try:
        # Check if default policy exists
        existing = PolicyRepository.get_default(db)
        if existing:
            print("Default policy already exists")
            return existing
        
        # Create default policy with basic structure
        default_config = {
            "roles": {
                "admin": {
                    "permissions": ["*"],
                    "description": "Full access to all functions"
                },
                "user": {
                    "permissions": ["get_mail", "get_weather", "search_web"],
                    "description": "Standard user permissions"
                },
                "guest": {
                    "permissions": [],
                    "description": "No permissions"
                }
            },
            "functions": {
                "get_mail": {
                    "allowed_roles": ["admin", "user"],
                    "output_restrictions": {
                        "cannot_trigger_functions": True,
                        "max_severity_for_use": "low"
                    }
                },
                "get_weather": {
                    "allowed_roles": ["admin", "user"],
                    "output_restrictions": {
                        "cannot_trigger_functions": True,
                        "max_severity_for_use": "low"
                    }
                },
                "search_web": {
                    "allowed_roles": ["admin", "user"],
                    "output_restrictions": {
                        "cannot_trigger_functions": True,
                        "max_severity_for_use": "medium"
                    }
                }
            },
            "severity_rules": {
                "safe": {
                    "allow_function_calls": True,
                    "allow_output_use": True,
                    "block": False
                },
                "low": {
                    "allow_function_calls": True,
                    "allow_output_use": True,
                    "block": False
                },
                "medium": {
                    "allow_function_calls": False,
                    "allow_output_use": True,
                    "block": False
                },
                "high": {
                    "allow_function_calls": False,
                    "allow_output_use": False,
                    "block": True
                },
                "critical": {
                    "allow_function_calls": False,
                    "allow_output_use": False,
                    "block": True
                }
            },
            "output_restrictions": {},
            "function_chaining": {},
            "context_rules": [],
            "decision_thresholds": {},
            "custom_prompts": {}
        }
        
        policy = PolicyRepository.create(
            db=db,
            policy_key="default",
            name="Default Policy",
            owner_id=owner_id,
            description="Default governance policy",
            roles=default_config.get("roles"),
            functions=default_config.get("functions"),
            severity_rules=default_config.get("severity_rules"),
            output_restrictions=default_config.get("output_restrictions"),
            function_chaining=default_config.get("function_chaining"),
            context_rules=default_config.get("context_rules"),
            decision_thresholds=default_config.get("decision_thresholds"),
            custom_prompts=default_config.get("custom_prompts"),
            is_default=True
        )
        print("Default policy created successfully")
        return policy
    finally:
        db.close()


def main():
    """
    Initialize database and create default policy.
    
    Note: User creation is deprecated. Users should be created through LMNR.
    """
    print("Initializing database...")
    init_db()
    print("Database tables created successfully")
    
    print("\n⚠️  User creation is deprecated. Users should be created through LMNR.")
    print("Skipping admin user creation...")
    
    print("\nTo create a default policy, you need to provide a LMNR user ID (UUID string).")
    print("Example: create_default_policy('your-lmnr-user-id-here')")
    print("\nDatabase initialization complete!")


if __name__ == "__main__":
    main()

