# PowerShell script for Windows to sync .env files
# Usage: .\scripts\sync-env.ps1 [source-file]

param(
    [string]$Source = ".env.example"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$EnvFile = Join-Path $ProjectRoot ".env"
$SourceFile = Join-Path $ProjectRoot $Source

Write-Host "Syncing .env file" -ForegroundColor Green

# Check if source file exists
if (-not (Test-Path $SourceFile)) {
    Write-Host "Error: Source file $Source not found" -ForegroundColor Red
    exit 1
}

# Copy source to .env
Copy-Item $SourceFile $EnvFile -Force

Write-Host "✓ .env file synced from $Source" -ForegroundColor Green
Write-Host "Remember to review and update sensitive values!" -ForegroundColor Yellow

# Check if .env.example exists and compare
$EnvExample = Join-Path $ProjectRoot ".env.example"
if ((Test-Path $EnvExample) -and ($Source -ne ".env.example")) {
    Write-Host "Checking for missing variables from .env.example..." -ForegroundColor Yellow
    
    # Read example variables
    $ExampleContent = Get-Content $EnvExample
    $EnvContent = Get-Content $EnvFile
    
    # Extract variable names (lines starting with variable assignments)
    $ExampleVars = $ExampleContent | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object { ($_ -split '=')[0] }
    $EnvVars = $EnvContent | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object { ($_ -split '=')[0] }
    
    $MissingVars = $ExampleVars | Where-Object { $EnvVars -notcontains $_ }
    
    if ($MissingVars) {
        Write-Host "Warning: Missing variables in .env:" -ForegroundColor Yellow
        $MissingVars | ForEach-Object { Write-Host "  $_" }
        Write-Host ""
        
        $Response = Read-Host "Add missing variables from .env.example? (y/N)"
        if ($Response -eq 'y' -or $Response -eq 'Y') {
            # Append missing variables
            Add-Content $EnvFile ""
            Add-Content $EnvFile "# Added from .env.example"
            foreach ($VarName in $MissingVars) {
                $ExampleLine = $ExampleContent | Where-Object { $_ -match "^$VarName=" }
                if ($ExampleLine) {
                    Add-Content $EnvFile $ExampleLine
                }
            }
            Write-Host "✓ Added missing variables" -ForegroundColor Green
        }
    }
}


