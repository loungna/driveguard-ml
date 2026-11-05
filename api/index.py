"""DriveGuard inference service.

No data is persisted. Uploads are validated JSON arrays of CSV rows and processed
in memory. Only locally bundled trained models are loaded from an allowlist; users cannot upload
or execute joblib/pickle models. The service never retrains on uploaded data.
"""
from __future__ import annotations
import json
import math
import sys
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from core.config import SMART, PREDICTORS, TREND
from core.labels import engineer_features
from core.crystaldiskinfo import parse_report

app = FastAPI(title="DriveGuard ML Prediction API", docs_url=None, redoc_url=None)
MAX_BODY_BYTES = 2_400_000
MAX_ROWS = 3000
MAX_DRIVES = 100
SUPPORTED = ("Seagate", "Toshiba", "HGST", "Western Digital")
# No user-uploaded executable model files. Only known, verified project artifacts.
ACTIVE_ENGINE = "XGBoost v4"
MODEL_FILES = {
    "Logistic Regression": "logistic_regression.joblib",
    "Decision Tree": "decision_tree.joblib",
    "Random Forest": "random_forest.joblib",
    "XGBoost": "xgboost.joblib",
    "XGBoost v4": "v4_xgboost.joblib",
}



def brand_for(model: str) -> str | None:
    s = model.strip().upper()
    if any(k in s for k in ("SSD", "NVME", "SA510", "MTFD", "DELLBOSS", "MICRON", "WDS", "ZA250", "ZA500", "ZA100", "ZA200")):
        return None
    if s.startswith("TOSHIBA"): return "Toshiba"
    if s.startswith(("HGST", "HITACHI")): return "HGST"
    if s.startswith(("WDC", "WD ", "WUH", "WUS")): return "Western Digital"
    if s.startswith("ST") or s.startswith("SEAGATE"): return "Seagate"
    return None


@lru_cache(maxsize=1)
def resources():
    metadata = json.loads((ROOT / "models" / "metadata.json").read_text(encoding="utf-8"))
    return metadata


@lru_cache(maxsize=5)
def load_pipeline(model_name: str):
    if model_name not in MODEL_FILES:
        raise ValueError("Unknown model selection")
    file = ROOT / "models" / MODEL_FILES[model_name]
    if model_name == "XGBoost v4":
        import hashlib
        expected = v4_manifest()["trained_model_sha256"].lower()
        actual = hashlib.sha256(file.read_bytes()).hexdigest()
        if expected != actual:
            raise RuntimeError("v4 model checksum mismatch")
    pipeline = joblib.load(file)
    encoder = pipeline.named_steps["features"].named_transformers_["model"]
    trained_models = set(map(str, encoder.categories_[0]))
    return pipeline, trained_models


@lru_cache(maxsize=1)
def v4_manifest():
    return json.loads((ROOT / "models" / "v4_model_manifest.json").read_text(encoding="utf-8"))

@lru_cache(maxsize=1)
def saved_validation_thresholds() -> dict[str, float]:
    # Thresholds were selected previously on validation data. Do not re-tune on test.
    registry = json.loads((ROOT / "models" / "validation_registry.json").read_text(encoding="utf-8"))
    result = {name: float(entry["threshold"]) for name, entry in registry["models"].items()}
    result["XGBoost v4"] = float(v4_manifest()["threshold"])
    return result


@app.get("/api/health")
def health():
    try:
        _, models = load_pipeline(ACTIVE_ENGINE)
        thresholds = saved_validation_thresholds()
    except Exception:
        return JSONResponse({"status": "unavailable", "model_ready": False}, status_code=503)
    return {"status": "ok", "model_ready": True, "model": ACTIVE_ENGINE,
            "threshold": thresholds[ACTIVE_ENGINE], "horizon_days": 7,
            "trained_model_count": len(models), "calibrated": False,
            "available_models": list(MODEL_FILES), "crystaldiskinfo_txt": True, "text_history_support": True}


