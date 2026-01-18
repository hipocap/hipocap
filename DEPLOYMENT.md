# HipoCap Deployment Guide

This guide covers building and deploying HipoCap Docker images to Docker Hub for production use.

## Prerequisites

- Docker and Docker Compose installed
- Docker Hub account with push permissions
- Access to the repository

## Quick Start

### Windows

1. **Set up environment variables:**
   ```powershell
   # Copy .env.example to .env
   Copy-Item .env.example .env
   # Edit .env with your production values (use Notepad, VS Code, etc.)
   notepad .env
   ```

2. **Build and push images:**
   ```powershell
   # Build and push with version tag (default: v1.0.0)
   .\scripts\build-and-push.ps1 -VersionTag v1.0.0
   
   # Build and push as latest
   .\scripts\build-and-push.ps1 -VersionTag latest
   
   # Use custom Docker Hub org
   .\scripts\build-and-push.ps1 -VersionTag v1.0.0 -DockerHubOrg myorg
   
   # Build and push only frontend
   .\scripts\build-and-push-frontend.ps1 -VersionTag v1.0.0
   ```

3. **Deploy using production compose:**
   ```powershell
   docker compose -f docker-compose.prod.yml up -d
   ```

### Linux/Mac

1. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your production values
   nano .env
   ```

2. **Build and push images:**
   ```bash
   chmod +x scripts/build-and-push.sh
   ./scripts/build-and-push.sh v1.0.0
   
   # Build and push only frontend
   chmod +x scripts/build-and-push-frontend.sh
   ./scripts/build-and-push-frontend.sh v1.0.0
   ```

3. **Deploy using production compose:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

## Environment Variables

Create a `.env` file with the following variables (see `.env.example` for template):

### Docker Hub Configuration
```bash
DOCKER_HUB_ORG=hipocap          # Your Docker Hub organization/username
IMAGE_TAG=v1.0.0                 # Image tag to use (e.g., v1.0.0, latest)
```

### Database Configuration
```bash
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-strong-password
POSTGRES_DB=postgres
HIPOCAP_DB_NAME=hipocap_second
```

### ClickHouse Configuration
```bash
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your-strong-password
CLICKHOUSE_RO_USER=readonly
CLICKHOUSE_RO_PASSWORD=readonly-password
CLICKHOUSE_DB=default
```

### Application Secrets
```bash
SHARED_SECRET_TOKEN=generate-random-secret
AEAD_SECRET_KEY=generate-random-secret
HIPOCAP_API_KEY=generate-random-api-key
NEXTAUTH_SECRET=generate-random-secret
```

### LLM Configuration (for hipocap-server)
```bash
OPENAI_API_KEY=your-openai-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
ANALYSIS_MODEL=x-ai/grok-4.1-fast
INFECTION_MODEL=x-ai/grok-4.1-fast
GUARD_MODEL=meta-llama/Prompt-Guard-86M
GUARD_DEVICE=cpu
HF_TOKEN=your-huggingface-token
HUGGINGFACE_TOKEN=your-huggingface-token
```

### Service URLs (Auto-configured in Docker, but can be overridden)
```bash
# These are automatically set to Docker service names when running in containers
# Only override if you need custom configurations
BACKEND_URL=http://app-server:8000
BACKEND_RT_URL=http://app-server:8002
HIPOCAP_SERVER_URL=http://hipocap-server:8006
QUERY_ENGINE_URL=http://query-engine:8903
QUICKWIT_SEARCH_URL=http://quickwit:7280
QUICKWIT_INGEST_URL=http://quickwit:7281
```

### Port Configuration (Optional)
```bash
FRONTEND_HOST_PORT=3000
APP_SERVER_HOST_PORT=8000
APP_SERVER_GRPC_HOST_PORT=8001
APP_SERVER_RT_HOST_PORT=8002
HIPOCAP_SERVER_HOST_PORT=8006
QUERY_ENGINE_HOST_PORT=8903
```

## Building Images Locally

### Using the Build Script

**Windows (PowerShell):**

Open PowerShell in the project root directory:

```powershell
# Build and push with version tag (default: v1.0.0)
.\scripts\build-and-push.ps1 -VersionTag v1.0.0

