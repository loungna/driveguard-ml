import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertCircle, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3,
  Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, CloudUpload, Code2,
  Database, Download, ExternalLink, FileCheck2, FileClock, FileSpreadsheet, FileText,
  Gauge, HardDrive, HardDriveDownload, Info, Layers3, LayoutDashboard, Menu, Moon,
  RefreshCw, SearchCheck, Shield, ShieldAlert, ShieldCheck, SlidersHorizontal, Sun,
  Terminal, TrendingDown, TrendingUp, UploadCloud, X, XCircle, Zap
} from 'lucide-react';
import {comparisonVersions, downloadText, nfmt, parseCsv, pct, postJson, recordsToCsv, safeSerial, signed} from './utils.js';

import {PredictionCard} from './PredictionDetails.jsx';
import {ResearchDetails} from './ResearchDetails.jsx';

const LINKS = [
  { id:'overview', icon:LayoutDashboard, title:'ภาพรวม', subtitle:'Overview' },
  { id:'inspect', icon:SearchCheck, title:'ตรวจ CrystalDiskInfo', subtitle:'TXT Analyzer' },
  { id:'predict', icon:Gauge, title:'ทำนาย SMART CSV', subtitle:'Prediction' },
  { id:'evolution', icon:BarChart3, title:'ML Evolution', subtitle:'Research' },
  { id:'guide', icon:FileText, title:'การใช้งาน', subtitle:'Documentation' }
];
const METRICS = [
  { id:'recall', label:'Recall', unit:'%', better:'higher', detail:'สัดส่วนการตรวจพบเหตุการณ์เสียในช่วง 7 วัน' },
  { id:'precision', label:'Precision', unit:'%', better:'higher', detail:'สัดส่วนการแจ้งเตือนที่เป็นเหตุการณ์เสียจริง' },
  { id:'mcc', label:'MCC', unit:'', better:'higher', detail:'ค่าประเมินสมดุลภายใต้ข้อมูลไม่สมดุล' },
  { id:'fp', label:'False Positives', unit:'records', better:'lower', detail:'จำนวนการแจ้งเตือนผิดระดับ HDD-day' }
];
const ROCKET = 'DriveGuard ML v1.6 · React Edition';