@app.post("/api/predict")
async def predict(request: Request):
    body = await request.body()
    if len(body) > MAX_BODY_BYTES:
        raise HTTPException(413, "Upload too large: choose a CSV under 2 MB")
    try:
        payload = json.loads(body)
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(400, "Invalid JSON input")
    if not isinstance(payload, dict) or not isinstance(payload.get("records"), list):
        raise HTTPException(422, "Expected a JSON object containing records: []")
    rows = payload["records"]
    if not 1 <= len(rows) <= MAX_ROWS:
        raise HTTPException(422, f"Upload 1 to {MAX_ROWS} rows per request")
    if any(not isinstance(row, dict) or len(row) > 150 for row in rows):
        raise HTTPException(422, "Each observation must be an object with at most 150 columns")
    requested = payload.get("model", ACTIVE_ENGINE)
    return score_records(rows, requested)


def score_records(rows: list[dict], requested: str = ACTIVE_ENGINE) -> dict:
    """Score historical HDD records; abstain rather than fake a reliable estimate."""
    if not isinstance(requested, str) or requested not in MODEL_FILES:
        raise HTTPException(422, f"Choose one of: {', '.join(MODEL_FILES)}")
    if not 1 <= len(rows) <= MAX_ROWS:
        raise HTTPException(422, f"Upload 1 to {MAX_ROWS} rows per request")
    d = pd.DataFrame(rows)
    d.columns = d.columns.astype(str).str.strip().str.lower()
    needed = {"date", "serial_number", "model"}
    if not needed.issubset(d.columns):
        raise HTTPException(422, "Required columns: date, serial_number, model")
    smart_present = [col for col in SMART if col in d.columns and pd.to_numeric(d[col], errors="coerce").notna().any()]
    if len(smart_present) < 3:
        raise HTTPException(422, "Supply at least 3 SMART raw attributes with numeric readings")
    models = d["model"].fillna("").astype(str).str.strip()
    brands = models.map(brand_for)
    if brands.isna().any():
        unknown = sorted(set(models[brands.isna()].tolist()))[:8]
        raise HTTPException(422, f"Unsupported HDD brand or SSD: {unknown}. Supported: {', '.join(SUPPORTED)}")
    raw = d.drop(columns=[c for c in ("failure", "target_7d") if c in d], errors="ignore")
    raw["failure"] = 0
    raw["date"] = pd.to_datetime(raw["date"], errors="coerce", format="%Y-%m-%d")
    if raw["date"].isna().any() or raw["serial_number"].isna().any():
        raise HTTPException(422, "All rows must have valid YYYY-MM-DD dates and serial numbers")
    if raw["serial_number"].astype(str).str.strip().eq("").any():
        raise HTTPException(422, "Missing serial number")
    try:
        engineered = engineer_features(raw)
    except Exception:
        raise HTTPException(422, "Unable to prepare SMART readings; check data types and column headers")
    latest = engineered.sort_values("date").groupby(["model", "serial_number"], sort=False).tail(1).copy()
    if len(latest) > MAX_DRIVES:
        raise HTTPException(422, f"Maximum {MAX_DRIVES} unique drives per batch")
    pipeline, trained_models = load_pipeline(requested)
    thresholds = saved_validation_thresholds()
    threshold = float(thresholds[requested])
    predictors = v4_manifest()["predictors"] if requested == "XGBoost v4" else PREDICTORS
    if list(predictors) != PREDICTORS:
        raise HTTPException(503, "Model feature list does not match live feature engineering")
    records_to_score = []
    outcomes = []
    # Avoid training-distribution extrapolation from unknown HDDs or a single SMART snapshot.
    for ix, rec in latest.iterrows():
        model = str(rec['model'])
        serial = str(rec['serial_number'])
        observations = engineered[(engineered['model']==model) & (engineered['serial_number']==serial)]
        unique_days = sorted(set(observations['date'].dt.strftime('%Y-%m-%d')))
        recent_dates = pd.to_datetime(unique_days[-8:])
        daily = len(unique_days)>=8 and len(recent_dates)==8 and all(
            (recent_dates[j]-recent_dates[j-1]).days==1 for j in range(1,8)
        )
        warnings = []
        reasons = []
        if model not in trained_models:
            warnings.append('This exact HDD model was absent from training; model inference withheld')
            reasons.append({'code': 'unknown_model', 'message_th': 'รุ่น HDD นี้ไม่อยู่ในชุดฝึกของโมเดลที่เลือก'})
        if not daily:
            warnings.append('At least 8 consecutive daily SMART readings are required for the 7-observation trend features')
            reasons.append({'code': 'history_incomplete', 'message_th': f'มีประวัติ {len(unique_days)} วัน ต้องมีอย่างน้อย 8 วันล่าสุดที่ต่อเนื่องกัน'})
        # Validate each drive's recent observations, not values supplied by other
        # drives or by old snapshots elsewhere in the uploaded file.
        recent = observations.sort_values('date').tail(8)
        valid = recent[SMART].apply(lambda col: col.map(lambda v: pd.notna(v) and math.isfinite(float(v)) and v >= 0))
        complete = [col for col in SMART if valid[col].all()]
        missing_critical = [col for col in TREND if col not in complete]
        latest_valid = [col for col in SMART if bool(valid.iloc[-1][col])]
        quality = {
            'complete_smart_columns': len(complete),
            'latest_valid_smart_columns': len(latest_valid),
            'missing_critical_attributes': missing_critical,
            'incomplete_smart_attributes': [col for col in SMART if col not in complete],
            'required_smart_columns': 8,
            'required_history_days': 8,
            'recent_days_consecutive': daily,
        }
        if len(complete) < 8 or missing_critical:
            warnings.append('SMART attributes are incomplete for reliable model inference')
            reasons.append({'code': 'smart_incomplete', 'message_th': f'มี SMART ที่ใช้ได้ครบช่วงล่าสุด {len(complete)} ตัว ต้องมีอย่างน้อย 8 ตัว และต้องมี 5, 187, 197, 198 ครบทุกวัน'})
        if (recent[SMART] < 0).any().any():
            warnings.append('Negative SMART raw readings are invalid')
            reasons.append({'code': 'negative_smart', 'message_th': 'พบค่า SMART raw ติดลบในช่วงล่าสุด กรุณาตรวจข้อมูลต้นฉบับ'})
        can_score = not warnings
        if can_score:
            records_to_score.append(ix)
        history = [{'date': row['date'].strftime('%Y-%m-%d'), **{
            col: float(row[col]) if pd.notna(row[col]) and math.isfinite(float(row[col])) else None
            for col in TREND
        }} for _, row in observations.sort_values('date').tail(30).iterrows()]
        supplied = sum(observations[col].map(lambda v: pd.notna(v) and math.isfinite(float(v))).any() for col in SMART)
        outcomes.append((ix,model,serial,len(unique_days),warnings,can_score,quality,reasons,history,int(supplied)))
    score_map={}
    if records_to_score:
        try:
            values=pipeline.predict_proba(latest.loc[records_to_score,predictors])[:,1]
        except Exception:
            raise HTTPException(503, 'Model could not evaluate these SMART readings')
        score_map=dict(zip(records_to_score, values))
    result=[]
    for ix,model,serial,n,warnings,can_score,quality,reasons,history,supplied in outcomes:
        rec=latest.loc[ix]
        score=float(score_map[ix]) if can_score else None
        result.append({
            'model':model, 'brand':brand_for(model), 'serial_number':serial,
            'date':rec['date'].strftime('%Y-%m-%d'),
            'score':round(score,7) if score is not None else None,
            'alert':bool(score>=threshold) if score is not None else None,
            'threshold':threshold if score is not None else None,
            'assessment':'experimental_ml' if can_score else 'insufficient_evidence',
            'history_rows':n, 'known_model':model in trained_models,
            'smart_columns_supplied':supplied, 'warnings':warnings,
            'quality':quality, 'reasons':reasons, 'smart_history':history,
            'prediction_window_end':(rec['date'] + pd.Timedelta(days=7)).strftime('%Y-%m-%d'),
            'smart_5_raw':None if pd.isna(rec['smart_5_raw']) else float(rec['smart_5_raw']),
            'smart_197_raw':None if pd.isna(rec['smart_197_raw']) else float(rec['smart_197_raw']),
        })
    return {'engine':requested,'research_version':('v4' if requested=='XGBoost v4' else 'v1'),
            'evaluation_is_retrospective':requested=='XGBoost v4',
            'score_is_calibrated_probability':False,'horizon_days':7,'threshold':threshold,
            'results':result,'total_rows_used':len(engineered),
            'privacy':'processed in memory; no server-side storage'}


