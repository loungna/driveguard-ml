"""Time-correct features and failure labels for cross-model HDD data."""
import numpy as np
import pandas as pd
from .config import SMART, TREND, NUMERIC, HORIZON_DAYS


def prepare(raw):
    d = raw.copy()
    d.columns = d.columns.str.strip().str.lower()
    required = {'date', 'model', 'serial_number', 'failure'}
    absent = required - set(d.columns)
    if absent:
        raise ValueError(f'Missing required Backblaze columns: {sorted(absent)}')
    d['date'] = pd.to_datetime(d['date'], errors='coerce')
    for c in ['serial_number', 'model']:
        d[c] = d[c].astype('string').str.strip()
    d['failure'] = pd.to_numeric(d['failure'], errors='coerce')
    # Do not fill absent failure labels with healthy/zero.
    d = d.loc[d['date'].notna() & d['model'].notna() & d['serial_number'].notna()
              & d['failure'].isin([0, 1])].copy()
    for c in ['capacity_bytes', *SMART]:
        if c not in d:
            d[c] = np.nan
        d[c] = pd.to_numeric(d[c], errors='coerce')
        d.loc[~np.isfinite(d[c]), c] = np.nan
    d.loc[d['capacity_bytes'] <= 0, 'capacity_bytes'] = np.nan
    return d.sort_values(['model','serial_number','date']).drop_duplicates(
        ['model','serial_number','date'], keep='last').reset_index(drop=True)


def engineer_features(raw):
    """Generate available-date predictors, retaining unlabeled inference rows.

    For inference only, an absent failure column may be filled with 0; it is NEVER
    acceptable to do this for training or label construction.
    """
    d=raw.copy()
    if 'failure' not in d.columns:
        d['failure']=0
    d=prepare(d)
    grouped=d.groupby(['model','serial_number'],sort=False)
    for c in TREND:
        g=grouped[c]
        d[f'{c}_delta_7obs']=(d[c]-g.shift(7)).astype('float32')
        d[f'{c}_roll7max']=g.rolling(window=7,min_periods=2).max().reset_index(
            level=[0,1],drop=True).astype('float32')
    for c in NUMERIC:
        d[c]=pd.to_numeric(d[c],errors='coerce').replace([np.inf,-np.inf],np.nan).astype('float32')
    return d


def engineer_labeled(raw, horizon=HORIZON_DAYS):
    """Use only past/present SMART values; exclude same-day failure and censored rows."""
    if 'failure' not in raw.columns:
        raise ValueError('Training label creation requires observed failure=0/1 in source data.')
    d = engineer_features(raw)
    keys = ['model', 'serial_number']
    grouped = d.groupby(keys,sort=False)
    failed = d.loc[d['failure'].eq(1)].groupby(keys)['date'].min().rename('failure_date')
    last = grouped['date'].max().rename('last_observed')
    d = d.join(failed, on=keys).join(last, on=keys)
    until_failure = (d['failure_date']-d['date']).dt.days
    positive = until_failure.between(1,horizon)
    known_negative = (until_failure > horizon) | (
        d['failure_date'].isna() & (d['last_observed']-d['date']).dt.days.ge(horizon)
    )
    d['target_7d'] = np.where(positive, 1, np.where(known_negative, 0, np.nan))
    d = d[d['target_7d'].notna()].copy()
    d['target_7d'] = d['target_7d'].astype('int8')
    for c in NUMERIC:
        d[c] = pd.to_numeric(d[c],errors='coerce').replace([np.inf,-np.inf],np.nan).astype('float32')
    return d.drop(columns=['failure_date','last_observed']).reset_index(drop=True)


def baseline_alert(d):
    from .config import BASELINE_SMART
    # Transparent simplified no-AI alert, not Backblaze's proprietary rule engine.
    return d[BASELINE_SMART].fillna(0).gt(0).any(axis=1).to_numpy(dtype='int8')
