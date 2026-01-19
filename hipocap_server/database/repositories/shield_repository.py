"""
Repository for shield operations.
"""

from sqlalchemy.orm import Session
from ..models import Shield
from typing import Optional, List, Dict, Any, Tuple
import json


class ShieldRepository:
    """Repository for shield database operations."""
    
    @staticmethod
    def parse_content(content: str) -> Tuple[str, str, str]:
        """
        Parse JSON content string to extract shield fields.
        
        Args:
            content: JSON string containing prompt_description, what_to_block, what_not_to_block
            
        Returns:
            Tuple of (prompt_description, what_to_block, what_not_to_block)
            
        Raises:
            ValueError: If JSON is invalid or required fields are missing
        """
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON format: {str(e)}")
        
        prompt_description = data.get("prompt_description")
        what_to_block = data.get("what_to_block")
        what_not_to_block = data.get("what_not_to_block")
        
        if not prompt_description:
            raise ValueError("Missing required field: prompt_description")
        if not what_to_block:
            raise ValueError("Missing required field: what_to_block")
        if what_not_to_block is None:
            raise ValueError("Missing required field: what_not_to_block")
        
        return prompt_description, what_to_block, what_not_to_block
    
    @staticmethod
    def create(
        db: Session,
        shield_key: str,
        name: str,
        owner_id: str,
        content: str,
        description: str = None
    ) -> Shield:
        """
        Create a new shield.
        
        Args:
            db: Database session
            shield_key: Unique identifier for the shield
            name: Human-readable name
            owner_id: LMNR user UUID as string
            content: JSON string containing prompt_description, what_to_block, what_not_to_block
            description: Optional description
            
        Returns:
            Created Shield object
            
        Raises:
            ValueError: If content JSON is invalid or missing required fields
        """
        prompt_description, what_to_block, what_not_to_block = ShieldRepository.parse_content(content)
        
        shield = Shield(
            shield_key=shield_key,
            name=name,
            description=description,
            prompt_description=prompt_description,
            what_to_block=what_to_block,
            what_not_to_block=what_not_to_block,
            owner_id=owner_id
        )
        db.add(shield)
        db.commit()
        db.refresh(shield)
        return shield
    
    @staticmethod
    def get_by_key(db: Session, shield_key: str) -> Optional[Shield]:
        """Get shield by key."""
        return db.query(Shield).filter(
            Shield.shield_key == shield_key
        ).first()
    
    @staticmethod
    def get_by_id(db: Session, shield_id: int) -> Optional[Shield]:
        """Get shield by ID."""
        return db.query(Shield).filter(
            Shield.id == shield_id
        ).first()
    
    @staticmethod
    def get_by_owner(db: Session, owner_id: str) -> List[Shield]:
        """Get all shields for an owner."""
        return db.query(Shield).filter(
            Shield.owner_id == owner_id
        ).all()
    
    @staticmethod
    def get_all_active(db: Session) -> List[Shield]:
        """Get all active shields."""
        return db.query(Shield).filter(
            Shield.is_active == True
        ).all()
    
    @staticmethod
    def update(
        db: Session,
        shield_id: int,
        name: str = None,
        description: str = None,
        content: str = None,
        is_active: bool = None
    ) -> Tuple[Optional[Shield], Dict[str, Any]]:
        """
        Update a shield with detailed change tracking.
        
        Args:
            db: Database session
            shield_id: Shield ID to update
            name: New name (optional)
            description: New description (optional)
            content: New JSON content (optional)
            is_active: Active status (optional)
            
        Returns:
            Tuple of (updated shield, changes dictionary)
            
        Raises:
            ValueError: If content JSON is invalid or missing required fields
        """
        shield = ShieldRepository.get_by_id(db, shield_id)
        if not shield:
            return None, {}
        
        changes = {}
        
        # Track changes for simple fields
        if name is not None and shield.name != name:
            changes["name"] = {"old": shield.name, "new": name}
            shield.name = name
        
        if description is not None and shield.description != description:
            changes["description"] = {"old": shield.description, "new": description}
            shield.description = description
        
        # Handle content update
        if content is not None:
            prompt_description, what_to_block, what_not_to_block = ShieldRepository.parse_content(content)
            
            content_changes = {}
            if shield.prompt_description != prompt_description:
                content_changes["prompt_description"] = {
                    "old": shield.prompt_description,
                    "new": prompt_description
                }
                shield.prompt_description = prompt_description
            
            if shield.what_to_block != what_to_block:
                content_changes["what_to_block"] = {
                    "old": shield.what_to_block,
                    "new": what_to_block
                }
                shield.what_to_block = what_to_block
            
            if shield.what_not_to_block != what_not_to_block:
                content_changes["what_not_to_block"] = {
                    "old": shield.what_not_to_block,
                    "new": what_not_to_block
                }
                shield.what_not_to_block = what_not_to_block
            
            if content_changes:
                changes["content"] = content_changes
        
        if is_active is not None and shield.is_active != is_active:
            changes["is_active"] = {"old": shield.is_active, "new": is_active}
            shield.is_active = is_active
        
        db.commit()
        db.refresh(shield)
        return shield, changes
    
    @staticmethod
    def delete(db: Session, shield_id: int) -> bool:
        """Delete a shield."""
        shield = ShieldRepository.get_by_id(db, shield_id)
        if not shield:
            return False
        
        db.delete(shield)
        db.commit()
        return True

