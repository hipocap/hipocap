# PowerShell script for Windows to build and push Docker images
# Usage: .\scripts\build-and-push.ps1 [version-tag]

param(
    [string]$VersionTag = "latest",
    [string]$DockerHubOrg = "hipocap"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Services to build
$Services = @(
    @{Name = "hipocap-server"; Path = ".\hipocap_server"},
    @{Name = "frontend"; Path = ".\frontend"},
    @{Name = "query-engine"; Path = ".\query-engine"},
    @{Name = "app-server"; Path = ".\app-server"}
)

Write-Host "Building and pushing HipoCap Docker images" -ForegroundColor Green
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

# Build and push each service
foreach ($service in $Services) {
    $serviceName = $service.Name
    $servicePath = $service.Path
    $imageName = "${DockerHubOrg}/${serviceName}"
    $fullImage = "${imageName}:${VersionTag}"
    $latestImage = "${imageName}:latest"

    Write-Host "Building $serviceName..." -ForegroundColor Green
    Push-Location (Join-Path $ProjectRoot $servicePath.Replace(".\", ""))

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

        Write-Host "[OK] $serviceName built and pushed successfully" -ForegroundColor Green
        Write-Host ""
    }
    finally {
        Pop-Location
    }
}

Write-Host "All images built and pushed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "To use these images, set in your .env file:" -ForegroundColor Yellow
Write-Host "DOCKER_HUB_ORG=$DockerHubOrg"
Write-Host "IMAGE_TAG=$VersionTag"
Write-Host ""
Write-Host "Then run:" -ForegroundColor Yellow
Write-Host "docker compose -f docker-compose.prod.yml up -d"
