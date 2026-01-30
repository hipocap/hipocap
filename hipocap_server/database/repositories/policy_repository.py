"""
Repository for governance policy operations.
"""

from sqlalchemy.orm import Session
from ..models import GovernancePolicy
from typing import Optional, List, Dict, Any, Tuple


class PolicyRepository:
    """Repository for governance policy database operations."""
    
    @staticmethod
    def create(
        db: Session,
        policy_key: str,
        name: str,
        owner_id: str,  # Changed to UUID string
        description: str = None,
        roles: Dict[str, Any] = None,
        functions: Dict[str, Any] = None,
        severity_rules: Dict[str, Any] = None,
        output_restrictions: Dict[str, Any] = None,
        function_chaining: Dict[str, Any] = None,
        context_rules: List[Dict[str, Any]] = None,
        decision_thresholds: Dict[str, Any] = None,
        custom_prompts: Dict[str, str] = None,
        is_default: bool = False
    ) -> GovernancePolicy:
        """Create a new governance policy."""
        # If this is set as default for this owner, unset other defaults for this owner
        if is_default:
            db.query(GovernancePolicy).filter(
                GovernancePolicy.owner_id == owner_id,
                GovernancePolicy.is_default == True
            ).update({"is_default": False})
        
        # Provide default values for required sections
        if severity_rules is None:
            severity_rules = {
                "safe": {"allow_function_calls": True, "allow_output_use": True, "block": False},
                "low": {"allow_function_calls": True, "allow_output_use": True, "block": False},
                "medium": {"allow_function_calls": False, "allow_output_use": True, "block": False},
                "high": {"allow_function_calls": False, "allow_output_use": False, "block": True},
                "critical": {"allow_function_calls": False, "allow_output_use": False, "block": True}
            }
        
        if roles is None:
            roles = {}
        
        if functions is None:
            functions = {}
        
        policy = GovernancePolicy(
            policy_key=policy_key,
            name=name,
            description=description,
            owner_id=owner_id,
            roles=roles,
            functions=functions,
            severity_rules=severity_rules,
            output_restrictions=output_restrictions,
            function_chaining=function_chaining,
            context_rules=context_rules,
            decision_thresholds=decision_thresholds,
            custom_prompts=custom_prompts,
            is_default=is_default
        )
        db.add(policy)
        db.commit()
        db.refresh(policy)
        return policy
    
    @staticmethod
    def get_by_key(db: Session, policy_key: str, owner_id: str = None) -> Optional[GovernancePolicy]:
        """Get policy by key (optionally filtered by owner)."""
        query = db.query(GovernancePolicy).filter(
            GovernancePolicy.policy_key == policy_key
        )
        if owner_id:
            query = query.filter(GovernancePolicy.owner_id == owner_id)
        return query.first()
    
    @staticmethod
    def get_by_id(db: Session, policy_id: int) -> Optional[GovernancePolicy]:
        """Get policy by ID."""
        return db.query(GovernancePolicy).filter(
            GovernancePolicy.id == policy_id
        ).first()
    
    @staticmethod
    def get_default(db: Session, owner_id: str = None) -> Optional[GovernancePolicy]:
        """Get the default policy (optionally filtered by owner)."""
        query = db.query(GovernancePolicy).filter(
            GovernancePolicy.is_default == True,
            GovernancePolicy.is_active == True
        )
        if owner_id:
            query = query.filter(GovernancePolicy.owner_id == owner_id)
        return query.first()
    
    @staticmethod
    def get_by_owner(db: Session, owner_id: str) -> List[GovernancePolicy]:  # Changed to UUID string
        """Get all policies for an owner."""
        return db.query(GovernancePolicy).filter(
            GovernancePolicy.owner_id == owner_id
        ).all()
    
    @staticmethod
    def get_all_active(db: Session) -> List[GovernancePolicy]:
        """Get all active policies."""
        return db.query(GovernancePolicy).filter(
            GovernancePolicy.is_active == True
        ).all()
    
    @staticmethod
    def build_default_config() -> Dict[str, Any]:
        """Build a default configuration dictionary with all required sections."""
        return {
            "roles": {
                "admin": {
                    "permissions": ["*"],
                    "description": "Full system access"
                },
                "assistant": {
                    "permissions": ["*"],
                    "description": "AI Assistant with execution capabilities"
                },
                "user": {
                    "permissions": ["web_search", "web_fetch", "read", "message"],
                    "description": "Standard user permissions (No execution)"
                }
            },
            "functions": {
                "exec": {
                    "allowed_roles": ["assistant", "admin"],
                    "description": "Execute system commands"
                },
                "bash": {
                    "allowed_roles": ["assistant", "admin"],
                    "description": "Execute bash commands"
                }
            },
            "severity_rules": {
                "safe": {"allow_function_calls": True, "allow_output_use": True, "block": False},
                "low": {"allow_function_calls": True, "allow_output_use": True, "block": False},
                "medium": {"allow_function_calls": False, "allow_output_use": True, "block": False},
                "high": {"allow_function_calls": False, "allow_output_use": False, "block": True},
                "critical": {"allow_function_calls": False, "allow_output_use": False, "block": True}
            },
            "output_restrictions": {},
            "function_chaining": {},
            "context_rules": [],
            "decision_thresholds": {
                "block_threshold": 0.7,
                "allow_threshold": 0.3,
                "use_severity_fallback": True
            }
        }

    @staticmethod
    def _deep_merge_dict(old_dict: Dict[str, Any], new_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Deep merge two dictionaries, with new_dict values taking precedence.
        
        Args:
            old_dict: Existing dictionary
            new_dict: New dictionary to merge
            
        Returns:
            Merged dictionary
        """
        if not old_dict:
            return new_dict.copy() if new_dict else {}
        if not new_dict:
            return old_dict.copy()
        
        result = old_dict.copy()
        for key, value in new_dict.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                # Recursively merge nested dictionaries
                result[key] = PolicyRepository._deep_merge_dict(result[key], value)
            else:
                # Replace or add new value
                result[key] = value
        return result
    
    @staticmethod
    def update(
        db: Session,
        policy_id: int,
        name: str = None,
        description: str = None,
        roles: Dict[str, Any] = None,
        functions: Dict[str, Any] = None,
        severity_rules: Dict[str, Any] = None,
        output_restrictions: Dict[str, Any] = None,
        function_chaining: Dict[str, Any] = None,
        context_rules: List[Dict[str, Any]] = None,
        decision_thresholds: Dict[str, Any] = None,
        custom_prompts: Dict[str, str] = None,
        is_active: bool = None,
        is_default: bool = None,
        merge_nested: bool = True
    ) -> Tuple[Optional[GovernancePolicy], Dict[str, Any]]:
        """
        Update a policy with detailed change tracking.
        
        Args:
            db: Database session
            policy_id: Policy ID to update
            name: New name (optional)
            description: New description (optional)
            roles: Roles to update (will merge if merge_nested=True)
            functions: Functions to update (will merge if merge_nested=True)
            severity_rules: Severity rules to update (will merge if merge_nested=True)
            output_restrictions: Output restrictions to update (will merge if merge_nested=True)
            function_chaining: Function chaining rules to update (will merge if merge_nested=True)
            context_rules: Context rules to update (replaces entirely)
            decision_thresholds: Decision thresholds to update (will merge if merge_nested=True)
            is_active: Active status (optional)
            is_default: Default status (optional)
            merge_nested: Whether to merge nested dictionaries (default: True)
            
        Returns:
            Tuple of (updated policy, changes dictionary)
        """
        policy = PolicyRepository.get_by_id(db, policy_id)
        if not policy:
            return None, {}
        
        changes = {}
        
        # Track changes for simple fields
        if name is not None and policy.name != name:
            changes["name"] = {"old": policy.name, "new": name}
            policy.name = name
        
        if description is not None and policy.description != description:
            changes["description"] = {"old": policy.description, "new": description}
            policy.description = description
        
        # Track changes for nested dictionaries (with merging)
        if roles is not None:
            if merge_nested and policy.roles:
                old_roles = set(policy.roles.keys()) if policy.roles else set()
                policy.roles = PolicyRepository._deep_merge_dict(policy.roles, roles)
                new_roles = set(policy.roles.keys())
                changes["roles"] = {
                    "added": list(new_roles - old_roles),
                    "updated": list(old_roles & new_roles),
                    "removed": list(old_roles - new_roles)
                }
            else:
                changes["roles"] = {"replaced": True}
                policy.roles = roles
        
        if functions is not None:
            if merge_nested and policy.functions:
                old_functions = set(policy.functions.keys()) if policy.functions else set()
                policy.functions = PolicyRepository._deep_merge_dict(policy.functions, functions)
                new_functions = set(policy.functions.keys())
                changes["functions"] = {
                    "added": list(new_functions - old_functions),
                    "updated": list(old_functions & new_functions),
                    "removed": list(old_functions - new_functions)
                }
            else:
                changes["functions"] = {"replaced": True}
                policy.functions = functions
        
        if severity_rules is not None:
            if merge_nested and policy.severity_rules:
                old_severities = set(policy.severity_rules.keys()) if policy.severity_rules else set()
                policy.severity_rules = PolicyRepository._deep_merge_dict(policy.severity_rules, severity_rules)
                new_severities = set(policy.severity_rules.keys())
                changes["severity_rules"] = {
                    "added": list(new_severities - old_severities),
                    "updated": list(old_severities & new_severities),
                    "removed": list(old_severities - new_severities)
                }
            else:
                changes["severity_rules"] = {"replaced": True}
                policy.severity_rules = severity_rules
        
        if output_restrictions is not None:
            if merge_nested and policy.output_restrictions:
                old_outputs = set(policy.output_restrictions.keys()) if policy.output_restrictions else set()
                policy.output_restrictions = PolicyRepository._deep_merge_dict(policy.output_restrictions, output_restrictions)
                new_outputs = set(policy.output_restrictions.keys())
                changes["output_restrictions"] = {
                    "added": list(new_outputs - old_outputs),
                    "updated": list(old_outputs & new_outputs),
                    "removed": list(old_outputs - new_outputs)
                }
            else:
                changes["output_restrictions"] = {"replaced": True}
                policy.output_restrictions = output_restrictions
        
        if function_chaining is not None:
            if merge_nested and policy.function_chaining:
                old_chaining = set(policy.function_chaining.keys()) if policy.function_chaining else set()
                policy.function_chaining = PolicyRepository._deep_merge_dict(policy.function_chaining, function_chaining)
                new_chaining = set(policy.function_chaining.keys())
                changes["function_chaining"] = {
                    "added": list(new_chaining - old_chaining),
                    "updated": list(old_chaining & new_chaining),
                    "removed": list(old_chaining - new_chaining)
                }
            else:
                changes["function_chaining"] = {"replaced": True}
                policy.function_chaining = function_chaining
        
        # Context rules are replaced entirely (not merged)
        if context_rules is not None:
            old_count = len(policy.context_rules) if policy.context_rules else 0
            policy.context_rules = context_rules
            new_count = len(context_rules) if context_rules else 0
            changes["context_rules"] = {
                "old_count": old_count,
                "new_count": new_count,
                "replaced": True
            }
        
        # Decision thresholds are merged (like other nested dicts)
        if decision_thresholds is not None:
            if merge_nested and policy.decision_thresholds:
                old_thresholds = set(policy.decision_thresholds.keys()) if policy.decision_thresholds else set()
                policy.decision_thresholds = PolicyRepository._deep_merge_dict(policy.decision_thresholds, decision_thresholds)
                new_thresholds = set(policy.decision_thresholds.keys())
                changes["decision_thresholds"] = {
                    "added": list(new_thresholds - old_thresholds),
                    "updated": list(old_thresholds & new_thresholds),
                    "removed": list(old_thresholds - new_thresholds)
                }
            else:
                changes["decision_thresholds"] = {"replaced": True}
                policy.decision_thresholds = decision_thresholds
        
        # Custom prompts are merged (like other nested dicts)
        if custom_prompts is not None:
            if merge_nested and policy.custom_prompts:
                old_prompts = set(policy.custom_prompts.keys()) if policy.custom_prompts else set()
                policy.custom_prompts = PolicyRepository._deep_merge_dict(policy.custom_prompts, custom_prompts)
                new_prompts = set(policy.custom_prompts.keys())
                changes["custom_prompts"] = {
                    "added": list(new_prompts - old_prompts),
                    "updated": list(old_prompts & new_prompts),
                    "removed": list(old_prompts - new_prompts)
                }
            else:
                changes["custom_prompts"] = {"replaced": True}
                policy.custom_prompts = custom_prompts
        
        if is_active is not None and policy.is_active != is_active:
            changes["is_active"] = {"old": policy.is_active, "new": is_active}
            policy.is_active = is_active
        
        if is_default is not None:
            if is_default != policy.is_default:
                changes["is_default"] = {"old": policy.is_default, "new": is_default}
            if is_default:
                # Unset other defaults
                db.query(GovernancePolicy).filter(
                    GovernancePolicy.is_default == True,
                    GovernancePolicy.id != policy_id
                ).update({"is_default": False})
            policy.is_default = is_default
        
        db.commit()
        db.refresh(policy)
        return policy, changes
    
    @staticmethod
    def delete(db: Session, policy_id: int) -> bool:
        """Delete a policy."""
        policy = PolicyRepository.get_by_id(db, policy_id)
        if not policy:
            return False
        
        db.delete(policy)
        db.commit()
        return True
    
    @staticmethod
    def to_config_dict(policy: GovernancePolicy) -> Dict[str, Any]:
        """Convert policy to config dictionary format."""
        # Start with a complete default structure
        config = PolicyRepository.build_default_config()
        
        # Override with policy values if they exist/are not empty
        if policy.roles and len(policy.roles) > 0:
            config["roles"] = policy.roles
        if policy.functions and len(policy.functions) > 0:
            config["functions"] = policy.functions
        if policy.severity_rules and len(policy.severity_rules) > 0:
            config["severity_rules"] = policy.severity_rules
        if policy.output_restrictions and len(policy.output_restrictions) > 0:
            config["output_restrictions"] = policy.output_restrictions
        if policy.function_chaining and len(policy.function_chaining) > 0:
            config["function_chaining"] = policy.function_chaining
        if policy.context_rules and len(policy.context_rules) > 0:
            config["context_rules"] = policy.context_rules
        if policy.decision_thresholds and len(policy.decision_thresholds) > 0:
            config["decision_thresholds"] = policy.decision_thresholds
        
        return config

