export const pct = (n, decimals = 2) => n == null || !Number.isFinite(Number(n))
  ? '—' : `${(Number(n) * 100).toFixed(decimals)}%`;
export const nfmt = (n) => n == null || !Number.isFinite(Number(n)) ? '—' : new Intl.NumberFormat('en-US').format(n);
export const signed = (n, digits = 2) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;
export const safeSerial = (s) => typeof s === 'string' && s.length > 5 ? `••••${s.slice(-4)}` : '••••';

export function comparisonVersions(dataset) {
  if (!dataset?.versions) return [];
  const versions = ['v2','v3','v4'].map(id => {
    const version = dataset.versions.find(v => v.id === id);
    return version ? {id, label:`XGBoost ${id}`, ...version.metrics} : null;
  }).filter(Boolean);
  const baseline = dataset.versions.find(v => v.id === 'v4')?.baseline;
  return baseline ? [...versions, {id:'smart', label:'SMART Rule', ...baseline}] : versions;
}

// RFC 4180 subset: quoted values, escaped double-quotes, embedded newlines,
// CRLF/BOM; rejects malformed input instead of guessing column boundaries.
export function parseCsv(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('ไฟล์ CSV ว่างเปล่า');
  const text = raw.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], val = '', quoted = false, afterQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { val += '"'; i++; }
      else if (ch === '"') { quoted = false; afterQuote = true; }
      else { val += ch; }
      continue;
    }
    if (ch === '"' && val === '' && !afterQuote) { quoted = true; continue; }
    if (ch === ',' || ch === '\r' || ch === '\n') {
      row.push(val); val = ''; afterQuote = false;
      if (ch !== ',') {
        if (row.some((v) => v !== '')) rows.push(row);
        row = [];
        if (ch === '\r' && text[i + 1] === '\n') i++;
      }
    } else if (afterQuote && ch === ' ') { /* optional spaces after a closing quote */ }
    else if (afterQuote || ch === '"') { throw new Error(`รูปแบบ CSV ไม่ถูกต้องที่ตัวอักษร ${i}`); }
    else { val += ch; }
  }
  if (quoted) throw new Error('CSV มีเครื่องหมายคำพูดที่ไม่ได้ปิด');
  row.push(val);
  if (row.some((v) => v !== '')) rows.push(row);
  if (rows.length < 2) throw new Error('CSV ต้องมีหัวตารางและข้อมูลอย่างน้อยหนึ่งแถว');
  const headers = rows[0].map((s) => s.trim().toLowerCase());
  if (headers.some((s) => !s) || new Set(headers).size !== headers.length) throw new Error('ชื่อคอลัมน์ CSV ว่างหรือซ้ำกัน');
  const required = ['date', 'serial_number', 'model'];
  if (required.some((x) => !headers.includes(x))) throw new Error('ต้องมีคอลัมน์ date, serial_number และ model');
  if (rows.length - 1 > 3000) throw new Error('อัปโหลดได้สูงสุด 3,000 แถวต่อครั้ง');
  return rows.slice(1).map((fields, idx) => {
    if (fields.length !== headers.length) throw new Error(`จำนวนคอลัมน์ไม่ตรงที่แถว ${idx + 2}`);
    return Object.fromEntries(headers.map((key, i) => [key, fields[i]]));
  });
}

export function recordsToCsv(rows) {
  if (!rows?.length) return '';
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const quote = (v) => {
    const str = v == null ? '' : String(v);
    return /[,\r\n"]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((header) => quote(row[header])).join(','))].join('\r\n');
}

export function downloadText(content, filename, type = 'text/plain;charset=utf-8') {
  const file = new Blob([content], {type});
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
export async function postJson(endpoint, payload, signal) {
  const response = await fetch(endpoint, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload), signal,
  });
  let json;
  try { json = await response.json(); } catch { throw new Error(`API ส่งข้อมูลกลับไม่ถูกต้อง (${response.status})`); }
  if (!response.ok) {
    const detail = json?.detail;
    throw new Error(typeof detail === 'string' ? detail : `Server error (${response.status})`);
  }
  return json;
}
