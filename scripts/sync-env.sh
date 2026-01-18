#!/bin/bash
set -e

# Sync .env file from example or remote source
# Usage: ./scripts/sync-env.sh [source]
# Examples:
#   ./scripts/sync-env.sh                    # Copy from .env.example
#   ./scripts/sync-env.sh .env.example       # Copy from .env.example
#   ./scripts/sync-env.sh .env.production    # Copy from .env.production
#   ./scripts/sync-env.sh remote://server    # Download from remote (requires SSH)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
ENV_EXAMPLE="${PROJECT_ROOT}/.env.example"

SOURCE="${1:-.env.example}"

echo -e "${GREEN}Syncing .env file${NC}"

# Handle remote source
if [[ "$SOURCE" == remote://* ]]; then
    REMOTE_PATH="${SOURCE#remote://}"
    echo -e "${YELLOW}Downloading from remote: ${REMOTE_PATH}${NC}"
    
    # Extract host and path
    if [[ "$REMOTE_PATH" == *":"* ]]; then
        REMOTE_HOST="${REMOTE_PATH%%:*}"
        REMOTE_FILE="${REMOTE_PATH#*:}"
    else
        echo -e "${RED}Error: Remote path must be in format host:/path/to/.env${NC}"
        exit 1
    fi
    
    # Download using scp
    scp "${REMOTE_HOST}:${REMOTE_FILE}" "${ENV_FILE}"
    echo -e "${GREEN}✓ Downloaded .env from ${REMOTE_PATH}${NC}"
    exit 0
fi

# Handle local source
if [ ! -f "${PROJECT_ROOT}/${SOURCE}" ]; then
    echo -e "${RED}Error: Source file ${SOURCE} not found${NC}"
    exit 1
fi

# Copy source to .env
cp "${PROJECT_ROOT}/${SOURCE}" "${ENV_FILE}"

# Check if .env.example exists and compare
if [ -f "${ENV_EXAMPLE}" ] && [ "${SOURCE}" != ".env.example" ]; then
    echo -e "${YELLOW}Checking for missing variables from .env.example...${NC}"
    
    # Extract variable names from .env.example (lines that start with variable assignments)
    EXAMPLE_VARS=$(grep -E '^[A-Z_]+=' "${ENV_EXAMPLE}" | cut -d'=' -f1 | sort)
    ENV_VARS=$(grep -E '^[A-Z_]+=' "${ENV_FILE}" | cut -d'=' -f1 | sort)
    
    MISSING_VARS=$(comm -23 <(echo "$EXAMPLE_VARS") <(echo "$ENV_VARS"))
    
    if [ -n "$MISSING_VARS" ]; then
        echo -e "${YELLOW}Warning: Missing variables in .env:${NC}"
        echo "$MISSING_VARS"
        echo ""
        read -p "Add missing variables from .env.example? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Append missing variables with their example values
            while IFS= read -r var_name; do
                example_line=$(grep "^${var_name}=" "${ENV_EXAMPLE}")
                if [ -n "$example_line" ]; then
                    echo "" >> "${ENV_FILE}"
                    echo "# Added from .env.example" >> "${ENV_FILE}"
                    echo "$example_line" >> "${ENV_FILE}"
                fi
            done <<< "$MISSING_VARS"
            echo -e "${GREEN}✓ Added missing variables${NC}"
        fi
    fi
fi

echo -e "${GREEN}✓ .env file synced from ${SOURCE}${NC}"
echo -e "${YELLOW}Remember to review and update sensitive values!${NC}"


