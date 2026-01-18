"""
Repository for analysis trace operations.
"""

from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_
from ..models import AnalysisTrace
from typing import Optional, List, Dict, Any
from datetime import datetime, date, time


class AnalysisTraceRepository:
    """Repository for analysis trace database operations."""
    
    @staticmethod
    def create_trace(
        db: Session,
        user_id: str,  # Changed to UUID string
        api_key_id: Optional[str],  # Changed to string (API key name/ID from LMNR)
        request_data: Dict[str, Any],
        response_data: Dict[str, Any],
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        policy_key: Optional[str] = None
    ) -> AnalysisTrace:
        """
        Create a new analysis trace.
        
        Args:
            db: Database session
            user_id: User ID from API key
            api_key_id: API key ID
            request_data: Request data (function_name, user_query, etc.)
            response_data: Full analysis response
            ip_address: Client IP address
            user_agent: User agent string
            policy_key: Policy key used (if any)
            
        Returns:
            Created AnalysisTrace object
        """
        # Extract key fields from response
        final_decision = response_data.get("final_decision", "ALLOWED")
        safe_to_use = response_data.get("safe_to_use", True)
        blocked_at = response_data.get("blocked_at")
        reason = response_data.get("reason")
        review_required = final_decision == "REVIEW_REQUIRED"
        hitl_reason = response_data.get("hitl_reason")
        
        # Extract scores
        input_score = None
        quarantine_score = None
        llm_score = None
        
        if response_data.get("input_analysis"):
            input_score = response_data["input_analysis"].get("score")
        
        if response_data.get("quarantine_analysis"):
            quarantine_score = response_data["quarantine_analysis"].get("score")
        
        if response_data.get("llm_analysis"):
            llm_score = response_data["llm_analysis"].get("score")
        
        trace = AnalysisTrace(
            user_id=user_id,
            api_key_id=api_key_id,
            function_name=request_data.get("function_name"),
            user_query=request_data.get("user_query"),
            user_role=request_data.get("user_role"),
            target_function=request_data.get("target_function"),
            require_quarantine=request_data.get("require_quarantine", True),
            quick_analysis=request_data.get("quick_analysis", False),
            policy_key=policy_key,
            analysis_response=response_data,
            final_decision=final_decision,
            safe_to_use=safe_to_use,
            blocked_at=blocked_at,
            reason=reason,
            review_required=review_required,
            hitl_reason=hitl_reason,
            input_score=input_score,
            quarantine_score=quarantine_score,
            llm_score=llm_score,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        db.add(trace)
        db.commit()
        db.refresh(trace)
        return trace
    
    @staticmethod
    def get_by_id(db: Session, trace_id: int) -> Optional[AnalysisTrace]:
        """Get trace by ID."""
        return db.query(AnalysisTrace).filter(AnalysisTrace.id == trace_id).first()
    
    @staticmethod
    def get_by_user(
        db: Session,
        user_id: str,  # Changed to UUID string
        limit: int = 50,
        offset: int = 0,
        order_by: str = "created_at_desc"
    ) -> List[AnalysisTrace]:
        """
        Get traces for a user, sorted by timestamp.
        
        Args:
            db: Database session
            user_id: User ID
            limit: Maximum number of results
            offset: Offset for pagination
            order_by: Sort order (created_at_desc or created_at_asc)
            
        Returns:
            List of AnalysisTrace objects
        """
        query = db.query(AnalysisTrace).filter(AnalysisTrace.user_id == user_id)
        
        # Apply sorting
        if order_by == "created_at_asc":
            query = query.order_by(AnalysisTrace.created_at)
        else:  # Default to DESC
            query = query.order_by(desc(AnalysisTrace.created_at))
        
        return query.offset(offset).limit(limit).all()
    
    @staticmethod
    def get_review_required(
        db: Session,
        user_id: str,  # Changed to UUID string
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[AnalysisTrace]:
        """
        Get review_required items for a user.
        
        Args:
            db: Database session
            user_id: User ID
            status: Filter by review status (pending, approved, rejected, reviewed)
            limit: Maximum number of results
            offset: Offset for pagination
            
        Returns:
            List of AnalysisTrace objects requiring review
        """
        query = db.query(AnalysisTrace).filter(
            and_(
                AnalysisTrace.user_id == user_id,
                AnalysisTrace.review_required == True
            )
        )
        
        if status:
            query = query.filter(AnalysisTrace.review_status == status)
        
        return query.order_by(desc(AnalysisTrace.created_at)).offset(offset).limit(limit).all()
    
    @staticmethod
    def update_review_status(
        db: Session,
        trace_id: int,
        status: str,
        reviewed_by: str,  # Changed to UUID string
        notes: Optional[str] = None
    ) -> Optional[AnalysisTrace]:
        """
        Update review status of a trace.
        
        Args:
            db: Database session
            trace_id: Trace ID
            status: New review status (approved, rejected, reviewed)
            reviewed_by: User ID of reviewer
            notes: Optional review notes
            
        Returns:
            Updated AnalysisTrace object or None if not found
        """
        trace = db.query(AnalysisTrace).filter(AnalysisTrace.id == trace_id).first()
        if not trace:
            return None
        
        trace.review_status = status
        trace.reviewed_by = reviewed_by
        trace.reviewed_at = datetime.utcnow()
        trace.review_notes = notes
        
        db.commit()
        db.refresh(trace)
        return trace
    
    @staticmethod
    def get_for_compliance(
        db: Session,
        user_id: str,  # Changed to UUID string
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        function_name: Optional[str] = None,
        final_decision: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[AnalysisTrace]:
        """
        Get traces for compliance queries.
        
        Args:
            db: Database session
            user_id: User ID
            start_date: Start date filter
            end_date: End date filter
            function_name: Filter by function name
            final_decision: Filter by final decision
            limit: Maximum number of results
            offset: Offset for pagination
            
        Returns:
            List of AnalysisTrace objects
        """
        query = db.query(AnalysisTrace).filter(AnalysisTrace.user_id == user_id)
        
        if start_date:
            query = query.filter(AnalysisTrace.created_at >= datetime.combine(start_date, datetime.min.time()))
        
        if end_date:
            query = query.filter(AnalysisTrace.created_at <= datetime.combine(end_date, datetime.max.time()))
        
        if function_name:
            query = query.filter(AnalysisTrace.function_name == function_name)
        
        if final_decision:
            query = query.filter(AnalysisTrace.final_decision == final_decision)
        
        return query.order_by(desc(AnalysisTrace.created_at)).offset(offset).limit(limit).all()
    
    @staticmethod
    def count_by_user(db: Session, user_id: str) -> int:  # Changed to UUID string
        """Get total count of traces for a user."""
        return db.query(AnalysisTrace).filter(AnalysisTrace.user_id == user_id).count()
    
    @staticmethod
    def count_review_required(db: Session, user_id: str, status: Optional[str] = None) -> int:  # Changed to UUID string
        """Get count of review_required items for a user."""
        query = db.query(AnalysisTrace).filter(
            and_(
                AnalysisTrace.user_id == user_id,
                AnalysisTrace.review_required == True
            )
        )
        
        if status:
            query = query.filter(AnalysisTrace.review_status == status)
        
        return query.count()

