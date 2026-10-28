param([string]$Message = ('update: DriveGuard ' + (Get-Date -Format 'yyyy-MM-dd HH:mm')))
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
function Fail([string]$message) { throw ('[DriveGuard] ' + $message) }
function CheckExit([string]$label) { if($LASTEXITCODE -ne 0) { Fail ($label + ' failed (exit ' + $LASTEXITCODE + ')') } }
if(!(Test-Path '.git')) { Fail 'Git repository not initialized. Run SETUP_AUTO_GITHUB_VERCEL_CLICK_HERE.bat first.' }
$remote=((& git remote get-url origin) -join '').Trim()
CheckExit 'git remote lookup'
if($remote -ne 'https://github.com/loungna/driveguard-ml.git' -and $remote -ne 'git@github.com:loungna/driveguard-ml.git') {
    Fail ('Not the approved DriveGuard repo: ' + $remote)
}
foreach($path in @('models/v4_xgboost.joblib','models/v4_model_manifest.json')) {
    if(!(Test-Path $path)) { Fail ('Missing trained model file: ' + $path) }
}
$manifest=Get-Content 'models/v4_model_manifest.json' -Raw | ConvertFrom-Json
$sha=(Get-FileHash 'models/v4_xgboost.joblib' -Algorithm SHA256).Hash.ToLowerInvariant()
if($sha -ne ([string]$manifest.trained_model_sha256).ToLowerInvariant()) { Fail 'Model SHA-256 mismatch' }
if(!(Get-Command npm.cmd -ErrorAction SilentlyContinue)) { Fail 'Node.js/npm missing. Install from https://nodejs.org/' }
if(!(Test-Path 'node_modules')) { & npm.cmd install --no-audit --no-fund; CheckExit 'npm install' }
& npm.cmd run build
CheckExit 'React build'
if(!(Test-Path 'dist/index.html')) { Fail 'dist/index.html missing' }
& git add -A
CheckExit 'git add'
& git -c core.whitespace=cr-at-eol diff --cached --check
CheckExit 'git whitespace verification'
$names=@(& git diff --cached --name-only)
foreach($path in $names) {
    if($path -match '(?i)(^|/)(\.env[^/]*|\.venv|node_modules|dist|\.vercel|__pycache__)(/|$)|^data/|^outputs/|(^|/)CrystalDiskInfo_[^/]+\.(txt|csv)$|\.(pem|p12|pfx|key|sqlite3?)$') {
        Fail ('Blocked private/generated file: ' + $path)
    }
}
if($names.Count -eq 0) { Write-Host '[DriveGuard] No changed files. Nothing to publish.' -ForegroundColor Yellow; exit 0 }
& git commit -m $Message
CheckExit 'git commit'
& git push origin main
CheckExit 'git push'
Write-Host '[OK] Code pushed to GitHub. Vercel will deploy automatically if Git is connected.' -ForegroundColor Green
Write-Host 'https://github.com/loungna/driveguard-ml' -ForegroundColor Cyan
Write-Host 'https://driveguard-ml.vercel.app' -ForegroundColor Cyan
