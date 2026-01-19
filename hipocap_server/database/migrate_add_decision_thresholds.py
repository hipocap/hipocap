"""
Migration script to add decision_thresholds column to governance_policies table.

Run this script to add the decision_thresholds column to existing databases.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy import text
from hipocap_server.database.connection import engine


def migrate():
    """Add decision_thresholds column to governance_policies table."""
    print("Starting migration: Add decision_thresholds column...")
    
    with engine.connect() as conn:
        # Check if column already exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='governance_policies' AND column_name='decision_thresholds'
        """))
        
        if result.fetchone():
            print("Column 'decision_thresholds' already exists. Skipping migration.")
            return
        
        # Add the column
        conn.execute(text("""
            ALTER TABLE governance_policies 
            ADD COLUMN decision_thresholds JSON
        """))
        
        conn.commit()
        print("Migration completed successfully!")
        print("Added 'decision_thresholds' column to 'governance_policies' table.")


if __name__ == "__main__":
    migrate()

