import React, {useState} from 'react';
import {nfmt, pct} from './utils.js';

export function ResearchDetails({dataset}) {
  const [selected,setSelected]=useState('v4');
  const v4=dataset.versions.find(v=>v.id==='v4');
  const v2=dataset.versions.find(v=>v.id==='v2');
  const v=dataset.versions.find(v=>v.id===selected);
  const m=selected==='smart'?v4.baseline:v.metrics;
  const total=m.tp+m.fp+m.fn+m.tn;
  return <>
    <section className="panel research-scope"><div className="panel-header"><div><h3>ข้อมูลและวิธีประเมิน v2–v4</h3><p>หน่วยผลทดสอบ: 1 HDD ใน 1 วัน (HDD-day) ไม่ใช่จำนวน HDD ที่เสียไม่ซ้ำ</p></div></div>
      <div className="split-grid"><div><span>ข้อมูลทั้งหมด</span><strong>Backblaze · HDD-only</strong><p>ม.ค.–มิ.ย. 2026 (Q1–Q2)</p></div><div><span>Train</span><strong>ม.ค.–มี.ค. 2026</strong><p>ใช้ฝึกโมเดล</p></div><div><span>Validation</span><strong>เม.ย. 2026</strong><p>เลือกพารามิเตอร์และ Threshold</p></div><div><span>Test</span><strong>พ.ค.–มิ.ย. 2026</strong><p>ประเมินย้อนหลังบนชุดเดียวกัน</p></div></div>
      <p className="score-explanation">ช่วงเดือนตามบันทึกผลทดลอง v2 ซึ่ง v3/v4 ใช้ร่วมกัน มีการเว้นขอบเขต label 7 วัน; ไฟล์ผลทดลองไม่ได้ระบุวันตัดแบ่งที่แน่นอน</p>
      <dl className="prediction-facts"><div><dt>แถว Validation</dt><dd>{nfmt(v4.validation_metrics.n_rows)} HDD-days</dd></div><div><dt>แถว Test</dt><dd>{nfmt(v4.metrics.n_rows)} HDD-days</dd></div><div><dt>แถว Test ที่มี label เสี่ยง</dt><dd>{nfmt(v4.test_positive_rows)} HDD-days</dd></div><div><dt>HDD ในกลุ่ม failure window</dt><dd>{nfmt(v4.drive_level.failed_drives)} ลูก · v4 ตรวจพบ {nfmt(v4.drive_level.detected_drives)} ลูก</dd></div><div><dt>จำนวนแถว Train / HDD ทั้งชุด</dt><dd>ไม่ได้ระบุในไฟล์ผลทดลอง</dd></div><div><dt>ชุด Test อ้างอิง</dt><dd>v2–v4 ชุดเดียวกัน · v1 คนละชุด</dd></div></dl>
      <p>เป้าหมาย label: เสียภายใน 7 วันถัดจากวันที่สังเกต โดยไม่นับการเสียในวันเดียวกัน ผล Test นี้เคยถูกสำรวจในรอบก่อนหน้า จึงยังต้องประเมินกับข้อมูลใหม่ที่ไม่เคยใช้มาก่อน</p>
      <p className="score-explanation">ช่วงข้อมูลที่บันทึกไว้: {v2.period} · ไม่ใช้ชุด Test เพื่อปรับเกณฑ์ของการทำนายครั้งนี้</p>
    </section>
    <section className="panel confusion-panel"><div className="panel-header"><div><h3>Confusion Matrix · Test</h3><p>จำนวนแถว HDD-day ที่ทำนายถูกและผิด</p></div><label className="matrix-selector">ผลทดลอง<select aria-label="เลือก Confusion Matrix" value={selected} onChange={e=>setSelected(e.target.value)}><option value="v4">XGBoost v4</option><option value="v3">XGBoost v3</option><option value="v2">XGBoost v2</option><option value="smart">SMART Rule</option></select></label></div>
      <div className="table-scroller"><table className="confusion-table"><thead><tr><th>ผลจริง / ผลทำนาย</th><th>ทำนายเสี่ยง</th><th>ทำนายไม่เสี่ยง</th></tr></thead><tbody><tr><th>เสียภายใน 7 วัน</th><td className="matrix-correct"><strong>TP · {nfmt(m.tp)}</strong><small>ตรวจพบถูกต้อง</small></td><td className="matrix-error"><strong>FN · {nfmt(m.fn)}</strong><small>พลาดเหตุการณ์เสีย</small></td></tr><tr><th>ไม่เสียในช่วงเป้าหมาย</th><td className="matrix-error"><strong>FP · {nfmt(m.fp)}</strong><small>แจ้งเตือนผิด</small></td><td className="matrix-correct"><strong>TN · {nfmt(m.tn)}</strong><small>ไม่แจ้งเตือนถูกต้อง</small></td></tr></tbody></table></div>
      <p className="matrix-total">รวม {nfmt(total)} HDD-days · Recall {pct(m.recall)} · Precision {pct(m.precision,4)}</p>
      <p className="score-explanation">HDD ลูกเดียวอาจมีหลายแถว จึงไม่ควรอ่าน TP หรือ FP เป็นจำนวน HDD ไม่ซ้ำ</p>
    </section>
  </>;
}
