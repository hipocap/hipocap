"""
Main analyzer module for detecting indirect prompt injection in function calls.
"""

import torch
from torch.nn.functional import softmax
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum
import json
import os


class SeverityLevel(Enum):
    """Severity levels for detected injection attempts."""
    SAFE = "safe"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Analyzer:
    """
    Main class for analyzing function calls and their results for indirect prompt injection.
    """
    
    def __init__(
        self,
        model_id: str = "meta-llama/Prompt-Guard-86M",
        device: str = "cuda",
        temperature: float = 1.0,
        safe_threshold: float = 0.1,
        low_threshold: float = 0.3,
        medium_threshold: float = 0.5,
        high_threshold: float = 0.7,
        critical_threshold: float = 0.9,
        hf_token: Optional[str] = None
    ):
        """
        Initialize the Analyzer.
        
        Args:
            model_id: HuggingFace model ID for the prompt guard model
            device: Device to run the model on ('cpu' or 'cuda')
            temperature: Temperature for softmax scaling
            safe_threshold: Score below this is considered SAFE
            low_threshold: Score below this is considered LOW severity
            medium_threshold: Score below this is considered MEDIUM severity
            high_threshold: Score below this is considered HIGH severity
            critical_threshold: Score above this is considered CRITICAL severity
            hf_token: HuggingFace token for accessing private/gated models (or set HF_TOKEN env var)
        """
        self.model_id = model_id
        
        # Auto-detect device if CUDA requested but not available
        if device == "cuda":
            try:
                if not torch.cuda.is_available():
                    device = "cpu"
                    print("[Analyzer] CUDA not available, using CPU instead")
            except Exception:
                device = "cpu"
                print("[Analyzer] Error checking CUDA, using CPU instead")
        
        self.device = device
        self.temperature = temperature
        self.thresholds = {
            SeverityLevel.SAFE: safe_threshold,
            SeverityLevel.LOW: low_threshold,
            SeverityLevel.MEDIUM: medium_threshold,
            SeverityLevel.HIGH: high_threshold,
            SeverityLevel.CRITICAL: critical_threshold
        }
        
        # Get HuggingFace token from parameter or environment
        token = hf_token or os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_TOKEN")
        
        # Load model and tokenizer with token if provided
        load_kwargs = {}
        if token:
            load_kwargs["token"] = token
        
        # Progress logging for model download
        print("[Hipocap Server] ========================================")
        print("[Hipocap Server] Downloading Prompt Guard Model")
        print(f"[Hipocap Server] Model: {model_id}")
        print(f"[Hipocap Server] Device: {device}")
        print("[Hipocap Server] This may take a few minutes on first startup...")
        print("[Hipocap Server] ========================================")
        
        print("[Hipocap Server] [1/3] Downloading tokenizer...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_id, **load_kwargs)
        print("[Hipocap Server] [1/3] ✓ Tokenizer downloaded successfully")
        
        print("[Hipocap Server] [2/3] Downloading model weights...")
        print("[Hipocap Server] [2/3] (This is the largest step - please wait...)")
        self.model = AutoModelForSequenceClassification.from_pretrained(model_id, **load_kwargs)
        print("[Hipocap Server] [2/3] ✓ Model weights downloaded successfully")
        
        print(f"[Hipocap Server] [3/3] Moving model to device ({device})...")
        self.model.to(device)
        self.model.eval()
        print("[Hipocap Server] [3/3] ✓ Model loaded and ready")
        print("[Hipocap Server] ========================================")
        print("[Hipocap Server] ✓ Prompt Guard model initialization complete!")
    
    def _get_class_probabilities(self, text: str) -> torch.Tensor:
        """
        Get class probabilities for the given text.
        
        Args:
            text: Input text to classify
            
        Returns:
            Tensor with class probabilities
        """
        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=512
        ).to(self.device)
        
        with torch.no_grad():
            logits = self.model(**inputs).logits
        
        scaled_logits = logits / self.temperature
        probabilities = softmax(scaled_logits, dim=-1)
        return probabilities
    
    def _calculate_injection_score(self, text: str) -> float:
        """
        Calculate the indirect injection score for the given text.
        
        Args:
            text: Text to evaluate
            
        Returns:
            Score between 0 and 1 (higher = more likely to be injection)
        """
        probabilities = self._get_class_probabilities(text)
        # Dynamic class detection: Prompt Guard model can be binary (2 classes) or multi-class (3+ classes)
        num_classes = probabilities.shape[1]
        if num_classes >= 3:
            # Multi-class model: combine probabilities for malicious (class 1) and embedded instructions (class 2)
            score = (probabilities[0, 1] + probabilities[0, 2]).item()
        else:
            # Binary classifier: only use class 1 (malicious)
            score = probabilities[0, 1].item()
        return score
    
    def _determine_severity(self, score: float) -> SeverityLevel:
        """
        Determine severity level based on score.
        
        Args:
            score: Injection score (0-1)
            
        Returns:
            SeverityLevel enum
        """
        if score < self.thresholds[SeverityLevel.SAFE]:
            return SeverityLevel.SAFE
        elif score < self.thresholds[SeverityLevel.LOW]:
            return SeverityLevel.LOW
        elif score < self.thresholds[SeverityLevel.MEDIUM]:
            return SeverityLevel.MEDIUM
        elif score < self.thresholds[SeverityLevel.HIGH]:
            return SeverityLevel.HIGH
        elif score < self.thresholds[SeverityLevel.CRITICAL]:
            return SeverityLevel.HIGH
        else:
            return SeverityLevel.CRITICAL
    
    def _format_function_result(self, result: Any) -> str:
        """
        Format function result as string for analysis.
        
        Args:
            result: Function result (can be dict, list, str, etc.)
            
        Returns:
            String representation of the result
        """
        if isinstance(result, str):
            return result
        elif isinstance(result, (dict, list)):
            return json.dumps(result, indent=2)
        else:
            return str(result)
    
    def analyze_function_name(self, function_name: str) -> Dict[str, Any]:
        """
        Analyze a function name for potential injection patterns.
        
        Args:
            function_name: Name of the function to analyze
            
        Returns:
            Dictionary with analysis results including score and severity
        """
        score = self._calculate_injection_score(function_name)
        severity = self._determine_severity(score)
        
        return {
            "function_name": function_name,
            "score": score,
            "severity": severity.value,
            "is_safe": severity == SeverityLevel.SAFE
        }
    
    def analyze_function_result(self, result: Any) -> Dict[str, Any]:
        """
        Analyze a function result for potential injection patterns.
        
        Args:
            result: Function result to analyze (can be any type)
            
        Returns:
            Dictionary with analysis results including score and severity
        """
        result_text = self._format_function_result(result)
        score = self._calculate_injection_score(result_text)
        severity = self._determine_severity(score)
        
        return {
            "result_preview": result_text[:200] + "..." if len(result_text) > 200 else result_text,
            "score": score,
            "severity": severity.value,
            "is_safe": severity == SeverityLevel.SAFE
        }
    
    def analyze_function_call(
        self,
        function_name: str,
        function_result: Any,
        function_args: Optional[Any] = None,
        include_details: bool = True
    ) -> Dict[str, Any]:
        """
        Analyze both function name, arguments, and result for indirect prompt injection.
        
        Args:
            function_name: Name of the function that was called
            function_result: Result returned by the function
            function_args: Optional arguments passed to the function
            include_details: Whether to include detailed analysis for name, args, and result separately
            
        Returns:
            Dictionary with comprehensive analysis results
        """
        # Analyze function name
        name_analysis = self.analyze_function_name(function_name)
        
        # Analyze function arguments if provided
        args_analysis = None
        if function_args is not None:
            args_analysis = self.analyze_function_result(function_args)
        
        # Analyze function result
        result_analysis = self.analyze_function_result(function_result)
        
        # Combined score calculation
        # Weight: name (20%), args (30% if provided, else 0%), result (50% if args provided, else 80%)
        if args_analysis:
            combined_score = (
                name_analysis["score"] * 0.2 + 
                args_analysis["score"] * 0.3 + 
                result_analysis["score"] * 0.5
            )
        else:
            combined_score = (name_analysis["score"] * 0.3 + result_analysis["score"] * 0.7)
        
        combined_severity = self._determine_severity(combined_score)
        
        analysis = {
            "function_name": function_name,
            "combined_score": combined_score,
            "combined_severity": combined_severity.value,
            "is_safe": combined_severity == SeverityLevel.SAFE,
            "recommendation": self._get_recommendation(combined_severity)
        }
        
        if include_details:
            analysis["name_analysis"] = name_analysis
            if args_analysis:
                analysis["args_analysis"] = args_analysis
            analysis["result_analysis"] = result_analysis
        
        return analysis
    
    def _get_recommendation(self, severity: SeverityLevel) -> str:
        """
        Get recommendation based on severity level.
        
        Args:
            severity: Severity level
            
        Returns:
            Recommendation string
        """
        recommendations = {
            SeverityLevel.SAFE: "Function call appears safe. Proceed normally.",
            SeverityLevel.LOW: "Low risk detected. Review function result before displaying to user.",
            SeverityLevel.MEDIUM: "Medium risk detected. Sanitize or filter function result before use.",
            SeverityLevel.HIGH: "High risk detected. Block or heavily sanitize function result.",
            SeverityLevel.CRITICAL: "CRITICAL risk detected. DO NOT use this function result. Block immediately."
        }
        return recommendations.get(severity, "Unknown severity level.")


def analyze_function_call(
    function_name: str,
    function_result: Any,
    function_args: Optional[Any] = None,
    model_id: str = "meta-llama/Prompt-Guard-86M",
    device: str = "cuda",
    **kwargs
) -> Dict[str, Any]:
    """
    Convenience function to analyze a function call without instantiating Analyzer.
    
    Args:
        function_name: Name of the function that was called
        function_result: Result returned by the function
        function_args: Optional arguments passed to the function
        model_id: HuggingFace model ID
        device: Device to run the model on
        **kwargs: Additional arguments to pass to Analyzer
        
    Returns:
        Dictionary with analysis results
    """
    analyzer = Analyzer(model_id=model_id, device=device, **kwargs)
    return analyzer.analyze_function_call(function_name, function_result, function_args)
