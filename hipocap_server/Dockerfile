FROM pytorch/pytorch:2.9.1-cuda12.6-cudnn9-runtime

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/* || true

# Copy the hipocap_server directory contents to /app/hipocap_server
# This preserves the module structure
COPY . /app/hipocap_server

# Install psycopg2-binary first to ensure SQLAlchemy can load postgres dialect
RUN pip install --no-cache-dir psycopg2-binary

# Install Python dependencies (remove torch, torchvision, transformers, numpy, scipy, scikit-learn as they are already in the base image)
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn[standard] \
    sqlalchemy \
    pydantic \
    python-dotenv \
    openai \
    transformers \
    requests

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8006

# Health check using curl (more reliable than Python requests)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8006/health || exit 1

# Run the server using uvicorn
CMD ["uvicorn", "hipocap_server.api.server:create_app", "--host", "0.0.0.0", "--port", "8006", "--factory"]

