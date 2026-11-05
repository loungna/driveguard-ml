import csv
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from api.index import app
from core.config import SMART

CLIENT = TestClient(app)
ROOT = Path(__file__).resolve().parents[1]


def fixture(name='01_Normal.csv'):
    with (ROOT / 'public/data' / name).open() as file:
        return list(csv.DictReader(file))


def predict(rows):
    response = CLIENT.post('/api/predict', json={'model':'XGBoost v4', 'records': rows})
    assert response.status_code == 200, response.text
    return response.json()['results']


def test_complete_examples_retain_live_scores_and_mixed_outcomes():
    normal = predict(fixture())[0]
    risky = predict(fixture('02_Rising_Errors.csv'))[0]
    assert normal['score'] == 0.2955574
    assert normal['alert'] is False
    assert risky['score'] == 0.9912141
    assert risky['alert'] is True
    mixed = predict(fixture('03_Mixed_Scenarios.csv'))
    assert len(mixed) == 4
    assert sum(r['score'] is None for r in mixed) == 2
    assert normal['quality']['complete_smart_columns'] == 14
    assert normal['prediction_window_end'] == '2026-04-17'


def test_other_drive_cannot_supply_missing_smart():
    healthy = fixture()
    blank = [{**row, 'serial_number':'MISSING', **{key:'' for key in SMART}} for row in healthy]
    results = {r['serial_number']:r for r in predict(healthy + blank)}
    assert results['SYNTH_BASE']['score'] == 0.2955574
    assert results['MISSING']['score'] is None
    assert results['MISSING']['smart_columns_supplied'] == 0
    assert results['MISSING']['quality']['latest_valid_smart_columns'] == 0
    assert results['MISSING']['reasons'][0]['code'] == 'smart_incomplete'


@pytest.mark.parametrize('day,value', [(-1,''), (-1,'NaN'),(-1,'Infinity'),(-1,'abc'),(-4,''),(-1,'-1')])
def test_invalid_critical_reading_in_recent_history_abstains(day,value):
    rows = fixture()
    rows[day]['smart_197_raw'] = value
    result = predict(rows)[0]
    assert result['score'] is None
    assert 'smart_197_raw' in result['quality']['missing_critical_attributes']
    assert any(r['code']=='smart_incomplete' for r in result['reasons'])


def test_old_missing_reading_does_not_block_recent_complete_history():
    rows = fixture()
    rows[0]['smart_197_raw'] = ''
    assert predict(rows)[0]['score'] == 0.2955574


def test_gap_prevents_inference_and_trend_keeps_nulls():
    rows = fixture()
    rows.pop(-3)
    rows[-1]['smart_197_raw'] = ''
    result = predict(rows)[0]
    assert result['score'] is None
    assert result['quality']['recent_days_consecutive'] is False
    assert result['smart_history'][-1]['smart_197_raw'] is None
    assert any(r['code']=='history_incomplete' for r in result['reasons'])


def test_optional_smart_missing_is_allowed_with_eight_complete_attributes():
    rows = fixture()
    for row in rows:
        for col in ['smart_1_raw','smart_7_raw','smart_188_raw','smart_192_raw','smart_193_raw','smart_240_raw']:
            row[col]=''
    result = predict(rows)[0]
    assert result['score'] is not None
    assert result['quality']['complete_smart_columns'] == 8