@app.post('/api/crystaldiskinfo')
async def crystaldiskinfo(request: Request):
    body = await request.body()
    if len(body)>MAX_BODY_BYTES:
        raise HTTPException(413, 'Total reports must be under 2.4 MB')
    try:
        payload=json.loads(body)
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(400, 'Invalid JSON input')
    reports=payload.get('reports') if isinstance(payload,dict) else None
    if not isinstance(reports,list) or not 1 <= len(reports) <= 30:
        raise HTTPException(422,'Upload 1 to 30 CrystalDiskInfo TXT reports')
    requested=payload.get('model', ACTIVE_ENGINE)
    if requested not in MODEL_FILES:
        raise HTTPException(422,'Unknown ML model')
    disks=[]
    for i,rep in enumerate(reports):
        if not isinstance(rep,dict) or not isinstance(rep.get('text'),str):
            raise HTTPException(422,'Each report must include a text field')
        filename=str(rep.get('filename',f'report_{i+1}.txt'))[:150]
        try:
            parsed=parse_report(rep['text'], filename)
        except ValueError as exc:
            raise HTTPException(422,f'{filename}: {exc}') from exc
        disks.extend(parsed)
    if len(disks)>120:
        raise HTTPException(422, 'Too many devices in TXT reports')
    # Deduplicate per device/day. A second export on the same day overwrites an earlier export.
    unique={}
    for disk in disks:
        unique[(disk['model'],disk['serial_number'],disk['date'])]=disk
    disks=list(unique.values())
    newest={}
    for disk in disks:
        key=(disk['model'],disk['serial_number'])
        if key not in newest or disk['date']>=newest[key]['date']:
            newest[key]=disk
    if len(newest)>MAX_DRIVES:
        raise HTTPException(422,f'Maximum {MAX_DRIVES} unique devices')
    ata_rows=[d['record'] for d in disks if d['kind']=='ATA HDD' and d['record'] is not None]
    scored={}
    if ata_rows:
        try:
            result=score_records(ata_rows, requested)
            scored={(r['model'],r['serial_number']):r for r in result['results']}
        except HTTPException as exc:
            if exc.status_code not in (422,):raise
            # Malformed/incomplete SMART should never make the entire inspection disappear.
            pass
    devices=[]
    for key,disk in sorted(newest.items(), key=lambda item: (item[1]['kind']!='ATA HDD',item[1]['model'])):
        info={k:v for k,v in disk.items() if k!='record'}
        inferred=scored.get(key)
        if inferred:
            info['ml']={k:inferred[k] for k in ('assessment','known_model','history_rows','score','alert','threshold','warnings','reasons','quality')}
        else:
            info['ml']={'assessment':'unsupported' if disk['kind']!='ATA HDD' else 'insufficient_evidence',
                        'score':None,'alert':None,'known_model':False,
                        'warnings':['SSD/NVMe models are not supported by the HDD predictor'] if disk['kind']!='ATA HDD' else ['Not enough compatible SMART attributes to calculate an ML score']}
        devices.append(info)
    return {'format':'CrystalDiskInfo TXT','reports_received':len(reports),
            'distinct_snapshots':len(disks),'devices':devices,
            'converted_hdd_records':ata_rows,
            'model_engine':requested,'mode':'conservative_smart_inspection_with_optional_ml',
            'note':'No fabricated 7-day ML risk score for unseen models, SSDs, or inadequate daily history',
            'privacy':'processed in memory; no server-side storage'}
