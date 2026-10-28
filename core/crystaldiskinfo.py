"""Conservative CrystalDiskInfo text-report parser.

ATA and NVMe attributes have different meanings. Parse only source-provided
information, and never synthesize unavailable time-series features.
"""
from __future__ import annotations
from datetime import datetime
import re
from typing import Any

from .config import SMART

HEADER = re.compile(r'(?m)^\s*\(\d{2}\)\s+([^\r\n]+)\r?\n-{15,}\r?\n')
FIELD = re.compile(r'^\s*([\w#][^:\n]{1,32})\s*:\s*(.*?)\s*$', re.M)
SINGLE_ATTRIBUTE = re.compile(r'^\s*([A-Fa-f0-9]{2})\s+(.+)$')
REPORT_DATE = re.compile(r'(?m)^\s*Date\s*:\s*(\d{4})/(\d{2})/(\d{2})\b')
SENSITIVE_FIELDS = {'serial number'}
IMPORTANT = (5, 187, 188, 197, 198, 199)


def _numeric(s: str) -> int | None:
    match = re.search(r'\b\d+\b', str(s).replace(',', ''))
    return int(match.group()) if match else None


def _extract_ata_attributes(block: str) -> dict[int, int]:
    section = re.search(r'-- S\.M\.A\.R\.T\.\s*-+\s*\r?\n(.*?)(?=\r?\n-- [A-Z_ ]+ -+|\Z)', block, re.S | re.I)
    if not section:
        return {}
    data: dict[int, int] = {}
    for line in section.group(1).splitlines():
        m = SINGLE_ATTRIBUTE.match(line)
        if not m:
            continue
        smart_id = int(m.group(1), 16)  # CDI prints SMART IDs as hexadecimal
        tokens = m.group(2).split()
        # ATA rows: Cur Wor Thr RawValues(6) Name, e.g. 05 100 100 _10 000000000000
        if len(tokens) < 4 or not re.fullmatch(r'[A-Fa-f0-9]{12}', tokens[3]):
            continue
        data[smart_id] = int(tokens[3], 16)
    return data


def parse_report(text: str, filename: str = 'CrystalDiskInfo.txt') -> list[dict[str, Any]]:
    if not isinstance(text, str) or not text.strip():
        raise ValueError('CrystalDiskInfo report is empty')
    if len(text) > 400_000:
        raise ValueError('CrystalDiskInfo report is too large (400,000 characters maximum)')
    date = REPORT_DATE.search(text)
    if not date:
        raise ValueError('CrystalDiskInfo report has no recognized Date: YYYY/MM/DD header')
    try:
        recorded = datetime(*map(int, date.groups())).date().isoformat()
    except ValueError as exc:
        raise ValueError('Invalid CrystalDiskInfo report date') from exc
    matches = list(HEADER.finditer(text))
    if not matches:
        raise ValueError('No CrystalDiskInfo device information blocks found')
    disks: list[dict[str, Any]] = []
    for i, entry in enumerate(matches):
        body = text[entry.end():matches[i+1].start() if i+1<len(matches) else len(text)]
        # Only scan before IDENTIFY_DEVICE and raw byte dump; field names are metadata there.
        summary = body.split('-- S.M.A.R.T.')[0]
        meta = {k.strip().lower(): v.strip() for k,v in FIELD.findall(summary)}
        model = meta.get('model', entry.group(1).strip())
        serial = meta.get('serial number','').strip()
        interface = meta.get('interface','').strip()
        if not serial or not model:
            continue
        is_nvme = 'nvm express' in interface.lower() or 'nvme' in interface.lower()
        is_ssd = is_nvme or 'ssd' in model.upper() or 'solid state' in interface.lower()
        kind = 'NVMe SSD' if is_nvme else 'SSD' if is_ssd else 'ATA HDD' if ('ata' in interface.lower()) else 'Unknown'
        raw = _extract_ata_attributes(body) if kind == 'ATA HDD' else {}
        power_hours = _numeric(meta.get('power on hours',''))
        temp = _numeric(meta.get('temperature',''))
        # SMART 9 is vendor-packed in some ATA dumps (example 885600003D17).
        # The CDI human-readable power-on-hours field is the safer value.
        if power_hours is not None and kind == 'ATA HDD':
            raw[9] = power_hours
        if temp is not None and kind == 'ATA HDD':
            raw[194] = temp
        # SMART 240 can also be vendor-packed; do not feed packed hex as ordinary hours.
        raw.pop(240, None)
        cap = re.search(r'([\d.,]+)\s*(TB|GB|MB)\b', meta.get('disk size',''), re.I)
        multiplier = {'MB':10**6,'GB':10**9,'TB':10**12}
        bytes_cap = round(float(cap.group(1).replace(',',''))*multiplier[cap.group(2).upper()]) if cap else None
        record: dict[str, Any] = {'date': recorded, 'serial_number':serial, 'model':model}
        if bytes_cap is not None: record['capacity_bytes']=bytes_cap
        for name in SMART:
            num = int(name.split('_')[1])
            if num in raw: record[name] = raw[num]
        issues=[]
        severity='info'
        if kind == 'ATA HDD':
            for num,label in ((5,'Reallocated sectors'),(187,'Reported uncorrectable errors'),(197,'Pending sectors'),(198,'Offline uncorrectable sectors')):
                if raw.get(num,0)>0:
                    issues.append({'severity':'warning','code':f'smart_{num}','message':f'{label}: {raw[num]} (SMART {num})'})
                    severity='warning'
            if raw.get(188,0)>0:
                issues.append({'severity':'warning','code':'smart_188','message':'Command timeout SMART 188 is non-zero; raw is vendor-packed and must not be read as a simple count'})
                severity='warning'
            if raw.get(199,0)>0:
                issues.append({'severity':'attention','code':'smart_199','message':f'UltraDMA CRC errors recorded: {raw[199]} (cumulative; inspect SATA cable/port and monitor changes)'})
                if severity=='info':severity='attention'
            if temp is not None and temp>=50:
                issues.append({'severity':'attention','code':'temperature','message':f'Temperature {temp} C; check cooling and vendor specifications'})
                if severity=='info':severity='attention'
        if is_nvme:
            issues.append({'severity':'info','code':'ssd_excluded','message':'NVMe SMART attribute IDs differ from HDD IDs; HDD prediction intentionally disabled'})
        if not issues:
            issues.append({'severity':'info','code':'snapshot','message':'No selected sector-error indicators found in this snapshot; this does not rule out failure'})
        disks.append({
            'model':model,'serial_number':serial,'kind':kind,'interface':interface,
            'date':recorded,'filename':filename,'health_reported':meta.get('health status'),
            'temperature_c':temp,'power_on_hours':power_hours,'capacity_bytes':bytes_cap,
            'raw_smart':{str(k):raw[k] for k in IMPORTANT if k in raw},
            'smart_count':len(raw),'issues':issues,'inspection':'needs_review' if severity=='warning' else severity,
            'record':record if kind=='ATA HDD' else None,
        })
    if not disks:
        raise ValueError('No devices with model and serial number found')
    return disks
