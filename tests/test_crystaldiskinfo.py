from __future__ import annotations
from datetime import date,timedelta
from fastapi.testclient import TestClient
from api.index import app, load_pipeline
from core.crystaldiskinfo import parse_report

CLIENT=TestClient(app)

def make_hdd(d='2026/10/01',model='ST2000DM005-2CW102',serial='TEST0001'):
    return f'''CrystalDiskInfo 9.9.2
 Date : {d} 12:20:05
--------------------------------------------
  (01) {model}
--------------------------------------------
 Model : {model}
 Serial Number : {serial}
 Disk Size : 2000.3 GB
 Interface : Serial ATA
 Power On Hours : 15639 hours
 Temperature : 38 C
 Health Status : Good
-- S.M.A.R.T. ----------------------------------
ID Cur Wor Thr RawValues(6) Attribute Name
01 _82 _64 __6 000008D82457 Read Error Rate
05 100 100 _10 000000000000 Reallocated
07 _78 _60 _45 000003CCD45B Seek Errors
09 _83 _83 __0 885600003D17 Hours
0C _96 _96 _20 00000000117F Power Count
BB 100 100 __0 000000000000 Reported uncorrectable
BC 100 __1 __0 000100020BA0 Command Timeout
C0 100 100 __0 0000000000C0 Power-Off
C1 _78 _78 __0 00000000B2D3 Load/Unload
C2 _38 _50 __0 001900000026 Temperature
C5 100 100 __0 000000000000 Pending
C6 100 100 __0 000000000000 Offline uncorrectable
C7 200 189 __0 00000000074D UltraDMA CRC
F0 100 253 __0 A4C100002021 Head flying hours
'''

def make_nvme(d='2026/10/01'):
    return f'''CrystalDiskInfo 9.9.2
 Date : {d} 11:00:00
--------------------------------------------
  (01) HS-SSD-FUTURE 2048G
--------------------------------------------
 Model : HS-SSD-FUTURE 2048G
 Serial Number : FAKE_NVME
 Interface : NVM Express
 Health Status : Good (97 %)
-- S.M.A.R.T. ----------------------------------
ID RawValues(6) Attribute Name
05 000000000003 Percentage Used
'''

def test_ata_hex_and_metadata_preferred():
    r=parse_report(make_hdd())[0]
    assert r['record']['smart_9_raw']==15639 # Hex SMART 09 is vendor packed
    assert r['record']['smart_194_raw']==38
    assert r['raw_smart']['199']==1869
    assert r['raw_smart']['188']==int('000100020BA0',16)
    assert r['record'].get('smart_240_raw') is None
    assert r['issues'][0]['code']=='smart_188'

def test_nvme_never_conflated_with_hdd_smart_ids():
    r=CLIENT.post('/api/crystaldiskinfo',json={'reports':[{'text':make_nvme()}]})
    assert r.status_code==200, r.text
    d=r.json()['devices'][0]
    assert d['kind']=='NVMe SSD' and d['ml']['score'] is None
    assert d['ml']['assessment']=='unsupported'

def test_unknown_hdd_and_snapshot_abstains():
    r=CLIENT.post('/api/crystaldiskinfo',json={'reports':[{'text':make_hdd()}]})
    assert r.status_code==200, r.text
    d=r.json()['devices'][0]
    assert d['kind']=='ATA HDD' and d['ml']['score'] is None
    assert d['ml']['known_model'] is False
    assert any('8 consecutive' in w for w in d['ml']['warnings'])
    assert d['raw_smart']['199']==1869

def test_multi_days_known_training_model_can_get_experimental_score():
    _,known=load_pipeline('XGBoost v4')
    model=next((x for x in known if x.startswith('ST') and not x.startswith('ST2000')),None)
    assert model is not None
    base=date(2026,10,1)
    reps=[{'text':make_hdd((base+timedelta(days=i)).strftime('%Y/%m/%d'),model=model)} for i in range(8)]
    r=CLIENT.post('/api/crystaldiskinfo',json={'reports':reps})
    assert r.status_code==200,r.text
    ml=r.json()['devices'][0]['ml']
    assert ml['assessment']=='experimental_ml'
    assert ml['score'] is not None and 0<=ml['score']<=1
    assert ml['history_rows']==8

def test_duplicate_day_is_not_fake_history():
    r=CLIENT.post('/api/crystaldiskinfo',json={'reports':[{'text':make_hdd()}]*8})
    assert r.status_code==200
    assert r.json()['distinct_snapshots']==1
    assert r.json()['devices'][0]['ml']['score'] is None

def test_invalid_report_returns_clear_error():
    r=CLIENT.post('/api/crystaldiskinfo',json={'reports':[{'filename':'bad.txt','text':'nonsense'}]})
    assert r.status_code==422
    assert 'Date:' in r.json()['detail']
