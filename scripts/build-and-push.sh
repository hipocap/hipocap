#!/bin/bash
set -e

# Build and push Docker images to Docker Hub
# Usage: ./scripts/build-and-push.sh [version-tag]
# Example: ./scripts/build-and-push.sh v1.0.0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOCKER_HUB_ORG="${DOCKER_HUB_ORG:-hipocap}"
VERSION_TAG="${1:-latest}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Services to build
SERVICES=(
    "hipocap-server:./hipocap_server"
    "frontend:./frontend"
    "query-engine:./query-engine"
    "app-server:./app-server"
)

echo -e "${GREEN}Building and pushing HipoCap Docker images${NC}"
echo -e "${YELLOW}Docker Hub Org: ${DOCKER_HUB_ORG}${NC}"
echo -e "${YELLOW}Version Tag: ${VERSION_TAG}${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Check if logged into Docker Hub
if ! docker info | grep -q "Username"; then
    echo -e "${YELLOW}Warning: Not logged into Docker Hub. Run 'docker login' first.${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Build and push each service
for service_info in "${SERVICES[@]}"; do
    IFS=':' read -r service_name service_path <<< "$service_info"
    image_name="${DOCKER_HUB_ORG}/${service_name}"
    full_image="${image_name}:${VERSION_TAG}"
    latest_image="${image_name}:latest"
    
    echo -e "${GREEN}Building ${service_name}...${NC}"
    cd "${PROJECT_ROOT}/${service_path}"
    
    # Build the image
    docker build -t "${full_image}" -t "${latest_image}" .
    
    echo -e "${GREEN}Pushing ${full_image}...${NC}"
    docker push "${full_image}"
    
    # Also push as latest if version tag is not latest
    if [ "${VERSION_TAG}" != "latest" ]; then
        echo -e "${GREEN}Pushing ${latest_image}...${NC}"
        docker push "${latest_image}"
    fi
    
    echo -e "${GREEN}✓ ${service_name} built and pushed successfully${NC}"
    echo ""
done

echo -e "${GREEN}All images built and pushed successfully!${NC}"
echo ""
echo -e "${YELLOW}To use these images, set in your .env file:${NC}"
echo "DOCKER_HUB_ORG=${DOCKER_HUB_ORG}"
echo "IMAGE_TAG=${VERSION_TAG}"
echo ""
echo -e "${YELLOW}Then run:${NC}"
echo "docker compose -f docker-compose.prod.yml up -d"


