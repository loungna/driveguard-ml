# DriveGuard React + FastAPI deployment to the user's EXISTING Vercel project.
# Requires an interactive Vercel login. Does not disable deployment protection.
param([switch]$Preview)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Fail([string]$message) { Write-Host $message -ForegroundColor Red; exit 1 }
Write-Host '[DriveGuard] React + Vite + XGBoost v4 deployment' -ForegroundColor Cyan
Write-Host ('Project folder: ' + $root)
foreach ($path in @('package.json', 'vite.config.js', 'vercel.json', 'api/index.py', 'models/v4_xgboost.joblib', 'models/v4_model_manifest.json')) {
    if (!(Test-Path $path)) { Fail ('Missing file: ' + $path) }
}
$manifest = Get-Content 'models/v4_model_manifest.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$actualHash = (Get-FileHash 'models/v4_xgboost.joblib' -Algorithm SHA256).Hash.ToLowerInvariant()
$expectedHash = [string]$manifest.trained_model_sha256
if ($actualHash -ne $expectedHash.ToLowerInvariant()) { Fail 'SHA-256 mismatch: the v4 trained model has changed.' }
Write-Host '[OK] v4 model SHA-256 verified' -ForegroundColor Green

if (!(Get-Command node -ErrorAction SilentlyContinue)) { Fail 'Node.js was not found. Install Node.js 22 LTS first.' }
if (!(Get-Command npm.cmd -ErrorAction SilentlyContinue)) { Fail 'npm was not found. Install Node.js first.' }
Write-Host '[1/4] Installing dependencies' -ForegroundColor Cyan
& npm.cmd install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Fail 'npm install failed; check internet/npm registry' }
Write-Host '[2/4] Building React frontend' -ForegroundColor Cyan
& npm.cmd run build
if ($LASTEXITCODE -ne 0 -or !(Test-Path 'dist/index.html')) { Fail 'Vite build failed. Deployment canceled.' }
Write-Host '[OK] dist/index.html exists' -ForegroundColor Green

$vercelCmd = Get-Command vercel.cmd -ErrorAction SilentlyContinue
if (!$vercelCmd) {
    Write-Host '[3/4] Installing Vercel CLI' -ForegroundColor Cyan
    & npm.cmd install --global vercel
    if ($LASTEXITCODE -ne 0) { Fail 'Could not install Vercel CLI' }
    $vercelCmd = Get-Command vercel.cmd -ErrorAction SilentlyContinue
    if (!$vercelCmd) { Fail 'Vercel CLI not found. Reopen PowerShell and retry.' }
}
Write-Host '[3/4] Linking existing Vercel project: driveguard-ml' -ForegroundColor Cyan
& vercel.cmd link --project driveguard-ml --scope jaymxs-projects --yes
if ($LASTEXITCODE -ne 0) { Fail 'Vercel link failed. Run vercel login, then retry.' }
if (!(Test-Path '.vercel/project.json')) { Fail 'Vercel did not create project link' }
$link = Get-Content '.vercel/project.json' -Raw | ConvertFrom-Json
if ($link.projectId -ne 'prj_uQhE5aPmMPDwoy8aXMAKR1bPk2zm') { Fail ('Wrong project ID: ' + $link.projectId + '. Deployment aborted.') }
if ($link.orgId -ne 'team_bgdxA1EVTxrYdcPO4GQNBgbV') { Fail ('Wrong Vercel team: ' + $link.orgId + '. Deployment aborted.') }
Write-Host '[OK] Correct Vercel project and team' -ForegroundColor Green

if ($Preview) {
    Write-Host '[4/4] Creating PREVIEW deployment (does not modify live domain)' -ForegroundColor Cyan
    & vercel.cmd deploy --yes --scope jaymxs-projects
} else {
    Write-Host '[4/4] Deploying to PRODUCTION: driveguard-ml.vercel.app' -ForegroundColor Cyan
    & vercel.cmd deploy --prod --yes --scope jaymxs-projects
}
if ($LASTEXITCODE -ne 0) { Fail 'Deployment failed; inspect Vercel build logs' }
Write-Host '[OK] Vercel CLI finished deployment' -ForegroundColor Green
if (!$Preview) {
    try {
        $health = Invoke-RestMethod -Uri 'https://driveguard-ml.vercel.app/api/health' -TimeoutSec 45 -ErrorAction Stop
        if ($health.model_ready -and $health.model -eq 'XGBoost v4') {
            Write-Host '[OK] Production API confirms XGBoost v4' -ForegroundColor Green
        } else { Write-Warning ('Health endpoint did not confirm v4. Response: ' + ($health | ConvertTo-Json -Compress)) }
    } catch { Write-Warning 'Could not verify live API automatically. It may be protected by Vercel Authentication; check manually.' }
}
Write-Host 'Website: https://driveguard-ml.vercel.app' -ForegroundColor Cyan
Write-Host 'API: https://driveguard-ml.vercel.app/api/health' -ForegroundColor Cyan
