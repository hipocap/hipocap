#!/bin/bash
set -e

# Build and push only the frontend Docker image to Docker Hub
# Usage: ./scripts/build-and-push-frontend.sh [version-tag]
# Example: ./scripts/build-and-push-frontend.sh v1.0.0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DOCKER_HUB_ORG="${DOCKER_HUB_ORG:-hipocap}"
VERSION_TAG="${1:-latest}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_PATH="${PROJECT_ROOT}/frontend"

echo -e "${GREEN}Building and pushing HipoCap Frontend Docker image${NC}"
echo -e "${YELLOW}Docker Hub Org: ${DOCKER_HUB_ORG}${NC}"
echo -e "${YELLOW}Version Tag: ${VERSION_TAG}${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Check if frontend directory exists
if [ ! -d "$FRONTEND_PATH" ]; then
    echo -e "${RED}Error: Frontend directory not found at $FRONTEND_PATH${NC}"
    exit 1
fi

image_name="${DOCKER_HUB_ORG}/frontend"
full_image="${image_name}:${VERSION_TAG}"
latest_image="${image_name}:latest"

echo -e "${GREEN}Building frontend...${NC}"
cd "$FRONTEND_PATH"

# Build the image
docker build -t "${full_image}" -t "${latest_image}" .

echo -e "${GREEN}Pushing ${full_image}...${NC}"
docker push "${full_image}"

# Also push as latest if version tag is not latest
if [ "${VERSION_TAG}" != "latest" ]; then
    echo -e "${GREEN}Pushing ${latest_image}...${NC}"
    docker push "${latest_image}"
fi

echo -e "${GREEN}[OK] Frontend built and pushed successfully${NC}"
echo ""

echo -e "${GREEN}Frontend image built and pushed successfully!${NC}"
echo ""
echo -e "${CYAN}Image: ${full_image}${NC}"
if [ "${VERSION_TAG}" != "latest" ]; then
    echo -e "${CYAN}Also tagged as: ${latest_image}${NC}"
fi
echo ""
echo -e "${YELLOW}To use this image, set in your .env file:${NC}"
echo "DOCKER_HUB_ORG=${DOCKER_HUB_ORG}"
echo "IMAGE_TAG=${VERSION_TAG}"
echo ""
echo -e "${YELLOW}Then run:${NC}"
echo "docker compose -f docker-compose.prod.yml up -d frontend"


