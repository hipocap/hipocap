"""
FastAPI server for hipocap-v1.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import router, initialize_pipeline
from .routes_policy import router as policy_router
from .routes_shield import router as shield_router
from ..database.connection import init_db, engine
from ..database.migrations import run_migrations
import os
import logging
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Configure basic logging if not already configured
if not logging.root.handlers:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

# Load environment variables from .env file
load_dotenv()


def create_app(
    openai_api_key: str = None,
    openai_base_url: str = None,
    openai_model: str = None,
    infection_model: str = None,
    analysis_model: str = None,
    guard_model: str = None,
    config_path: str = "hipocap_config.json",
    hf_token: str = None,
    **pipeline_kwargs
) -> FastAPI:
    """
    Create and configure the FastAPI application.
    
    Args:
        openai_api_key: OpenAI API key (or set OPENAI_API_KEY env var)
        openai_base_url: Custom base URL for OpenAI-compatible API (or set OPENAI_BASE_URL env var)
        openai_model: Default model name (or set OPENAI_MODEL env var)
        infection_model: Model for Stage 1 infection simulation (or set INFECTION_MODEL env var)
        analysis_model: Model for Stage 2 analysis/evaluation (or set ANALYSIS_MODEL env var)
        guard_model: Model for Prompt Guard (or set GUARD_MODEL env var)
        config_path: Path to configuration file
        hf_token: HuggingFace token for accessing private/gated models (or set HF_TOKEN env var)
        **pipeline_kwargs: Additional pipeline arguments
        
    Returns:
        Configured FastAPI application
    """
    app = FastAPI(
        title="Hipocap-v1 API",
        description="Server-side API for detecting indirect prompt injection in function calls",
        version="0.1.0"
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure appropriately for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include routers
    app.include_router(router)
    app.include_router(policy_router)
    app.include_router(shield_router)
    
    # Initialize database and pipeline on startup
    @app.on_event("startup")
    async def startup_event():
        # Initialize database tables
        try:
            init_db()
            logger.info("Database initialized successfully")
            
            # Run pending migrations
            try:
                logger.info("Checking for pending migrations...")
                migration_results = run_migrations(engine, dry_run=False)
                if all(migration_results.values()):
                    logger.info("All migrations completed successfully")
                else:
                    failed = [name for name, success in migration_results.items() if not success]
                    logger.warning(f"Some migrations failed: {failed}")
            except Exception as e:
                logger.error(f"Error running migrations: {e}")
                logger.warning("Continuing without migrations (some features may not work)")
        except Exception as e:
            logger.error(f"Warning: Database initialization failed: {e}")
            logger.warning("Continuing without database (some features may not work)")
        
        # Initialize pipeline
        initialize_pipeline(
            openai_api_key=openai_api_key,
            openai_base_url=openai_base_url,
            openai_model=openai_model,
            infection_model=infection_model,
            analysis_model=analysis_model,
            guard_model=guard_model,
            config_path=config_path,
            hf_token=hf_token,
            **pipeline_kwargs
        )
    
    return app


# For running with uvicorn directly
if __name__ == "__main__":
    import uvicorn
    
    app = create_app()
    uvicorn.run(app, host="0.0.0.0", port=8006)


