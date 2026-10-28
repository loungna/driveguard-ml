param([string]$Repository='https://github.com/loungna/driveguard-ml.git')
$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
foreach($name in @('git','git.exe')) {if(Get-Command $name -ErrorAction SilentlyContinue){break}}
if(!(Get-Command git -ErrorAction SilentlyContinue)){throw 'Install Git for Windows first: https://git-scm.com/download/win'}
if(!(Test-Path .git)){git init; if($LASTEXITCODE -ne 0){throw 'git init failed'}}
if(!(git config user.name)){throw 'Set a Git username: git config --global user.name "Your Name"'}
if(!(git config user.email)){throw 'Set a Git email: git config --global user.email "you@example.com"'}
git branch -M main
if(git remote | Select-String -Quiet '^origin$'){git remote set-url origin $Repository}else{git remote add origin $Repository}
# Exclude private snapshots, raw data, environments, and caches with .gitignore.
git add .
if($LASTEXITCODE -ne 0){throw 'git add failed'}
git diff --cached --check
if($LASTEXITCODE -ne 0){throw 'Whitespace errors found'}
git commit -m 'Deploy DriveGuard ML v1.6 React UI UX Pro Max with XGBoost v4'
if($LASTEXITCODE -ne 0){Write-Warning 'Commit may already exist; continuing'}
git push -u origin main
if($LASTEXITCODE -ne 0){throw 'Push failed: log in to GitHub, check repo write access, or pull remote changes before retrying.'}
Write-Host 'GitHub: https://github.com/loungna/driveguard-ml' -ForegroundColor Green
