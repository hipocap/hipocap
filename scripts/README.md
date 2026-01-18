# HipoCap Build Scripts

This directory contains scripts for building and managing HipoCap Docker images.

## Scripts

### `build-and-push.ps1` (Windows PowerShell)
Builds and pushes all Docker images to Docker Hub.

**Usage:**
```powershell
.\build-and-push.ps1 -VersionTag v1.0.0 -DockerHubOrg hipocap
```

**Parameters:**
- `-VersionTag` - Version tag for images (default: `latest`)
- `-DockerHubOrg` - Docker Hub organization/username (default: `hipocap`)

**Example:**
```powershell
# Build and push with version tag
.\build-and-push.ps1 -VersionTag v1.0.0

# Use custom Docker Hub org
.\build-and-push.ps1 -VersionTag v1.0.0 -DockerHubOrg myorg
```

### `build-and-push.sh` (Linux/Mac)
Builds and pushes all Docker images to Docker Hub.

**Usage:**
```bash
./build-and-push.sh v1.0.0
```

**Environment Variables:**
- `DOCKER_HUB_ORG` - Docker Hub organization/username (default: `hipocap`)

**Example:**
```bash
# Build and push with version tag
./build-and-push.sh v1.0.0

# Use custom Docker Hub org
DOCKER_HUB_ORG=myorg ./build-and-push.sh v1.0.0
```

### `sync-env.ps1` (Windows PowerShell)
Syncs `.env` file from example or another source.

**Usage:**
```powershell
.\sync-env.ps1 .env.example
```

### `sync-env.sh` (Linux/Mac)
Syncs `.env` file from example or remote source.

**Usage:**
```bash
./sync-env.sh .env.example
./sync-env.sh remote://user@server:/path/to/.env
```

### `build-and-push-frontend.ps1` (Windows PowerShell)
Builds and pushes only the frontend Docker image to Docker Hub.

**Usage:**
```powershell
.\build-and-push-frontend.ps1 -VersionTag v1.0.0 -DockerHubOrg hipocap
```

**Parameters:**
- `-VersionTag` - Version tag for image (default: `latest`)
- `-DockerHubOrg` - Docker Hub organization/username (default: `hipocap`)

**Example:**
```powershell
# Build and push frontend with version tag
.\build-and-push-frontend.ps1 -VersionTag v1.0.0

# Use custom Docker Hub org
.\build-and-push-frontend.ps1 -VersionTag v1.0.0 -DockerHubOrg myorg
```

### `build-and-push-frontend.sh` (Linux/Mac)
Builds and pushes only the frontend Docker image to Docker Hub.

**Usage:**
```bash
./build-and-push-frontend.sh v1.0.0
```

**Environment Variables:**
- `DOCKER_HUB_ORG` - Docker Hub organization/username (default: `hipocap`)

**Example:**
```bash
# Build and push frontend with version tag
./build-and-push-frontend.sh v1.0.0

# Use custom Docker Hub org
DOCKER_HUB_ORG=myorg ./build-and-push-frontend.sh v1.0.0
```

## Services Built

The scripts build the following services:

1. **hipocap-server** - Security analysis server
2. **frontend** - Next.js web application
3. **query-engine** - Query processing service
4. **app-server** - Observability backend (Rust)

## Prerequisites

- Docker installed and running
- Logged into Docker Hub (`docker login`)
- Sufficient disk space for images
- Network access to Docker Hub

## Troubleshooting

### Windows Execution Policy
If you get an execution policy error:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Docker Not Running
Make sure Docker Desktop is running:
```powershell
docker info
```

### Build Failures
- Check Docker daemon is running
- Verify Dockerfile paths are correct
- Ensure sufficient disk space
- Check Docker Hub login status

