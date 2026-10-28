param([switch]$SkipInitialDeploy)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$repoUrl = 'https://github.com/loungna/driveguard-ml.git'
$projectId = 'prj_uQhE5aPmMPDwoy8aXMAKR1bPk2zm'
$teamId = 'team_bgdxA1EVTxrYdcPO4GQNBgbV'
$teamSlug = 'jaymxs-projects'

function Fail([string]$message) { throw ('[DriveGuard] ' + $message) }
function CheckExit([string]$label) { if ($LASTEXITCODE -ne 0) { Fail ($label + ' failed (exit ' + $LASTEXITCODE + ')') } }
# Windows PowerShell 5.1 treats some native-program stderr as a terminating
# NativeCommandError when ErrorActionPreference = Stop. A missing login is an
# expected status, so suppress stderr only for the login checks.
function Test-GitHubLogin([string]$ghPath) {
    $oldPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'SilentlyContinue'
        & $ghPath auth status --hostname github.com 1>$null 2>$null
        $authExitCode = $LASTEXITCODE
        return ($authExitCode -eq 0)
    } catch {
        return $false
    } finally {
        $ErrorActionPreference = $oldPreference
    }
}
function Invoke-GitHubLogin([string]$ghPath) {
    Write-Host '[Login] GitHub CLI is not authenticated. Starting browser sign-in...' -ForegroundColor Yellow
    Write-Host '[Login] Follow the one-time device code instructions and authorize GitHub.' -ForegroundColor Yellow
    $oldPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $ghPath auth login --hostname github.com --git-protocol https --web
        $loginExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $oldPreference
    }
    if($loginExitCode -ne 0) { Fail ('GitHub login did not complete (exit ' + $loginExitCode + '). Run: gh auth login --hostname github.com --git-protocol https --web') }
    if(-not (Test-GitHubLogin $ghPath)) { Fail 'GitHub login not detected after authorization. Run: gh auth status' }
}
function Test-VercelLogin([string]$vercelPath) {
    $oldPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'SilentlyContinue'
        & $vercelPath whoami 1>$null 2>$null
        $authExitCode = $LASTEXITCODE
        return ($authExitCode -eq 0)
    } catch {
        return $false
    } finally {
        $ErrorActionPreference = $oldPreference
    }
}
function Require([string]$name, [string]$url) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if (!$cmd) { Fail ('Missing ' + $name + '. Install and reopen PowerShell: ' + $url) }
    return $cmd.Source
}
function CheckModel {
    foreach($path in @('package.json','api/index.py','models/v4_xgboost.joblib','models/v4_model_manifest.json','vercel.json')) {
        if(!(Test-Path $path)) { Fail ('Missing project file: ' + $path) }
    }
    $manifest = Get-Content 'models/v4_model_manifest.json' -Raw -Encoding UTF8 | ConvertFrom-Json
    $sha = (Get-FileHash 'models/v4_xgboost.joblib' -Algorithm SHA256).Hash.ToLowerInvariant()
    if($sha -ne ([string]$manifest.trained_model_sha256).ToLowerInvariant()) { Fail 'XGBoost v4 model SHA-256 mismatch' }
}
function PushChanges([string]$message) {
    & git add -A
    CheckExit 'git add'
    & git -c core.whitespace=cr-at-eol diff --cached --check
    CheckExit 'git whitespace verification'
    $names = @(& git diff --cached --name-only)
    foreach($path in $names) {
        if($path -match '(?i)(^|/)(\.env[^/]*|\.venv|node_modules|dist|\.vercel|__pycache__)(/|$)|^data/|^outputs/|(^|/)CrystalDiskInfo_[^/]+\.(txt|csv)$|\.(pem|p12|pfx|key|sqlite3?)$') {
            Fail ('Blocked private or generated file from commit: ' + $path)
        }
    }
    if($names.Count -gt 0) {
        & git commit -m $message
        CheckExit 'git commit'
    } else { Write-Host '[OK] No changes to commit' -ForegroundColor Green }
    & git push -u origin main
    CheckExit 'git push'
}

Write-Host '[DriveGuard] ONE-TIME GitHub + Vercel auto-deploy setup' -ForegroundColor Cyan
$git=Require 'git' 'https://git-scm.com/downloads/win'
$gh=Require 'gh' 'https://cli.github.com/'
$node=Require 'node' 'https://nodejs.org/'
$npm=Require 'npm.cmd' 'https://nodejs.org/'
CheckModel
Write-Host '[OK] XGBoost v4 model matches SHA-256 manifest' -ForegroundColor Green

Write-Host '[1/3] Testing and building React before publishing' -ForegroundColor Cyan
if(Test-Path 'package-lock.json') { & $npm ci --no-audit --no-fund }
else { & $npm install --no-audit --no-fund }
CheckExit 'npm dependency installation'
& $npm run test:utils
CheckExit 'Frontend unit tests'
& $npm run build
CheckExit 'React production build'
if(!(Test-Path 'dist/index.html')) { Fail 'React build did not generate dist/index.html' }

