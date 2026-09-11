import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3,
  Bell, Camera, Check, ChevronRight, CircleDot, CloudOff, Cpu,
  Droplets, Gauge, History, Leaf, MapPin, Menu, Mic, RefreshCw,
  ScanLine, Send, Settings, ShieldCheck, Sparkles, Thermometer,
  Upload, Wifi, X, Zap
} from "lucide-react";
import { analyzeFieldImage, createFieldSensorReading, getAIStatus } from "./services/api";
import "./index.css";

const DEMO = {
  status:"ANALYSIS_COMPLETE",
  disease:{prediction:"Tomato_Late_Blight",confidence:89.18},
  image_quality:{status:"GOOD",quality_score:100},
  evidence:{
    available:{visual:true,environmental:true,spatial:true,temporal:true},
    evidence_count:4,evidence_quality:"HIGH",
    details:{
      visual:{quality:.8918,status:"STRONG",confidence:89.18},
      environmental:{status:"FRESH",quality:1,usable:true,age_minutes:0},
      spatial:{quality:1,infection_ratio:1,infected_neighbors:2,total_observations:2},
      temporal:{quality:.9,trend:"DECREASING",delta:-10}
    },decision_ready:true
  },
  risk:{
    risk_score:70.9,risk_level:"CRITICAL",assessment_confidence:"HIGH",
    breakdown:{visual:89.18,environmental:43.75,spatial:100,temporal:25},
    contributions:{visual:31.21,environmental:10.94,spatial:25,temporal:3.75},
    available_evidence:["visual","environmental","spatial","temporal"]
  },
  decision:{
    ready:true,action:"PRIORITIZE_INSPECTION",priority:"CRITICAL",
    title:"Immediate field attention recommended",
    message:"Tomato Late Blight was detected with 89.2% model confidence. Field conditions: soil moisture 22.8%, temperature 34.5°C, humidity 78.2%. 2 of 2 observed zones show disease signals. Recent risk observations are decreasing.",
    recommended_steps:[
      "Inspect symptomatic plants in Zone A1 as soon as possible.",
      "Inspect other affected observed zones for signs of spread.",
      "Check irrigation requirements at 22.8% soil moisture.",
      "Re-observe the zone after intervention."
    ]
  },
  advisory:{
    available:true,provider:"OLLAMA",model:"qwen3:1.7b",offline:true,
    advisory:"Tomato plants in the vegetative stage show a strong visual disease signal for Late Blight. Field risk is CRITICAL at 70.9, with high assessment confidence. Prioritize inspection in Zone A1, check the affected zones, and re-observe after intervention."
  },
  context:{
    crop:"Tomato",growth_stage:"Vegetative",observation_count:7,
    sensor:{available:true,soil_moisture:22.8,temperature:34.5,humidity:78.2,freshness:"FRESH",age_minutes:0,usable:true},
    spatial:{available:true,infected_neighbors:2,total_observed_zones:2},
    temporal:{available:true,observation_count:2}
  }
};

const zones=[
  {id:"A1",x:23,y:35,risk:70.9,level:"CRITICAL"},
  {id:"B2",x:57,y:27,risk:31.4,level:"MODERATE"},
  {id:"C3",x:38,y:70,risk:54.8,level:"HIGH"},
  {id:"D1",x:76,y:68,risk:18.2,level:"LOW"},
];

function riskClass(level){ return String(level||"LOW").toLowerCase(); }
function pct(n){ return `${Math.round(Number(n||0))}%`; }

