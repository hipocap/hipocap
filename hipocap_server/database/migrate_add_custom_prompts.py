"""
Migration script to add custom_prompts column to governance_policies table.

Run this script manually to add the custom_prompts column to existing databases.
Note: Migrations are now automatically run on server startup, so this script is mainly
useful for manual migration or testing.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from hipocap_server.database.connection import engine
from hipocap_server.database.migrations import run_migrations


def migrate():
    """Run the custom_prompts migration."""
    print("Starting migration: Add custom_prompts column...")
    
    try:
        results = run_migrations(engine, dry_run=False)
        if all(results.values()):
            print("Migration completed successfully!")
        else:
            failed = [name for name, success in results.items() if not success]
            print(f"Migration failed: {failed}")
            sys.exit(1)
    except Exception as e:
        print(f"Error running migration: {e}")
        sys.exit(1)


if __name__ == "__main__":
    migrate()