if(-not (Test-GitHubLogin $gh)) {
    Invoke-GitHubLogin $gh
} else {
    Write-Host '[OK] GitHub CLI is already authenticated.' -ForegroundColor Green
}
& $gh auth setup-git
CheckExit 'GitHub Git credential setup'
$login = (& $gh api user --jq '.login' | Select-Object -First 1)
CheckExit 'GitHub user lookup'
$id = (& $gh api user --jq '.id' | Select-Object -First 1)
CheckExit 'GitHub user ID lookup'
Write-Host ('[OK] Signed in to GitHub as ' + $login) -ForegroundColor Green
if($login -ne 'loungna') { Write-Warning 'Vercel may require the repository owner (loungna) to connect this personal repository.' }

if(!(Test-Path '.git')) { & git init; CheckExit 'git init' }
# Refuse to overwrite an unrelated repository remote.
$remotes=@(& git remote)
if($remotes -contains 'origin') {
    $current=((& git remote get-url origin) -join '').Trim()
    CheckExit 'git remote get-url'
    if($current -ne $repoUrl -and $current -ne 'git@github.com:loungna/driveguard-ml.git') {
        Fail ('This folder is already linked to another repository: ' + $current)
    }
} else {
    & git remote add origin $repoUrl
    CheckExit 'git remote add'
}
& git branch -M main
CheckExit 'git branch main'
$authorName = & git config user.name
if(-not $authorName) { & git config user.name $login; CheckExit 'set Git author name' }
$authorEmail = & git config user.email
if(-not $authorEmail) { & git config user.email ($id + '+' + $login + '@users.noreply.github.com'); CheckExit 'set Git author email' }

Write-Host '[2/3] Publishing built-and-tested source to GitHub main' -ForegroundColor Cyan
PushChanges 'release: DriveGuard v1.6 React UI UX Pro Max + XGBoost v4'
Write-Host 'Repository: https://github.com/loungna/driveguard-ml' -ForegroundColor Green

$vercelCmd = Get-Command 'vercel.cmd' -ErrorAction SilentlyContinue
if(!$vercelCmd) {
    & $npm install -g vercel
    CheckExit 'Vercel CLI installation'
    $vercelCmd = Get-Command 'vercel.cmd' -ErrorAction SilentlyContinue
    if(!$vercelCmd) {
        $npmPrefix = ((& $npm prefix -g) -join '').Trim()
        $candidate = Join-Path $npmPrefix 'vercel.cmd'
        if(!(Test-Path $candidate)) { Fail 'Vercel CLI not found after installation. Open a new PowerShell and rerun.' }
        $vercel = $candidate
    } else { $vercel=$vercelCmd.Source }
} else { $vercel=$vercelCmd.Source }

if(-not (Test-VercelLogin $vercel)) {
    Write-Host '[Login] Authorize Vercel in your browser (team jaymxs-projects)' -ForegroundColor Yellow
    $oldPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $vercel login
        $vercelLoginExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $oldPreference
    }
    if($vercelLoginExitCode -ne 0) { Fail ('Vercel browser login failed (exit ' + $vercelLoginExitCode + ')') }
    if(-not (Test-VercelLogin $vercel)) { Fail 'Vercel login not detected. Run: vercel whoami' }
} else {
    Write-Host '[OK] Vercel CLI is already authenticated.' -ForegroundColor Green
}
Write-Host '[3/3] Linking EXISTING Vercel project and Git repository' -ForegroundColor Cyan
& $vercel link --project driveguard-ml --scope $teamSlug --yes
CheckExit 'Vercel project link'
if(!(Test-Path '.vercel/project.json')) { Fail 'Vercel project link file missing' }
$project = Get-Content '.vercel/project.json' -Raw | ConvertFrom-Json
if($project.projectId -ne $projectId -or $project.orgId -ne $teamId) {
    Fail ('Wrong Vercel project or team. Got project=' + $project.projectId + ' team=' + $project.orgId)
}
& $vercel git connect --yes --scope $teamSlug
CheckExit 'Vercel Git connection'
Write-Host '[OK] Vercel Git integration connected. Future pushes to main trigger automatic deploys.' -ForegroundColor Green

if(!$SkipInitialDeploy) {
    Write-Host '[Deploy] Publishing initial Production deployment' -ForegroundColor Cyan
    & $vercel deploy --prod --yes --scope $teamSlug
    CheckExit 'Vercel initial production deployment'
    Write-Host '[Notice] Check live API health; successful build alone does not prove the Python model loaded.' -ForegroundColor Yellow
    try {
        $health = Invoke-RestMethod -Uri 'https://driveguard-ml.vercel.app/api/health' -TimeoutSec 30
        if($health.model_ready -and $health.model -eq 'XGBoost v4') { Write-Host '[OK] Production API confirms XGBoost v4' -ForegroundColor Green }
        else { Write-Warning ('API health did not confirm model. ' + ($health | ConvertTo-Json -Compress)) }
    } catch { Write-Warning 'Could not check API health automatically (site may require Vercel Authentication).' }
}
Write-Host 'SUCCESS: Future updates require only SYNC_CODE_TO_GITHUB_CLICK_HERE.bat (no manual Vercel deploy).' -ForegroundColor Green
Write-Host 'Site: https://driveguard-ml.vercel.app' -ForegroundColor Cyan
