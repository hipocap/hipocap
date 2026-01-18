"""
Configuration loader for RBAC and severity-based rules.
"""

import json
import os
from typing import Dict, Any, Optional, List
from enum import Enum


class SeverityLevel(Enum):
    """Severity levels matching the analyzer."""
    SAFE = "safe"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Config:
    """
    Loads and validates JSON configuration for RBAC and severity-based rules.
    """
    
    def __init__(self, config_path: str = None, config_dict: Dict[str, Any] = None):
        """
        Initialize the config loader.
        
        Args:
            config_path: Path to the JSON configuration file
            config_dict: Optional dictionary to initialize config directly (for dynamic configs)
        """
        self.config_path = config_path
        if config_dict:
            self.config = config_dict
            self._validate_config()
        else:
            self.config = self._load_config()
            self._validate_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from JSON file."""
        if not os.path.exists(self.config_path):
            raise FileNotFoundError(f"Configuration file not found: {self.config_path}")
        
        with open(self.config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        return config
    
    def _validate_config(self):
        """Validate configuration structure."""
        required_sections = ["roles", "functions", "severity_rules"]
        for section in required_sections:
            if section not in self.config:
                raise ValueError(f"Missing required section: {section}")
        
        # Ensure severity_rules is a dictionary
        if not isinstance(self.config.get("severity_rules"), dict):
            self.config["severity_rules"] = {}
        
        # Provide default severity rules if missing (lenient validation)
        # This allows policies to define only the severity levels they need
        default_severity_rules = {
            "safe": {"allow_function_calls": True, "allow_output_use": True, "block": False},
            "low": {"allow_function_calls": True, "allow_output_use": True, "block": False},
            "medium": {"allow_function_calls": False, "allow_output_use": True, "block": False},
            "high": {"allow_function_calls": False, "allow_output_use": False, "block": True},
            "critical": {"allow_function_calls": False, "allow_output_use": False, "block": True}
        }
        
        # Merge defaults with existing rules (existing rules take precedence)
        for severity, default_rule in default_severity_rules.items():
            if severity not in self.config["severity_rules"]:
                self.config["severity_rules"][severity] = default_rule.copy()
    
    def check_role_permission(self, role: str, function_name: str) -> bool:
        """
        Check if a role has permission to call a function.
        
        Args:
            role: User role (e.g., "admin", "user", "guest")
            function_name: Name of the function to check
            
        Returns:
            True if role has permission, False otherwise
        """
        if role not in self.config.get("roles", {}):
            return False
        
        role_config = self.config["roles"][role]
        permissions = role_config.get("permissions", [])
        
        if "*" in permissions:
            return True
        
        if function_name in permissions:
            return True
        
        if function_name in self.config.get("functions", {}):
            func_config = self.config["functions"][function_name]
            allowed_roles = func_config.get("allowed_roles", [])
            if role in allowed_roles:
                return True
        
        return False
    
    def get_severity_rule(self, severity: str) -> Dict[str, Any]:
        """
        Get rules for a specific severity level.
        
        Args:
            severity: Severity level (safe, low, medium, high, critical)
            
        Returns:
            Dictionary with severity rules
        """
        severity = severity.lower()
        if severity not in self.config.get("severity_rules", {}):
            severity = "safe"
        
        return self.config["severity_rules"].get(severity, {})
    
    def check_output_restriction(self, function_name: str) -> Dict[str, Any]:
        """
        Get output restrictions for a function.
        
        Args:
            function_name: Name of the function
            
        Returns:
            Dictionary with output restrictions, or empty dict if none
        """
        if function_name in self.config.get("output_restrictions", {}):
            return self.config["output_restrictions"][function_name]
        
        if function_name in self.config.get("functions", {}):
            func_config = self.config["functions"][function_name]
            return func_config.get("output_restrictions", {})
        
        return {}
    
    def get_function_chaining_config(self, function_name: str) -> Dict[str, Any]:
        """
        Get function chaining configuration for a specific function.
        
        Args:
            function_name: Name of the function
            
        Returns:
            Dictionary with function chaining config containing:
            - allowed_targets: List of functions this function can call (or ["*"] for all)
            - blocked_targets: List of functions this function cannot call (or ["*"] for none)
            - description: Optional description of the chaining rules
            Returns empty dict if not configured
        """
        if function_name not in self.config.get("function_chaining", {}):
            return {}
        
        chain_config = self.config["function_chaining"][function_name]
        return {
            "allowed_targets": chain_config.get("allowed_targets", []),
            "blocked_targets": chain_config.get("blocked_targets", []),
            "description": chain_config.get("description", "")
        }
    
    def check_function_chaining(self, source_func: str, target_func: str) -> bool:
        """
        Check if source function can call target function.
        
        Args:
            source_func: Source function name
            target_func: Target function name
            
        Returns:
            True if chaining is allowed, False otherwise
        """
        if source_func not in self.config.get("function_chaining", {}):
            return True
        
        chain_config = self.config["function_chaining"][source_func]
        
        blocked_targets = chain_config.get("blocked_targets", [])
        if "*" in blocked_targets:
            return False
        if target_func in blocked_targets:
            return False
        
        allowed_targets = chain_config.get("allowed_targets", [])
        if "*" in allowed_targets:
            return True
        if target_func in allowed_targets:
            return True
        
        return True
    
    def evaluate_context_rules(
        self,
        function_name: str,
        result: Any,
        severity: str
    ) -> Dict[str, Any]:
        """
        Evaluate context rules for a function result.
        
        Args:
            function_name: Name of the function
            result: Function result (can be string, dict, etc.)
            severity: Severity level from analysis
            
        Returns:
            Dictionary with action to take, or empty dict if no rules match
        """
        context_rules = self.config.get("context_rules", [])
        
        if isinstance(result, (dict, list)):
            result_text = json.dumps(result, indent=2)
        else:
            result_text = str(result)
        
        result_lower = result_text.lower()
        severity_lower = severity.lower()
        
        severity_order = {"safe": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
        current_severity_level = severity_order.get(severity_lower, 0)
        
        for rule in context_rules:
            if rule.get("function") != function_name:
                continue
            
            condition = rule.get("condition", {})
            matches = True
            
            if "severity" in condition:
                severity_condition = condition["severity"]
                if severity_condition.startswith(">="):
                    required_severity = severity_condition[2:].lower()
                    required_level = severity_order.get(required_severity, 0)
                    if current_severity_level < required_level:
                        matches = False
                elif severity_condition.startswith(">"):
                    required_severity = severity_condition[1:].lower()
                    required_level = severity_order.get(required_severity, 0)
                    if current_severity_level <= required_level:
                        matches = False
                elif severity_condition.startswith("<="):
                    required_severity = severity_condition[2:].lower()
                    required_level = severity_order.get(required_severity, 0)
                    if current_severity_level > required_level:
                        matches = False
                elif severity_condition.startswith("<"):
                    required_severity = severity_condition[1:].lower()
                    required_level = severity_order.get(required_severity, 0)
                    if current_severity_level >= required_level:
                        matches = False
                else:
                    if severity_lower != severity_condition.lower():
                        matches = False
            
            if not matches:
                continue
            
            if "contains_keywords" in condition:
                keywords = condition["contains_keywords"]
                if not any(keyword.lower() in result_lower for keyword in keywords):
                    matches = False
            
            if not matches:
                continue
            
            if "contains_patterns" in condition:
                patterns = condition["contains_patterns"]
                if not any(pattern.lower() in result_lower for pattern in patterns):
                    matches = False
            
            if not matches:
                continue
            
            if condition.get("contains_urls", False):
                url_indicators = ["http://", "https://", "www.", ".com", ".org", ".net"]
                if not any(indicator in result_text for indicator in url_indicators):
                    matches = False
            
            if matches:
                return rule.get("action", {})
        
        return {}
    
    def get_function_config(self, function_name: str) -> Dict[str, Any]:
        """
        Get full configuration for a function.
        
        Args:
            function_name: Name of the function
            
        Returns:
            Dictionary with function configuration
        """
        return self.config.get("functions", {}).get(function_name, {})
    
    def requires_review(self, function_name: str) -> bool:
        """
        Check if a function requires human review (HITL - Human In The Loop).
        
        DEPRECATED: Review system has been removed. This method always returns False.
        
        Args:
            function_name: Name of the function
            
        Returns:
            False (review system is deprecated)
        """
        return False
    
    def get_decision_thresholds(self) -> Dict[str, Any]:
        """
        Get decision thresholds for ALLOW/BLOCK decisions.
        
        Returns:
            Dictionary with decision thresholds:
            - block_threshold: Score above this = BLOCKED (default: 0.7)
            - allow_threshold: Score below this = ALLOWED (default: 0.3)
            - use_severity_fallback: If True, use severity rules for scores between thresholds (default: True)
        """
        thresholds = self.config.get("decision_thresholds", {})
        return {
            "block_threshold": thresholds.get("block_threshold", 0.7),
            "allow_threshold": thresholds.get("allow_threshold", 0.3),
            "use_severity_fallback": thresholds.get("use_severity_fallback", True)
        }
    
    def get_hitl_rules(self, function_name: str) -> Optional[str]:
        """
        Get HITL (Human-In-The-Loop) rules/description for a function.
        These rules describe when the LLM should recommend human review.
        
        Args:
            function_name: Name of the function
            
        Returns:
            HITL rules description string if configured, None otherwise
        """
        func_config = self.get_function_config(function_name)
        return func_config.get("hitl_rules") or func_config.get("hitl_description")
    
    def get_quarantine_exclude(self, function_name: str) -> Optional[str]:
        """
        Get quarantine exclude instruction for a function.
        
        Args:
            function_name: Name of the function
            
        Returns:
            Exclude instruction string if configured, None otherwise
        """
        func_config = self.get_function_config(function_name)
        return func_config.get("quarantine_exclude")
    
    def get_all_roles(self) -> List[str]:
        """Get list of all defined roles."""
        return list(self.config.get("roles", {}).keys())
    
    def get_all_functions(self) -> List[str]:
        """Get list of all defined functions."""
        return list(self.config.get("functions", {}).keys())
    
    def get_llm_analysis_agent_config(self) -> Dict[str, Any]:
        """
        Get LLM analysis agent configuration.
        
        Returns:
            Dictionary with LLM agent configuration (enabled, model, temperature, system_prompt)
        """
        return self.config.get("llm_analysis_agent", {})
    
    def update_rbac(self, roles: Dict[str, Any] = None, functions: Dict[str, Any] = None) -> None:
        """
        Update RBAC configuration dynamically.
        
        Args:
            roles: Dictionary of roles to add/update
            functions: Dictionary of function configurations to add/update
        """
        if roles:
            if "roles" not in self.config:
                self.config["roles"] = {}
            self.config["roles"].update(roles)
        
        if functions:
            if "functions" not in self.config:
                self.config["functions"] = {}
            self.config["functions"].update(functions)
    
    def add_role(self, role_name: str, permissions: List[str], description: str = None) -> None:
        """
        Add or update a role with permissions.
        
        Args:
            role_name: Name of the role
            permissions: List of function names the role can access (use "*" for all)
            description: Optional description of the role
        """
        if "roles" not in self.config:
            self.config["roles"] = {}
        
        self.config["roles"][role_name] = {
            "permissions": permissions,
            "description": description or f"Role: {role_name}"
        }
    
    def add_function_permission(self, function_name: str, allowed_roles: List[str], 
                                output_restrictions: Dict[str, Any] = None,
                                description: str = None) -> None:
        """
        Add or update function permissions.
        
        Args:
            function_name: Name of the function
            allowed_roles: List of roles allowed to call this function
            output_restrictions: Optional output restrictions for the function
            description: Optional description of the function
        """
        if "functions" not in self.config:
            self.config["functions"] = {}
        
        func_config = {
            "allowed_roles": allowed_roles,
            "description": description or f"Function: {function_name}"
        }
        
        if output_restrictions:
            func_config["output_restrictions"] = output_restrictions
        
        self.config["functions"][function_name] = func_config
    
    def update_rbac(self, roles: Dict[str, Any] = None, functions: Dict[str, Any] = None) -> None:
        """
        Update RBAC configuration dynamically.
        
        Args:
            roles: Dictionary of roles to add/update
            functions: Dictionary of function configurations to add/update
        """
        if roles:
            if "roles" not in self.config:
                self.config["roles"] = {}
            self.config["roles"].update(roles)
        
        if functions:
            if "functions" not in self.config:
                self.config["functions"] = {}
            self.config["functions"].update(functions)
    
    def add_role(self, role_name: str, permissions: List[str], description: str = None) -> None:
        """
        Add or update a role with permissions.
        
        Args:
            role_name: Name of the role
            permissions: List of function names the role can access (use "*" for all)
            description: Optional description of the role
        """
        if "roles" not in self.config:
            self.config["roles"] = {}
        
        self.config["roles"][role_name] = {
            "permissions": permissions,
            "description": description or f"Role: {role_name}"
        }
    
    def add_function_permission(self, function_name: str, allowed_roles: List[str], 
                                output_restrictions: Dict[str, Any] = None,
                                description: str = None) -> None:
        """
        Add or update function permissions.
        
        Args:
            function_name: Name of the function
            allowed_roles: List of roles allowed to call this function
            output_restrictions: Optional output restrictions for the function
            description: Optional description of the function
        """
        if "functions" not in self.config:
            self.config["functions"] = {}
        
        func_config = {
            "allowed_roles": allowed_roles,
            "description": description or f"Function: {function_name}"
        }
        
        if output_restrictions:
            func_config["output_restrictions"] = output_restrictions
        
        self.config["functions"][function_name] = func_config


def load_config(config_path: str) -> Config:
    """
    Convenience function to load configuration.
    
    Args:
        config_path: Path to the JSON configuration file
        
    Returns:
        Config instance
    """
    return Config(config_path)

