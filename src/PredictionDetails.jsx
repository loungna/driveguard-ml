import React from 'react';
import {AlertCircle, TrendingUp} from 'lucide-react';
import {nfmt, safeSerial} from './utils.js';

const ATTRIBUTES = [
  ['smart_5_raw', '5 · Reallocated sectors'],
  ['smart_187_raw', '187 · Reported uncorrectable'],
  ['smart_197_raw', '197 · Current pending sectors'],
  ['smart_198_raw', '198 · Offline uncorrectable'],
];

export function SmartTrend({history, attribute, label}) {
  const values = history.map(row => row[attribute]);
  const finite = values.filter(Number.isFinite);
  const min = Math.min(0, ...finite), max = Math.max(1, ...finite);
  const x = i => 36 + i * 248 / Math.max(1, history.length - 1);
  const y = v => 74 - (v - min) * 58 / (max - min);
  let connected = false;
  const path = values.map((v, i) => {
    if (!Number.isFinite(v)) { connected = false; return ''; }
    const point = `${connected ? 'L' : 'M'}${x(i)},${y(v)}`;
    connected = true; return point;
  }).join(' ');
  return <figure className="smart-trend">
    <figcaption>{label}<strong>{Number.isFinite(values.at(-1)) ? nfmt(values.at(-1)) : 'ไม่มีค่าล่าสุด'}</strong></figcaption>
    <svg viewBox="0 0 300 105" role="img" aria-label={`${label} จาก ${history[0]?.date} ถึง ${history.at(-1)?.date}; ค่าล่าสุด ${values.at(-1) ?? 'ไม่มีข้อมูล'}`}>
      <line x1="36" x2="284" y1="74" y2="74" className="trend-axis"/>
      <line x1="36" x2="284" y1="16" y2="16" className="trend-axis"/>
      <text x="30" y="20" textAnchor="end">{nfmt(max)}</text>
      <text x="30" y="78" textAnchor="end">{nfmt(min)}</text>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2"/>
      {values.map((v,i)=>Number.isFinite(v)&&<circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill="currentColor"><title>{`${history[i].date}: ${nfmt(v)}`}</title></circle>)}
      <text x="36" y="98">{history[0]?.date.slice(5)}</text>
      <text x="284" y="98" textAnchor="end">{history.at(-1)?.date.slice(5)}</text>
    </svg>
  </figure>;
}

export function PredictionCard({result:r, engine, index}) {
  const scored = r.assessment === 'experimental_ml' && Number.isFinite(r.score);
  const status = !scored ? 'ประเมินไม่ได้' : r.alert ? 'พบสัญญาณเสี่ยง' : 'ไม่พบสัญญาณเสี่ยงตามเกณฑ์';
  const reasons = r.reasons?.length ? r.reasons.map(x=>x.message_th) : r.warnings || [];
  return <article className="prediction-card">
    <div className="prediction-head"><div><small>HDD {index + 1} · {engine}</small><strong>{r.model}</strong><p>Serial {safeSerial(r.serial_number)}</p></div>
      <span className={`status-pill status-${!scored?'neutral':r.alert?'warning':'good'}`}><span className="status-dot"/>{status}</span>
    </div>
    <div className="score-pair"><div><span>คะแนนจากโมเดล</span><strong>{scored?r.score.toFixed(4):'—'}</strong></div><div><span>เกณฑ์แจ้งเตือน (Threshold)</span><strong>{scored?r.threshold.toFixed(4):'—'}</strong></div></div>
    <p className="score-explanation">{scored?'คะแนน 0–1 ยังไม่ใช่ความน่าจะเป็นที่ปรับเทียบแล้ว · แจ้งเตือนเมื่อคะแนน ≥ เกณฑ์':'ระบบงดให้คะแนนเมื่อหลักฐานไม่ครบ ไม่ได้หมายความว่า HDD ปลอดภัย'}</p>
    <dl className="prediction-facts">
      <div><dt>ข้อมูลล่าสุด</dt><dd>{r.date}</dd></div>
      <div><dt>ช่วงเป้าหมาย</dt><dd>7 วันถัดจากข้อมูลล่าสุด{r.prediction_window_end&&` ถึง ${r.prediction_window_end}`}</dd></div>
      <div><dt>ประวัติที่ใช้ได้</dt><dd>{nfmt(r.history_rows)} วัน · {r.quality?.recent_days_consecutive?'8 วันล่าสุดต่อเนื่อง':'ช่วงล่าสุดยังไม่ครบเกณฑ์'}</dd></div>
      <div><dt>รุ่นอยู่ในชุดฝึก</dt><dd>{r.known_model?'พบในโมเดลที่เลือก':'ไม่พบในโมเดลที่เลือก'}</dd></div>
      <div><dt>SMART ครบช่วงล่าสุด</dt><dd>{r.quality?nfmt(r.quality.complete_smart_columns):'—'} / 14 ตัว · ต้องมีอย่างน้อย 8 ตัว</dd></div>
      <div><dt>SMART หลักที่ขาดหรือใช้ไม่ได้</dt><dd>{r.quality?.missing_critical_attributes?.length?r.quality.missing_critical_attributes.map(x=>x.replace('smart_','').replace('_raw','')).join(', '):r.quality?'ไม่มี':'ไม่ระบุ'}</dd></div>
    </dl>
    {!!reasons.length&&<div className="prediction-warnings">{reasons.map((w,i)=><p key={i}><AlertCircle size={15}/>{w}</p>)}</div>}
    {scored&&<p className="prediction-advice">{r.alert?'ควรสำรองข้อมูลและตรวจสอบ SMART เพิ่มเติม ผลนี้ไม่ยืนยันว่า HDD จะเสียแน่นอน':'ติดตาม SMART ต่อเนื่องและสำรองข้อมูล ผลนี้ไม่ยืนยันว่า HDD จะไม่เสีย'}</p>}
    {!!r.smart_history?.length&&<details className="trend-details"><summary><TrendingUp size={17}/> ดูแนวโน้ม SMART หลัก</summary>
      <p>ค่า raw สูงสุด 30 วันล่าสุด แกนตั้งแยกตามแต่ละค่า · ช่องว่างหมายถึงไม่มีข้อมูล · กราฟนี้แสดงข้อมูลนำเข้า ไม่ใช่คำอธิบายสาเหตุของคะแนนโมเดล</p>
      <div className="trend-grid">{ATTRIBUTES.map(([key,label])=><SmartTrend key={key} history={r.smart_history} attribute={key} label={label}/>)}</div>
      <details><summary>ดูค่าตัวเลขรายวัน</summary><div className="table-scroller"><table><thead><tr><th>วันที่</th>{ATTRIBUTES.map(([key,label])=><th key={key}>{label.split(' · ')[0]}</th>)}</tr></thead><tbody>{r.smart_history.map(row=><tr key={row.date}><th>{row.date}</th>{ATTRIBUTES.map(([key])=><td key={key}>{nfmt(row[key])}</td>)}</tr>)}</tbody></table></div></details>
    </details>}
  </article>;
}
