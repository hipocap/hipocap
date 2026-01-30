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
    try:
        with engine.begin() as conn:
            # Create table
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
            # Create indexes (only if they don't exist)
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_shields_shield_key ON shields(shield_key)
                """))
            except Exception as e:
                log_warning(f"Index idx_shields_shield_key may already exist: {e}")
            
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_shields_owner_id ON shields(owner_id)
                """))
            except Exception as e:
                log_warning(f"Index idx_shields_owner_id may already exist: {e}")
            
            log_info("Shields table created successfully")
    except Exception as e:
        log_error(f"Error creating shields table: {e}")
        raise


def check_shields_table_needed(engine) -> bool:
    """Check if shields table migration is needed."""
    return not check_table_exists(engine, "shields")


def migrate_fix_policy_key_uniqueness(engine):
    """Remove global uniqueness from policy_key and add composite unique constraint."""
    with engine.connect() as conn:
        # Check if the old unique index exists and drop it
        # Note: Index names can vary depending on how they were created
        try:
            # Try common name
            conn.execute(text("DROP INDEX IF EXISTS ix_governance_policies_policy_key"))
        except Exception:
            pass
            
        try:
            # Another common name if created by SQLAlchemy unique=True
            conn.execute(text("ALTER TABLE governance_policies DROP CONSTRAINT IF EXISTS governance_policies_policy_key_key"))
        except Exception:
            pass

        # Add new composite index
        try:
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uix_policy_owner ON governance_policies(policy_key, owner_id)"))
        except Exception as e:
            log_warning(f"Could not create uix_policy_owner: {e}")
        
        conn.commit()


def check_policy_uniqueness_fix_needed(engine) -> bool:
    """Check if we need to fix policy key uniqueness."""
    # This is slightly hard to check purely with standard SQL across engines, 
    # but we can check if uix_policy_owner exists
    with engine.connect() as conn:
        if engine.dialect.name == 'postgresql':
            result = conn.execute(text("SELECT 1 FROM pg_indexes WHERE indexname = 'uix_policy_owner'"))
            return result.fetchone() is None
        elif engine.dialect.name == 'sqlite':
            result = conn.execute(text("PRAGMA index_info('uix_policy_owner')"))
            return result.fetchone() is None
        return True # Default to True for other dialects to be safe


def migrate_ensure_per_user_default_policies(engine):
    """Ensure every existing user has a default policy."""
    from sqlalchemy.orm import sessionmaker
    from .models import GovernancePolicy, AnalysisTrace
    from .repositories.policy_repository import PolicyRepository
    
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        # Get all unique owner IDs from policies and traces
        owner_ids = set()
        
        try:
            # From policies
            policies = db.query(GovernancePolicy.owner_id).distinct().all()
            owner_ids.update([p.owner_id for p in policies])
        except Exception as e:
            log_warning(f"Could not get owners from policies: {e}")
        
        try:
            # From traces
            traces = db.query(AnalysisTrace.user_id).distinct().all()
            owner_ids.update([t.user_id for t in traces])
        except Exception as e:
            log_warning(f"Could not get owners from traces: {e}")
        
        log_info(f"Found {len(owner_ids)} unique users to check for default policies")
        
        count = 0
        for owner_id in owner_ids:
            if not owner_id:
                continue
                
            # Check if user has a policy with key 'default'
            existing_default = db.query(GovernancePolicy).filter(
                GovernancePolicy.owner_id == owner_id,
                GovernancePolicy.policy_key == "default"
            ).first()
            
            if not existing_default:
                # Create default policy
                PolicyRepository.create(
                    db=db,
                    policy_key="default",
                    name="Default Policy",
                    owner_id=owner_id,
                    description="Default governance policy created during migration.",
                    is_default=True
                )
                count += 1
        
        db.commit()
        log_info(f"Created {count} missing default policies")
    except Exception as e:
        db.rollback()
        log_error(f"Error ensuring default policies: {e}")
        # Don't fail the whole startup for this data migration
    finally:
        db.close()


def check_ensure_default_policies_needed(engine) -> bool:
    """Always check for missing default policies on startup."""
    return True


def migrate_ensure_default_shields(engine):
    """Ensure every existing user has a default 'jailbreak' shield."""
    from sqlalchemy.orm import sessionmaker
    import json
    from .models import Shield, GovernancePolicy, AnalysisTrace
    from .repositories.shield_repository import ShieldRepository
    
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        # Get all unique owner IDs
        owner_ids = set()
        try:
            policies = db.query(GovernancePolicy.owner_id).distinct().all()
            owner_ids.update([p.owner_id for p in policies])
        except Exception: pass
        
        try:
            traces = db.query(AnalysisTrace.user_id).distinct().all()
            owner_ids.update([t.user_id for t in traces])
        except Exception: pass
        
        log_info(f"Checking {len(owner_ids)} users for default shields")
        
        count = 0
        default_content = json.dumps({
            "prompt_description": "Generic jailbreak and prompt injection detection.",
            "what_to_block": "Direct jailbreak attempts, system prompt extraction, password requests.",
            "what_not_to_block": "Normal user queries, creative writing requests, technical questions."
        })
        
        for owner_id in owner_ids:
            if not owner_id: continue
                
            existing = db.query(Shield).filter(
                Shield.owner_id == owner_id,
                Shield.shield_key == "jailbreak"
            ).first()
            
            if not existing:
                ShieldRepository.create(
                    db=db,
                    shield_key="jailbreak",
                    name="Default Jailbreak Shield",
                    owner_id=owner_id,
                    content=default_content,
                    description="Automatically created default jailbreak shield."
                )
                count += 1
        
        db.commit()
        log_info(f"Created {count} missing default shields")
    except Exception as e:
        db.rollback()
        log_error(f"Error ensuring default shields: {e}")
    finally:
        db.close()


def check_ensure_default_shields_needed(engine) -> bool:
    """Always check for missing default shields on startup."""
    return True


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
    Migration(
        name="fix_policy_key_uniqueness",
        description="Change policy_key uniqueness from global to per-owner",
        check_func=check_policy_uniqueness_fix_needed,
        migrate_func=migrate_fix_policy_key_uniqueness
    ),
    Migration(
        name="ensure_per_user_default_policies",
        description="Ensure every account has a default policy",
        check_func=check_ensure_default_policies_needed,
        migrate_func=migrate_ensure_per_user_default_policies
    ),
    Migration(
        name="ensure_default_shields",
        description="Ensure every account has a default jailbreak shield",
        check_func=check_ensure_default_shields_needed,
        migrate_func=migrate_ensure_default_shields
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

