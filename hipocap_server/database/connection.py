"""
Database connection and session management.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database configuration
def _running_in_docker() -> bool:
    # Common, lightweight heuristic used by many Python apps.
    return os.path.exists("/.dockerenv") or os.getenv("RUNNING_IN_DOCKER") == "1"


_IN_DOCKER = _running_in_docker()
_DEFAULT_DB_HOST = "postgres" if _IN_DOCKER else "localhost"
_DEFAULT_DB_PORT = "5432" if _IN_DOCKER else "5433"

DB_HOST = os.getenv("DB_HOST", _DEFAULT_DB_HOST)
DB_PORT = os.getenv("DB_PORT", _DEFAULT_DB_PORT)
DB_NAME = os.getenv("DB_NAME", "hipocap_second")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

# Database URL - ensure postgresql:// (not postgres://)
# Convert postgres:// to postgresql:// if needed
database_url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)
DATABASE_URL = database_url

# Create engine with connection timeout parameters
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args={
        "connect_timeout": 10,  # 10 second connection timeout
        "options": "-c statement_timeout=30000"  # 30 second statement timeout
    }
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """
    Dependency for getting database session.
    
    Yields:
        Database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize database - create all tables.
    """
    Base.metadata.create_all(bind=engine)

