"""
Hipocap-v1 - Server-side package for detecting indirect prompt injection in function calls.

This package analyzes function names and function results to prevent indirect prompt injection
attacks in chat interfaces with function calling capabilities. This is the server-side implementation
that runs the ML models and provides a REST API.
"""

from .analyzer import Analyzer, analyze_function_call, SeverityLevel
from .scorer import Scorer
from .pipeline import GuardPipeline, create_guard_pipeline
from .config import Config, load_config

__version__ = "0.1.0"
__all__ = [
    "Analyzer",
    "analyze_function_call",
    "SeverityLevel",
    "Scorer",
    "GuardPipeline",
    "create_guard_pipeline",
    "Config",
    "load_config"
]
