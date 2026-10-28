# DriveGuard ML v1.6 — React + UI UX Pro Max Edition

## ข้อมูลจริงและข้อจำกัด

- **Frontend ใหม่ทั้งหมด:** React + Vite, SPA แบบ hash route (`/#/overview`, `/#/inspect`, `/#/predict`, `/#/evolution`, `/#/guide`)
- **Backend เดิม:** FastAPI `api/index.py` รันโมเดลจาก `models/v4_xgboost.joblib` ที่ฝึกจริง ไม่ได้ฝึกใหม่
- **Design inspiration:** [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT) ใช้ design reasoning เรื่อง analytics dashboards, typography, accessibility, performance และ responsive layout ไม่ได้คัดลอกเว็บไซต์เจ้าของ Repo
- **Theme:** Navy / Teal Professional SaaS; Light/Dark Mode, มี active navigation, keyboard focus, mobile drawer, reduced motion
- **TXT:** อัปโหลด CrystalDiskInfo .txt ได้หลายไฟล์ ตรวจ ATA HDD/SSD แยกประเภทและแปลง SMART Hex มี warning สำหรับ SMART 188 และ 199; HDD ที่ข้อมูลไม่ครบ/รุ่นไม่รู้จักงด ML score
- **CSV:** อัปโหลด SMART CSV, อ่าน quote/CRLF, เลือก engine, ผ่าน API ทำนายแบบไม่บันทึกไฟล์, แสดงผลราย HDD
- **ML Evolution:** กราฟเลือก Metric, เทียบ SMART, v2, v3, v4 บน Test cohort เดียวกัน; v1 มีข้อมูลชุดทดสอบคนละ cohort จึงไม่แสดงในกราฟเปรียบเทียบตรง
- **ประเมินผล:** v4 Recall 77.20%, SMART Recall 71.67%; FP v4 1,241,061 ต่อ SMART 1,602,881; ผลย้อนหลัง Q2 2026 เคยตรวจใน v2/v3 ไม่ใช่ blind holdout ใหม่; คะแนน v4 ไม่ใช่ calibrated probability

## 1) เปิดใน VS Code บน Windows

ต้องมี Node.js 22 LTS, npm, Python 3.13 ที่มีอินเทอร์เน็ตในการติดตั้ง Dependencies

Terminal A (Backend):

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn api.index:app --reload --port 8000
```

Terminal B (React Frontend):

```powershell
npm install
npm run dev
```

เปิด http://127.0.0.1:5173 — Vite proxy `/api` ไปยัง http://127.0.0.1:8000

เช็ก Backend: http://127.0.0.1:8000/api/health ต้องมี `model_ready: true` และ `model: "XGBoost v4"`.

## 2) Build และ Test

```powershell
npm install
npm run test:utils
npm run build
.\.venv\Scripts\python.exe -m pytest -q tests
```

- `dist/` คือไฟล์เว็บ React ที่ Build แล้ว
- `api/index.py` และ `models/` อยู่ root เดียวกัน — Vercel จะทำให้เป็น Python Function แยกจาก Vite static assets
- อย่าเปลี่ยนชื่อ `models/v4_xgboost.joblib` และ `models/v4_model_manifest.json`
- ไม่ควรอัปโหลดข้อมูล CrystalDiskInfo จริงที่มี Serial Numbers ขึ้น GitHub; ตัวอย่างใน `samples/` เป็นข้อมูลสังเคราะห์เท่านั้น

## 3) Deploy ไป Vercel โปรเจกต์เดิม

เลือกแตก ZIP โฟลเดอร์นี้ทั้งหมด แล้วดับเบิลคลิก `DEPLOY_REACT_CLICK_HERE.bat` หรือรัน PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\DEPLOY_REACT_PRODUCTION.ps1
```

สคริปต์จะตรวจ SHA256 โมเดล, `npm install`, `npm run build`, `vercel link`, ตรวจ Vercel Project ID / Team ID ให้ตรงกับโปรเจกต์เดิม **ก่อน** `vercel deploy --prod` และตรวจ `/api/health` หลัง Deploy

หากอยากตรวจ Preview โดย **ไม่กระทบ Production**:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\DEPLOY_REACT_PRODUCTION.ps1 -Preview
```

- Vercel Project ID: `prj_uQhE5aPmMPDwoy8aXMAKR1bPk2zm`
- Team ID: `team_bgdxA1EVTxrYdcPO4GQNBgbV`
- Production URL: https://driveguard-ml.vercel.app
- API Health: https://driveguard-ml.vercel.app/api/health
- Project deployment protection เดิมอาจต้อง Login ก่อนเข้าจาก Preview/บาง URL; สคริปต์ไม่ได้แก้ Privacy Settings

## 4) ผลการทดสอบในสภาพแวดล้อมที่จัดทำ ZIP

- Python backend TestSuite 24 tests ผ่าน (มี warnings เรื่อง scikit-learn ของเครื่องทดสอบไม่ตรงกับ estimator serialization 1.9.1; ไฟล์ requirements.txt pin 1.9.1)
- Node.js native unit tests ของ CSV parser ผ่าน 4 tests
- โค้ด JSX ผ่าน TypeScript JSX syntax transpilation ไม่พบ parser errors
- API `/api/health` และการอ่าน CrystalDiskInfo ตรวจโดย TestClient แล้ว
- **ไม่ได้ยืนยัน production build `npm run build` ใน sandbox นี้** เพราะไม่มี npm registry network; ต้องรัน `npm install` / `npm run build` บนเครื่องคุณหรือที่ Vercel ที่เชื่อมต่ออินเทอร์เน็ต
- **ยังไม่ได้ Deploy ไป Production** และไม่ควรอ้างว่าเว็บไซต์อัปเดตแล้วจนกว่าจะเช็ก Vercel URL และ `/api/health`

## 5) แผนผังโครงการ

```text
DriveGuard_React_UIUX_Pro_Max_v1_6/
├── src/
│   ├── App.jsx             # React UI ครบ 5 หน้า
│   ├── styles.css          # Design system UX Pro Max-inspired
│   ├── main.jsx
│   └── utils.js            # CSV parser, API request, export
├── public/
│   ├── data/ml_evolution.json
│   └── data/sample_for_testing.csv  # synthetic test
├── api/index.py            # FastAPI endpoints
├── core/                   # Backblaze SMART feature engineering and TXT parser
├── models/                 # serialized ML v1 + XGBoost v4 and manifest
├── samples/                # synthetic-only examples, ignored on Vercel
├── tests/                  # Python + JavaScript unit tests
├── package.json
├── vite.config.js
├── vercel.json
├── requirements.txt
└── DEPLOY_REACT_PRODUCTION.ps1
```

## 6) เซฟซอร์สโค้ดขึ้น GitHub

GitHub repository: https://github.com/loungna/driveguard-ml

โปรเจกต์ต้อง Push จากบัญชีที่มีสิทธิ์เขียน repo โดยเปิด PowerShell ในโฟลเดอร์โปรเจกต์แล้วรัน:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\PUBLISH_GITHUB_WINDOWS.ps1
```

อย่า Commit ไฟล์ CrystalDiskInfo จริงที่มี Serial Number, raw Backblaze หลาย GB, `.env` หรือ tokens. GitHub เข้าสู่ระบบผ่าน Git Credential Manager ตามปกติ ไม่ต้องแปะ token ในแชต