# Build and push as latest
.\scripts\build-and-push.ps1 -VersionTag latest

# Use custom Docker Hub org
.\scripts\build-and-push.ps1 -VersionTag v1.0.0 -DockerHubOrg myorg

# Build and push only frontend
.\scripts\build-and-push-frontend.ps1 -VersionTag v1.0.0

# If you get execution policy errors, run:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Linux/Mac:**
```bash
# Make scripts executable (first time only)
chmod +x scripts/build-and-push.sh
chmod +x scripts/build-and-push-frontend.sh

# Build and push with version tag
./scripts/build-and-push.sh v1.0.0

# Build and push as latest
./scripts/build-and-push.sh latest

# Use custom Docker Hub org
DOCKER_HUB_ORG=myorg ./scripts/build-and-push.sh v1.0.0

# Build and push only frontend
./scripts/build-and-push-frontend.sh v1.0.0
```

### Manual Build

Build individual services:

```bash
# Set your Docker Hub org
export DOCKER_HUB_ORG=hipocap
export VERSION_TAG=v1.0.0

# Build hipocap-server
docker build -t ${DOCKER_HUB_ORG}/hipocap-server:${VERSION_TAG} ./hipocap_server
docker push ${DOCKER_HUB_ORG}/hipocap-server:${VERSION_TAG}

# Build frontend
docker build -t ${DOCKER_HUB_ORG}/frontend:${VERSION_TAG} ./frontend
docker push ${DOCKER_HUB_ORG}/frontend:${VERSION_TAG}

# Build query-engine
docker build -t ${DOCKER_HUB_ORG}/query-engine:${VERSION_TAG} ./query-engine
docker push ${DOCKER_HUB_ORG}/query-engine:${VERSION_TAG}

# Build app-server
docker build -t ${DOCKER_HUB_ORG}/app-server:${VERSION_TAG} ./app-server
docker push ${DOCKER_HUB_ORG}/app-server:${VERSION_TAG}
```

## Syncing Environment Files

**Windows (PowerShell):**
```powershell
# Copy from .env.example
Copy-Item .env.example .env

# Or manually copy
Copy-Item .env.production .env
```

**Linux/Mac:**
```bash
# Copy from .env.example
./scripts/sync-env.sh

# Copy from another file
./scripts/sync-env.sh .env.production

# Download from remote server (requires SSH)
./scripts/sync-env.sh remote://user@server:/path/to/.env
```

## CI/CD with GitHub Actions

The repository includes a GitHub Actions workflow (`.github/workflows/docker-build-push.yml`) that automatically builds and pushes images on:

- Push to `main`/`master` branch → tags as `latest`
- Tagged releases (e.g., `v1.0.0`) → tags with version
- Manual workflow dispatch → custom tag

### Setting up GitHub Actions

1. Add Docker Hub credentials to GitHub Secrets:
   - `DOCKER_HUB_USERNAME`: Your Docker Hub username
   - `DOCKER_HUB_TOKEN`: Your Docker Hub access token

2. The workflow will automatically:
   - Build all services (hipocap-server, frontend, query-engine, app-server)
   - Push to Docker Hub
   - Tag appropriately based on branch/tag

## Production Deployment

1. **Prepare environment:**
   ```bash
   # Copy and edit environment file
   cp .env.example .env
   nano .env  # or use your preferred editor
   ```

2. **Pull and start services:**
   ```bash
   # Pull latest images
   docker compose -f docker-compose.prod.yml pull
   
   # Start services
   docker compose -f docker-compose.prod.yml up -d
   ```

3. **Check service health:**
   ```bash
   # Check service status
   docker compose -f docker-compose.prod.yml ps
   
   # View logs
   docker compose -f docker-compose.prod.yml logs -f
   
   # View logs for specific service
   docker compose -f docker-compose.prod.yml logs -f frontend
   docker compose -f docker-compose.prod.yml logs -f hipocap-server
   ```

4. **Update services:**
   ```bash
   # Update IMAGE_TAG in .env to new version
   docker compose -f docker-compose.prod.yml pull
   docker compose -f docker-compose.prod.yml up -d
   ```