function useHashPage(){
  const get=()=>{
    const v=window.location.hash.replace(/^#\/?/,'').split('?')[0];
    return LINKS.some(x=>x.id===v)?v:'overview';
  };
  const [page,setPage]=useState(get);
  useEffect(()=>{const update=()=>setPage(get());window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update)},[]);
  const go=(v)=>{window.location.hash=`/${v}`;setPage(v);window.scrollTo({top:0,behavior:'auto'});};
  return [page,go];
}
function useTheme(){
  const [theme,setTheme]=useState(()=>{
    try{return localStorage.getItem('driveguard_theme')||'light'}catch{return 'light'}
  });
  useEffect(()=>{
    document.documentElement.dataset.theme=theme;
    try{localStorage.setItem('driveguard_theme',theme)}catch{/* ignore */}
  },[theme]);
  return [theme,setTheme];
}
function SectionHeading({eyebrow,title,desc,aside}){return <div className="section-heading"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{desc&&<p>{desc}</p>}</div>{aside&&<div className="heading-aside">{aside}</div>}</div>}
function InfoTooltip({children}){return <span className="inline-help" title={children}><Info size={14}/></span>}
function StatusPill({type='neutral',children}){return <span className={`status-pill status-${type}`}><span className="status-dot"/>{children}</span>}
function PageIntro({eyebrow,title,desc,actions}){return <div className="page-intro"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div>{actions&&<div>{actions}</div>}</div>}
function StatCard({label,value,detail,icon:Icon,tone='teal',badge}){return <article className={`stat-card tone-${tone}`}><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={20}/></span></div><div className="stat-value">{value}</div><div className="stat-bottom"><span>{detail}</span>{badge&&<span className="stat-chip">{badge}</span>}</div></article>}
function DataDisclaimer({compact=false}){return <div className={`context-note ${compact?'compact':''}`} role="note"><Info size={17}/><p>ผลการทดลอง v4 มาจากการประเมินย้อนหลังบนข้อมูล Q2 2026 ที่เคยถูกตรวจสอบในรอบก่อนหน้า และค่าคะแนนโมเดล <strong>ยังไม่ใช่ความน่าจะเป็นที่ Calibrate แล้ว</strong> โปรดใช้เพื่อคัดกรองและสาธิต ไม่ใช่คำสั่งเปลี่ยน HDD อัตโนมัติ</p></div>}
function MetricVisualization({showTitle=true,versions=[]}){
  const [metric,setMetric]=useState('recall');
  const meta=METRICS.find(m=>m.id===metric);
  const data=versions;
  if (!data.length) return <p className="score-explanation">กำลังโหลดผลทดลอง…</p>;
  const max=Math.max(...data.map(d=>d[metric]));
  const fmt=(n)=>metric==='recall'?pct(n):metric==='precision'?pct(n,4):metric==='mcc'?n.toFixed(5):nfmt(n);
  return <div className="viz-panel">
    {showTitle&&<div className="viz-head"><div><h3>เปรียบเทียบโมเดล</h3><p>{meta.detail}</p></div><div className="legend"><span className="legend-dot v4"/>XGBoost v4 <span className="legend-dot smart"/>SMART Rule</div></div>}
    <div className="segment-tabs" role="group" aria-label="เลือก Metric สำหรับเปรียบเทียบ">
      {METRICS.map(m=><button key={m.id} className={metric===m.id?'active':''} aria-pressed={metric===m.id} onClick={()=>setMetric(m.id)}>{m.label}</button>)}
    </div>
    <div className="compare-rows">
      {data.map(item=><div className="compare-row" key={item.id}>
        <span className="compare-name">{item.label}</span><div className="compare-track"><div className={`compare-bar ${item.id}`} style={{width:`${Math.max(1,item[metric]/max*100)}%`}}/></div>
        <span className="compare-value">{fmt(item[metric])}</span>
      </div>)}
    </div>
    <div className="compare-foot"><Info size={15}/><span>{metric==='fp'?'False Positives ยิ่งน้อยยิ่งดี':'ค่าที่สูงกว่าไม่ได้แปลว่าดีกว่าทุกด้าน'} · เปรียบเทียบ v2–v4 และ SMART บน Test cohort เดียวกัน</span></div>
  </div>;
}
function Overview({go,health,dataset}){
  const versions=comparisonVersions(dataset), v4=versions.find(v=>v.id==='v4'), baseline=versions.find(v=>v.id==='smart');
  const drive=dataset?.versions.find(v=>v.id==='v4')?.drive_level;
  return <>
    <section className="hero">
      <div className="hero-content"><div className="hero-kicker"><span className="signal-dot"/> INTELLIGENT DISK HEALTH · RESEARCH PROTOTYPE</div>
        <h1>รู้ทันความเสี่ยง<br/><span>ก่อนข้อมูลสูญหาย</span></h1>
        <p>แพลตฟอร์มวิเคราะห์ SMART สำหรับ HDD ด้วย Machine Learning เชื่อมผลวิจัย Backblaze เข้ากับไฟล์ CrystalDiskInfo ที่ใช้งานได้จริง</p>
        <div className="hero-actions"><button className="btn btn-primary" onClick={()=>go('inspect')}><UploadCloud size={18}/> วิเคราะห์ CrystalDiskInfo <ArrowRight size={17}/></button><button className="btn btn-on-dark" onClick={()=>go('evolution')}>ดูผลการทดลอง <ArrowRight size={16}/></button></div>
        <div className="hero-meta"><span><ShieldCheck size={17}/> ไม่จัดเก็บไฟล์บนเซิร์ฟเวอร์</span><span><Activity size={17}/> XGBoost v4</span></div>
      </div>
      <div className="hero-art" aria-hidden="true"><div className="orbit o1"/><div className="orbit o2"/><div className="orbit o3"/><div className="disk-widget"><div className="disk-header"><span>DEVICE INTELLIGENCE</span><span className="micro-led"/></div><div className="disk-inner"><HardDrive size={52}/><div><strong>SMART ANALYTICS</strong><small>7-DAY FAILURE HORIZON</small></div></div><div className="pulse-line"><svg viewBox="0 0 300 52" preserveAspectRatio="none"><path d="M0 33 L30 33 L43 33 L52 12 L68 49 L83 26 L93 33 L125 33 L143 21 L158 33 L187 33 L206 5 L221 47 L238 33 L300 33" fill="none" stroke="#37d3c2" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/></svg></div><span className="disk-caption">DATA-DRIVEN DETECTION · NOT A DEVICE DIAGNOSIS</span></div></div>
    </section>
    <div className="page-inner">
      <div className="section-bar"><div><span className="eyebrow">MODEL PERFORMANCE · V4 RETROSPECTIVE TEST</span><h2>ผลลัพธ์ที่วัดได้จริง</h2></div><StatusPill type={health?.model_ready?'good':'neutral'}>{health?.model_ready?'API MODEL READY':'RESEARCH METRICS'}</StatusPill></div>
      <div className="stats-grid">
        <StatCard label="Recall · XGBoost v4" value={pct(v4?.recall)} detail={`เทียบ SMART Rule ${pct(baseline?.recall)}`} icon={TrendingUp} badge={v4&&baseline?`${signed((v4.recall-baseline.recall)*100)} pp`:null}/>
        <StatCard label="False Positives" value={nfmt(v4?.fp)} detail={`HDD-days · SMART Rule ${nfmt(baseline?.fp)}`} icon={TrendingDown} tone="blue"/>
        <StatCard label="Drive-level Recall" value={pct(drive?.recall)} detail={`ตรวจพบ HDD ${nfmt(drive?.detected_drives)} / ${nfmt(drive?.failed_drives)} ลูกในกลุ่ม failure window`} icon={HardDrive} tone="violet"/>
        <StatCard label="ML Inference Engine" value="XGBoost v4" detail={`เกณฑ์แจ้งเตือน ${v4?.threshold?.toFixed(4)??'—'} · คะแนนยังไม่ใช่ความน่าจะเป็น`} icon={Zap} tone="slate"/>
      </div>
      <div className="section-grid">
        <div className="panel"><div className="panel-header"><div><h3>ผลเปรียบเทียบกับ SMART Rule</h3><p>เลือก Metric เพื่อดูข้อแลกเปลี่ยนระหว่าง Recall กับ False Alarms</p></div><BarChart3 size={20}/></div><MetricVisualization showTitle={false} versions={versions}/></div>
        <div className="panel action-panel"><div className="panel-header"><div><h3>เริ่มต้นใช้งาน</h3><p>นำไฟล์จากเครื่องของคุณมาวิเคราะห์ได้ทันที</p></div><Layers3 size={21}/></div>
          <button className="action-choice" onClick={()=>go('inspect')}><span className="action-icon teal"><FileText size={24}/></span><span><strong>CrystalDiskInfo TXT</strong><small>ตรวจสุขภาพ HDD / SSD พร้อมคำอธิบาย SMART</small></span><ChevronRight size={19}/></button>
          <button className="action-choice" onClick={()=>go('predict')}><span className="action-icon blue"><FileSpreadsheet size={23}/></span><span><strong>SMART CSV Prediction</strong><small>ทำนายด้วยข้อมูลย้อนหลังที่ครบเกณฑ์</small></span><ChevronRight size={19}/></button>
          <button className="action-choice" onClick={()=>go('evolution')}><span className="action-icon purple"><BarChart3 size={23}/></span><span><strong>ML Research Evolution</strong><small>ศึกษาโมเดล v1–v4 และ SMART Rule</small></span><ChevronRight size={19}/></button>
          <div className="action-note"><Shield size={17}/> หากอุปกรณ์ไม่รองรับ ระบบจะไม่แต่งคะแนนความเสี่ยง</div>
        </div>
      </div>
      <DataDisclaimer/>
    </div>
  </>;
}
function FileDrop({files, onFiles, accept, multiple=false, icon:Icon=UploadCloud, title, subtitle, maxFiles=30}){
  const input=useRef(null);const [dragging,setDragging]=useState(false);
  const pick=(f)=>{if(!f?.length)return;onFiles(Array.from(f).slice(0,maxFiles));};
  return <div className={`file-drop ${dragging?'dragging':''}`} role="group" aria-label={title} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={e=>{e.preventDefault();setDragging(false)}} onDrop={e=>{e.preventDefault();setDragging(false);pick(e.dataTransfer.files)}}>
    <input ref={input} type="file" accept={accept} multiple={multiple} className="visually-hidden" aria-label={title} onChange={e=>{pick(e.target.files);e.target.value=''}}/>
    <span className="file-drop-icon"><Icon size={27}/></span><h3>{title}</h3><p>{subtitle}</p>
    <button type="button" className="btn btn-outline" onClick={()=>input.current?.click()}><CloudUpload size={17}/> เลือกไฟล์จากเครื่อง</button>
    <small>หรือลากไฟล์มาวางที่นี่ · ไม่จัดเก็บไฟล์หลังประมวลผล</small>
    {!!files?.length&&<div className="selected-files"><FileCheck2 size={16}/><span>{files.length} ไฟล์ · {files.map(x=>x.name).join(', ')}</span><button className="icon-btn" title="ล้างไฟล์ที่เลือก" aria-label="ล้างไฟล์" onClick={()=>onFiles([])}><X size={16}/></button></div>}
  </div>;
}
function ErrorBox({message}){return message?<div className="error-notice" role="alert"><AlertCircle size={19}/><span>{message}</span></div>:null}
function PendingHint({text}){return <div className="empty-result"><div className="empty-graphic"><HardDriveDownload size={35}/></div><strong>ยังไม่มีผลวิเคราะห์</strong><p>{text}</p></div>}
function InspectionCard({device}){
  const isHdd=device.kind==='ATA HDD';const issues=device.issues||[];const ml=device.ml||{};
  return <article className="device-card"><div className="device-head"><div className={`drive-symbol ${isHdd?'hdd':'ssd'}`}><HardDrive size={25}/></div><div className="device-identity"><div className="device-label">{device.kind} · {device.interface||'Interface ไม่ระบุ'}</div><h3>{device.model}</h3><p>Serial {safeSerial(device.serial_number)} · {device.date}</p></div><StatusPill type={device.inspection==='needs_review'?'warning':isHdd?'neutral':'neutral'}>{device.inspection==='needs_review'?'ตรวจสอบเพิ่ม':isHdd?'SMART Inspection':'ML ไม่รองรับ SSD'}</StatusPill></div>
    <div className="device-stats"><div><span>อุณหภูมิ</span><strong>{device.temperature_c??'—'}<small> °C</small></strong></div><div><span>ชั่วโมงทำงาน</span><strong>{nfmt(device.power_on_hours)}</strong></div><div><span>Health จากโปรแกรม</span><strong className="small-text">{device.health_reported||'ไม่ได้ระบุ'}</strong></div></div>
    <div className="device-section"><div className="subheading"><ClipboardCheck size={17}/> SMART Findings</div>
    <div className="issue-stack">{issues.map((issue,i)=><div className={`issue issue-${issue.severity}`} key={`${issue.code}-${i}`}><span>{issue.severity==='warning'?<AlertTriangle size={17}/>:<Info size={17}/>}</span><p>{issue.message}</p></div>)}</div></div>
    <div className="ml-conclusion"><div><span className="subheading"><Activity size={17}/> ML · Failure within 7 days</span><p>{ml.assessment==='experimental_ml'?'มีข้อมูลครบตามเกณฑ์สำหรับการประเมินแบบทดลอง':isHdd?'ข้อมูลยังไม่เพียงพอ หรือรุ่น HDD ไม่อยู่ในชุดฝึก — ระบบงดคาดการณ์':'NVMe/SSD ไม่ใช่ขอบเขตการฝึกโมเดล HDD'}</p>
      {!!ml.warnings?.length&&<div className="minor-warnings">{(ml.reasons?.length?ml.reasons.map(r=>r.message_th):ml.warnings).map((s,i)=><small key={i}>{s}</small>)}</div>}</div><div className="conclusion-score">{typeof ml.score==='number'?<><strong>{ml.score.toFixed(4)}</strong><small>{ml.alert?'คะแนนถึงเกณฑ์แจ้งเตือน':'คะแนนต่ำกว่าเกณฑ์'} · {ml.threshold?.toFixed(4)}</small></>:<><strong>—</strong><small>ไม่ออกคะแนน</small></>}</div></div>
    </article>;
}
function Inspect({health}){
  const [files,setFiles]=useState([]);const [loading,setLoading]=useState(false);const [result,setResult]=useState(null);const [error,setError]=useState('');
  const start=async()=>{setError('');setResult(null);if(!files.length)return setError('กรุณาเลือก TXT ของ CrystalDiskInfo ก่อน');if(files.length>30)return setError('รองรับสูงสุด 30 รายงานต่อครั้ง');
    if(files.some(f=>!f.name.toLowerCase().endsWith('.txt')))return setError('กรุณาเลือกไฟล์นามสกุล .txt เท่านั้น');
    if(files.some(f=>f.size>400000)||files.reduce((n,f)=>n+f.size,0)>1800000)return setError('ไฟล์เกินข้อจำกัด: ไม่เกิน 400 KB ต่อไฟล์ และรวมไม่เกิน 1.8 MB');
    setLoading(true);try{const reports=await Promise.all(files.map(async f=>({filename:f.name,text:await f.text()})));setResult(await postJson('/api/crystaldiskinfo',{reports,model:'XGBoost v4'}));}catch(e){setError(e.message)}finally{setLoading(false)}
  };
  const exportCsv=()=>{if(!result?.converted_hdd_records?.length)return;downloadText(recordsToCsv(result.converted_hdd_records),'driveguard_cdi_ata_hdd.csv','text/csv;charset=utf-8')};
  return <div className="page-inner content-page"><PageIntro eyebrow="01 / DIAGNOSTICS" title="วิเคราะห์ CrystalDiskInfo" desc="อัปโหลดรายงาน .txt จาก CrystalDiskInfo ได้โดยตรง รองรับรายงานหลายวันและอุปกรณ์หลายลูกในไฟล์เดียว" actions={<StatusPill type={health?.model_ready?'good':'neutral'}>READ-ONLY SMART INSPECTION</StatusPill>}/>
    <div className="two-column"><div><div className="panel upload-panel"><div className="panel-header"><div><h3>นำเข้ารายงานอุปกรณ์</h3><p>รองรับ ATA HDD และ NVMe/SSD สำหรับการตรวจ SMART</p></div><FileText size={21}/></div>
      <FileDrop files={files} onFiles={setFiles} accept=".txt,text/plain" multiple title="วางไฟล์ CrystalDiskInfo .txt" subtitle="เลือก TXT ครั้งเดียวหรือหลายวันของ HDD เดียวกัน"/>
      <div className="hint-list"><span><Check size={15}/> ถอดรหัส SMART Hex ให้ถูกต้อง</span><span><Check size={15}/> แยก HDD/SSD อัตโนมัติ</span><span><Check size={15}/> คะแนน ML เฉพาะข้อมูลที่รองรับ</span></div>
      <button className="btn btn-primary full" disabled={loading||!files.length} onClick={start}>{loading?<RefreshCw size={18} className="spin"/>:<SearchCheck size={18}/>} {loading?'กำลังตรวจข้อมูล…':'เริ่มวิเคราะห์อุปกรณ์'} <ArrowRight size={17}/></button><ErrorBox message={error}/></div>
      <div className="help-card"><div className="help-icon"><Info size={20}/></div><div><strong>วิธี Export ไฟล์จาก CrystalDiskInfo</strong><p>เปิด CrystalDiskInfo → File → Save (Text) → เลือก TXT มาอัปโหลด หากต้องการสร้างแนวโน้ม ให้บันทึกไฟล์หลายวันต่อเนื่องกัน</p></div></div></div>
      <div className="result-side"><div className="panel result-panel"><div className="panel-header"><div><h3>ผลตรวจอุปกรณ์</h3><p>แสดงผลจริงจากข้อมูลที่อัปโหลด ไม่แต่งคะแนนความเสี่ยง</p></div>{result&&<StatusPill type="good">{result.devices.length} DEVICES</StatusPill>}</div>
        {result?<><div className="result-overview"><span><strong>{result.devices.length}</strong> อุปกรณ์</span><span><strong>{result.reports_received}</strong> รายงาน</span><span><strong>{result.distinct_snapshots}</strong> Snapshots</span></div>
        <div className="device-list">{result.devices.map((d,i)=><InspectionCard key={`${d.model}-${i}`} device={d}/>)}</div>
        {!!result.converted_hdd_records?.length&&<button className="btn btn-outline" onClick={exportCsv}><Download size={17}/> ดาวน์โหลด SMART CSV สำหรับ HDD</button>}</>:<PendingHint text="อัปโหลด CrystalDiskInfo TXT เพื่อแสดงอุปกรณ์, ค่า SMART, ประเด็นที่ต้องตรวจ และความพร้อมในการทำนาย"/>}
      </div></div></div><div className="minor-note"><ShieldCheck size={16}/> ไม่ส่งไฟล์ให้บุคคลภายนอก ไม่มีการเก็บข้อมูลลงฐานข้อมูลใน API นี้</div>
  </div>
}
function Predict({health}){
  const [files,setFiles]=useState([]), [engine,setEngine]=useState('XGBoost v4'), [error,setError]=useState(''), [loading,setLoading]=useState(false), [response,setResponse]=useState(null), [upload,setUpload]=useState(null);
  const request=useRef({id:0,controller:null});
  useEffect(()=>()=>{request.current.id++;request.current.controller?.abort()},[]);
  const reset=()=>{request.current.id++;request.current.controller?.abort();setLoading(false);setResponse(null);setUpload(null);setError('')};
  const changeFiles=value=>{reset();setFiles(value)};
  const onRun=async()=>{
    reset();if(!files[0])return setError('เลือก CSV ก่อน');
    if(files[0].size>1600000)return setError('ขนาด CSV ไม่ควรเกิน 1.6 MB ต่อครั้ง');
    const id=++request.current.id,controller=new AbortController();request.current.controller=controller;
    const file=files[0],selectedEngine=engine;setLoading(true);
    try{const rows=parseCsv(await file.text());if(id!==request.current.id)return;
      const result=await postJson('/api/predict',{model:selectedEngine,records:rows},controller.signal);
      if(id!==request.current.id)return;setResponse(result);setUpload({name:file.name,rows:rows.length});
    }catch(e){if(id===request.current.id&&e.name!=='AbortError')setError(e.message)}finally{if(id===request.current.id)setLoading(false)}
  };
  const scored=response?.results.filter(r=>r.assessment==='experimental_ml')||[];
  return <div className="page-inner content-page"><PageIntro eyebrow="02 / ML PREDICTION" title="ประเมินความเสี่ยง HDD เสียภายใน 7 วัน" desc="ใช้ประวัติ SMART รายวันและรุ่น HDD ที่อยู่ในชุดฝึก เพื่อประเมิน 7 วันถัดจากวันที่ข้อมูลล่าสุด" actions={<StatusPill type={health?.model_ready?'good':'warning'}>{health?.model_ready?'ระบบพร้อมประเมิน':'ตรวจสอบการเชื่อมต่อ API'}</StatusPill>}/>
    <div className="two-column predict-layout"><div><div className="panel upload-panel"><div className="panel-header"><div><h3>ข้อมูลสำหรับโมเดล</h3><p>ต้องมี date, serial_number, model และค่า smart_*_raw</p></div><Database size={21}/></div>
      <FileDrop files={files} onFiles={changeFiles} maxFiles={1} accept=".csv,text/csv" title="อัปโหลด SMART CSV" subtitle="สูงสุด 3,000 แถว · 100 HDD · 1.6 MB ต่อครั้ง"/>
      <label className="field-label" htmlFor="model-select">โมเดลที่ใช้วิเคราะห์</label>
      <div className="select-shell"><select id="model-select" value={engine} onChange={e=>{reset();setEngine(e.target.value)}}>{(health?.available_models||['XGBoost v4','Random Forest','XGBoost','Decision Tree','Logistic Regression']).map(v=><option key={v} value={v}>{v}{v==='XGBoost v4'?' · โมเดลหลัก':' · รุ่นทดลอง v1'}</option>)}</select><ChevronDown size={17}/></div>
      <div className="field-caption"><Info size={15}/> {engine==='XGBoost v4'?'v4 ประเมินย้อนหลังบนชุด Test เดียวกับ v2/v3':'โมเดลตัวเลือกนี้เป็น artifact ของ v1 ไม่ใช่โมเดล v2/v3 ในหน้าผลวิจัย'}</div>
      <button className="btn btn-primary full" disabled={loading||!files.length} onClick={onRun}>{loading?<RefreshCw className="spin" size={18}/>:<Gauge size={18}/>} {loading?'กำลังประเมิน…':'เริ่มประเมินข้อมูล'} <ArrowRight size={17}/></button><ErrorBox message={error}/></div>
      <div className="help-card"><div className="help-icon"><FileClock size={20}/></div><div><strong>ตรวจความพร้อมแยกแต่ละ HDD</strong><p>ต้องมีอย่างน้อย 8 วันล่าสุดต่อเนื่องกัน และ SMART ที่ใช้ได้ครบช่วงอย่างน้อย 8 ตัว โดยต้องมี 5, 187, 197, 198 ครบ ไม่มีค่าติดลบ และเป็นรุ่นที่อยู่ในชุดฝึก</p></div></div>
      <div className="panel sample-files"><h3>ไฟล์ทดลอง 3 กรณี</h3><p>ข้อมูลสังเคราะห์สำหรับทดสอบระบบ ไม่ใช้วัดความแม่นยำ</p>{[['01_Normal.csv','ปกติจำลอง · 10 วัน'],['02_Rising_Errors.csv','error เพิ่มต่อเนื่อง · 10 วัน'],['03_Mixed_Scenarios.csv','รวม 4 HDD · ประวัติสั้นและรุ่นไม่รองรับ']].map(([file,label])=><a key={file} href={`/data/${file}`} download><FileSpreadsheet size={17}/><span>{label}</span><Download size={16}/></a>)}</div>
    </div><div className="result-side"><div className="panel result-panel" aria-live="polite" aria-busy={loading}><div className="panel-header"><div><h3>ผลการประเมิน</h3><p>{response?`ผลจาก ${response.engine} · ${upload?.name}`:'เลือกไฟล์และโมเดล แล้วกดเริ่มประเมินข้อมูล'}</p></div></div>
    {response?<><div className="result-overview"><span><strong>{response.results.length}</strong> HDD ทั้งหมด</span><span><strong>{scored.filter(r=>r.alert).length}</strong> พบสัญญาณเสี่ยง</span><span><strong>{scored.filter(r=>!r.alert).length}</strong> ไม่พบตามเกณฑ์</span><span><strong>{response.results.length-scored.length}</strong> ประเมินไม่ได้</span></div>
      <p className="score-explanation">นำเข้า {nfmt(upload.rows)} แถว · ใช้ {nfmt(response.total_rows_used)} แถวหลังจัดการข้อมูลซ้ำ · เกณฑ์ของ {response.engine}: {response.threshold.toFixed(4)}</p>
      <div className="prediction-stack">{response.results.map((r,i)=><PredictionCard key={`${r.model}-${r.serial_number}`} result={r} engine={response.engine} index={i}/>)}</div>
      <div className="context-note"><Info size={17}/><p>ผลจาก {response.engine} เป็นคะแนนคัดกรองที่ยังไม่ใช่เปอร์เซ็นต์โอกาสเสีย {response.research_version==='v4'?'โมเดล v4 ผ่านการประเมินย้อนหลัง ซึ่งไม่ใช่การทดสอบข้อมูลใหม่ที่ไม่เคยเห็นมาก่อน':''}</p></div>
      </>:<PendingHint text={loading?'กำลังตรวจข้อมูลและประเมินความเสี่ยง…':'ผลจะแสดงคะแนน เกณฑ์แจ้งเตือน และเหตุผลเมื่อประเมินไม่ได้ หากเปลี่ยนไฟล์หรือโมเดลต้องประเมินใหม่'}/>}
    </div></div></div>
  </div>
}
function Evolution({dataset,error}){
  if(!dataset)return <div className="page-inner content-page"><PageIntro eyebrow="03 / RESEARCH & EXPERIMENTS" title="ML Evolution" desc="ผลทดลอง v1–v4"/>{error?<ErrorBox message={error}/>:<p>กำลังโหลดผลทดลอง…</p>}</div>;
  const versions=comparisonVersions(dataset),v4=versions.find(v=>v.id==='v4'),v3=versions.find(v=>v.id==='v3'),baseline=versions.find(v=>v.id==='smart');
  return <div className="page-inner content-page"><PageIntro eyebrow="03 / RESEARCH & EXPERIMENTS" title="ML Evolution · v1 → v4" desc="เปรียบเทียบผล Test และข้อแลกเปลี่ยนของการตรวจพบกับการแจ้งเตือนผิด โดยแยก v1 ที่ใช้ชุด Test ต่างกัน"/>
    <div className="evolution-banner"><div><span className="eyebrow">V4 · RETROSPECTIVE TEST</span><h2>เลือก v4 ตามเป้าหมาย Recall และ False Positives เทียบ SMART</h2><p>Recall สูงขึ้น {((v4.recall-baseline.recall)*100).toFixed(2)} จุดเปอร์เซ็นต์ และ False Positives ลดลง {((baseline.fp-v4.fp)/baseline.fp*100).toFixed(2)}% บนชุด Test เดียวกัน</p></div></div>
    <div className="stats-grid three"><StatCard label="SMART Rule Recall" value={pct(baseline.recall)} detail="Baseline แบบไม่ใช้ ML" icon={ShieldAlert} tone="slate"/><StatCard label="XGBoost v4 Recall" value={pct(v4.recall)} detail={`เทียบ v3 ${pct(v3.recall)}`} icon={TrendingUp}/><StatCard label="False Positives ลดลงจาก SMART" value={nfmt(baseline.fp-v4.fp)} detail="จำนวนแถว HDD-day ในชุด Test" icon={TrendingDown} tone="blue"/></div>
    <div className="context-note tradeoff-note"><Info size={20}/><p><strong>v4 ตรวจพบมากขึ้น แต่ v3 แจ้งเตือนผิดน้อยกว่า</strong><br/>v4 มี FP {nfmt(v4.fp)} เทียบ v3 {nfmt(v3.fp)} และ Precision {pct(v4.precision,4)} เทียบ {pct(v3.precision,4)} การเลือก v4 จึงเป็นการเลือกตามเป้าหมายโครงการ ไม่ได้ดีที่สุดทุกตัวชี้วัด</p></div>
    <div className="section-grid"><div className="panel"><div className="panel-header"><div><h3>เปรียบเทียบ v2–v4 กับ SMART</h3><p>ตัวเลขจากผล Test ที่บันทึกไว้ชุดเดียวกัน</p></div><BarChart3 size={20}/></div><MetricVisualization showTitle={false} versions={versions}/></div><div className="panel experiment-panel"><div className="panel-header"><div><h3>กระบวนการปรับปรุงโมเดล</h3><p>เลือกค่าด้วย Validation แล้วรายงานผล Test</p></div><SlidersHorizontal size={20}/></div><div className="timeline">
      {[['v1','Baseline','เปรียบเทียบ LR, DT, RF และ XGBoost บน Q2 · Test คนละชุด'],['v2','Class Imbalance','ขยายข้อมูลเป็น Q1–Q2 ปรับ Weight และ Threshold'],['v3','Fine-tuning','ปรับโมเดลเพื่อลดการแจ้งเตือนผิดและเพิ่ม MCC'],['v4','Optuna Trial 23','เลือกด้วยเงื่อนไข Recall และ FP เทียบ SMART บน Validation']].map(([v,h,d])=><div className="timeline-row" key={v}><span className={`version-token ${v}`}>{v}</span><div><strong>{h}</strong><p>{d}</p></div></div>)}
    </div></div></div>
    <div className="panel table-panel"><div className="panel-header"><div><h3>ผลเปรียบเทียบที่ใช้รายงาน · Test</h3><p>PR-AUC ที่ไม่ได้รายงานจะแสดงว่าไม่มีข้อมูล ไม่แทนด้วยศูนย์</p></div><ClipboardCheck size={19}/></div><div className="table-scroller"><table><thead><tr><th>Metric</th><th>SMART Rule</th><th>XGBoost v2</th><th>XGBoost v3</th><th>XGBoost v4</th></tr></thead><tbody>
      {[['Recall','recall'],['Precision','precision'],['F1','f1'],['MCC','mcc'],['PR-AUC','pr_auc'],['False Positives','fp'],['Threshold','threshold']].map(([label,key])=><tr key={key}><th>{label}</th>{[versions[3],versions[0],versions[1],versions[2]].map(v=><td key={v.id}>{v[key]==null?'ไม่ได้รายงาน':key==='fp'?nfmt(v[key]):['recall','precision'].includes(key)?pct(v[key],key==='precision'?4:2):v[key].toFixed(5)}</td>)}</tr>)}
    </tbody></table></div></div>
    <ResearchDetails dataset={dataset}/>
    <p className="experiment-source">แหล่งข้อมูล: บันทึกผลทดลองโครงการ v1–v4 · <a href="/data/ml_evolution.json" download>ดาวน์โหลดข้อมูลผลทดลอง</a></p><DataDisclaimer/>
  </div>
}
function Guide({go,health}){
  return <div className="page-inner content-page"><PageIntro eyebrow="04 / DOCUMENTATION" title="คู่มือการใช้งาน DriveGuard" desc="เลือกชนิดข้อมูลที่ต้องการวิเคราะห์และอ่านความหมายของผลลัพธ์อย่างถูกต้อง"/>
    <div className="guide-steps"><div className="guide-step"><div className="guide-num">01</div><div className="guide-copy"><div className="guide-icon"><FileText size={23}/></div><h3>TXT · CrystalDiskInfo</h3><p>ส่งออกรายงาน Text จาก CrystalDiskInfo แล้วอัปโหลด เว็บไซต์จะแยก ATA HDD กับ NVMe/SSD และอธิบายค่า SMART รายตัว</p><button className="text-link" onClick={()=>go('inspect')}>เปิด TXT Analyzer <ArrowRight size={16}/></button></div></div>
    <div className="guide-step"><div className="guide-num">02</div><div className="guide-copy"><div className="guide-icon"><FileSpreadsheet size={23}/></div><h3>CSV · Backblaze SMART</h3><p>ส่งข้อมูล SMART รายวันของ HDD เดียวกันต่อเนื่องอย่างน้อย 8 วัน ต้องมี date, model, serial_number และ SMART attributes ที่โมเดลรองรับ</p><button className="text-link" onClick={()=>go('predict')}>เปิด CSV Prediction <ArrowRight size={16}/></button></div></div>
    <div className="guide-step"><div className="guide-num">03</div><div className="guide-copy"><div className="guide-icon"><Activity size={23}/></div><h3>อ่านผลด้วยความเข้าใจ</h3><p>“งดคาดการณ์” ไม่ได้แปลว่า HDD ปลอดภัย ส่วนค่าคะแนน ML ไม่ใช่โอกาสเสียร้อยละที่ได้รับการ Calibrate แล้ว</p><button className="text-link" onClick={()=>go('evolution')}>ดูผลวิจัย <ArrowRight size={16}/></button></div></div></div>
    <div className="section-grid"><div className="panel"><div className="panel-header"><div><h3>ระบบที่ใช้งานอยู่</h3><p>Architecture ของ DriveGuard React Edition</p></div><Code2 size={20}/></div><div className="stack-list"><div><span>Frontend</span><strong>React 19 + Vite 6</strong></div><div><span>Backend</span><strong>FastAPI · Python</strong></div><div><span>Active inference</span><strong>XGBoost v4</strong></div><div><span>Data processing</span><strong>In memory · No persistence</strong></div><div><span>API status</span><strong>{health?.model_ready?'Model loaded':health?.status==='unavailable'?'Model unavailable':'Not verified yet'}</strong></div></div></div>
    <div className="panel"><div className="panel-header"><div><h3>ข้อจำกัดสำคัญ</h3><p>ข้อควรทราบก่อนใช้ผลเพื่อการตัดสินใจ</p></div><Shield size={20}/></div><div className="limitations"><div><AlertTriangle size={18}/><span>โมเดล v4 ฝึกจากข้อมูล Backblaze HDD ไม่รองรับการทำนาย SSD/NVMe</span></div><div><AlertTriangle size={18}/><span>HDD รุ่นที่ไม่พบในชุดฝึกและ Snapshot เดียวต้องงดการทำนาย</span></div><div><AlertTriangle size={18}/><span>ข้อมูลย้อนหลังจาก v2/v3 ถูกใช้สำรวจแล้ว จึงไม่ใช่ Blind Test ครั้งแรก</span></div><div><AlertTriangle size={18}/><span>ควรสำรองข้อมูลเสมอ ไม่ใช้คะแนนนี้สั่งเปลี่ยนอุปกรณ์อัตโนมัติ</span></div></div></div></div>
  </div>;
}
function Sidebar({active,go,theme,setTheme,health,open,setOpen}){
  return <><div className={`sidebar-backdrop ${open?'visible':''}`} onClick={()=>setOpen(false)}/><aside className={`sidebar ${open?'sidebar-open':''}`}><div className="sidebar-brand"><div className="brand-icon"><HardDrive size={24}/></div><div><strong>DriveGuard<span> ML</span></strong><small>INTELLIGENT DISK HEALTH</small></div><button className="icon-btn close-mobile" title="ปิดเมนู" aria-label="ปิดเมนู" onClick={()=>setOpen(false)}><X size={20}/></button></div>
    <div className="sidebar-navigation"><div className="sidebar-label">WORKSPACE</div><nav aria-label="เมนูหลัก">{LINKS.map(link=>{const Icon=link.icon;return <button key={link.id} className={`nav-item ${link.id===active?'current':''}`} aria-current={active===link.id?'page':undefined} onClick={()=>{go(link.id);setOpen(false)}}><Icon size={20}/><span><strong>{link.title}</strong><small>{link.subtitle}</small></span>{active===link.id&&<span className="active-indicator"/>}</button>})}</nav></div>
    <div className="sidebar-bottom"><div className="server-state"><div className="server-top"><span className="server-led" style={{background:health?.model_ready?'#33c7ae':undefined}}/><span>ENGINE STATUS</span></div><strong>{health?.model_ready?`${health.model} · โมเดลหลักพร้อมใช้`:health?.status==='unavailable'?'Model unavailable':'API Not Verified'}</strong><small>7-day failure classification</small></div>
      <button className="theme-toggle" onClick={()=>setTheme(theme==='light'?'dark':'light')} aria-label="สลับธีมมืดสว่าง">{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}<span>{theme==='light'?'Dark Mode':'Light Mode'}</span><span className="kbd">{theme==='light'?'◐':'☀'}</span></button>
      <div className="sidebar-foot"><span>v1.6 · React Edition</span><span>Research Prototype</span></div></div>
  </aside></>;
}
export default function App(){
  const [page,go]=useHashPage();const [theme,setTheme]=useTheme();const [menu,setMenu]=useState(false);const [health,setHealth]=useState(null);
  const [dataset,setDataset]=useState(null),[researchError,setResearchError]=useState('');
  useEffect(()=>{const controller=new AbortController();fetch('/data/ml_evolution.json',{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(d=>{if(!['v2','v3','v4'].every(id=>d.versions?.some(v=>v.id===id&&v.metrics)))throw new Error();setDataset(d)}).catch(e=>{if(e.name!=='AbortError')setResearchError('โหลดผลทดลองไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ')});return()=>controller.abort()},[]);
  useEffect(()=>{let active=true;fetch('/api/health',{cache:'no-store'}).then(r=>r.json()).then(data=>{if(active)setHealth(data)}).catch(()=>{if(active)setHealth({status:'offline',model_ready:false})});return()=>{active=false}},[]);
  const current=LINKS.find(x=>x.id===page)??LINKS[0];
  return <div className="app-shell"><Sidebar active={page} go={go} theme={theme} setTheme={setTheme} health={health} open={menu} setOpen={setMenu}/>
    <div className="app-main"><header className="topbar"><button className="icon-btn mobile-menu" onClick={()=>setMenu(true)} aria-label="เปิดเมนู"><Menu size={24}/></button><div className="breadcrumbs"><span>DriveGuard ML</span><ChevronRight size={15}/><strong>{current.title}</strong></div><div className="top-actions"><span className="top-version">REACT · V1.6</span><span className={`api-indicator ${health?.model_ready?'on':'off'}`}><span/>{health?.model_ready?'API Connected':'API Checking'}</span><button className="icon-btn top-theme" onClick={()=>setTheme(theme==='light'?'dark':'light')} aria-label="เปลี่ยนธีม">{theme==='light'?<Moon size={19}/>:<Sun size={19}/>}</button></div></header>
      <main id="main-content">{page==='overview'?<><ErrorBox message={researchError}/><Overview go={go} health={health} dataset={dataset}/></>:page==='inspect'?<Inspect health={health}/>:page==='predict'?<Predict health={health}/>:page==='evolution'?<Evolution dataset={dataset} error={researchError}/>:<Guide go={go} health={health}/>}</main>
      <footer className="site-footer"><span>© 2026 DriveGuard ML · React Edition</span><span>Academic Research Prototype · Not a production failure guarantee</span></footer>
    </div>
  </div>;
}
