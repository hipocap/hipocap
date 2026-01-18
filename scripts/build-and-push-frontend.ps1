# PowerShell script for Windows to build and push only the frontend Docker image
# Usage: .\scripts\build-and-push-frontend.ps1 [version-tag]

param(
    [string]$VersionTag = "v1.0.0",
    [string]$DockerHubOrg = "hipocap"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$FrontendPath = Join-Path $ProjectRoot "frontend"

Write-Host "Building and pushing HipoCap Frontend Docker image" -ForegroundColor Green
Write-Host "Docker Hub Org: $DockerHubOrg" -ForegroundColor Yellow
Write-Host "Version Tag: $VersionTag" -ForegroundColor Yellow
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "Error: Docker is not running" -ForegroundColor Red
    exit 1
}

# Check if frontend directory exists
if (-not (Test-Path $FrontendPath)) {
    Write-Host "Error: Frontend directory not found at $FrontendPath" -ForegroundColor Red
    exit 1
}

$imageName = "${DockerHubOrg}/frontend"
$fullImage = "${imageName}:${VersionTag}"
$latestImage = "${imageName}:latest"

Write-Host "Building frontend..." -ForegroundColor Green
Push-Location $FrontendPath

try {
    # Build the image
    docker build -t $fullImage -t $latestImage .

    Write-Host "Pushing $fullImage..." -ForegroundColor Green
    docker push $fullImage

    # Also push as latest if version tag is not latest
    if ($VersionTag -ne "latest") {
        Write-Host "Pushing $latestImage..." -ForegroundColor Green
        docker push $latestImage
    }

    Write-Host "[OK] Frontend built and pushed successfully" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "Error building or pushing frontend image: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

Write-Host "Frontend image built and pushed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Image: $fullImage" -ForegroundColor Cyan
if ($VersionTag -ne "latest") {
    Write-Host "Also tagged as: $latestImage" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "To use this image, set in your .env file:" -ForegroundColor Yellow
Write-Host "DOCKER_HUB_ORG=$DockerHubOrg"
Write-Host "IMAGE_TAG=$VersionTag"
Write-Host ""
Write-Host "Then run:" -ForegroundColor Yellow
Write-Host "docker compose -f docker-compose.yml up -d frontend"
Write-Host "or"
Write-Host "docker compose -f docker-compose.prod.yml up -d frontend"


