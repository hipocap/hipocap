"""
Database models for hipocap-v1.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, Float, Index
from sqlalchemy.sql import func
from .connection import Base


class GovernancePolicy(Base):
    """Governance policy model for storing RBAC and security rules."""
    
    __tablename__ = "governance_policies"
    
    id = Column(Integer, primary_key=True, index=True)
    policy_key = Column(String(255), unique=True, index=True, nullable=False)  # Unique identifier
    name = Column(String(255), nullable=False)  # Human-readable name
    description = Column(Text, nullable=True)
    owner_id = Column(String(36), nullable=False, index=True)  # LMNR user UUID as string
    
    # Policy configuration (stored as JSON)
    roles = Column(JSON, nullable=True)  # RBAC roles
    functions = Column(JSON, nullable=True)  # Function configurations
    severity_rules = Column(JSON, nullable=True)  # Severity-based rules
    output_restrictions = Column(JSON, nullable=True)  # Output restrictions
    function_chaining = Column(JSON, nullable=True)  # Function chaining rules
    context_rules = Column(JSON, nullable=True)  # Context rules
    decision_thresholds = Column(JSON, nullable=True)  # Decision thresholds for ALLOW/BLOCK (block_threshold, allow_threshold)
    custom_prompts = Column(JSON, nullable=True)  # Custom prompts configuration
    
    # Metadata
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)  # Default policy for the system
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Index on owner_id for performance
    __table_args__ = (
        Index('idx_governance_policies_owner_id', 'owner_id'),
    )


class AnalysisTrace(Base):
    """Analysis trace model for storing analysis results and compliance data."""
    
    __tablename__ = "analysis_traces"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), nullable=False, index=True)  # LMNR user UUID as string
    api_key_id = Column(String(255), nullable=True, index=True)  # API key name/ID from LMNR
    
    # Request fields
    function_name = Column(String(255), nullable=False, index=True)
    user_query = Column(Text, nullable=True)
    user_role = Column(String(100), nullable=True)
    target_function = Column(String(255), nullable=True)
    require_quarantine = Column(Boolean, default=True)
    quick_analysis = Column(Boolean, default=False)
    policy_key = Column(String(255), nullable=True, index=True)
    
    # Full analysis response (stored as JSON)
    analysis_response = Column(JSON, nullable=False)
    
    # Key fields for quick queries
    final_decision = Column(String(50), nullable=False, index=True)  # ALLOWED, BLOCKED, REVIEW_REQUIRED, etc.
    safe_to_use = Column(Boolean, nullable=False)
    blocked_at = Column(String(100), nullable=True)
    reason = Column(Text, nullable=True)
    review_required = Column(Boolean, default=False, index=True)  # For filtering review items
    hitl_reason = Column(Text, nullable=True)
    
    # Scores for analytics
    input_score = Column(Float, nullable=True)
    quarantine_score = Column(Float, nullable=True)
    llm_score = Column(Float, nullable=True)
    
    # Review management
    review_status = Column(String(50), default="pending", index=True)  # pending, approved, rejected, reviewed
    reviewed_by = Column(String(36), nullable=True, index=True)  # LMNR user UUID as string
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_notes = Column(Text, nullable=True)
    
    # Metadata
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_analysis_traces_user_id', 'user_id'),
        Index('idx_analysis_traces_reviewed_by', 'reviewed_by'),
    )