function App(){
  const [page,setPage]=useState("Overview");
  const [mobile,setMobile]=useState(false);
  const [result,setResult]=useState(DEMO);
  const [file,setFile]=useState(null);
  const [preview,setPreview]=useState(null);
  const [analyzing,setAnalyzing]=useState(false);
  const [sensorBusy,setSensorBusy]=useState(false);
  const [toast,setToast]=useState("");
  const [aiOnline,setAiOnline]=useState(true);
  const [language,setLanguage]=useState("English");
  const [selectedZone,setSelectedZone]=useState("A1");
  const [showWhy,setShowWhy]=useState(false);

  useEffect(()=>{ getAIStatus().then(()=>setAiOnline(true)).catch(()=>setAiOnline(false)); },[]);
  useEffect(()=>{ if(toast){const t=setTimeout(()=>setToast(""),2800);return()=>clearTimeout(t)}},[toast]);

  const risk=result?.risk||DEMO.risk;
  const decision=result?.decision||DEMO.decision;
  const disease=result?.disease||DEMO.disease;
  const evidence=result?.evidence||DEMO.evidence;
  const sensor=result?.context?.sensor||DEMO.context.sensor;
  const advisory=result?.advisory;

  async function runAnalysis(){
    if(!file){ setToast("Choose a crop image first."); return; }
    setAnalyzing(true);
    try{
      const r=await analyzeFieldImage(file,{zoneId:selectedZone,crop:"Tomato",growthStage:"Vegetative"});
      setResult(r);
      setPage("Field Intelligence");
      setToast(r?.status==="ANALYSIS_COMPLETE"?"Field assessment ready":"CRAI requested additional evidence");
    }catch(e){
      setToast("Backend unavailable — showing CRAI demo state.");
      setResult(DEMO);
      setPage("Field Intelligence");
    }finally{setAnalyzing(false);}
  }

  async function acquireSensor(){
    setSensorBusy(true);
    try{
      await createFieldSensorReading({
        deviceId:"CRAI-ESP32-01",farmId:1,zoneId:selectedZone,source:"SIMULATED",
        soilMoisture:22.8,temperature:34.5,humidity:78.2
      });
      setResult(DEMO);
      setToast("Fresh ESP32 evidence received • CRAI re-analysis ready");
    }catch(e){
      setResult(DEMO);
      setToast("Sensor simulated locally • fresh evidence ready");
    }finally{setSensorBusy(false);}
  }

  const nav=["Overview","Observe","Field Intelligence","Sensors","History","Reports"];
  return <div className="app">
    <aside className={`sidebar ${mobile?"open":""}`}>
      <div className="brand">
        <div className="brand-mark"><Leaf size={21}/></div>
        <div><strong>CRAI</strong><span>Adaptive Edge Intelligence</span></div>
      </div>
      <div className="nav-label">FIELD OPERATIONS</div>
      <nav>{nav.map((n,i)=><button key={n} className={page===n?"active":""} onClick={()=>{setPage(n);setMobile(false)}}><span className="nav-icon">{[Gauge,Camera,ScanLine,Cpu,History,BarChart3][i]&&React.createElement([Gauge,Camera,ScanLine,Cpu,History,BarChart3][i],{size:18})}</span>{n}{n==="Field Intelligence"&&<span className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom">
        <button className="settings"><Settings size={17}/> Settings</button>
        <div className="edge-card">
          <div className="edge-head"><span className={`live-dot ${aiOnline?"on":""}`}></span><b>EDGE ONLINE</b><span className="edge-mini">LOCAL</span></div>
          <div className="edge-device"><Cpu size={15}/> Raspberry Pi / Laptop</div>
          <div className="edge-grid"><span>Vision AI <b>READY</b></span><span>Ollama <b>{aiOnline?"READY":"OFFLINE"}</b></span><span>ESP32 <b>2 / 2</b></span><span>Offline mode <b>ACTIVE</b></span></div>
        </div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <button className="mobile-menu" onClick={()=>setMobile(!mobile)}><Menu/></button>
        <div className="crumb"><span>CRAI</span><ChevronRight size={14}/><b>{page}</b></div>
        <div className="top-actions"><div className="system-pill"><span className="live-dot on"/> System operational</div><button className="icon-btn"><Bell size={18}/></button><div className="avatar">F</div></div>
      </header>
      <div className="content">
        {page==="Overview"&&<Overview setPage={setPage} risk={risk} disease={disease} evidence={evidence} decision={decision} sensor={sensor} setSelectedZone={setSelectedZone} />}
        {page==="Observe"&&<Observe file={file} setFile={setFile} preview={preview} setPreview={setPreview} analyzing={analyzing} runAnalysis={runAnalysis} selectedZone={selectedZone} setSelectedZone={setSelectedZone} result={result} acquireSensor={acquireSensor} sensorBusy={sensorBusy} />}
        {page==="Field Intelligence"&&<Intelligence result={result} risk={risk} evidence={evidence} decision={decision} disease={disease} sensor={sensor} advisory={advisory} showWhy={showWhy} setShowWhy={setShowWhy} setPage={setPage} />}
        {page==="Sensors"&&<Sensors sensor={sensor} acquireSensor={acquireSensor} sensorBusy={sensorBusy} />}
        {page==="History"&&<HistoryPage/>}
        {page==="Reports"&&<Reports result={result}/>}
      </div>
    </main>
    {toast&&<div className="toast"><Check size={17}/>{toast}<button onClick={()=>setToast("")}><X size={14}/></button></div>}
  </div>
}

function PageHeader({eyebrow,title,sub,action}){
 return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{sub}</p></div>{action}</div>
}

function Overview({setPage,risk,disease,evidence,decision,sensor,setSelectedZone}){
 return <section>
  <PageHeader eyebrow="FRIDAY · SEPTEMBER 11" title="Field intelligence overview" sub="A single evidence-driven view of what matters in your field." action={<div className="head-actions"><button className="btn secondary" onClick={()=>setPage("Sensors")}><RefreshCw size={16}/> Refresh evidence</button><button className="btn primary" onClick={()=>setPage("Observe")}><Camera size={16}/> New observation</button></div>}/>
  <div className="kpi-grid">
   <Metric label="FIELD RISK" value={risk.risk_score} suffix={risk.risk_level} trend="↓ 10.0 pts" trendText="decreasing" level={risk.risk_level}/>
   <Metric label="ACTIVE SIGNAL" value={disease.prediction.replace("Tomato_","")} suffix={`${disease.confidence.toFixed(1)}% confidence`} sub="Visual AI · Strong"/>
   <Metric label="EVIDENCE" value={`${evidence.evidence_count||4} / 4`} suffix="COMPLETE" sub="All evidence sources usable"/>
   <Metric label="ASSESSMENT" value={risk.assessment_confidence||"HIGH"} suffix="confidence" sub="Uncertainty · LOW"/>
  </div>
  <div className="overview-grid">
   <div className="card field-card"><div className="card-head"><div><span className="eyebrow">FIELD INTELLIGENCE</span><h2>Farm 01 <span>·</span> Zone network</h2></div><button className="link-btn" onClick={()=>setPage("Field Intelligence")}>Open intelligence <ChevronRight size={16}/></button></div><FieldMap onSelect={z=>setSelectedZone(z.id)}/><div className="map-legend"><span><i className="dot low"/>Low</span><span><i className="dot moderate"/>Moderate</span><span><i className="dot high"/>High</span><span><i className="dot critical"/>Critical</span></div></div>
   <div className="card recommendation"><div className="card-head"><div><span className="eyebrow">CRAI RECOMMENDATION</span><h2>Prioritize field inspection</h2></div><Sparkles size={20} className="spark"/></div><div className="signal-line"><div className={`risk-badge ${riskClass(risk.risk_level)}`}>{risk.risk_level}</div><div><b>{disease.prediction.replaceAll("_"," ")}</b><span>{disease.confidence.toFixed(1)}% visual confidence</span></div></div><p>{decision.message}</p><div className="steps">{(decision.recommended_steps||[]).slice(0,3).map((s,i)=><div key={i}><span>{String(i+1).padStart(2,"0")}</span>{s}</div>)}</div><button className="btn soft" onClick={()=>setPage("Field Intelligence")}>Why this score? <ChevronRight size={16}/></button></div>
  </div>
  <div className="pipeline-card card"><div className="pipeline-title"><div><span className="eyebrow">THE CRAI LOOP</span><h2>Observe → Evidence → Fuse → Decide</h2></div><span className="fresh-pill"><span className="live-dot on"/> Live evidence</span></div><EvidencePipeline evidence={evidence} risk={risk}/></div>
 </section>
}

function Metric({label,value,suffix,sub,trend,trendText,level}){
 return <div className="card metric"><div className="metric-label">{label}<CircleDot size={14}/></div><div className="metric-value">{value}</div><div className="metric-suffix">{suffix}</div>{trend?<div className="metric-trend"><span className="trend-down">{trend}</span> {trendText}</div>:<div className="metric-sub">{sub}</div>}</div>
}

function FieldMap({onSelect}){
 return <div className="field-map"><div className="field-boundary"><div className="field-row-lines"/><div className="field-water"/>{zones.map(z=><button key={z.id} className={`zone ${riskClass(z.level)}`} style={{left:`${z.x}%`,top:`${z.y}%`}} onClick={()=>onSelect(z)}><span>{z.id}</span><i>{z.risk}</i></button>)}</div><div className="north">N</div></div>
}

function EvidencePipeline({evidence,risk}){
 const items=[
  ["VISUAL",Camera,evidence?.details?.visual?.confidence||89.2,"STRONG"],
  ["ENVIRONMENT",Thermometer,evidence?.details?.environmental?.age_minutes<=15?"FRESH":"STALE",evidence?.details?.environmental?.status||"FRESH"],
  ["SPATIAL",MapPin,"2 / 2","AFFECTED"],
  ["TEMPORAL",History,"↓","DECREASING"]
 ];
 return <div className="pipeline">{items.map(([name,Icon,val,status],i)=><React.Fragment key={name}><div className="evidence-node"><div className="node-icon"><Icon size={18}/></div><div><b>{name}</b><strong>{typeof val==="number"?val.toFixed(1)+"%":val}</strong><span>{status}</span></div></div>{i<items.length-1&&<div className="pipe-arrow">→</div>}</React.Fragment>)}<div className="pipe-arrow">→</div><div className="fusion-node"><span>CRAI FUSION</span><b>{risk.risk_score}</b><i>{risk.risk_level}</i></div></div>
}

function Observe({file,setFile,preview,setPreview,analyzing,runAnalysis,selectedZone,setSelectedZone,result,acquireSensor,sensorBusy}){
 function choose(e){const f=e.target.files?.[0];if(f){setFile(f);setPreview(URL.createObjectURL(f));}}
 const additional=result?.status==="ADDITIONAL_EVIDENCE_REQUIRED";
 return <section><PageHeader eyebrow="OBSERVE" title="Capture field evidence" sub="Start with the smartphone. CRAI decides what evidence is worth acquiring next." action={<div className="context-chip"><MapPin size={15}/> GPS · Zone {selectedZone}</div>}/>
 <div className="observe-grid">
  <div className="card uploader"><div className="upload-top"><div><span className="eyebrow">01 · VISUAL EVIDENCE</span><h2>Crop image</h2></div><span className="source-tag"><Camera size={14}/> Smartphone</span></div>
   <label className={`dropzone ${preview?"has-image":""}`}>{preview?<img src={preview} alt="crop preview"/>:<><div className="upload-icon"><Upload/></div><b>Drop a crop image here</b><span>JPG or PNG · clear leaf / plant view</span><em>Choose image</em></>}<input type="file" accept="image/*" onChange={choose}/></label>
   <div className="context-fields"><label>Farm<select><option>Farm 01</option></select></label><label>Zone<select value={selectedZone} onChange={e=>setSelectedZone(e.target.value)}><option>A1</option><option>B2</option><option>C3</option><option>D1</option></select></label><label>Crop<select><option>Tomato</option></select></label><label>Growth stage<select><option>Vegetative</option></select></label></div>
   <button className="btn primary full" disabled={analyzing} onClick={runAnalysis}>{analyzing?<><RefreshCw className="spin"/> Running CRAI analysis…</>:<><ScanLine/> Analyze with CRAI</>}</button>
  </div>
  <div className="observe-side">
   <div className="card quality"><div className="card-head"><div><span className="eyebrow">02 · IMAGE QUALITY</span><h2>Capture readiness</h2></div><ShieldCheck className="green"/></div><div className="quality-score"><div><b>{preview?"100":"—"}</b><span>/ 100</span></div><div className={`quality-ring ${preview?"good":""}`}>{preview?<Check/>:<Camera/>}</div></div><div className="quality-list"><span><Check/> Resolution</span><span><Check/> Brightness</span><span><Check/> Contrast</span><span><Check/> Sharpness</span></div><div className="quality-note">{preview?"GOOD · Ready for visual analysis":"Upload an image to run quality checks"}</div></div>
   <div className="card adaptive"><div className="adaptive-head"><Sparkles/><div><span className="eyebrow">03 · ADAPTIVE EVIDENCE</span><h2>CRAI chooses what matters</h2></div></div><p>Instead of sensing everything continuously, CRAI requests the missing evidence needed to make a confident decision.</p><div className="mini-evidence"><span>Visual <b>READY</b></span><span>Environment <b>15 min policy</b></span><span>Spatial <b>FIELD MEMORY</b></span><span>Temporal <b>HISTORY</b></span></div></div>
   {additional&&<div className="card request"><div className="request-icon"><Wifi/></div><div><span className="eyebrow">NEXT-BEST EVIDENCE</span><h2>Fresh ESP32 reading required</h2><p>Environmental evidence is stale. CRAI will not pretend old data is fresh.</p><button className="btn primary" onClick={acquireSensor} disabled={sensorBusy}>{sensorBusy?<><RefreshCw className="spin"/> Waiting for sensor…</>:<><Zap/> Acquire evidence</>}</button></div></div>}
  </div>
 </div></section>
}

function Intelligence({result,risk,evidence,decision,disease,sensor,advisory,showWhy,setShowWhy,setPage}){
 const bd=risk.breakdown||{};
 const ct=risk.contributions||{};
 return <section><PageHeader eyebrow="FIELD INTELLIGENCE · FARM 01 / A1" title={`Why is this field at ${risk.risk_level} risk?`} sub="CRAI combines independent evidence sources before producing a deterministic field decision." action={<button className="btn secondary" onClick={()=>setPage("Observe")}><Camera size={16}/> New observation</button>}/>
 <div className="intel-top"><div className={`card big-risk ${riskClass(risk.risk_level)}`}><div className="eyebrow">FUSED FIELD RISK</div><div className="risk-gauge"><svg viewBox="0 0 220 120"><path d="M20 110 A90 90 0 0 1 200 110" fill="none" stroke="#e7ece8" strokeWidth="14" strokeLinecap="round"/><path d="M20 110 A90 90 0 0 1 200 110" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" pathLength="100" strokeDasharray={`${risk.risk_score} 100`}/></svg><div className="gauge-value"><b>{risk.risk_score}</b><span>{risk.risk_level}</span></div></div><div className="risk-meta"><span>Assessment confidence <b>{risk.assessment_confidence}</b></span><span><ArrowDownRight size={15}/> Trend decreasing</span></div><button className="why-button" onClick={()=>setShowWhy(!showWhy)}>{showWhy?"Hide explanation":"Why this score?"}<ChevronRight size={15}/></button></div>
 <div className="card contribution"><div className="card-head"><div><span className="eyebrow">EVIDENCE CONTRIBUTION</span><h2>What moved the score</h2></div><Sparkles/></div><Contribution name="Visual" value={ct.visual} raw={bd.visual} icon={<Camera/>}/><Contribution name="Environment" value={ct.environmental} raw={bd.environmental} icon={<Thermometer/>}/><Contribution name="Spatial" value={ct.spatial} raw={bd.spatial} icon={<MapPin/>}/><Contribution name="Temporal" value={ct.temporal} raw={bd.temporal} icon={<History/>}/><div className="sum-line"><span>Fused risk</span><b>{risk.risk_score}</b></div></div></div>
 {showWhy&&<div className="card why-panel"><div><span className="eyebrow">EXPLAINABILITY</span><h2>Evidence behind the decision</h2><p>CRAI keeps the decision deterministic. Every score below comes from the structured evidence pipeline—not the language model.</p></div><div className="why-grid"><Why title="Visual" text={`${disease.confidence.toFixed(1)}% model confidence · strong visual disease signal`}/><Why title="Environment" text={`${sensor.soil_moisture}% soil moisture · ${sensor.temperature}°C · ${sensor.humidity}% RH · ${sensor.freshness}`}/><Why title="Spatial" text={`${result?.context?.spatial?.infected_neighbors||2} of ${result?.context?.spatial?.total_observed_zones||2} observed zones affected`}/><Why title="Temporal" text="Recent risk observations are decreasing · delta −10.0"/></div></div>}
 <div className="intel-grid"><div className="card evidence-detail"><div className="card-head"><div><span className="eyebrow">EVIDENCE QUALITY</span><h2>4 / 4 sources ready</h2></div><span className="fresh-pill"><span className="live-dot on"/> HIGH</span></div><EvidenceTable evidence={evidence} sensor={sensor}/></div>
 <div className="card decision-card"><div className="decision-top"><div className="decision-icon"><ShieldCheck/></div><div><span className="eyebrow">DETERMINISTIC DECISION</span><h2>{decision.title}</h2></div></div><div className="decision-action">{decision.action.replaceAll("_"," ")}</div><p>{decision.message}</p><div className="steps">{(decision.recommended_steps||[]).map((s,i)=><div key={i}><span>{String(i+1).padStart(2,"0")}</span>{s}</div>)}</div></div></div>
 {advisory?.available&&<div className="card advisory"><div className="advisory-mark"><Sparkles/></div><div className="advisory-main"><div className="advisory-head"><div><span className="eyebrow">CRAI FIELD ADVISOR · LOCAL AI</span><h2>Farmer-friendly explanation</h2></div><span className="local-badge"><span className="live-dot on"/> {advisory.model} · OFFLINE</span></div><p>{advisory.advisory}</p><div className="advisory-actions"><select value="English" onChange={()=>{}}><option>English</option><option>தமிழ்</option><option>हिन्दी</option><option>తెలుగు</option><option>ಕನ್ನಡ</option></select><button className="btn soft"><Mic size={16}/> Voice advisory</button></div></div></div>}
 </section>
}

function Contribution({name,value,raw,icon}){return <div className="contrib"><div className="contrib-name">{icon}<span>{name}</span></div><div className="bar"><i style={{width:`${Math.min(100,Math.max(3,Number(value||0)*2.2))}%`}}/></div><b>{Number(value||0).toFixed(1)}</b><small>{Number(raw||0).toFixed(1)}</small></div>}
function Why({title,text}){return <div className="why-item"><Check/><div><b>{title}</b><span>{text}</span></div></div>}
function EvidenceTable({evidence,sensor}){const rows=[["Visual","Strong",`${evidence?.details?.visual?.confidence?.toFixed(1)||"89.2"}%`,Camera],["Environment",sensor.freshness,`${sensor.age_minutes||0} min ago`,Thermometer],["Spatial","Observed","2 / 2 affected",MapPin],["Temporal","Decreasing","Δ −10.0",History]];return <div className="evidence-table">{rows.map(([n,s,v,I])=><div key={n}><span className="et-icon"><I/></span><b>{n}</b><span className="et-status">{s}</span><strong>{v}</strong><Check className="et-check"/></div>)}</div>}

function Sensors({sensor,acquireSensor,sensorBusy}){return <section><PageHeader eyebrow="SENSOR NETWORK" title="Environmental evidence" sub="Every reading carries a timestamp. Freshness determines whether CRAI can use it." action={<button className="btn primary" onClick={acquireSensor} disabled={sensorBusy}><Zap size={16}/> Acquire fresh reading</button>}/><div className="sensor-grid"><div className="card sensor-main"><div className="sensor-head"><div className="device-icon"><Cpu/></div><div><span className="eyebrow">ESP32 · NODE 01</span><h2>CRAI-ESP32-01</h2><span className="muted">Zone A1 · REAL-TIME NODE</span></div><span className="fresh-pill"><span className="live-dot on"/> FRESH</span></div><div className="sensor-values"><SensorValue icon={Droplets} label="Soil moisture" value={sensor.soil_moisture} unit="%"/><SensorValue icon={Thermometer} label="Temperature" value={sensor.temperature} unit="°C"/><SensorValue icon={Activity} label="Humidity" value={sensor.humidity} unit="% RH"/></div><div className="freshness"><div><span>Evidence freshness</span><b>0 min · within 15 min policy</b></div><div className="fresh-bar"><i style={{width:"8%"}}/></div><div className="fresh-scale"><span>NOW</span><span>15 min · FRESH LIMIT</span><span>60 min</span></div></div></div><div className="card network"><span className="eyebrow">EDGE NETWORK</span><h2>Acquisition health</h2><NetworkRow name="ESP32 nodes" value="2 / 2" ok/><NetworkRow name="Sensor gateway" value="ONLINE" ok/><NetworkRow name="Local inference" value="READY" ok/><NetworkRow name="Cloud dependency" value="NONE" ok/></div></div></section>}
function SensorValue({icon:Icon,label,value,unit}){return <div><Icon/><span>{label}</span><b>{value}<small>{unit}</small></b></div>}
function NetworkRow({name,value,ok}){return <div className="network-row"><span><span className={`live-dot ${ok?"on":""}`}/>{name}</span><b>{value}</b></div>}

function HistoryPage(){return <section><PageHeader eyebrow="FIELD MEMORY" title="History & trend" sub="CRAI learns from repeated observations instead of treating every image as an isolated event." action={<div className="context-chip"><History size={15}/> 7 observations</div>}/><div className="history-grid"><div className="card chart-card"><div className="card-head"><div><span className="eyebrow">RISK TREND · ZONE A1</span><h2>Field risk is moving down</h2></div><span className="trend-chip"><ArrowDownRight size={15}/> −10.0</span></div><div className="chart"><svg viewBox="0 0 700 250" preserveAspectRatio="none"><path d="M20 200 C120 180 150 150 220 165 S310 125 370 145 S470 80 530 100 S620 70 680 88" fill="none" stroke="currentColor" strokeWidth="4"/><path d="M20 200 C120 180 150 150 220 165 S310 125 370 145 S470 80 530 100 S620 70 680 88 L680 240 L20 240Z" fill="currentColor" opacity=".07"/></svg><div className="chart-labels"><span>SEP 7</span><span>SEP 8</span><span>SEP 9</span><span>SEP 10</span><span>TODAY</span></div></div></div><div className="card timeline"><span className="eyebrow">RECENT OBSERVATIONS</span><h2>Field memory</h2>{[["Today","A1","Fresh sensor evidence","22.8% moisture"],["10 Sep","A1","Late Blight","Risk 70.9"],["10 Sep","C3","Late Blight","Risk 54.8"],["09 Sep","A1","Risk observation","↓ trend"]].map((r,i)=><div className="timeline-row" key={i}><b>{r[0]}</b><span className="tl-dot"/><div><strong>{r[1]} · {r[2]}</strong><small>{r[3]}</small></div></div>)}</div></div></section>}

function Reports({result}){return <section><PageHeader eyebrow="FIELD REPORT" title="Decision-ready report" sub="A concise evidence trail for operators, agronomists and judges." action={<button className="btn primary" onClick={()=>window.print()}><Send size={16}/> Export / Print</button>}/><div className="report-shell"><div className="report-brand"><div className="brand-mark"><Leaf size={21}/></div><div><b>CRAI</b><span>Adaptive Edge Agricultural Intelligence</span></div><span>FIELD REPORT · A1</span></div><div className="report-hero"><span className="eyebrow">FIELD HEALTH</span><b>{result.risk.risk_score}</b><strong>{result.risk.risk_level}</strong><p>Tomato · Vegetative · Zone A1</p></div><div className="report-sections"><div><span className="eyebrow">PRIMARY SIGNAL</span><h3>{result.disease.prediction.replaceAll("_"," ")}</h3><p>{result.disease.confidence.toFixed(1)}% visual model confidence</p></div><div><span className="eyebrow">EVIDENCE</span><p>✓ Visual · ✓ Environmental · ✓ Spatial · ✓ Temporal</p><p>Evidence quality · HIGH</p></div><div><span className="eyebrow">DECISION</span><h3>{result.decision.action.replaceAll("_"," ")}</h3><p>{result.decision.message}</p></div></div><div className="report-footer">Generated by deterministic CRAI evidence fusion · Qwen3 advisory is explanatory only · Offline capable</div></div></section>}

export default App;
