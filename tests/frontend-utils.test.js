import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,recordsToCsv,pct,safeSerial,comparisonVersions} from '../src/utils.js';
import fs from 'node:fs';

test('CSV handles quoted multi-line data and escaped quotes', () => {
  const rows=parseCsv('\uFEFFdate,serial_number,model,note\r\n2026-10-01,AAA,ST100,"one, ""quoted"""\r\n');
  assert.equal(rows.length,1);
  assert.equal(rows[0].model,'ST100');
});
test('CSV handles quoted cells and export', () => {
  const rows=parseCsv('date,serial_number,model,note\n2026-10-01,ABC,ST100,"note, with comma"');
  assert.equal(rows[0].note,'note, with comma');
  assert.deepEqual(parseCsv(recordsToCsv(rows)),rows);
});
test('CSV refuses missing columns and unclosed quotes', () => {
  assert.throws(()=>parseCsv('date,model\n2026-01-01,ST'),/date, serial_number/);
  assert.throws(()=>parseCsv('date,serial_number,model\n2026-01-01,ABC,"bad'),/ไม่ได้ปิด/);
});
test('display helpers do not imply calibrated likelihood', () => {
  assert.equal(pct(0.772), '77.20%');
  assert.equal(safeSerial('ZFM123456'), '••••3456');
});

test('research comparisons use saved cohorts and preserve unavailable PR-AUC', () => {
  const source=JSON.parse(fs.readFileSync(new URL('../public/data/ml_evolution.json',import.meta.url)));
  const versions=comparisonVersions(source);
  assert.deepEqual(versions.map(v=>v.id),['v2','v3','v4','smart']);
  for(const v of versions){
    assert.equal(v.tp+v.fp+v.fn+v.tn,v.n_rows);
    assert.equal(v.n_rows,18862076);
  }
  assert.equal(versions[2].pr_auc,null);
  source.versions.find(v=>v.id==='v4').metrics.recall=0.123;
  assert.equal(comparisonVersions(source)[2].recall,0.123);
  assert.deepEqual(comparisonVersions(null),[]);
});
