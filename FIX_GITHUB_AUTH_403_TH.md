# DriveGuard GitHub CLI Login Fix (Windows PowerShell 5.1)

This release fixes the setup script failure at `gh auth status` while the user is not logged in. Windows PowerShell 5.1 with `$ErrorActionPreference = 'Stop'` treats GitHub CLI stderr from the expected unauthenticated state as a terminating `NativeCommandError`.

## Option A: use fixed setup automatically

Download and extract this ZIP to a NEW folder. Double-click `SETUP_AUTO_GITHUB_VERCEL_CLICK_HERE.bat`. It now checks login without aborting, then launches interactive `gh auth login --hostname github.com --git-protocol https --web` if required. Approve the request in your OWN browser. The script never asks you to paste a token into ChatGPT. If you're already logged in, it skips login.

## Option B: patch only the script in your existing folder

Replace `SETUP_AUTO_GITHUB_VERCEL.ps1` in the old project with the fixed version from this ZIP, then run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\SETUP_AUTO_GITHUB_VERCEL.ps1
```

## Option C: login manually, no files needed

```powershell
gh auth login --hostname github.com --git-protocol https --web
gh auth status
powershell -NoProfile -ExecutionPolicy Bypass -File .\SETUP_AUTO_GITHUB_VERCEL.ps1
```

Do not upload tokens, `.env` files, real CrystalDiskInfo snapshots with drive serial numbers, or private Backblaze raw data to GitHub. The repository `loungna/driveguard-ml` is PUBLIC.

This package changes the GitHub/Vercel login probes and interactive login flow only. It does NOT perform GitHub authorization, GitHub push, or Vercel deployment on your computer. Those actions happen after you authorize the app in the browser.
