# DriveGuard v1.6 — GitHub + Vercel Auto Deploy (Windows)

**Root:** DriveGuard React UI UX Pro Max, FastAPI, trained XGBoost v4 and CrystalDiskInfo TXT parser.

## Why GitHub 403 occurred

The ChatGPT GitHub connector is for reading/searching repositories, not pushing code. The user's GitHub repository has write permission for their account, but the app connector cannot perform Git pushes. Reference: https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt

## One-time setup (first deployment)

1. Install Git for Windows: https://git-scm.com/downloads/win
2. Install GitHub CLI: https://cli.github.com/
3. Install Node.js 22+ (supported version): https://nodejs.org/
4. Extract this ZIP and double-click `SETUP_AUTO_GITHUB_VERCEL_CLICK_HERE.bat`.
5. Approve the browser login for GitHub (`gh auth login`) and Vercel if prompted. Do not paste GitHub/Vercel tokens into ChatGPT.
6. Script checks the XGBoost v4 model SHA-256, commits source to the existing `loungna/driveguard-ml` repository, runs `npm run build`, connects the existing Vercel project `driveguard-ml` to GitHub with `vercel git connect`, and performs the first production deployment.

**GitHub repository:** https://github.com/loungna/driveguard-ml

**Vercel project:** https://vercel.com/jaymxs-projects/driveguard-ml

**Production website:** https://driveguard-ml.vercel.app

**Model health:** https://driveguard-ml.vercel.app/api/health (should show `model_ready=true`, `model=XGBoost v4`)

If Vercel asks permission for the GitHub repository, select `loungna/driveguard-ml`. If the Vercel project is already connected to a different repository, the script stops and does not change the existing project silently.

## Later source updates

Double-click `SYNC_CODE_TO_GITHUB_CLICK_HERE.bat` in the project folder after reviewing code changes. It builds React, commits updates to `main`, pushes to GitHub, and the **Vercel Git integration automatically starts a Production Deployment**. Do not use the manual Vercel deploy script each time.

This is automatic **GitHub → Vercel deployment**. It intentionally does not publish every file save, because incomplete or sensitive code could become public. For direct AI-authored Git commits and Push, use Codex with this GitHub repo rather than the read-only ChatGPT GitHub connector.

## When it fails

- `gh` not found: install GitHub CLI. `gh auth login` asks you to authorize in your browser.
- `git push` fails: check that the current GitHub account owns `loungna/driveguard-ml` and its default branch is `main`.
- `vercel git connect` fails: open Vercel Project Settings → Git and connect `loungna/driveguard-ml`; grant Vercel app access when prompted. See https://vercel.com/docs/cli/git
- Browser requires Vercel Authentication: adjust Deployment Protection only when you intend the site to be public. Deployment does not automatically disable protection.
- Cannot build React: verify Node.js and run `npm install` and `npm run build`.
- API health fails: review Vercel runtime logs. Build READY is not proof that the model API works.

Do not commit actual CrystalDiskInfo exports (they contain serial numbers), Backblaze raw snapshots, `.env`, local credentials, virtual environments or downloaded dependencies. `git add` protects common patterns but cannot guarantee that all sensitive data will be detected; review changes before running sync.