5. **Stop services:**
   ```bash
   docker compose -f docker-compose.prod.yml down
   ```

## Service Architecture

HipoCap consists of the following services:

- **frontend**: Next.js web application (port 3000)
- **app-server**: Rust backend API server (ports 8000, 8001, 8002)
- **hipocap-server**: Python-based policy analysis server (port 8006)
- **query-engine**: Query processing service (port 8903)
- **postgres**: PostgreSQL database (port 5432)
- **clickhouse**: ClickHouse analytics database (port 8123)
- **quickwit**: Search and indexing service (ports 7280, 7281)

All services communicate using Docker service names when running in containers.

## Image Naming Convention

Images are named as: `{DOCKER_HUB_ORG}/{service-name}:{tag}`

Examples:
- `hipocap/hipocap-server:latest`
- `hipocap/hipocap-server:v1.0.0`
- `hipocap/frontend:latest`
- `hipocap/frontend:v1.0.0`
- `hipocap/query-engine:v1.0.0`
- `hipocap/app-server:v1.0.0`

## Security Best Practices

1. **Never commit `.env` files** - They contain sensitive credentials
2. **Use strong passwords** - Generate random secrets for production
3. **Rotate secrets regularly** - Update API keys and passwords periodically
4. **Use Docker secrets** - For production, consider using Docker secrets instead of environment variables
5. **Limit image access** - Make Docker Hub repositories private if needed
6. **Use specific tags** - Avoid using `latest` in production, use version tags (e.g., `v1.0.0`)
7. **Keep images updated** - Regularly update base images and dependencies
8. **Network isolation** - Use Docker networks to isolate services if needed

## Troubleshooting

### Images not found
- Verify `DOCKER_HUB_ORG` and `IMAGE_TAG` in `.env`
- Check Docker Hub for published images: `https://hub.docker.com/r/{DOCKER_HUB_ORG}/`
- Ensure you're logged into Docker Hub: `docker login`
- Verify image tags match what's in your `.env` file

### Build failures
- Check Docker daemon is running: `docker info`
- Verify Dockerfile paths are correct
- Check for sufficient disk space: `docker system df`
- Review build logs for specific errors
- Ensure all required files are present in build contexts

### Deployment issues
- Verify all environment variables are set: `docker compose -f docker-compose.prod.yml config`
- Check service logs: `docker compose -f docker-compose.prod.yml logs [service-name]`
- Ensure ports are not already in use: `netstat -tulpn | grep :3000` (Linux) or `netstat -ano | findstr :3000` (Windows)
- Verify database connectivity: Check postgres and clickhouse logs
- Check service health: `docker compose -f docker-compose.prod.yml ps`
- Verify network connectivity between services

### Service connection issues
- Ensure services are using Docker service names (e.g., `http://app-server:8000`) not `localhost`
- Check that all services are on the same Docker network
- Verify environment variables like `HIPOCAP_SERVER_URL`, `BACKEND_URL` are correctly set
- Review service dependencies in docker-compose files

### Frontend issues
- Check Next.js build logs: `docker compose -f docker-compose.prod.yml logs frontend`
- Verify database migrations completed: Check frontend logs for migration messages
- Ensure `DATABASE_URL` is correctly configured
- Check that `NEXTAUTH_URL` matches your deployment URL

### Hipocap-server issues
- Verify `HIPOCAP_API_KEY` is set and matches between frontend and hipocap-server
- Check LLM API keys are valid: `OPENAI_API_KEY`, `HF_TOKEN`
- Review hipocap-server logs: `docker compose -f docker-compose.prod.yml logs hipocap-server`
- Ensure database connection is working: Check `LMNR_DATABASE_URL` and `DB_*` variables

## Monitoring and Maintenance

### Viewing Logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f hipocap-server

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100
```

### Resource Usage
```bash
# Container stats
docker stats

# Disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

### Backup and Restore
- **PostgreSQL**: Use `pg_dump` to backup databases
- **ClickHouse**: Use ClickHouse backup tools
- **Volumes**: Backup Docker volumes regularly

## Support

For issues or questions, please open an issue on GitHub or contact the HipoCap team.
