"""Columns and paths shared by extraction, modeling, and inference."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SMART = [
    'smart_1_raw', 'smart_5_raw', 'smart_7_raw', 'smart_9_raw',
    'smart_12_raw', 'smart_187_raw', 'smart_188_raw', 'smart_192_raw',
    'smart_193_raw', 'smart_194_raw', 'smart_197_raw', 'smart_198_raw',
    'smart_199_raw', 'smart_240_raw',
]
TREND = ['smart_5_raw', 'smart_187_raw', 'smart_197_raw', 'smart_198_raw']
TREND_FEATURES = [f'{s}_delta_7obs' for s in TREND] + [f'{s}_roll7max' for s in TREND]
NUMERIC = ['capacity_bytes', *SMART, *TREND_FEATURES]
PREDICTORS = ['model', *NUMERIC]
COLLECT_COLUMNS = ['date', 'serial_number', 'model', 'failure', 'capacity_bytes', *SMART]
HORIZON_DAYS = 7
BASELINE_SMART = ['smart_5_raw', 'smart_187_raw', 'smart_188_raw', 'smart_197_raw', 'smart_198_raw']
