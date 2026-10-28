import csv, json, hashlib
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from api.index import app, v4_manifest, load_pipeline, ACTIVE_ENGINE
from core.config import PREDICTORS
from core.labels import engineer_features
import pandas as pd
ROOT = Path(__file__).resolve().parents[1]
CLIENT = TestClient(app)
with (ROOT/'samples/SYNTHETIC_SMART_example.csv').open(newline='',encoding='utf-8') as f:
    SAMPLE=list(csv.DictReader(f))

def test_model_verified():
    man = v4_manifest()
    assert hashlib.sha256((ROOT/'models/v4_xgboost.joblib').read_bytes()).hexdigest().upper()==man['trained_model_sha256']
    assert man['predictors']==PREDICTORS
    assert ACTIVE_ENGINE=='XGBoost v4'

def test_v4_real_predict_and_research():
    r = CLIENT.post('/api/predict',json={'records':SAMPLE})
    assert r.status_code==200,r.text
    d=r.json()
    assert d['engine']=='XGBoost v4'
    assert d['research_version']=='v4'
    assert d['score_is_calibrated_probability'] is False
    assert 0<=d['results'][0]['score']<=1

def test_no_improper_single_snapshot_claim():
    r=CLIENT.post('/api/predict',json={'records':SAMPLE[:1]})
    assert r.status_code==200,r.text
    assert r.json()['results'][0]['score'] is None
    assert r.json()['results'][0]['assessment']=='insufficient_evidence'
    assert any('8 consecutive' in w for w in r.json()['results'][0]['warnings'])

def test_v4_scores_identical_to_saved_pipeline():
    model,known = load_pipeline('XGBoost v4')
    engineered=engineer_features(pd.DataFrame(SAMPLE).assign(failure=0))
    api=CLIENT.post('/api/predict',json={'records':SAMPLE}).json()['results'][0]['score']
    direct=float(model.predict_proba(engineered.sort_values('date').tail(1)[PREDICTORS])[0,1])
    assert api==round(direct,7)

def test_v4_status_consistent():
    s=json.loads((ROOT/'assets/v4_training_status.json').read_text())
    m=s['test']['ml'];b=s['test']['smart_rule'];
    assert s['test']['better_than_smart_on_both_reading_metrics']
    assert m['recall']>b['recall'] and m['fp']<b['fp']
    v4=next(v for v in json.loads((ROOT/'assets/ml_evolution.json').read_text())['versions'] if v['id']=='v4')
    assert v4['status']=='completed'
    assert v4['metrics']['pr_auc'] is None
    assert v4['metrics']['fp']==m['fp']
