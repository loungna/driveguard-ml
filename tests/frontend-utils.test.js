import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,recordsToCsv,pct,safeSerial} from '../src/utils.js';

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
