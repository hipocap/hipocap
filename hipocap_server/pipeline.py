"""
Guard Pipeline for detecting contextual blending attacks.

Flow: Input Analysis → LLM Analysis Agent (Structured) → Quarantine LLM → Output Analysis
"""

from typing import Dict, Any, Optional, List
from .analyzer import Analyzer, SeverityLevel
from .scorer import Scorer
from .config import Config
from .prompts import (
    QUARANTINE_SYSTEM_PROMPT_DEFAULT,
    LLM_AGENT_SYSTEM_PROMPT_DEFAULT,
    get_quarantine_system_prompt,
    format_llm_agent_user_prompt,
    format_llm_agent_user_prompt_with_schema,
    INFECTION_MODEL_SYSTEM_PROMPT,
    format_quarantine_stage1_user_prompt,
    format_quarantine_stage2_user_prompt,
    format_quarantine_stage2_user_prompt_with_schema
)
import openai
import json
import time
import os
import re
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class GuardPipeline:
    """
    Multi-stage defense pipeline for detecting indirect prompt injection.
    
    Input Analysis: Analyze function call input with Prompt Guard
    LLM Analysis Agent: Analyze function result with structured outputs (threat indicators, patterns, function calls)
    Quarantine Analysis: If passed, send to quarantine LLM, then analyze LLM output
    """
    
    def __init__(
        self,
        # Prompt Guard settings
        model_id: Optional[str] = None,
        device: str = "cuda",
        temperature: float = 1.0,
        # Input analysis thresholds
        input_safe_threshold: float = 0.1,
        input_block_threshold: float = 0.5,
        # OpenAI/LLM settings
        openai_api_key: Optional[str] = None,
        openai_base_url: Optional[str] = None,
        openai_model: Optional[str] = None,
        infection_model: Optional[str] = None,
        analysis_model: Optional[str] = None,
        # Quarantine analysis thresholds
        quarantine_safe_threshold: float = 0.1,
        quarantine_block_threshold: float = 0.5,
        # Quarantine LLM prompt
        quarantine_system_prompt: Optional[str] = None,
        # Additional settings
        enable_quarantine: bool = True,
        verbose: bool = False,
        # Configuration
        config_path: Optional[str] = None,
        config: Optional[Config] = None,
        # HuggingFace token
        hf_token: Optional[str] = None
    ):
        """
        Initialize the Guard Pipeline.
        
        Args:
            model_id: HuggingFace model ID for Prompt Guard (or set GUARD_MODEL env var)
            device: Device to run Prompt Guard on
            temperature: Temperature for Prompt Guard softmax
            input_safe_threshold: Score below this passes input analysis
            input_block_threshold: Score above this blocks at input analysis
            openai_api_key: OpenAI API key (or set OPENAI_API_KEY env var)
            openai_base_url: Custom base URL for OpenAI-compatible API (or set OPENAI_BASE_URL env var)
            openai_model: Model name to use for quarantine LLM (or set OPENAI_MODEL env var, used as fallback)
            infection_model: Model name for Stage 1 infection simulation (or set INFECTION_MODEL env var)
            analysis_model: Model name for Stage 2 analysis/evaluation (or set ANALYSIS_MODEL env var)
            quarantine_safe_threshold: Score below this passes quarantine analysis
            quarantine_block_threshold: Score above this blocks at quarantine analysis
            quarantine_system_prompt: System prompt for quarantine LLM
            enable_quarantine: Whether to enable quarantine analysis
            verbose: Whether to print detailed logs
            config_path: Path to JSON configuration file for RBAC and rules
            config: Optional pre-loaded Config instance
            hf_token: HuggingFace token for accessing private/gated models (or set HF_TOKEN env var)
        """
        # Load configuration from environment variables with fallbacks
        # Guard model (Prompt Guard)
        guard_model = model_id or os.getenv("GUARD_MODEL", "meta-llama/Prompt-Guard-86M")
        
        # Device configuration - auto-detect if CUDA is available, fallback to CPU
        # Allow environment variable override first
        device_env = os.getenv("GUARD_DEVICE")
        if device_env:
            device = device_env
        elif device == "cuda":
            # Check if CUDA is actually available
            try:
                import torch
                if not torch.cuda.is_available():
                    device = "cpu"
                    if verbose:
                        print("[Config] CUDA not available, falling back to CPU")
            except Exception:
                device = "cpu"
                if verbose:
                    print("[Config] Error checking CUDA availability, using CPU")
        
        # HuggingFace token for model downloads
        hf_token_value = hf_token or os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_TOKEN")
        
        # OpenAI configuration
        api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
        base_url = openai_base_url or os.getenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
        
        # Model configuration
        # Default model (used as fallback if specific models not set)
        default_model = openai_model or os.getenv("OPENAI_MODEL", "x-ai/grok-4.1-fast")
        
        # Infection model (Stage 1) - defaults to default_model if not set
        self.infection_model = infection_model or os.getenv("INFECTION_MODEL", default_model)
        
        # Analysis model (Stage 2) - defaults to default_model if not set
        self.analysis_model = analysis_model or os.getenv("ANALYSIS_MODEL", default_model)
        
        # Initialize components with HuggingFace token
        self.analyzer = Analyzer(
            model_id=guard_model,
            device=device,
            temperature=temperature,
            hf_token=hf_token_value
        )
        self.scorer = Scorer(
            model_id=guard_model,
            device=device,
            temperature=temperature,
            hf_token=hf_token_value
        )
        
        # Input analysis thresholds
        self.input_safe_threshold = input_safe_threshold
        self.input_block_threshold = input_block_threshold
        
        # Quarantine analysis thresholds
        self.quarantine_safe_threshold = quarantine_safe_threshold
        self.quarantine_block_threshold = quarantine_block_threshold
        
        # OpenAI/LLM configuration
        self.openai_client = None
        self.openai_model = default_model  # Keep for backward compatibility
        self.enable_quarantine = enable_quarantine
        self.verbose = verbose
        
        # Initialize OpenAI client
        if enable_quarantine:
            try:
                if not api_key:
                    if verbose:
                        print("Warning: No OpenAI API key provided. Set OPENAI_API_KEY environment variable or pass openai_api_key parameter.")
                    self.enable_quarantine = False
                else:
                    # Set timeout to prevent long waits (30 seconds total timeout)
                    self.openai_client = openai.OpenAI(
                        api_key=api_key,
                        base_url=base_url,
                        timeout=30.0,  # 30 second timeout for all requests
                        max_retries=1  # Only retry once on network errors
                    )
                    if verbose:
                        print(f"[Config] OpenAI client initialized with base_url: {base_url}")
                        print(f"[Config] Infection model (Stage 1): {self.infection_model}")
                        print(f"[Config] Analysis model (Stage 2): {self.analysis_model}")
                        print(f"[Config] Guard model: {guard_model}")
            except Exception as e:
                if verbose:
                    print(f"Warning: Could not initialize OpenAI client: {e}")
                self.enable_quarantine = False
        
        # Default quarantine system prompt
        # Note: This prompt is designed to reveal hidden instructions by having the LLM process content naturally
        # However, we use a more neutral prompt to reduce false positives on benign content
        self.quarantine_system_prompt = quarantine_system_prompt or QUARANTINE_SYSTEM_PROMPT_DEFAULT
        
        # Load configuration if provided
        self.config = config
        if config_path and not config:
            try:
                self.config = Config(config_path)
                if verbose:
                    print(f"[Config] Loaded configuration from {config_path}")
            except Exception as e:
                if verbose:
                    print(f"[Config] Warning: Could not load config: {e}")
                self.config = None
        
        # LLM Analysis Agent settings
        self.enable_llm_agent = False
        self.llm_agent_model = self.analysis_model  # Use analysis model for LLM agent
        self.llm_agent_temperature = 0.3
        self.llm_agent_system_prompt = None
        
        # Custom prompts from policy (will override defaults if set)
        self.custom_prompts = None
        
        if self.config:
            llm_agent_config = self.config.get_llm_analysis_agent_config()
            if llm_agent_config.get('enabled', False):
                self.enable_llm_agent = True
                self.llm_agent_model = llm_agent_config.get('model') or self.analysis_model
                self.llm_agent_temperature = llm_agent_config.get('temperature', 0.3)
                self.llm_agent_system_prompt = llm_agent_config.get('system_prompt') or LLM_AGENT_SYSTEM_PROMPT_DEFAULT
        
        # Initialize OpenAI client for LLM agent if needed
        if self.enable_llm_agent and not self.openai_client:
            try:
                api_key = openai_api_key or "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"
                base_url = openai_base_url or "https://openrouter.ai/api/v1"
                
                # Set timeout to prevent long waits (30 seconds total timeout)
                self.openai_client = openai.OpenAI(
                    api_key=api_key,
                    base_url=base_url,
                    timeout=30.0,  # 30 second timeout for all requests
                    max_retries=1  # Only retry once on network errors
                )
            except Exception as e:
                if verbose:
                    print(f"Warning: Could not initialize OpenAI client for LLM agent: {e}")
                self.enable_llm_agent = False
    
    def _detect_keywords(
        self,
        function_result: Any,
        keywords: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Detect sensitive keywords in function result.
        
        Args:
            function_result: Result from the function
            keywords: Optional custom list of keywords to detect (if not provided, uses default)
            
        Returns:
            Dictionary with keyword detection results
        """
        # Default sensitive keywords if not provided
        if keywords is None:
            keywords = [
                # Security classifications
                "confidential", "classified", "top secret", "restricted", "sensitive",
                "for internal use only", "do not distribute", "need-to-know",
                # Business sensitivity
                "proprietary", "trade secret", "internal use only",
                "do not share", "confidential business information",
                # Action-triggering
                "password reset", "account verification", "urgent action required",
                "click here", "verify now", "immediate action needed",
                "your account will be closed", "suspicious activity detected",
                # Financial
                "wire transfer", "payment required", "refund processing",
                "account suspended", "payment failed",
                # Personal information indicators
                "ssn", "social security number", "credit card",
                "date of birth", "mother's maiden name"
            ]
        
        # Convert function_result to string for searching
        if isinstance(function_result, (dict, list)):
            content = json.dumps(function_result, indent=2).lower()
        else:
            content = str(function_result).lower()
        
        # Detect keywords (case-insensitive)
        detected_keywords = []
        keyword_positions = {}
        
        for keyword in keywords:
            keyword_lower = keyword.lower()
            # Find all occurrences
            pattern = re.escape(keyword_lower)
            matches = list(re.finditer(pattern, content))
            
            if matches:
                detected_keywords.append(keyword)
                keyword_positions[keyword] = len(matches)
        
        # Categorize keywords
        security_keywords = []
        business_keywords = []
        action_keywords = []
        financial_keywords = []
        pii_keywords = []
        
        security_patterns = ["confidential", "classified", "top secret", "restricted", "sensitive", "internal use only", "do not distribute", "need-to-know"]
        business_patterns = ["proprietary", "trade secret", "do not share", "confidential business"]
        action_patterns = ["password reset", "account verification", "urgent action", "click here", "verify now", "immediate action", "account will be closed", "suspicious activity"]
        financial_patterns = ["wire transfer", "payment required", "refund", "account suspended", "payment failed"]
        pii_patterns = ["ssn", "social security", "credit card", "date of birth", "mother's maiden name"]
        
        for keyword in detected_keywords:
            keyword_lower = keyword.lower()
            if any(pattern in keyword_lower for pattern in security_patterns):
                security_keywords.append(keyword)
            elif any(pattern in keyword_lower for pattern in business_patterns):
                business_keywords.append(keyword)
            elif any(pattern in keyword_lower for pattern in action_patterns):
                action_keywords.append(keyword)
            elif any(pattern in keyword_lower for pattern in financial_patterns):
                financial_keywords.append(keyword)
            elif any(pattern in keyword_lower for pattern in pii_patterns):
                pii_keywords.append(keyword)
        
        # Calculate risk score based on keyword count and categories
        base_score = min(len(detected_keywords) * 0.1, 0.7)  # Max 0.7 from keyword count
        category_multiplier = 1.0
        
        if len(security_keywords) > 0:
            category_multiplier = max(category_multiplier, 1.2)
        if len(action_keywords) > 0:
            category_multiplier = max(category_multiplier, 1.3)  # Action keywords are more concerning
        if len(financial_keywords) > 0:
            category_multiplier = max(category_multiplier, 1.2)
        if len(pii_keywords) > 0:
            category_multiplier = max(category_multiplier, 1.3)  # PII is very concerning
        
        risk_score = min(base_score * category_multiplier, 0.95)
        
        # Determine severity
        if risk_score >= 0.7:
            severity = "high"
        elif risk_score >= 0.4:
            severity = "medium"
        elif risk_score >= 0.2:
            severity = "low"
        else:
            severity = "safe"
        
        return {
            "detected": len(detected_keywords) > 0,
            "detected_keywords": detected_keywords,
            "keyword_count": len(detected_keywords),
            "keyword_positions": keyword_positions,
            "categories": {
                "security": security_keywords,
                "business": business_keywords,
                "action_triggering": action_keywords,
                "financial": financial_keywords,
                "pii": pii_keywords
            },
            "risk_score": risk_score,
            "severity": severity
        }
    
    def _analyze_input(self, function_name: str, function_result: Any, function_args: Optional[Any] = None) -> Dict[str, Any]:
        """
        Analyze function call input with Prompt Guard.
        
        Args:
            function_name: Name of the function
            function_result: Result from the function
            function_args: Optional arguments passed to the function
            
        Returns:
            Dictionary with analysis results and decision
        """
        if self.verbose:
            print("[Input Analysis] Analyzing function call input...")
        
        analysis = self.analyzer.analyze_function_call(function_name, function_result, function_args)
        score = analysis['combined_score']
        
        decision = "PASS"
        if score >= self.input_block_threshold:
            decision = "BLOCK"
        # Scores between thresholds will be handled by severity rules
        
        result = {
            "phase": "input",
            "decision": decision,
            "score": score,
            "severity": analysis['combined_severity'],
            "analysis": analysis,
            "timestamp": time.time()
        }
        
        if self.verbose:
            print(f"[Input Analysis] Score: {score:.4f}, Decision: {decision}, Severity: {analysis['combined_severity']}")
        
        return result
    
    def _get_function_specific_policy(self, function_name: str) -> Dict[str, Any]:
        """
        Extract all policy details for a specific function.
        
        Args:
            function_name: Name of the function
            
        Returns:
            Dictionary with function-specific policy rules:
            - allowed_roles: List of roles allowed to call this function
            - output_restrictions: Output restriction rules
            - function_chaining: Function chaining rules for this function
            - hitl_rules: HITL rules for this function
            - description: Function description
        """
        if not self.config:
            return {}
        
        func_config = self.config.get_function_config(function_name)
        function_chaining = self.config.get_function_chaining_config(function_name)
        
        policy = {
            "function_name": function_name,
            "description": func_config.get("description", ""),
            "allowed_roles": func_config.get("allowed_roles", []),
            "output_restrictions": func_config.get("output_restrictions", {}),
            "function_chaining": function_chaining or {},
            "hitl_rules": self.config.get_hitl_rules(function_name),
            "quarantine_exclude": self.config.get_quarantine_exclude(function_name)
        }
        
        return policy
    
    def _get_llm_analysis_schema(self, quick_mode: bool = False) -> Dict[str, Any]:
        """
        Get JSON schema for structured LLM analysis output (deterministic, policy-driven).
        
        Args:
            quick_mode: If True, returns simplified schema with only score, decision, reason
        
        Returns:
            JSON schema dictionary
        """
        if quick_mode:
            return {
                "type": "object",
                "properties": {
                    "score": {
                        "type": "number",
                        "minimum": 0.0,
                        "maximum": 1.0,
                        "description": "Risk score: 0.0 = safe, 1.0 = critical"
                    },
                    "decision": {
                        "type": "string",
                        "enum": ["ALLOW", "BLOCK"],
                        "description": "Decision: ALLOW or BLOCK"
                    },
                    "reason": {
                        "type": "string",
                        "description": "Brief reason for the decision"
                    }
                },
                "required": ["score", "decision", "reason"],
                "additionalProperties": False
            }
        else:
            # Full mode with detailed analysis
            return {
                "type": "object",
                "properties": {
                    "score": {
                        "type": "number",
                        "minimum": 0.0,
                        "maximum": 1.0,
                        "description": "Risk score: 0.0 = safe, 1.0 = critical"
                    },
                    "decision": {
                        "type": "string",
                        "enum": ["ALLOW", "BLOCK"],
                        "description": "Decision: ALLOW or BLOCK"
                    },
                    "reason": {
                        "type": "string",
                        "description": "Brief reason for the decision"
                    },
                    "threats_found": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of threats detected"
                    },
                    "threat_indicators": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "S1-S14 threat categories + technical indicators (instruction_injection, contextual_blending, function_call_attempt, hidden_instructions)"
                    },
                    "detected_patterns": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Attack patterns detected (contextual_blending, instruction_injection, function_call_attempt)"
                    },
                    "function_call_attempts": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Detected function call attempts (e.g., search_web, send_mail, get_weather)"
                    },
                    "policy_violations": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of policy violations found"
                    },
                    "severity": {
                        "type": "string",
                        "enum": ["safe", "low", "medium", "high", "critical"],
                        "description": "Severity level"
                    },
                    "summary": {
                        "type": "string",
                        "description": "Summary of findings"
                    },
                    "details": {
                        "type": "string",
                        "description": "Detailed analysis explanation"
                    }
                },
                "required": ["score", "decision", "reason", "threats_found", "threat_indicators", "detected_patterns", "function_call_attempts", "policy_violations", "severity", "summary", "details"],
                "additionalProperties": False
            }
    
    def _get_function_specific_policy(self, function_name: str) -> Dict[str, Any]:
        """
        Extract all policy details for a specific function.
        
        Args:
            function_name: Name of the function to extract policy for
        
        Returns:
            Dictionary with function-specific policy rules:
            - allowed_roles: List of roles allowed to call this function
            - output_restrictions: Output restriction rules
            - function_chaining: Function chaining rules for this function
            - hitl_rules: HITL rules for this function
            - description: Function description
        """
        if not self.config:
            return {}
        
        func_config = self.config.get_function_config(function_name)
        function_chaining = self.config.get_function_chaining_config(function_name)
        
        policy = {
            "function_name": function_name,
            "description": func_config.get("description", ""),
            "allowed_roles": func_config.get("allowed_roles", []),
            "output_restrictions": func_config.get("output_restrictions", {}),
            "function_chaining": function_chaining or {},
            "hitl_rules": self.config.get_hitl_rules(function_name),
            "quarantine_exclude": self.config.get_quarantine_exclude(function_name)
        }
        
        return policy
    
    def _analyze_with_llm_agent(
        self,
        function_name: str,
        function_result: Any,
        function_args: Optional[Any] = None,
        user_query: Optional[str] = None,
        quick_mode: bool = False
    ) -> Dict[str, Any]:
        """
        Analyze function result using LLM analysis agent (deterministic, policy-driven).
        
        Args:
            function_name: Name of the function
            function_result: Result from the function
            function_args: Optional arguments passed to the function
            user_query: Optional user query context
            quick_mode: If True, returns only score, decision, and reason. If False, returns detailed analysis.
            
        Returns:
            Dictionary with structured analysis including score (0.0-1.0) and decision
        """
        if not self.enable_llm_agent or not self.openai_client:
            return {
                "phase": "llm_analysis",
                "decision": "SKIPPED",
                "error": "LLM analysis agent not enabled or OpenAI client not available"
            }
        
        if self.verbose:
            print("[LLM Analysis Agent] Analyzing function result with structured outputs...")
        
        try:
            # Extract function-specific policy
            function_policy = self._get_function_specific_policy(function_name)
            
            # Create deterministic prompt with function-specific policy
            user_message = format_llm_agent_user_prompt(
                function_name=function_name,
                function_result=function_result,
                function_args=function_args,
                user_query=user_query,
                quick_mode=quick_mode,
                function_policy=function_policy
            )
            
            # Get schema based on quick_mode
            schema = self._get_llm_analysis_schema(quick_mode=quick_mode)
            
            # Call LLM with temperature=0 for deterministic results
            # Optimize: Reduce max_tokens for faster responses and use shorter timeout
            max_tokens = 300 if quick_mode else 600  # Reduced from 500/1000 for faster responses
            
            try:
                # Get system prompt (custom from policy or default)
                system_prompt = self.llm_agent_system_prompt
                if self.custom_prompts and self.custom_prompts.get("llm_agent_system_prompt"):
                    system_prompt = self.custom_prompts.get("llm_agent_system_prompt")
                elif not system_prompt:
                    system_prompt = LLM_AGENT_SYSTEM_PROMPT_DEFAULT
                
                # Try using structured outputs with json_schema
                response = self.openai_client.chat.completions.create(
                    model=self.llm_agent_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    response_format={
                        "type": "json_schema",
                        "json_schema": {
                            "name": "security_analysis",
                            "strict": True,
                            "schema": schema
                        }
                    },
                    temperature=0.0,  # Deterministic
                    max_tokens=max_tokens
                )
                
                # Extract structured analysis from JSON response
                response_content = response.choices[0].message.content
                structured_analysis = json.loads(response_content)
                
            except (AttributeError, TypeError, KeyError, ValueError, openai.APIError, openai.APITimeoutError) as e:
                # Check if it's a timeout - if so, skip fallbacks to avoid more delays
                if isinstance(e, (openai.APITimeoutError, TimeoutError)):
                    if self.verbose:
                        print(f"[LLM Analysis Agent] Request timed out, skipping fallbacks to avoid further delays")
                    raise e  # Re-raise to trigger error handling
                
                # Fallback to JSON mode if structured outputs not supported
                if self.verbose:
                    print(f"[LLM Analysis Agent] Structured outputs not supported ({type(e).__name__}), using JSON mode...")
                
                # Add instruction to return JSON
                user_message_with_schema = format_llm_agent_user_prompt_with_schema(user_message, schema)
                
                try:
                    response = self.openai_client.chat.completions.create(
                        model=self.llm_agent_model,
                        messages=[
                            {"role": "system", "content": self.llm_agent_system_prompt},
                            {"role": "user", "content": user_message_with_schema}
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.0,  # Deterministic
                        max_tokens=max_tokens
                    )
                    
                    response_content = response.choices[0].message.content
                    structured_analysis = json.loads(response_content)
                except (Exception, openai.APITimeoutError) as json_error:
                    # If JSON mode also fails or times out, skip third fallback to avoid more delays
                    if isinstance(json_error, (openai.APITimeoutError, TimeoutError)):
                        if self.verbose:
                            print(f"[LLM Analysis Agent] JSON mode timed out, skipping further fallbacks")
                        raise json_error
                    # If JSON mode also fails, re-raise to trigger outer fallback
                    if self.verbose:
                        print(f"[LLM Analysis Agent] JSON mode also failed: {json_error}")
                    raise e  # Re-raise original exception to trigger outer fallback
            
            # Extract results
            score = structured_analysis.get("score", 0.0)
            decision = structured_analysis.get("decision", "ALLOW")
            reason = structured_analysis.get("reason", "")
            
            result = {
                "phase": "llm_analysis",
                "decision": decision,
                "score": score,
                "reason": reason,
                "timestamp": time.time()
            }
            
            # Add detailed fields for full mode
            if not quick_mode:
                result.update({
                    "threats_found": structured_analysis.get("threats_found", []),
                    "threat_indicators": structured_analysis.get("threat_indicators", []),
                    "detected_patterns": structured_analysis.get("detected_patterns", []),
                    "function_call_attempts": structured_analysis.get("function_call_attempts", []),
                    "policy_violations": structured_analysis.get("policy_violations", []),
                    "severity": structured_analysis.get("severity", "safe"),
                    "summary": structured_analysis.get("summary", ""),
                    "details": structured_analysis.get("details", "")
                })
            
            if self.verbose:
                print(f"[LLM Analysis Agent] Decision: {decision}, Score: {score}")
                if not quick_mode:
                    print(f"  Threats: {result.get('threats_found', [])}")
                    print(f"  Threat Indicators: {result.get('threat_indicators', [])}")
                    print(f"  Detected Patterns: {result.get('detected_patterns', [])}")
                    print(f"  Function Call Attempts: {result.get('function_call_attempts', [])}")
                    print(f"  Policy Violations: {result.get('policy_violations', [])}")
                    print(f"  Severity: {result.get('severity', 'safe')}")
            
            return result
            
        except (Exception, openai.APITimeoutError, TimeoutError) as e:
            if self.verbose:
                print(f"[LLM Analysis Agent] Error: {e}")
            
            # If timeout occurred, skip fallback to avoid more delays
            if isinstance(e, (openai.APITimeoutError, TimeoutError)):
                return {
                    "phase": "llm_analysis",
                    "decision": "ERROR",
                    "score": 0.0,  # Don't block on timeout - allow but log error
                    "reason": f"LLM analysis timed out after 30 seconds",
                    "error": f"LLM analysis timed out: {str(e)}",
                    "timestamp": time.time()
                }
            
            # Fallback: try without structured outputs (only for non-timeout errors)
            try:
                if self.verbose:
                    print("[LLM Analysis Agent] Falling back to regular chat completion...")
                
                max_tokens = 300 if quick_mode else 600  # Reduced for faster responses
                response = self.openai_client.chat.completions.create(
                    model=self.llm_agent_model,
                    messages=[
                        {"role": "system", "content": self.llm_agent_system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    temperature=0.0,  # Deterministic
                    max_tokens=max_tokens
                )
                
                llm_output = response.choices[0].message.content
                
                # Fallback: simple analysis from text output
                result = {
                    "phase": "llm_analysis",
                    "decision": "ALLOW",
                    "score": 0.0,
                    "reason": "Fallback analysis - structured outputs not supported",
                    "error": "Structured outputs not supported, used fallback",
                    "timestamp": time.time()
                }
                
                # Add detailed fields for full mode
                if not quick_mode:
                    result.update({
                        "threats_found": [],
                        "threat_indicators": [],
                        "detected_patterns": [],
                        "function_call_attempts": [],
                        "policy_violations": [],
                        "severity": "safe",
                        "summary": llm_output[:200] if llm_output else "Fallback analysis",
                        "details": llm_output if llm_output else "Fallback analysis"
                    })
                
                return result
            except (Exception, openai.APITimeoutError, TimeoutError) as fallback_error:
                # If fallback also times out, return error immediately
                if isinstance(fallback_error, (openai.APITimeoutError, TimeoutError)):
                    return {
                        "phase": "llm_analysis",
                        "decision": "ERROR",
                        "score": 0.0,  # Don't block on timeout
                        "reason": f"LLM analysis timed out (fallback also timed out)",
                        "error": f"LLM analysis timed out: {str(e)} (fallback also timed out: {str(fallback_error)})",
                        "timestamp": time.time()
                    }
                return {
                    "phase": "llm_analysis",
                    "decision": "ERROR",
                    "score": 1.0,
                    "reason": f"LLM analysis failed: {str(e)} (fallback also failed: {str(fallback_error)})",
                    "error": f"LLM analysis failed: {str(e)} (fallback also failed: {str(fallback_error)})",
                    "timestamp": time.time()
                }
    
    def _get_quarantine_system_prompt(self, quick_analysis: bool = False) -> str:
        """
        Get system prompt for quarantine analysis, optimized for quick mode.
        
        Args:
            quick_analysis: If True, returns shorter prompt for faster processing
        
        Returns:
            System prompt string
        """
        # Check for custom prompt from policy first
        if self.custom_prompts:
            if quick_analysis:
                custom_prompt = self.custom_prompts.get("quarantine_system_prompt_quick")
                if custom_prompt:
                    return custom_prompt
            else:
                custom_prompt = self.custom_prompts.get("quarantine_system_prompt_full")
                if custom_prompt:
                    return custom_prompt
        
        # Fallback to default
        return get_quarantine_system_prompt(quick_analysis)
    
    def _get_quarantine_analysis_schema(self, quick_analysis: bool = False) -> Dict[str, Any]:
        """
        Get JSON schema for structured quarantine analysis output.
        
        Args:
            quick_analysis: If True, returns minimal schema without summary/content_analysis for faster processing
        
        Returns:
            JSON schema dictionary
        """
        # Optimize descriptions based on mode - shorter descriptions reduce token usage
        if quick_analysis:
            # Minimal descriptions for quick mode (10-20 chars max)
            base_properties = {
                "threat_indicators": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "S1-S14 threats + technical indicators"
                },
                "severity_assessment": {
                    "type": "string",
                    "enum": ["safe", "low", "medium", "high", "critical"],
                    "description": "Security severity level"
                },
                "detected_patterns": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Attack patterns detected"
                },
                "function_call_attempts": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Detected function calls"
                },
                "confidence": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                    "description": "Confidence 0-1"
                },
                "requires_hitl": {
                    "type": "boolean",
                    "description": "Whether human review (HITL) is recommended"
                },
                "hitl_reason": {
                    "type": "string",
                    "description": "Reason for HITL recommendation (if requires_hitl is true)"
                }
            }
            required = ["threat_indicators", "severity_assessment", "detected_patterns", "confidence", "requires_hitl"]
        else:
            # Full mode: Slightly longer but still optimized descriptions
            base_properties = {
                "threat_indicators": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "S1-S14 threat categories + technical indicators (instruction_injection, contextual_blending, function_call_attempt, hidden_instructions)"
                },
                "severity_assessment": {
                    "type": "string",
                    "enum": ["safe", "low", "medium", "high", "critical"],
                    "description": "Security severity: safe/low/medium/high/critical"
                },
                "detected_patterns": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Attack patterns: contextual_blending, instruction_injection, function_call_attempt"
                },
                "function_call_attempts": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Detected function call attempts (e.g., search_web, send_mail, get_weather)"
                },
                "confidence": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                    "description": "Confidence level 0-1"
                },
                "requires_hitl": {
                    "type": "boolean",
                    "description": "Whether human review (HITL) is recommended based on HITL rules and content analysis"
                },
                "hitl_reason": {
                    "type": "string",
                    "description": "Reason why HITL is recommended (if requires_hitl is true). Should reference specific HITL rules that were triggered."
                },
                "summary": {
                    "type": "string",
                    "description": "Brief summary of content and security concerns. Mention policy violations if function calls are blocked. If HITL is recommended, mention why."
                },
                "content_analysis": {
                    "type": "string",
                    "description": "Content analysis. Explain policy violations if function call attempts are blocked. If HITL is recommended, explain which HITL rules were triggered."
                }
            }
            required = ["threat_indicators", "severity_assessment", "detected_patterns", "summary", "content_analysis", "requires_hitl"]
        
        return {
            "type": "object",
            "properties": base_properties,
            "required": required,
            "additionalProperties": False
        }
    
    def _analyze_quarantine(
        self,
        function_name: str,
        function_result: Any,
        function_args: Optional[Any] = None,
        user_query: Optional[str] = None,
        function_chaining_info: Optional[Dict[str, Any]] = None,
        hitl_rules: Optional[str] = None,
        quick_analysis: bool = False
    ) -> Dict[str, Any]:
        """
        Two-stage quarantine analysis:
        1. Stage 1 (Infection Simulation): Send function_result to LLM with normal prompt to trigger hidden instructions
        2. Stage 2 (Evaluation): Analyze the Stage 1 LLM response for security threats
        
        Args:
            function_name: Name of the function
            function_result: Result from the function
            function_args: Optional arguments passed to the function
            user_query: Optional user query context
            function_chaining_info: Optional function chaining configuration with allowed_targets and blocked_targets
            hitl_rules: Optional HITL rules/description that the LLM should evaluate to determine if human review is needed
            quick_analysis: If True, skips expensive text fields (summary, content_analysis) for faster processing
            
        Returns:
            Dictionary with structured LLM analysis results including infection_simulation, function_chaining_info, and HITL recommendations
        """
        if not self.enable_quarantine or not self.openai_client:
            return {
                "phase": "quarantine",
                "decision": "SKIPPED",
                "error": "Quarantine analysis not enabled or OpenAI client not available"
            }
        
        # Skip quarantine for simple structured data (status messages, small dicts)
        # These are unlikely to contain hidden instructions and cause false positives
        if isinstance(function_result, dict):
            # Skip if it's a simple status/response dict (common patterns)
            if len(function_result) <= 3 and all(
                isinstance(k, str) and isinstance(v, (str, int, bool, type(None)))
                for k, v in function_result.items()
            ):
                # Check if it looks like a simple status message
                keys_lower = [k.lower() for k in function_result.keys()]
                if any(key in keys_lower for key in ['status', 'message', 'success', 'error', 'code', 'result']):
                    if self.verbose:
                        print("[Quarantine Analysis] Skipping quarantine for simple structured data (status message)")
                    return {
                        "phase": "quarantine",
                        "decision": "SKIPPED",
                        "reason": "Simple structured data - unlikely to contain hidden instructions",
                        "score": 0.0,
                        "severity": "safe"
                    }
        
        # Early exit conditions for quick mode (more aggressive skipping)
        if quick_analysis:
            # Skip very small inputs (< 100 characters)
            result_str = str(function_result)
            if len(result_str) < 100:
                if self.verbose:
                    print("[Quarantine Analysis] Quick mode: Skipping very small input (< 100 chars)")
                return {
                    "phase": "quarantine",
                    "decision": "SKIPPED",
                    "reason": "Quick mode: Input too small for analysis",
                    "score": 0.0,
                    "severity": "safe",
                    "quick_analysis": True
                }
            
            # Skip simple numeric/boolean responses
            if isinstance(function_result, (int, float, bool)) or function_result is None:
                if self.verbose:
                    print("[Quarantine Analysis] Quick mode: Skipping simple numeric/boolean/null response")
                return {
                    "phase": "quarantine",
                    "decision": "SKIPPED",
                    "reason": "Quick mode: Simple data type",
                    "score": 0.0,
                    "severity": "safe",
                    "quick_analysis": True
                }
            
            # Skip empty strings/lists
            if function_result == "" or (isinstance(function_result, list) and len(function_result) == 0):
                if self.verbose:
                    print("[Quarantine Analysis] Quick mode: Skipping empty input")
                return {
                    "phase": "quarantine",
                    "decision": "SKIPPED",
                    "reason": "Quick mode: Empty input",
                    "score": 0.0,
                    "severity": "safe",
                    "quick_analysis": True
                }
        
        if self.verbose:
            print("[Quarantine Analysis] Starting two-stage analysis...")
        
        # Initialize input_truncated flag
        input_truncated = False
        
        try:
            # Format the function result for the LLM
            if isinstance(function_result, (dict, list)):
                formatted_result = json.dumps(function_result, indent=2)
            else:
                formatted_result = str(function_result)
            
            # Truncate large inputs in quick mode to reduce processing time
            if quick_analysis and len(formatted_result) > 2000:
                original_length = len(formatted_result)
                formatted_result = formatted_result[:2000] + "\n[Input truncated for quick analysis]"
                input_truncated = True
                if self.verbose:
                    print(f"[Quarantine Analysis] Quick mode: Truncated input from {original_length} to 2000 chars")
            
            # ============================================
            # STAGE 1: INFECTION SIMULATION
            # Skip in quick mode for speed - evaluate original function_result directly
            # ============================================
            infection_response = None
            infection_response_text = None
            
            if quick_analysis:
                # Quick mode: Skip Stage 1, use original function_result directly
                if self.verbose:
                    print("[Quarantine Analysis] Quick mode: Skipping Stage 1 infection simulation")
                infection_response_text = formatted_result
                infection_response = {
                    "llm_response": None,
                    "skipped": True,
                    "reason": "Quick analysis mode - Stage 1 skipped for speed",
                    "timestamp": time.time()
                }
            else:
                # Full mode: Run Stage 1 infection simulation
                if self.verbose:
                    print("[Quarantine Analysis] Stage 1: Simulating LLM infection...")
                
                # Create a normal user-like prompt to trigger any hidden instructions
                # Use user_query if available, otherwise use a generic prompt
                stage1_user_prompt = format_quarantine_stage1_user_prompt(user_query, formatted_result)
                
                try:
                    # Stage 1: Normal LLM interaction to trigger hidden instructions
                    # Reduced max_tokens for faster response
                    stage1_response = self.openai_client.chat.completions.create(
                        model=self.infection_model,
                        messages=[
                            {
                                "role": "system",
                                "content": self.custom_prompts.get("infection_model_system_prompt") if self.custom_prompts and self.custom_prompts.get("infection_model_system_prompt") else INFECTION_MODEL_SYSTEM_PROMPT
                            },
                            {"role": "user", "content": stage1_user_prompt}
                        ],
                        temperature=0.7,  # Slightly higher temperature to allow natural responses
                        max_tokens=600  # Reduced from 1000 for faster response
                    )
                    
                    infection_response_text = stage1_response.choices[0].message.content
                    infection_response = {
                        "llm_response": infection_response_text,
                        "model": self.infection_model,
                        "timestamp": time.time()
                    }
                    
                    if self.verbose:
                        print(f"[Quarantine Analysis] Stage 1: LLM responded with {len(infection_response_text)} characters")
                        print(f"[Quarantine Analysis] Stage 1 Response Preview: {infection_response_text[:200]}...")
                        
                except Exception as stage1_error:
                    if self.verbose:
                        print(f"[Quarantine Analysis] Stage 1 failed: {stage1_error}")
                    # If Stage 1 fails, use function_result directly for Stage 2
                    infection_response_text = formatted_result
                    infection_response = {
                        "llm_response": None,
                        "error": str(stage1_error),
                        "fallback_used": formatted_result,
                        "timestamp": time.time()
                    }
            
            # ============================================
            # STAGE 2: EVALUATION
            # Analyze the Stage 1 LLM response (or original function_result in quick mode) for security threats
            # ============================================
            if self.verbose:
                print("[Quarantine Analysis] Stage 2: Evaluating LLM output...")
            
            # Create prompt for structured security analysis
            # In quick mode, analyze original function_result; in full mode, analyze Stage 1 response
            stage2_content = infection_response_text if infection_response_text else formatted_result
            
            # Get the schema for structured outputs (quick mode skips expensive text fields)
            schema = self._get_quarantine_analysis_schema(quick_analysis=quick_analysis)
            
            # Build user message using centralized prompt formatter
            # Format function_args if provided
            formatted_args = None
            if function_args is not None:
                if isinstance(function_args, (dict, list)):
                    formatted_args = json.dumps(function_args, indent=2)
                else:
                    formatted_args = str(function_args)
            user_message = format_quarantine_stage2_user_prompt(
                function_name=function_name,
                stage2_content=stage2_content,
                function_args=formatted_args,
                user_query=user_query,
                quick_analysis=quick_analysis,
                function_chaining_info=function_chaining_info,
                hitl_rules=hitl_rules
            )
            
            # Initialize response_content for prompt guard scoring
            response_content = None
            
            # Get system prompt (optimized for quick mode)
            system_prompt = self._get_quarantine_system_prompt(quick_analysis)
            
            # Try using structured outputs first
            try:
                response = self.openai_client.chat.completions.create(
                    model=self.analysis_model,
                    messages=[
                        {
                            "role": "system",
                            "content": system_prompt
                        },
                        {"role": "user", "content": user_message}
                    ],
                    response_format={
                        "type": "json_schema",
                        "json_schema": {
                            "name": "quarantine_security_analysis",
                            "strict": True,
                            "schema": schema
                        }
                    },
                    temperature=0.1 if quick_analysis else 0.3,  # Lower temperature for quick mode
                    max_tokens=200 if quick_analysis else 600  # Reduced tokens for faster response (was 250/1000)
                )
                
                # Extract structured analysis from JSON response
                response_content = response.choices[0].message.content
                structured_analysis = json.loads(response_content)
                
            except (AttributeError, TypeError, KeyError, ValueError, openai.APIError) as e:
                # Fallback to JSON mode if structured outputs not supported
                if self.verbose:
                    print(f"[Quarantine Analysis] Structured outputs not supported ({type(e).__name__}), using JSON mode...")
                
                user_message_with_schema = format_quarantine_stage2_user_prompt_with_schema(user_message, schema)
                
                try:
                    response = self.openai_client.chat.completions.create(
                        model=self.analysis_model,
                        messages=[
                            {
                                "role": "system",
                                "content": system_prompt
                            },
                            {"role": "user", "content": user_message_with_schema}
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.1 if quick_analysis else 0.3,  # Lower temperature for quick mode
                        max_tokens=200 if quick_analysis else 600  # Reduced tokens for faster response (was 250/1000)
                    )
                    
                    response_content = response.choices[0].message.content
                    structured_analysis = json.loads(response_content)
                except Exception as json_error:
                    if self.verbose:
                        print(f"[Quarantine Analysis] JSON mode also failed: {json_error}")
                    
                    # Final fallback: try to extract JSON from response or use raw text
                    try:
                        # Get response content if available, otherwise use error message
                        if 'response' in locals() and hasattr(response, 'choices') and len(response.choices) > 0:
                            response_content = response.choices[0].message.content
                        else:
                            # If we don't have response_content, create a fallback
                            response_content = str(json_error)
                        
                        # Try to extract JSON object from response
                        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_content, re.DOTALL)
                        if json_match:
                            structured_analysis = json.loads(json_match.group())
                        else:
                            # Last resort: create minimal structured analysis from raw text
                            raw_score = self.scorer.score(response_content)
                            structured_analysis = {
                                "threat_indicators": [],
                                "severity_assessment": "safe" if raw_score < 0.3 else "medium",
                                "detected_patterns": [],
                                "function_call_attempts": [],
                                "confidence": 0.5
                            }
                            # Only add text fields if not in quick mode
                            if not quick_analysis:
                                structured_analysis["summary"] = response_content[:500]  # Truncate if too long
                                structured_analysis["content_analysis"] = response_content
                    except Exception as final_error:
                        if self.verbose:
                            print(f"[Quarantine Analysis] Final fallback also failed: {final_error}")
                        raise e  # Re-raise original exception
            
            if self.verbose:
                print(f"[Quarantine Analysis] Structured analysis received:")
                print(f"  Severity: {structured_analysis.get('severity_assessment', 'unknown')}")
                print(f"  Threat Indicators: {len(structured_analysis.get('threat_indicators', []))}")
                print(f"  Detected Patterns: {structured_analysis.get('detected_patterns', [])}")
                print(f"  Function Call Attempts: {structured_analysis.get('function_call_attempts', [])}")
            
            # Get LLM's severity assessment and threat indicators FIRST
            llm_severity = structured_analysis.get('severity_assessment', 'safe').lower()
            threat_indicators = structured_analysis.get('threat_indicators', [])
            detected_patterns = structured_analysis.get('detected_patterns', [])
            function_call_attempts = structured_analysis.get('function_call_attempts', [])
            confidence = structured_analysis.get('confidence', 0.5)
            
            # Check if LLM actually detected threats
            has_threats = (
                len(threat_indicators) > 0 or 
                len(detected_patterns) > 0 or 
                len(function_call_attempts) > 0 or
                llm_severity not in ['safe', 'low']
            )
            
            # Calculate base score from LLM's severity assessment and confidence
            # This is the PRIMARY score - the LLM has already analyzed the content
            severity_to_score = {
                'safe': 0.0,
                'low': 0.2,
                'medium': 0.5,
                'high': 0.8,
                'critical': 0.95
            }
            base_severity_score = severity_to_score.get(llm_severity, 0.0)
            
            # Adjust base score by confidence (higher confidence = closer to severity score)
            # Confidence acts as a multiplier: 0.5 confidence = halfway between safe and severity, 1.0 = full severity
            llm_assessment_score = base_severity_score * confidence + (1 - confidence) * (base_severity_score * 0.5)
            
            # Boost score if multiple threat indicators or function call attempts detected
            threat_multiplier = 1.0
            if len(threat_indicators) > 3:
                threat_multiplier = 1.1  # Multiple threat categories
            if len(function_call_attempts) > 0:
                threat_multiplier = max(threat_multiplier, 1.15)  # Function call attempts are critical
            if len(detected_patterns) > 2:
                threat_multiplier = max(threat_multiplier, 1.05)  # Multiple attack patterns
            
            # Apply multiplier (cap at 0.99 to avoid perfect scores)
            llm_assessment_score = min(llm_assessment_score * threat_multiplier, 0.99)
            
            # Convert structured analysis to JSON string for secondary validation with Prompt Guard
            analysis_json = json.dumps(structured_analysis, indent=2)
            
            # Score the structured analysis with Prompt Guard (secondary validation)
            if self.verbose:
                print("[Quarantine Analysis] Scoring structured analysis with Prompt Guard (secondary validation)...")
            
            prompt_guard_analysis_score = self.scorer.score(analysis_json)
            
            # IMPORTANT: Score the quarantine LLM's output itself for malicious injection
            # This is a defense-in-depth measure to catch any injection in the LLM's response
            if self.verbose:
                print("[Quarantine Analysis] Running prompt guard on quarantine LLM output for malicious injection...")
            
            # Score the LLM's raw response content for injection attempts
            # Use response_content if available, otherwise use the structured analysis JSON
            if response_content:
                prompt_guard_llm_score = self.scorer.score(response_content)
            else:
                # Fallback: score the structured analysis JSON if response_content not available
                prompt_guard_llm_score = prompt_guard_analysis_score
            
            if self.verbose:
                print(f"[Quarantine Analysis] LLM Assessment Score (primary): {llm_assessment_score:.4f}")
                print(f"[Quarantine Analysis] Prompt Guard Analysis Score (secondary): {prompt_guard_analysis_score:.4f}")
                print(f"[Quarantine Analysis] Prompt Guard LLM Output Score (secondary): {prompt_guard_llm_score:.4f}")
            
            # Use LLM assessment as primary score, prompt guard scores as secondary validation
            # If prompt guard scores are very high (>0.7), they indicate injection in the LLM response itself
            # If prompt guard scores are very low (<0.1) but LLM assessment is high, trust LLM (it analyzed the content correctly)
            # Weight: 80% LLM assessment, 20% prompt guard validation
            analysis_score = llm_assessment_score
            llm_output_score = prompt_guard_llm_score
            
            # Only score summary/content_analysis if LLM detected threats AND not in quick mode
            # This prevents false positives from scoring natural language summaries of benign content
            summary_score = None
            content_analysis_score = None
            if has_threats and not quick_analysis:
                # LLM detected something suspicious - score the text fields for additional validation
                # Only if they exist (not in quick mode)
                if 'summary' in structured_analysis:
                    summary_score = self.scorer.score(structured_analysis.get('summary', ''))
                if 'content_analysis' in structured_analysis:
                    content_analysis_score = self.scorer.score(structured_analysis.get('content_analysis', ''))
                
                # If summary or content_analysis scores are very high (>= 0.9), they indicate strong threat signals
                # In this case, we should weight them more heavily or use them as a strong signal
                if summary_score is not None and content_analysis_score is not None:
                    high_text_scores = summary_score >= 0.9 or content_analysis_score >= 0.9
                    
                    if high_text_scores:
                        # When text scores are very high, they're a strong indicator of threats
                        # Weight them more heavily: use max of text scores as primary signal
                        max_text_score = max(summary_score, content_analysis_score)
                        # Combined score: LLM assessment is primary, high text scores boost it
                        combined_score = (llm_assessment_score * 0.5 + max_text_score * 0.3 + prompt_guard_llm_score * 0.2)
                    else:
                        # Normal weighting: LLM assessment is primary, text scores and prompt guard are secondary
                        combined_score = (llm_assessment_score * 0.6 + summary_score * 0.15 + content_analysis_score * 0.15 + prompt_guard_llm_score * 0.1)
                else:
                    # Text fields not available (quick mode) - use LLM assessment as primary
                    combined_score = (llm_assessment_score * 0.8 + prompt_guard_llm_score * 0.2)
            else:
                # LLM says safe with no threats - trust it, but still include prompt guard score as safety check
                # Use LLM assessment as primary (it's already low for safe/low severity)
                combined_score = (llm_assessment_score * 0.9 + prompt_guard_llm_score * 0.1)
            
            # Trust LLM assessment when it says safe/low with no threats
            if not has_threats and llm_severity in ['safe', 'low']:
                # LLM confidently says it's safe - trust it
                severity = llm_severity
                # Only override if LLM assessment score is very high (indicating LLM might be wrong)
                if llm_assessment_score >= self.quarantine_block_threshold:
                    # LLM assessment indicates high risk - override to at least medium
                    severity = "medium" if llm_assessment_score < 0.7 else "high"
            else:
                # LLM detected threats or is uncertain - use combined assessment
                if combined_score >= self.quarantine_block_threshold:
                    # Score indicates high risk
                    if combined_score >= 0.9:
                        severity = "critical"
                    else:
                        severity = "high"
                    # Use LLM severity if it's higher
                    severity_order = {"safe": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
                    llm_severity_level = severity_order.get(llm_severity, 0)
                    current_severity_level = severity_order.get(severity, 0)
                    if llm_severity_level > current_severity_level:
                        severity = llm_severity
                elif combined_score >= self.quarantine_safe_threshold:
                    # Score indicates medium risk
                    severity = "medium" if combined_score < 0.5 else "high"
                    # Use LLM severity if it's higher
                    severity_order = {"safe": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
                    llm_severity_level = severity_order.get(llm_severity, 0)
                    current_severity_level = severity_order.get(severity, 0)
                    if llm_severity_level > current_severity_level:
                        severity = llm_severity
                else:
                    # Score indicates low risk, but use LLM assessment if it flags something
                    severity_order = {"safe": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
                    llm_severity_level = severity_order.get(llm_severity, 0)
                    if llm_severity_level >= 2:  # medium or higher
                        severity = llm_severity
                    else:
                        severity = "safe" if combined_score < 0.1 else "low"
            
            decision = "PASS"
            severity_order = {"safe": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
            severity_level = severity_order.get(severity, 0)
            
            # Special handling: If summary or content_analysis scores are very high (>= 0.9),
            # this is a strong threat signal and should trigger BLOCK even if combined_score is lower
            # Only applicable if not in quick mode
            high_text_threat = False
            if has_threats and not quick_analysis and summary_score is not None and content_analysis_score is not None:
                if summary_score >= 0.9 or content_analysis_score >= 0.9:
                    high_text_threat = True
            
            # Simple decision logic: BLOCK for high severity, otherwise PASS (let severity rules handle it)
            if severity_level >= 4:  # critical
                decision = "BLOCK"
            elif severity_level >= 3:  # high
                decision = "BLOCK"
            elif high_text_threat:
                # High text scores indicate strong threat signals - block even if severity is medium
                decision = "BLOCK"
            elif combined_score >= self.quarantine_block_threshold:
                decision = "BLOCK"
            else:
                # PASS - let severity rules and thresholds handle it
                decision = "PASS"
            
            result = {
                "phase": "quarantine",
                "decision": decision,
                "score": combined_score,  # Combined score (LLM assessment + prompt guard validation)
                "analysis_score": llm_assessment_score,  # Primary score from LLM severity assessment
                "llm_output_score": llm_output_score,  # Prompt guard score on LLM output (secondary validation)
                "severity": severity,
                "structured_analysis": structured_analysis,
                "threat_indicators": structured_analysis.get('threat_indicators', []),
                "detected_patterns": structured_analysis.get('detected_patterns', []),
                "function_call_attempts": structured_analysis.get('function_call_attempts', []),
                "confidence": structured_analysis.get('confidence', 0.0),
                "requires_hitl": structured_analysis.get('requires_hitl', False),
                "hitl_reason": structured_analysis.get('hitl_reason', ''),
                "timestamp": time.time(),
                "quick_analysis": quick_analysis,  # Indicate if quick mode was used
                "input_truncated": input_truncated,  # Indicate if input was truncated
                # Stage 1: Infection simulation results
                "infection_simulation": infection_response
            }
            
            # Only include text fields if not in quick mode
            if not quick_analysis:
                result["summary"] = structured_analysis.get('summary', '')
                result["content_analysis"] = structured_analysis.get('content_analysis', '')
            
            # Include function chaining info in response
            if function_chaining_info:
                result["function_chaining_info"] = function_chaining_info
            
            # Only include summary/content scores if they were calculated (when threats detected and not quick mode)
            if has_threats and not quick_analysis:
                if summary_score is not None:
                    result["summary_score"] = summary_score
                if content_analysis_score is not None:
                    result["content_analysis_score"] = content_analysis_score
            
            if self.verbose:
                mode_str = "Quick" if quick_analysis else "Full"
                print(f"[Quarantine Analysis] {mode_str} Mode - Stage 2 Evaluation Complete:")
                print(f"  Combined Score (Stage 2): {combined_score:.4f}, Decision: {decision}, Severity: {severity}")
                print(f"  LLM Assessment Score (primary): {llm_assessment_score:.4f}")
                print(f"  Prompt Guard Analysis Score: {prompt_guard_analysis_score:.4f}")
                print(f"  Prompt Guard LLM Output Score: {llm_output_score:.4f}")
                if has_threats and not quick_analysis:
                    if summary_score is not None:
                        print(f"  Summary Score: {summary_score:.4f}")
                    if content_analysis_score is not None:
                        print(f"  Content Analysis Score: {content_analysis_score:.4f}")
                elif quick_analysis:
                    print(f"  Quick mode: Text field scoring skipped")
                else:
                    print(f"  Trusting LLM assessment (safe/low with no threats detected)")
                if input_truncated:
                    print(f"  Input was truncated for quick analysis")
                print(f"[Quarantine Analysis] {mode_str} mode analysis complete")
            
            return result
            
        except Exception as e:
            if self.verbose:
                print(f"[Quarantine Analysis] Error: {e}")
            return {
                "phase": "quarantine",
                "decision": "ERROR",
                "score": 0.0,  # Add default score
                "severity": "safe",  # Add default severity
                "error": str(e),
                "timestamp": time.time()
            }
    
    def analyze(
        self,
        function_name: str,
        function_result: Any,
        function_args: Optional[Any] = None,
        user_query: Optional[str] = None,
        user_role: Optional[str] = None,
        target_function: Optional[str] = None,
        input_analysis: bool = True,
        llm_analysis: bool = False,
        quarantine_analysis: bool = False,
        quick_analysis: bool = False,
        enable_keyword_detection: bool = False,
        keywords: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Complete pipeline analysis of a function call.
        
        Args:
            function_name: Name of the function that was called
            function_result: Result returned by the function
            function_args: Optional arguments passed to the function
            user_query: Optional user query for context
            user_role: Optional user role for RBAC checking (e.g., "admin", "user", "guest")
            target_function: Optional target function for function chaining checks
            input_analysis: Whether to run input analysis (Stage 1: Prompt Guard)
            llm_analysis: Whether to run LLM analysis agent (Stage 2: Structured LLM analysis)
            quarantine_analysis: Whether to run quarantine analysis (Stage 3: Two-stage infection simulation)
            quick_analysis: If True, uses quick mode for LLM analysis (simplified output with only score, decision, reason). If False, uses full detailed analysis with threat indicators, detected patterns, function call attempts, etc.
            enable_keyword_detection: Whether to enable keyword detection for sensitive keywords
            keywords: Optional custom list of keywords to detect (if not provided, uses default sensitive keywords)
            
        Returns:
            Complete analysis with enabled stages and final decision.
        """
        if self.verbose:
            print(f"\n{'='*60}")
            print(f"Guard Pipeline Analysis: {function_name}")
            print(f"{'='*60}\n")
        
        # Get function chaining configuration early for inclusion in all responses
        function_chaining_info = None
        hitl_rules = None
        if self.config:
            function_chaining_info = self.config.get_function_chaining_config(function_name)
            # Only include if there's actual configuration (not empty dict)
            if not function_chaining_info or (not function_chaining_info.get('allowed_targets') and not function_chaining_info.get('blocked_targets')):
                function_chaining_info = None
            
            # Get HITL rules for this function
            hitl_rules = self.config.get_hitl_rules(function_name)
        
        # RBAC Check
        if self.config and user_role:
            if not self.config.check_role_permission(user_role, function_name):
                result = {
                    "final_decision": "BLOCKED",
                    "blocked_at": "rbac",
                    "reason": f"Role '{user_role}' does not have permission to call '{function_name}'",
                    "input_analysis": None,
                    "quarantine_analysis": None,
                    "safe_to_use": False,
                    "rbac_blocked": True
                }
                if function_chaining_info:
                    result["function_chaining_info"] = function_chaining_info
                return result
        
        # Function Chaining Check
        if self.config and target_function:
            if not self.config.check_function_chaining(function_name, target_function):
                result = {
                    "final_decision": "BLOCKED",
                    "blocked_at": "function_chaining",
                    "reason": f"Function '{function_name}' is not allowed to call '{target_function}'",
                    "input_analysis": None,
                    "quarantine_analysis": None,
                    "safe_to_use": False,
                    "chaining_blocked": True
                }
                if function_chaining_info:
                    result["function_chaining_info"] = function_chaining_info
                return result
        
        # Keyword Detection (if enabled)
        keyword_detection_result = None
        if enable_keyword_detection:
            keyword_detection_result = self._detect_keywords(function_result, keywords)
            if self.verbose:
                print(f"[Keyword Detection] Detected {keyword_detection_result['keyword_count']} keywords, Risk Score: {keyword_detection_result['risk_score']:.4f}")
        
        # Input Analysis
        input_result = None
        if input_analysis:
            input_result = self._analyze_input(function_name, function_result, function_args)
        else:
            # If input analysis is disabled, create a default pass result
            input_result = {
                "phase": "input",
                "decision": "PASS",
                "score": 0.0,
                "severity": "safe",
                "analysis": None,
                "timestamp": time.time(),
                "skipped": True,
                "reason": "Input analysis disabled"
            }
        
        # Apply severity rules after input analysis (only if input analysis was run)
        if self.config and input_analysis and input_result:
            severity_rule = self.config.get_severity_rule(input_result['severity'])
            if severity_rule.get('block', False):
                result = {
                    "final_decision": "BLOCKED",
                    "blocked_at": "severity_rule_input",
                    "reason": f"Severity rule for '{input_result['severity']}' requires blocking",
                    "input_analysis": input_result,
                    "llm_analysis": None,
                    "quarantine_analysis": None,
                    "keyword_detection": keyword_detection_result,
                    "safe_to_use": False,
                    "severity_rule": severity_rule
                }
                if function_chaining_info:
                    result["function_chaining_info"] = function_chaining_info
                return result
            
            # Check output restrictions (only if input analysis was run)
            if input_analysis and input_result:
                output_restrictions = self.config.check_output_restriction(function_name)
                max_severity_allowed = output_restrictions.get("max_severity_allowed")
                if max_severity_allowed:
                    severity_order = {"safe": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
                    current_level = severity_order.get(input_result['severity'].lower(), 0)
                    max_level = severity_order.get(max_severity_allowed.lower(), 0)
                    if current_level > max_level:
                        result = {
                            "final_decision": "BLOCKED",
                            "blocked_at": "output_restriction",
                            "reason": f"Function '{function_name}' output severity '{input_result['severity']}' exceeds allowed maximum '{max_severity_allowed}'",
                            "input_analysis": input_result,
                            "llm_analysis": None,
                            "quarantine_analysis": None,
                            "keyword_detection": keyword_detection_result,
                            "safe_to_use": False,
                            "output_restriction": output_restrictions
                        }
                        if function_chaining_info:
                            result["function_chaining_info"] = function_chaining_info
                        return result
                
                # Evaluate context rules
                context_action = self.config.evaluate_context_rules(
                    function_name,
                    function_result,
                    input_result['severity']
                )
            else:
                context_action = {"block": False}
            if context_action.get('block', False):
                result = {
                    "final_decision": "BLOCKED",
                    "blocked_at": "context_rule",
                    "reason": context_action.get('reason', 'Context rule triggered'),
                    "input_analysis": input_result,
                    "quarantine_analysis": None,
                    "safe_to_use": False,
                    "context_rule": context_action
                }
                if function_chaining_info:
                    result["function_chaining_info"] = function_chaining_info
                return result
        
        # If input analysis blocks, stop here (only if input analysis was enabled and ran)
        if input_analysis and input_result and input_result.get('decision') == "BLOCK":
            result = {
                "final_decision": "BLOCKED",
                "blocked_at": "input_analysis",
                "reason": f"Input analysis detected {input_result['severity']} risk (score: {input_result['score']:.4f})",
                "input_analysis": input_result,
                "llm_analysis": None,  # Skipped because input was blocked
                "quarantine_analysis": None,
                "keyword_detection": keyword_detection_result,
                "safe_to_use": False
            }
            if function_chaining_info:
                result["function_chaining_info"] = function_chaining_info
            return result
        
        # Check keyword detection results (if enabled)
        if enable_keyword_detection and keyword_detection_result and keyword_detection_result.get('detected'):
            # If keywords detected with high risk, we may want to block or review
            keyword_risk = keyword_detection_result.get('risk_score', 0.0)
            keyword_severity = keyword_detection_result.get('severity', 'safe')
            
            # If keyword detection shows high risk, consider blocking
            if keyword_severity in ['high', 'critical'] or keyword_risk >= 0.7:
                result = {
                    "final_decision": "BLOCKED",
                    "blocked_at": "keyword_detection",
                    "reason": f"Keyword detection identified {keyword_detection_result['keyword_count']} sensitive keywords with {keyword_severity} severity (risk score: {keyword_risk:.4f})",
                    "input_analysis": input_result,
                    "llm_analysis": None,
                    "quarantine_analysis": None,
                    "keyword_detection": keyword_detection_result,
                    "safe_to_use": False
                }
                if function_chaining_info:
                    result["function_chaining_info"] = function_chaining_info
                return result
        
        # LLM Analysis Agent (after input analysis, before quarantine)
        llm_analysis_result = None
        if llm_analysis:
            # Auto-enable LLM agent if OpenAI client is available but LLM agent wasn't explicitly enabled
            if not self.enable_llm_agent and self.openai_client:
                if self.verbose:
                    print("[LLM Analysis] Auto-enabling LLM agent")
                self.enable_llm_agent = True
                self.llm_agent_model = self.analysis_model
                # Use default system prompt if not set
                if not self.llm_agent_system_prompt:
                    self.llm_agent_system_prompt = LLM_AGENT_SYSTEM_PROMPT_DEFAULT 

            
            # Use quick_mode based on quick_analysis parameter
            quick_mode = quick_analysis
            
            if self.enable_llm_agent and self.openai_client:
                llm_analysis_result = self._analyze_with_llm_agent(
                    function_name, 
                    function_result,
                    function_args,
                    user_query,
                    quick_mode=quick_mode
                )
            else:
                # LLM analysis requested but not available
                if self.verbose:
                    print("[LLM Analysis] LLM analysis requested but LLM agent is not available")
                llm_analysis_result = {
                    "decision": "ERROR",
                    "reason": "LLM analysis requested but LLM agent is not available. Please provide OpenAI API credentials.",
                    "error": True,
                    "quick_mode": quick_mode
                }
            
            # Check for policy violations first (always block)
            if llm_analysis_result and llm_analysis_result.get('policy_violations'):
                result = {
                    "final_decision": "BLOCKED",
                    "blocked_at": "llm_analysis",
                    "reason": f"LLM analysis detected policy violations: {', '.join(llm_analysis_result.get('policy_violations', []))}",
                    "input_analysis": input_result,
                    "llm_analysis": llm_analysis_result,
                    "quarantine_analysis": None,
                    "keyword_detection": keyword_detection_result,
                    "safe_to_use": False
                }
                if function_chaining_info:
                    result["function_chaining_info"] = function_chaining_info
                return result
            
            # If LLM analysis blocks, check severity rules
            if llm_analysis_result and llm_analysis_result.get('decision') == "BLOCK":
                # Check severity rules
                if self.config and llm_analysis_result.get('severity'):
                    severity_rule = self.config.get_severity_rule(llm_analysis_result['severity'])
                    if severity_rule.get('block', False):
                        result = {
                            "final_decision": "BLOCKED",
                            "blocked_at": "severity_rule_llm_analysis",
                            "reason": f"Severity rule for '{llm_analysis_result['severity']}' requires blocking (from LLM analysis)",
                            "input_analysis": input_result,
                            "llm_analysis": llm_analysis_result,
                            "quarantine_analysis": None,
                            "safe_to_use": False,
                            "severity_rule": severity_rule
                        }
                        if function_chaining_info:
                            result["function_chaining_info"] = function_chaining_info
                        return result
                # If no severity rule blocks, continue to quarantine for defense in depth
                if self.verbose:
                    print("[LLM Analysis Agent] Block decision detected, but continuing to quarantine for defense in depth")
        
        # If only LLM analysis is enabled (no quarantine), return result based on LLM analysis
        if llm_analysis and not quarantine_analysis:
            # Check if LLM analysis had an error
            if llm_analysis_result and llm_analysis_result.get('error'):
                # On error, allow but with warning
                result = {
                    "final_decision": "ALLOWED",
                    "blocked_at": None,
                    "reason": llm_analysis_result.get('reason', 'LLM analysis requested but not available'),
                    "input_analysis": input_result,
                    "llm_analysis": llm_analysis_result,
                    "quarantine_analysis": None,
                    "keyword_detection": keyword_detection_result,
                    "safe_to_use": True,
                    "warning": "LLM analysis failed, proceeding with input analysis only"
                }
                if function_chaining_info:
                    result["function_chaining_info"] = function_chaining_info
                return result
            
            # Use LLM analysis result for final decision (simplified output)
            if llm_analysis_result:
                # Check for policy violations first (always block)
                policy_violations = llm_analysis_result.get('policy_violations', [])
                threats_found = llm_analysis_result.get('threats_found', [])
                severity = llm_analysis_result.get('severity', 'safe')
                decision = llm_analysis_result.get('decision', 'ALLOW')
                score = llm_analysis_result.get('score', 0.0)
                reason_text = llm_analysis_result.get('reason', '')
                
                # Priority 1: Policy violations always block
                if policy_violations:
                    final_decision = "BLOCKED"
                    final_score = score
                    reason = f"LLM analysis detected policy violations: {', '.join(policy_violations)}"
                # Priority 2: If LLM explicitly says BLOCK, respect that decision
                elif decision == "BLOCK":
                    final_decision = "BLOCKED"
                    final_score = score
                    if reason_text:
                        reason = reason_text
                    else:
                        reason = f"LLM analysis detected {severity} risk (score: {score:.2f})"
                        if threats_found:
                            reason += f" with threats: {', '.join(threats_found)}"
                # Priority 3: Check severity rules if decision is ALLOW but threats found
                elif threats_found:
                    severity_rule = None
                    if self.config:
                        severity_rule = self.config.get_severity_rule(severity)
                    
                    if severity_rule and severity_rule.get('block', False):
                        final_decision = "BLOCKED"
                        final_score = score
                        reason = f"LLM analysis detected {severity} risk (score: {score:.2f}) with threats: {', '.join(threats_found)}"
                    else:
                        final_decision = "ALLOWED"
                        final_score = score
                        reason = f"LLM analysis detected {severity} risk (score: {score:.2f}) but severity rules allow it"
                # Priority 4: Safe - no threats, decision is ALLOW
                else:
                    final_decision = "ALLOWED"
                    final_score = score
                    reason = reason_text if reason_text else 'LLM analysis: Safe'
                
                result = {
                    "final_decision": final_decision,
                    "final_score": final_score,
                    "blocked_at": None if final_decision == "ALLOWED" else "llm_analysis",
                    "reason": reason,
                    "input_analysis": input_result,
                    "llm_analysis": llm_analysis_result,
                    "quarantine_analysis": None,
                    "keyword_detection": keyword_detection_result,
                    "safe_to_use": final_decision == "ALLOWED"
                }
                if function_chaining_info:
                    result["function_chaining_info"] = function_chaining_info
                return result
        
        # If input analysis says BLOCK and no other analysis is enabled, return block
        if input_analysis and input_result and input_result.get('decision') == "BLOCK" and not llm_analysis and not quarantine_analysis:
            # Check severity rules to determine final decision
            severity_rule = None
            if self.config:
                severity_rule = self.config.get_severity_rule(input_result.get('severity', 'safe'))
            
            # If severity rule says to block, block it
            if severity_rule and severity_rule.get('block', False):
                result = {
                    "final_decision": "BLOCKED",
                    "blocked_at": "input_analysis",
                    "reason": f"Input analysis detected {input_result['severity']} risk (score: {input_result.get('score', 0):.4f})",
                    "input_analysis": input_result,
                    "llm_analysis": None,
                    "quarantine_analysis": None,
                    "keyword_detection": keyword_detection_result,
                    "safe_to_use": False,
                    "severity_rule": severity_rule
                }
                if function_chaining_info:
                    result["function_chaining_info"] = function_chaining_info
                return result
            # Otherwise, allow it (let severity rules handle it)
        
        # Quarantine Analysis
        quarantine_result = None
        if quarantine_analysis and self.enable_quarantine:
            # Use quick mode if only LLM analysis is enabled (no quarantine), but we're running quarantine
            # Actually, if quarantine is enabled, we want full mode
            quick_mode = False  # Quarantine always uses full mode
            quarantine_result = self._analyze_quarantine(
                function_name, 
                function_result, 
                user_query, 
                function_chaining_info, 
                hitl_rules=hitl_rules, 
                quick_analysis=quick_mode
            )
        else:
            # Quarantine skipped
            if not quarantine_analysis:
                reason = "Quarantine analysis disabled (quarantine_analysis=false)"
            elif not self.enable_quarantine:
                reason = "Quarantine analysis disabled globally (enable_quarantine=false)"
            else:
                reason = "Quarantine analysis disabled"
            
            quarantine_result = {
                "phase": "quarantine",
                "decision": "SKIPPED",
                "reason": reason,
                "score": None,
                "severity": None,
                "timestamp": time.time()
            }
        
        # Handle skipped quarantine - but only if LLM analysis is not enabled or already completed
        # If LLM analysis is enabled and not quarantine, we should have already returned above
        if quarantine_result and quarantine_result.get('decision') == "SKIPPED":
            # If LLM analysis was requested but not run, we should have handled it above
            # This case is for when neither LLM nor quarantine is enabled
            if not llm_analysis or (llm_analysis_result and not llm_analysis_result.get('error')):
                result = {
                    "final_decision": "ALLOWED",
                    "blocked_at": None,
                    "reason": quarantine_result.get('reason', 'Quarantine analysis skipped'),
                    "input_analysis": input_result,
                    "llm_analysis": llm_analysis_result,
                    "quarantine_analysis": quarantine_result,
                    "keyword_detection": keyword_detection_result,
                    "safe_to_use": True
                }
                if function_chaining_info:
                    result["function_chaining_info"] = function_chaining_info
                return result
        
        # Apply severity rules after quarantine analysis
        if self.config and quarantine_result.get('severity'):
            severity_rule = self.config.get_severity_rule(quarantine_result['severity'])
            if severity_rule.get('block', False):
                result = {
                    "final_decision": "BLOCKED",
                    "blocked_at": "severity_rule_quarantine",
                    "reason": f"Severity rule for '{quarantine_result['severity']}' requires blocking",
                    "input_analysis": input_result,
                    "llm_analysis": llm_analysis_result,
                    "quarantine_analysis": quarantine_result,
                    "keyword_detection": keyword_detection_result,
                    "safe_to_use": False,
                    "severity_rule": severity_rule
                }
                if function_chaining_info:
                    result["function_chaining_info"] = function_chaining_info
                return result
            
            # Check if output can be used
            if not severity_rule.get('allow_output_use', True):
                result = {
                    "final_decision": "BLOCKED",
                    "blocked_at": "severity_rule_quarantine",
                    "reason": f"Severity '{quarantine_result['severity']}' does not allow output use",
                    "input_analysis": input_result,
                    "llm_analysis": llm_analysis_result,
                    "quarantine_analysis": quarantine_result,
                    "keyword_detection": keyword_detection_result,
                    "safe_to_use": False,
                    "severity_rule": severity_rule
                }
                if function_chaining_info:
                    result["function_chaining_info"] = function_chaining_info
                return result
        
        # Handle quarantine errors
        if quarantine_result and quarantine_result.get('decision') == "ERROR":
            result = {
                "final_decision": "ALLOWED_WITH_WARNING",
                "blocked_at": None,
                "reason": "Input analysis passed, quarantine analysis error occurred",
                "input_analysis": input_result,
                "llm_analysis": llm_analysis_result,
                "quarantine_analysis": quarantine_result,
                "keyword_detection": keyword_detection_result,
                "safe_to_use": True,
                "warning": "Quarantine analysis failed"
            }
            if function_chaining_info:
                result["function_chaining_info"] = function_chaining_info
            return result
        
        # Make final decision based on all phases
        # Consider LLM analysis result in final decision
        if llm_analysis_result and llm_analysis_result.get('decision') == "BLOCK":
            # If LLM analysis blocks, use that as primary reason
            llm_score = llm_analysis_result.get('score', 0.0)
            result = {
                "final_decision": "BLOCKED",
                "final_score": llm_score,
                "blocked_at": "llm_analysis",
                "reason": f"LLM analysis agent detected {llm_analysis_result.get('severity', 'unknown')} risk (score: {llm_score:.4f})",
                "input_analysis": input_result,
                "llm_analysis": llm_analysis_result,
                "quarantine_analysis": quarantine_result,
                "keyword_detection": keyword_detection_result,
                "safe_to_use": False
            }
            if function_chaining_info:
                result["function_chaining_info"] = function_chaining_info
            return result
        
        if quarantine_result and quarantine_result.get('decision') == "BLOCK":
            q_score = quarantine_result.get('score', 0.0)
            result = {
                "final_decision": "BLOCKED",
                "final_score": q_score,
                "blocked_at": "quarantine_analysis",
                "reason": f"Quarantine analysis detected {quarantine_result.get('severity', 'unknown')} risk in LLM output (score: {q_score:.4f})",
                "input_analysis": input_result,
                "llm_analysis": llm_analysis_result,
                "quarantine_analysis": quarantine_result,
                "keyword_detection": keyword_detection_result,
                "safe_to_use": False
            }
            if function_chaining_info:
                result["function_chaining_info"] = function_chaining_info
            return result
        
        # Final decision logic using thresholds and severity rules
        # Get decision thresholds from config
        decision_thresholds = None
        if self.config:
            decision_thresholds = self.config.get_decision_thresholds()
        
        block_threshold = decision_thresholds.get('block_threshold', 0.7) if decision_thresholds else 0.7
        allow_threshold = decision_thresholds.get('allow_threshold', 0.3) if decision_thresholds else 0.3
        use_severity_fallback = decision_thresholds.get('use_severity_fallback', True) if decision_thresholds else True
        
        # Determine final decision based on analysis results
        final_decision = "ALLOWED"
        blocked_at = None
        final_reason = "All phases passed"
        final_score = 0.0
        
        # Calculate final_score from available analyses (priority: LLM > Quarantine > Input)
        if llm_analysis_result and 'score' in llm_analysis_result:
            final_score = llm_analysis_result.get('score', 0.0)
        elif quarantine_result and 'score' in quarantine_result:
            final_score = quarantine_result.get('score', 0.0)
        elif input_result and 'score' in input_result:
            final_score = input_result.get('score', 0.0)
        
        # Priority 1: Check for policy violations (always block)
        if llm_analysis_result and llm_analysis_result.get('policy_violations'):
            final_decision = "BLOCKED"
            blocked_at = "llm_analysis"
            final_reason = f"Policy violations detected: {', '.join(llm_analysis_result.get('policy_violations', []))}"
            if 'score' in llm_analysis_result:
                final_score = llm_analysis_result.get('score', 0.0)
        # Priority 2: If LLM analysis explicitly says BLOCK, respect that decision
        elif llm_analysis_result and llm_analysis_result.get('decision') == "BLOCK":
            final_decision = "BLOCKED"
            blocked_at = "llm_analysis"
            if 'score' in llm_analysis_result:
                final_score = llm_analysis_result.get('score', 0.0)
            reason_text = llm_analysis_result.get('reason', '')
            if reason_text:
                final_reason = reason_text
            else:
                severity = llm_analysis_result.get('severity', 'unknown')
                final_reason = f"LLM analysis detected {severity} risk (score: {final_score:.2f})"
        # Priority 3: Check combined score against thresholds
        elif llm_analysis_result or quarantine_result:
            # Get the highest severity from all analyses
            max_severity = "safe"
            combined_score = 0.0
            
            if llm_analysis_result:
                llm_severity = llm_analysis_result.get('severity', 'safe').lower()
                severity_order = {"safe": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
                if severity_order.get(llm_severity, 0) > severity_order.get(max_severity, 0):
                    max_severity = llm_severity
                # Use actual score from LLM analysis if available, otherwise calculate from severity
                if 'score' in llm_analysis_result:
                    llm_score = llm_analysis_result.get('score', 0.0)
                else:
                    # Fallback: Calculate score from severity and threats
                    threats_count = len(llm_analysis_result.get('threats_found', []))
                    violations_count = len(llm_analysis_result.get('policy_violations', []))
                    # Base score from severity (0.0 for safe, 0.2 for low, 0.4 for medium, 0.6 for high, 0.8 for critical)
                    severity_score = severity_order.get(llm_severity, 0) * 0.2
                    # Add bonuses for threats and violations
                    threat_bonus = min(threats_count * 0.1, 0.3)  # Max 0.3 bonus
                    violation_bonus = min(violations_count * 0.2, 0.4)  # Max 0.4 bonus
                    llm_score = min(severity_score + threat_bonus + violation_bonus, 1.0)
                combined_score = max(combined_score, llm_score)
                # Update final_score to use LLM score if it's higher
                if llm_score > final_score:
                    final_score = llm_score
            
            if quarantine_result:
                q_severity = quarantine_result.get('severity', 'safe').lower()
                severity_order = {"safe": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
                if severity_order.get(q_severity, 0) > severity_order.get(max_severity, 0):
                    max_severity = q_severity
                if 'score' in quarantine_result:
                    q_score = quarantine_result.get('score', 0)
                    combined_score = max(combined_score, q_score)
                    # Update final_score to use quarantine score if it's higher
                    if q_score > final_score:
                        final_score = q_score
            
            # Apply thresholds
            if combined_score >= block_threshold:
                final_decision = "BLOCKED"
                blocked_at = "llm_analysis" if llm_analysis_result else "quarantine_analysis"
                final_reason = f"Combined score {combined_score:.4f} exceeds block threshold {block_threshold}"
            elif combined_score < allow_threshold:
                final_decision = "ALLOWED"
                final_reason = f"Combined score {combined_score:.4f} below allow threshold {allow_threshold}"
            elif use_severity_fallback:
                # Use severity rules for scores between thresholds
                severity_rule = None
                if self.config:
                    severity_rule = self.config.get_severity_rule(max_severity)
                
                if severity_rule and severity_rule.get('block', False):
                    final_decision = "BLOCKED"
                    blocked_at = "severity_rule"
                    final_reason = f"Severity rule for '{max_severity}' requires blocking (score: {combined_score:.4f})"
                else:
                    final_decision = "ALLOWED"
                    final_reason = f"Score {combined_score:.4f} between thresholds, severity '{max_severity}' allows it"
            else:
                # No severity fallback - use score
                final_decision = "BLOCKED" if combined_score >= (block_threshold + allow_threshold) / 2 else "ALLOWED"
                blocked_at = "threshold" if final_decision == "BLOCKED" else None
                final_reason = f"Score {combined_score:.4f} between thresholds, no severity fallback"
        
        # Check output restrictions for final decision
        if self.config:
            output_restrictions = self.config.check_output_restriction(function_name)
            if output_restrictions.get('cannot_trigger_functions', False) and target_function:
                final_decision = "BLOCKED"
                blocked_at = "output_restriction"
                final_reason = f"Function '{function_name}' output cannot trigger other functions"
        
        # Build final response with function chaining info
        final_response = {
            "final_decision": final_decision,
            "final_score": final_score,
            "blocked_at": blocked_at,
            "reason": final_reason,
            "input_analysis": input_result,
            "llm_analysis": llm_analysis_result,
            "quarantine_analysis": quarantine_result,
            "keyword_detection": keyword_detection_result,
            "safe_to_use": final_decision == "ALLOWED"
        }
        
        # Include function chaining info in final response
        if function_chaining_info:
            final_response["function_chaining_info"] = function_chaining_info
        
        return final_response


def create_guard_pipeline(
    openai_api_key: Optional[str] = None,
    openai_base_url: Optional[str] = None,
    openai_model: Optional[str] = None,
    infection_model: Optional[str] = None,
    analysis_model: Optional[str] = None,
    guard_model: Optional[str] = None,
    config_path: Optional[str] = None,
    hf_token: Optional[str] = None,
    **kwargs
) -> GuardPipeline:
    """
    Convenience function to create a GuardPipeline instance.
    
    Args:
        openai_api_key: OpenAI API key (or set OPENAI_API_KEY env var)
        openai_base_url: Custom base URL for OpenAI-compatible API (or set OPENAI_BASE_URL env var)
        openai_model: Default model name (or set OPENAI_MODEL env var, used as fallback)
        infection_model: Model for Stage 1 infection simulation (or set INFECTION_MODEL env var)
        analysis_model: Model for Stage 2 analysis/evaluation (or set ANALYSIS_MODEL env var)
        guard_model: Model for Prompt Guard (or set GUARD_MODEL env var)
        config_path: Path to JSON configuration file for RBAC and rules
        hf_token: HuggingFace token for accessing private/gated models (or set HF_TOKEN env var)
        **kwargs: Additional arguments for GuardPipeline
        
    Returns:
        GuardPipeline instance
    """
    return GuardPipeline(
        openai_api_key=openai_api_key,
        openai_base_url=openai_base_url,
        openai_model=openai_model,
        infection_model=infection_model,
        analysis_model=analysis_model,
        model_id=guard_model,
        config_path=config_path,
        hf_token=hf_token,
        **kwargs
    )

