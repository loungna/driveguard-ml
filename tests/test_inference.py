"""Smoke tests: pip install pytest httpx; python -m pytest -q"""
import csv
from pathlib import Path
from fastapi.testclient import TestClient
from api.index import app

ROOT = Path(__file__).resolve().parents[1]
CLIENT = TestClient(app)
with (ROOT/'samples/SYNTHETIC_SMART_example.csv').open(newline='',encoding='utf-8') as f:
    SAMPLE = list(csv.DictReader(f))


def test_health_has_saved_winner():
    r=CLIENT.get('/api/health')
    assert r.status_code==200
    assert r.json()['model']=='XGBoost v4'
    assert r.json()['threshold']==0.49451056122779846


def test_known_model_prediction():
    r=CLIENT.post('/api/predict',json={'records':SAMPLE})
    assert r.status_code==200
    v=r.json()
    assert len(v['results'])==1
    assert v['results'][0]['model']=='ST12000NM0008'
    assert v['results'][0]['known_model'] is True
    assert v['engine']=='XGBoost v4'
    assert isinstance(v['results'][0]['score'],float)


def test_unseen_supported_brand():
    a=[{**row,'model':'STNEWTESTXYZ'} for row in SAMPLE]
    r=CLIENT.post('/api/predict',json={'records':a})
    assert r.status_code==200
    assert r.json()['results'][0]['known_model'] is False
    assert r.json()['results'][0]['warnings']


def test_ssd_is_rejected():
    a=[{**row,'model':'Samsung SSD 990 EVO'} for row in SAMPLE]
    r=CLIENT.post('/api/predict',json={'records':a})
    assert r.status_code==422


def test_missing_smart_rejected():
    a=[{k:v for k,v in row.items() if not k.startswith('smart_')} for row in SAMPLE]
    r=CLIENT.post('/api/predict',json={'records':a})
    assert r.status_code==422


def test_invalid_dates_rejected():
    a=[{**row,'date':'invalid'} for row in SAMPLE]
    r=CLIENT.post('/api/predict',json={'records':a})
    assert r.status_code==422


def test_two_models():
    b=[{**row,'model':'TOSHIBA MG07ACA14TA','serial_number':'DEMO002'} for row in SAMPLE]
    r=CLIENT.post('/api/predict',json={'records':SAMPLE+b})
    assert r.status_code==200
    assert len(r.json()['results'])==2


def test_future_failure_column_ignored():
    a=[{**row,'failure':'1','target_7d':'1'} for row in SAMPLE]
    r1=CLIENT.post('/api/predict',json={'records':SAMPLE})
    r2=CLIENT.post('/api/predict',json={'records':a})
    assert r1.status_code==r2.status_code==200
    assert r1.json()['results'][0]['score']==r2.json()['results'][0]['score']


def test_all_four_pretrained_model_engines():
    from api.index import saved_validation_thresholds
    thresholds = saved_validation_thresholds()
    for model in ('Logistic Regression', 'Decision Tree', 'Random Forest', 'XGBoost', 'XGBoost v4'):
        res = CLIENT.post('/api/predict', json={'records': SAMPLE, 'model': model})
        assert res.status_code == 200, (model, res.text)
        result = res.json()
        assert result['engine'] == model
        assert result['threshold'] == thresholds[model]
        assert 0 <= result['results'][0]['score'] <= 1
        assert result['results'][0]['threshold'] == thresholds[model]


def test_model_allowlist_blocks_path_traversal():
    for name in ('../models/best_model.joblib', 'BAD MODEL', '../../etc/passwd'):
        res = CLIENT.post('/api/predict', json={'records': SAMPLE, 'model': name})
        assert res.status_code == 422


def test_selected_threshold_is_from_stored_validation():
    import json
    registry = json.loads((ROOT/'models/validation_registry.json').read_text())
    assert registry['selection_split'] == 'validation'
    from api.index import saved_validation_thresholds
    for model, info in registry['models'].items():
        assert saved_validation_thresholds()[model] == info['threshold']


def test_selected_engine_is_not_influenced_by_payload_failure():
    for model in ('Decision Tree', 'XGBoost'):
        r1 = CLIENT.post('/api/predict', json={'records': SAMPLE, 'model': model})
        data = [{**r,'failure':'1','target_7d':'1'} for r in SAMPLE]
        r2 = CLIENT.post('/api/predict', json={'records': data, 'model': model})
        assert r1.status_code==r2.status_code==200
        assert r1.json()['results'][0]['score'] == r2.json()['results'][0]['score']


def test_western_digital_wds_ssd_rejected():
    from api.index import brand_for
    assert brand_for("WDC WDS250G2B0A") is None
