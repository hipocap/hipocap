"""
Automatic migration system for database schema updates.

This module checks for pending migrations and applies them automatically on server startup.
"""

from sqlalchemy import text, inspect
from typing import List, Dict, Callable, Optional
import logging
import sys

logger = logging.getLogger(__name__)

# Fallback to print if logging is not configured
def log_info(msg):
    """Log info message, fallback to print if logging not configured."""
    if logger.handlers:
        logger.info(msg)
    else:
        print(f"[INFO] {msg}", file=sys.stderr)

def log_error(msg):
    """Log error message, fallback to print if logging not configured."""
    if logger.handlers:
        logger.error(msg)
    else:
        print(f"[ERROR] {msg}", file=sys.stderr)

def log_warning(msg):
    """Log warning message, fallback to print if logging not configured."""
    if logger.handlers:
        logger.warning(msg)
    else:
        print(f"[WARNING] {msg}", file=sys.stderr)

def log_debug(msg):
    """Log debug message, fallback to print if logging not configured."""
    if logger.handlers:
        logger.debug(msg)
    else:
        print(f"[DEBUG] {msg}", file=sys.stderr)


class Migration:
    """Represents a single database migration."""
    
    def __init__(self, name: str, description: str, check_func: Callable, migrate_func: Callable):
        """
        Initialize a migration.
        
        Args:
            name: Unique identifier for the migration
            description: Human-readable description
            check_func: Function that checks if migration is needed (returns bool)
            migrate_func: Function that performs the migration
        """
        self.name = name
        self.description = description
        self.check_func = check_func
        self.migrate_func = migrate_func
    
    def is_needed(self, engine) -> bool:
        """Check if this migration is needed."""
        try:
            return self.check_func(engine)
        except Exception as e:
            log_error(f"Error checking migration {self.name}: {e}")
            return False
    
    def apply(self, engine) -> bool:
        """Apply this migration."""
        try:
            log_info(f"Applying migration: {self.name} - {self.description}")
            self.migrate_func(engine)
            log_info(f"Migration {self.name} completed successfully")
            return True
        except Exception as e:
            log_error(f"Error applying migration {self.name}: {e}")
            return False


def check_column_exists(engine, table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table."""
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = :table_name AND column_name = :column_name
        """), {"table_name": table_name, "column_name": column_name})
        return result.fetchone() is not None


def check_table_exists(engine, table_name: str) -> bool:
    """Check if a table exists."""
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = :table_name
        """), {"table_name": table_name})
        return result.fetchone() is not None


def migrate_add_custom_prompts(engine):
    """Add custom_prompts column to governance_policies table."""
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE governance_policies 
            ADD COLUMN custom_prompts JSON
        """))
        conn.commit()


def check_custom_prompts_needed(engine) -> bool:
    """Check if custom_prompts migration is needed."""
    return not check_column_exists(engine, "governance_policies", "custom_prompts")


def migrate_add_shields_table(engine):
    """Add shields table."""
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS shields (
                id SERIAL PRIMARY KEY,
                shield_key VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                prompt_description TEXT NOT NULL,
                what_to_block TEXT NOT NULL,
                what_not_to_block TEXT NOT NULL,
                owner_id VARCHAR(36) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE
            )
        """))
        # Create indexes
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_shields_shield_key ON shields(shield_key)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_shields_owner_id ON shields(owner_id)
        """))
        conn.commit()


def check_shields_table_needed(engine) -> bool:
    """Check if shields table migration is needed."""
    return not check_table_exists(engine, "shields")


# Register all migrations
MIGRATIONS: List[Migration] = [
    Migration(
        name="add_custom_prompts",
        description="Add custom_prompts column to governance_policies table",
        check_func=check_custom_prompts_needed,
        migrate_func=migrate_add_custom_prompts
    ),
    Migration(
        name="add_shields_table",
        description="Add shields table for custom blocking rules",
        check_func=check_shields_table_needed,
        migrate_func=migrate_add_shields_table
    ),
]


def run_migrations(engine, dry_run: bool = False) -> Dict[str, bool]:
    """
    Check and run all pending migrations.
    
    Args:
        engine: SQLAlchemy engine
        dry_run: If True, only check which migrations are needed without applying them
        
    Returns:
        Dictionary mapping migration names to success status (True if applied successfully or not needed, False if failed)
    """
    results = {}
    
    log_info("Checking for pending migrations...")
    
    for migration in MIGRATIONS:
        if migration.is_needed(engine):
            log_info(f"Migration needed: {migration.name} - {migration.description}")
            if not dry_run:
                results[migration.name] = migration.apply(engine)
            else:
                log_info(f"[DRY RUN] Would apply migration: {migration.name}")
                results[migration.name] = True
        else:
            log_debug(f"Migration not needed: {migration.name}")
            results[migration.name] = True
    
    if all(results.values()):
        log_info("All migrations completed successfully")
    else:
        failed = [name for name, success in results.items() if not success]
        log_warning(f"Some migrations failed: {failed}")
    
    return results


def check_migrations_needed(engine) -> List[str]:
    """
    Check which migrations are needed without applying them.
    
    Args:
        engine: SQLAlchemy engine
        
    Returns:
        List of migration names that are needed
    """
    needed = []
    for migration in MIGRATIONS:
        if migration.is_needed(engine):
            needed.append(migration.name)
    return needed

