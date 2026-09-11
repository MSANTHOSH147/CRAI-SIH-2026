import React, {useEffect, useMemo, useRef, useState} from "react";
import {
  Activity, AlertTriangle, BarChart3, Bell, Camera, CheckCircle2, ChevronRight,
  CircleDot, Cpu, Droplets, FileText, Gauge, History as HistoryIcon, Leaf,
  MapPin, Menu, Mic, RefreshCw, Search, Send, Settings, ShieldCheck,
  Sparkles, Thermometer, Upload, Wifi, X, Zap
} from "lucide-react";
import {
  getHealth, getAIStatus, analyzeFieldImage, createSensorRequest,
  getSensorReadings
} from "./services/api";
import "./integration-additions.css";

const NAV = ["Overview","Observe","Field Intelligence","Sensors","History","Reports"];

const zones = [
  {id:"A1",x:18,y:28,risk:70.9,level:"critical"},
  {id:"B2",x:42,y:52,risk:46,level:"moderate"},
  {id:"C3",x:68,y:31,risk:38,level:"moderate"},
  {id:"D1",x:75,y:68,risk:24,level:"low"}
];

function num(v, fallback=null){ return v === null || v === undefined || Number.isNaN(Number(v)) ? fallback : Number(v); }
function diseaseName(d){
  const x = d || {};
  return x.disease || x.prediction?.replaceAll("_"," ") || "No disease signal";
}
function getDisease(r){ return r?.disease || r?.disease_ai || r?.analysis?.disease || r?.analysis?.disease_ai || null; }
function getRisk(r){ return r?.risk || r?.analysis?.risk || null; }
function getDecision(r){ return r?.decision || r?.analysis?.decision || null; }
function getEvidence(r){ return r?.evidence || r?.analysis?.evidence || null; }
function getAdaptive(r){ return r?.adaptive_evidence || r?.analysis?.evidence?.adaptive || r?.analysis?.adaptive_evidence || null; }
function getSensor(r){ return r?.sensor || r?.analysis?.sensor || null; }
function getAdvisory(r){ return r?.advisory || r?.analysis?.advisory || null; }
function riskClass(level=""){ return String(level).toLowerCase().replaceAll(" ","-"); }
function ageMinutes(ts){
  if(!ts) return null;
  const t = new Date(ts).getTime();
  if(!Number.isFinite(t)) return null;
  return Math.max(0,(Date.now()-t)/60000);
}
function evidenceCount(e){
  const a=e?.available || {};
  return ["visual","environmental","spatial","temporal"].filter(k=>a[k]).length;
}
function fmt(v,d=1){ const n=num(v); return n===null ? "—" : n.toFixed(d); }

export default function App(){
  const [page,setPage] = useState("Overview");
  const [mobileOpen,setMobileOpen] = useState(false);
  const [result,setResult] = useState(null);
  const [selectedZone,setSelectedZone] = useState("A1");
  const [file,setFile] = useState(null);
  const [preview,setPreview] = useState("");
  const [busy,setBusy] = useState(false);
  const [sensorBusy,setSensorBusy] = useState(false);
  const [health,setHealth] = useState(false);
  const [aiOnline,setAiOnline] = useState(false);
  const [sensor,setSensor] = useState(null);
  const [error,setError] = useState("");
  const [language,setLanguage] = useState("English");
  const [lastUpdated,setLastUpdated] = useState(null);
  const inputRef=useRef(null);

  useEffect(()=>{
    Promise.allSettled([getHealth(),getAIStatus()]).then(([h,a])=>{
      setHealth(h.status==="fulfilled");
      setAiOnline(a.status==="fulfilled");
    });
    refreshSensor();
  },[]);

  async function refreshSensor(){
    try{
      const data=await getSensorReadings();
      const rows=Array.isArray(data?.value)?data.value:(Array.isArray(data)?data:[]);
      if(rows.length){
        const latest=[...rows].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp))[0];
        setSensor({...latest,available:true});
      }
    }catch{}
  }

  function selectFile(f){
    if(!f) return;
    setError("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setPage("Observe");
  }

  async function runAnalysis(currentFile=file){
    if(!currentFile) return;
    setBusy(true); setError("");
    try{
      const r=await analyzeFieldImage({
        file:currentFile,
        zoneId:selectedZone,
        farmId:1,
        crop:"Tomato",
        growthStage:"Vegetative"
      });
      setResult(r);
      setLastUpdated(new Date());

      const s=r?.sensor_acquisition;
      const risk=getRisk(r);
      const adaptive=getAdaptive(r);

      if(!risk && (s?.status==="PENDING" || adaptive?.action==="REQUEST_SENSOR")){
        setSensorBusy(true);
        await createSensorRequest({
          farmId:1,
          zoneId:selectedZone,
          deviceId:"CRAI-ESP32-01",
          source:"ESP32",
          requestedEvidence:s?.requested_evidence || "FRESH_SENSOR",
          reason:s?.reason || adaptive?.evidence_gap || "ENVIRONMENT",
          priority:s?.priority || adaptive?.priority || "HIGH"
        }).catch(()=>null);

        // The backend can fulfill a pending analysis automatically when
        // the ESP32 posts a fresh reading. Poll readings, then rerun the
        // same image so the UI receives the completed deterministic result.
        const started=Date.now();
        while(Date.now()-started < 90000){
          await new Promise(res=>setTimeout(res,3000));
          const data=await getSensorReadings().catch(()=>null);
          const rows=Array.isArray(data?.value)?data.value:(Array.isArray(data)?data:[]);
          const fresh=rows
            .filter(x=>String(x.zone_id||"").toUpperCase()===selectedZone)
            .sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp))[0];
          if(fresh && ageMinutes(fresh.timestamp)!==null && ageMinutes(fresh.timestamp)<=15){
            setSensor({...fresh,available:true});
            const finalR=await analyzeFieldImage({
              file:currentFile,zoneId:selectedZone,farmId:1,crop:"Tomato",growthStage:"Vegetative"
            });
            setResult(finalR);
            setLastUpdated(new Date());
            break;
          }
        }
        setSensorBusy(false);
      }else{
        const s2=getSensor(r);
        if(s2) setSensor({...s2,available:true});
      }
    }catch(e){
      setError(e?.message || "CRAI analysis failed.");
    }finally{
      setBusy(false);
      setSensorBusy(false);
    }
  }

  function resetObservation(){
    setFile(null); setPreview(""); setResult(null); setError("");
    setPage("Observe");
  }

  const disease=getDisease(result);
  const risk=getRisk(result);
  const decision=getDecision(result);
  const evidence=getEvidence(result);
  const adaptive=getAdaptive(result);
  const advisory=getAdvisory(result);
  const ready=!!risk;
  const count=evidenceCount(evidence);

  return (
    <div className="crai-app">
      <aside className={`sidebar ${mobileOpen?"open":""}`}>
        <div className="brand">
          <div className="brand-mark"><Leaf size={25}/></div>
          <div><b>CRAI</b><span>Adaptive Edge Intelligence</span></div>
        </div>
        <div className="nav-label">FIELD OPERATIONS</div>
        {NAV.map(item=>(
          <button key={item} className={`nav-item ${page===item?"active":""}`}
            onClick={()=>{setPage(item);setMobileOpen(false)}}>
            {item==="Overview"?<Gauge size={19}/>:item==="Observe"?<Camera size={19}/>:item==="Field Intelligence"?<ShieldCheck size={19}/>:item==="Sensors"?<Cpu size={19}/>:item==="History"?<HistoryIcon size={19}/>:<BarChart3 size={19}/>}
            <span>{item}</span>{item==="Field Intelligence"&&ready?<i/>:null}
          </button>
        ))}
        <div className="sidebar-spacer"/>
        <button className={`nav-item ${page==="Settings"?"active":""}`} onClick={()=>setPage("Settings")}><Settings size={19}/><span>Settings</span></button>
        <div className="edge-card">
          <div className="edge-top"><span className="live-dot on"/> EDGE ONLINE <small>LOCAL</small></div>
          <div className="edge-node"><Cpu size={17}/> Raspberry Pi / Laptop</div>
          <div className="edge-grid"><div><span>Vision AI</span><b>READY</b></div><div><span>Ollama</span><b>{aiOnline?"READY":"CHECK"}</b></div><div><span>ESP32</span><b>{sensor?.available?"CONNECTED":"WAITING"}</b></div><div><span>Offline mode</span><b>ACTIVE</b></div></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="mobile-menu" onClick={()=>setMobileOpen(!mobileOpen)}><Menu/></button>
          <div className="crumb">CRAI <ChevronRight size={15}/> <b>{page}</b></div>
          <div className="top-actions"><span className="system-pill"><span className={`live-dot ${health?"on":""}`}/>{health?"System operational":"Backend offline"}</span><button className="icon-btn"><Bell size={19}/></button><div className="avatar">F</div></div>
        </header>

        <div className="content">
          {page==="Overview" && <Overview result={result} risk={risk} disease={disease} decision={decision} evidence={evidence} count={count} setPage={setPage} setSelectedZone={setSelectedZone}/>}
          {page==="Observe" && <Observe file={file} preview={preview} inputRef={inputRef} busy={busy} sensorBusy={sensorBusy} error={error} result={result} selectedZone={selectedZone} setSelectedZone={setSelectedZone} selectFile={selectFile} runAnalysis={()=>runAnalysis()} reset={resetObservation}/>}
          {page==="Field Intelligence" && <Intelligence result={result} risk={risk} disease={disease} decision={decision} evidence={evidence} adaptive={adaptive} advisory={advisory} setPage={setPage}/>}
          {page==="Sensors" && <Sensors sensor={sensor} busy={sensorBusy} refresh={refreshSensor} onAcquire={()=>{setPage("Observe"); if(file) runAnalysis(file)}}/>}
          {page==="History" && <HistoryPage result={result}/>}
          {page==="Reports" && <Reports result={result}/>}
          {page==="Settings" && <SettingsPage language={language} setLanguage={setLanguage} aiOnline={aiOnline}/>}
        </div>
      </main>
    </div>
  );
}

function Header({eyebrow,title,sub,action}){return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{sub}</p></div>{action&&<div className="head-action">{action}</div>}</div>}

function Overview({result,risk,disease,decision,evidence,count,setPage,setSelectedZone}){
  const ready=!!risk;
  return <section>
    <Header eyebrow="FRIDAY · SEPTEMBER 11" title="Field intelligence overview" sub="A single evidence-driven view of what matters in your field."
      action={<div className="head-actions"><button className="btn secondary" onClick={()=>setPage("Sensors")}><RefreshCw size={16}/> Refresh evidence</button><button className="btn primary" onClick={()=>setPage("Observe")}><Camera size={16}/> New observation</button></div>}/>
    <div className="kpi-grid">
      <Metric label="FIELD RISK" value={ready?fmt(risk.risk_score):"—"} suffix={ready?(risk.risk_level||"PENDING"):"AWAITING EVIDENCE"} sub={ready?"Deterministic fusion":"Start an observation"} level={risk?.risk_level}/>
      <Metric label="ACTIVE SIGNAL" value={disease?diseaseName(disease):"—"} suffix={disease?`${fmt(disease.confidence,1)}% confidence`:"Awaiting image"} sub={disease?"Visual AI · Model output":"No observation yet"}/>
      <Metric label="EVIDENCE" value={`${count} / 4`} suffix={ready?"COMPLETE":"IN PROGRESS"} sub={ready?"All accepted sources usable":"CRAI will request what is missing"}/>
      <Metric label="ASSESSMENT" value={ready?(risk.assessment_confidence||"HIGH"):"WAITING"} suffix={ready?"confidence":"for evidence"} sub={ready?"Deterministic CRAI decision":"Start an observation"}/>
    </div>
    <div className="overview-grid">
      <div className="card field-card"><div className="card-head"><div><span className="eyebrow">FIELD INTELLIGENCE</span><h2>Farm 01 <span>·</span> Zone network</h2></div><button className="link-btn" onClick={()=>setPage("Field Intelligence")}>Open intelligence <ChevronRight size={16}/></button></div><FieldMap onSelect={z=>{setSelectedZone(z.id);setPage("Observe")}}/><div className="map-legend"><span><i className="dot low"/>Low</span><span><i className="dot moderate"/>Moderate</span><span><i className="dot high"/>High</span><span><i className="dot critical"/>Critical</span></div></div>
      <div className="card recommendation"><div className="card-head"><div><span className="eyebrow">CRAI RECOMMENDATION</span><h2>{ready?"Prioritize field inspection":"Ready for observation"}</h2></div><Sparkles size={20} className="spark"/></div>
        {ready?<><div className="signal-line"><div className={`risk-badge ${riskClass(risk.risk_level)}`}>{risk.risk_level}</div><div><b>{diseaseName(disease)}</b><span>{fmt(disease?.confidence,1)}% visual confidence</span></div></div><p>{decision?.message||decision?.reason||"CRAI generated a deterministic decision."}</p><div className="steps">{(decision?.recommended_steps||[]).slice(0,3).map((s,i)=><div key={i}><span>{String(i+1).padStart(2,"0")}</span>{s}</div>)}</div><button className="btn soft" onClick={()=>setPage("Field Intelligence")}>Why this score? <ChevronRight size={16}/></button></>:<><p>Upload a crop image. CRAI validates image quality, runs disease AI, and requests only the evidence needed for a reliable decision.</p><button className="btn primary" onClick={()=>setPage("Observe")}><Camera size={16}/> Start observation</button></>}</div>
    </div>
    <div className="pipeline-card card"><div className="pipeline-title"><div><span className="eyebrow">THE CRAI LOOP</span><h2>Observe → Evidence → Fuse → Decide</h2></div><span className="fresh-pill"><span className="live-dot on"/> Live evidence</span></div><EvidencePipeline evidence={evidence} risk={risk}/></div>
  </section>
}

function Metric({label,value,suffix,sub,level}){return <div className="card metric"><div className="metric-label">{label}<CircleDot size={14}/></div><div className="metric-value">{value}</div><div className="metric-suffix">{suffix}</div><div className="metric-sub">{sub}</div></div>}

function FieldMap({onSelect}){return <div className="field-map"><div className="field-boundary"><div className="field-row-lines"/><div className="field-water"/>{zones.map(z=><button key={z.id} className={`zone ${riskClass(z.level)}`} style={{left:`${z.x}%`,top:`${z.y}%`}} onClick={()=>onSelect(z)}><span>{z.id}</span><i>{z.risk}</i></button>)}</div><div className="north">N</div></div>}

function EvidencePipeline({evidence,risk}){
  const d=evidence?.details||{};
  const items=[
    ["VISUAL",Camera,d.visual?.confidence,"STRONG"],
    ["ENVIRONMENT",Thermometer,d.environmental?.status,d.environmental?.age_minutes!=null?`${fmt(d.environmental.age_minutes,0)} min ago`:"MISSING"],
    ["SPATIAL",MapPin,d.spatial?.infected_neighbors!=null?`${d.spatial.infected_neighbors} / ${d.spatial.total_observations}`:"—",d.spatial?.available?"OBSERVED":"MISSING"],
    ["TEMPORAL",HistoryIcon,d.temporal?.trend?.replaceAll("_"," ")||"—",d.temporal?.delta!=null?`Δ ${d.temporal.delta>0?"+":""}${fmt(d.temporal.delta,1)}`:"MISSING"]
  ];
  return <div className="evidence-pipeline">{items.map(([name,I,v,s])=><div className="evidence-item" key={name}><div className="evidence-icon"><I size={18}/></div><div><span>{name}</span><b>{v==null?"—":typeof v==="number"?fmt(v,1):v}</b><small>{s}</small></div></div>)}<div className="pipeline-arrow">→</div><div className="evidence-result"><ShieldCheck size={19}/><div><span>FUSED RISK</span><b>{risk?.risk_score!=null?fmt(risk.risk_score,1):"WAITING"}</b><small>{risk?.risk_level||"ADDITIONAL EVIDENCE"}</small></div></div></div>
}

function Observe({file,preview,inputRef,busy,sensorBusy,error,result,selectedZone,setSelectedZone,selectFile,runAnalysis,reset}){
  const d=getDisease(result), r=getRisk(result), dec=getDecision(result), ad=getAdaptive(result);
  return <section><Header eyebrow="FIELD OBSERVATION" title="Observe a crop" sub="Start with the smartphone. CRAI decides what additional evidence is actually needed." action={<span className="fresh-pill"><span className="live-dot on"/> EDGE INFERENCE</span>}/>
    <div className="observe-grid">
      <div className="card upload-card">
        <div className="card-head"><div><span className="eyebrow">SMARTPHONE VISION</span><h2>Crop image</h2></div><Camera size={20}/></div>
        {!preview?<button className="upload-zone" onClick={()=>inputRef.current?.click()}><Upload size={28}/><strong>Select an image</strong><span>JPG, JPEG, PNG or WEBP · Crop / leaf imagery</span><div className="upload-button">Choose Image</div></button>:<div className="preview-wrap"><img src={preview} alt="Selected crop"/><div className="preview-overlay"><b>{file?.name}</b><button onClick={reset}><X size={16}/></button></div></div>}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" hidden onChange={e=>selectFile(e.target.files?.[0])}/>
        <div className="context-row"><label>Zone<select value={selectedZone} onChange={e=>setSelectedZone(e.target.value)}><option>A1</option><option>B2</option><option>C3</option><option>D1</option></select></label><label>Crop<select defaultValue="Tomato"><option>Tomato</option></select></label><label>Growth stage<select defaultValue="Vegetative"><option>Vegetative</option><option>Flowering</option><option>Fruiting</option></select></label></div>
        <button className="btn primary wide" disabled={!file||busy||sensorBusy} onClick={runAnalysis}>{busy?<><RefreshCw className="spin"/> Running CRAI…</>:sensorBusy?<><Wifi className="pulse"/> Waiting for fresh ESP32 evidence…</>:<><Sparkles size={17}/> Analyze with CRAI</>}</button>
        {error&&<div className="error-box"><AlertTriangle size={17}/>{error}</div>}
      </div>
      <div className="card observe-status">
        <span className="eyebrow">ADAPTIVE EVIDENCE</span><h2>CRAI only senses what matters.</h2>
        <EvidenceStatus label="Image quality" ok={!!result?.image_quality && result.image_quality.status==="GOOD"} text={result?.image_quality?.status||"Waiting for image"}/>
        <EvidenceStatus label="Visual disease AI" ok={!!d} text={d?`${diseaseName(d)} · ${fmt(d.confidence,1)}%`:"Waiting"}/>
        <EvidenceStatus label="Environmental" ok={!!getSensor(result) && ageMinutes(getSensor(result)?.timestamp)<=15} text={getSensor(result)?`${fmt(getSensor(result).soil_moisture,1)}% soil · ${fmt(getSensor(result).temperature,1)}°C`:"Waiting for ESP32"}/>
        <EvidenceStatus label="Field decision" ok={!!r} text={r?`${fmt(r.risk_score,1)} · ${r.risk_level}`:(ad?.reason||"Additional evidence may be requested")}/>
        {dec&&<div className={`decision-mini ${r?"ready":"pending"}`}><ShieldCheck size={18}/><div><b>{dec.title||dec.action||"CRAI decision"}</b><span>{dec.message||dec.reason}</span></div></div>}
      </div>
    </div>
  </section>
}
function EvidenceStatus({label,ok,text}){return <div className="status-row"><span>{ok?<CheckCircle2 size={18}/>:<CircleDot size={18}/>}<b>{label}</b></span><small>{text}</small></div>}

function Intelligence({result,risk,disease,decision,evidence,adaptive,advisory,setPage}){
  if(!risk) return <section><Header eyebrow="FIELD INTELLIGENCE" title="Decision intelligence" sub="Complete an observation to unlock deterministic field risk."/><div className="card empty-report"><Gauge size={30}/><h2>No completed assessment yet</h2><p>CRAI will show the score only after the evidence gate is satisfied.</p><button className="btn primary" onClick={()=>setPage("Observe")}><Camera size={16}/> Start observation</button></div></section>;
  const b=risk.breakdown||{};
  const c=risk.contributions||{};
  return <section><Header eyebrow="FIELD INTELLIGENCE · FARM 01 / A1" title={`Why is this field at ${risk.risk_level} risk?`} sub="CRAI combines independent evidence sources before producing a deterministic field decision." action={<button className="btn primary" onClick={()=>setPage("Observe")}><Camera size={16}/> New observation</button>}/>
    <div className="risk-hero card"><div><span className="eyebrow">FUSED FIELD RISK</span><div className="risk-number">{fmt(risk.risk_score,1)}<span>{risk.risk_level}</span></div><p>Assessment confidence <b>{risk.assessment_confidence||"HIGH"}</b></p></div><div className={`risk-gauge ${riskClass(risk.risk_level)}`}><div style={{"--score":`${Math.min(100,Math.max(0,num(risk.risk_score,0)))}%`}}/><b>{fmt(risk.risk_score,1)}</b></div></div>
    <div className="card"><div className="card-head"><div><span className="eyebrow">EVIDENCE CONTRIBUTION</span><h2>What moved the score</h2></div><span className="fresh-pill">{evidence?.evidence_count||4} / 4 sources</span></div><div className="contrib-grid">{[["Visual",b.visual,c.visual,Camera],["Environment",b.environmental,c.environmental,Thermometer],["Spatial",b.spatial,c.spatial,MapPin],["Temporal",b.temporal,c.temporal,HistoryIcon]].map(([n,s,con,I])=><div className="contrib" key={n}><div><I size={17}/><span>{n}</span><b>{fmt(con,1)}</b></div><div className="bar"><i style={{width:`${Math.min(100,Math.max(0,num(s,0)))}%`}}/></div><small>{fmt(s,1)}</small></div>)}</div></div>
    <div className="two-col"><div className="card"><span className="eyebrow">EVIDENCE QUALITY</span><h2>{evidence?.evidence_count||4} / 4 sources ready</h2><div className="quality-list"><Quality n="Visual" v={evidence?.details?.visual?.status||"STRONG"} d={fmt(evidence?.details?.visual?.confidence,1)+"%"} /><Quality n="Environment" v={evidence?.details?.environmental?.status||"FRESH"} d={evidence?.details?.environmental?.age_minutes!=null?fmt(evidence.details.environmental.age_minutes,0)+" min ago":"—"}/><Quality n="Spatial" v={evidence?.details?.spatial?.available?"Observed":"Missing"} d={evidence?.details?.spatial?.infected_neighbors!=null?`${evidence.details.spatial.infected_neighbors} / ${evidence.details.spatial.total_observations} affected`:"—"}/><Quality n="Temporal" v={evidence?.details?.temporal?.trend?.replaceAll("_"," ")||"—"} d={evidence?.details?.temporal?.delta!=null?`Δ ${fmt(evidence.details.temporal.delta,1)}`:"—"}/></div></div>
      <div className="card decision-card"><div className="decision-top"><div className="decision-icon"><ShieldCheck/></div><div><span className="eyebrow">DETERMINISTIC DECISION</span><h2>{decision?.title||String(decision?.action||"Decision").replaceAll("_"," ")}</h2></div></div><div className="decision-action">{String(decision?.action||"WAITING_FOR_EVIDENCE").replaceAll("_"," ")}</div><p>{decision?.message||decision?.reason||"Decision generated by CRAI."}</p><div className="steps">{(decision?.recommended_steps||[]).map((s,i)=><div key={i}><span>{String(i+1).padStart(2,"0")}</span>{s}</div>)}</div></div></div>
    {advisory?.available&&<div className="card advisory"><div className="advisory-mark"><Sparkles/></div><div><span className="eyebrow">CRAI FIELD ADVISOR · LOCAL AI</span><h2>Farmer-friendly explanation</h2><p>{advisory.advisory}</p><span className="local-badge">{advisory.model} · OFFLINE</span></div></div>}
  </section>
}
function Quality({n,v,d}){return <div className="quality-row"><span><span className="live-dot on"/>{n}</span><b>{v}</b><small>{d}</small></div>}

function Sensors({sensor,busy,refresh,onAcquire}){
  const age=ageMinutes(sensor?.timestamp);
  return <section><Header eyebrow="SENSOR NETWORK" title="Environmental evidence" sub="Every reading carries a timestamp. Freshness determines whether CRAI can use it." action={<button className="btn primary" onClick={onAcquire} disabled={busy}><Zap size={16}/> {busy?"Waiting for ESP32":"Acquire fresh reading"}</button>}/>
    <div className="sensor-grid"><div className="card sensor-main"><div className="sensor-head"><div className="device-icon"><Cpu/></div><div><span className="eyebrow">ESP32 · NODE 01</span><h2>CRAI-ESP32-01</h2><span className="muted">Zone A1 · REAL-TIME NODE</span></div><span className="fresh-pill"><span className={`live-dot ${sensor?.available?"on":""}`}/>{sensor?.available?"FRESH":"NO READING"}</span></div>
      <div className="sensor-values"><SensorValue icon={Droplets} label="Soil moisture" value={fmt(sensor?.soil_moisture,1)} unit="%"/><SensorValue icon={Thermometer} label="Temperature" value={fmt(sensor?.temperature,1)} unit="°C"/><SensorValue icon={Activity} label="Humidity" value={fmt(sensor?.humidity,1)} unit="% RH"/></div>
      <div className="freshness"><div><span>Evidence freshness</span><b>{age!=null?`${fmt(age,0)} min · ${age<=15?"within":"outside"} 15 min policy`:"No reading received"}</b></div><div className="fresh-bar"><i style={{width:age==null?"2%":`${Math.min(100,Math.max(3,age/60*100))}%`}}/></div><div className="fresh-scale"><span>NOW</span><span>15 min · FRESH LIMIT</span><span>60 min</span></div></div>
      <button className="btn secondary" onClick={refresh}><RefreshCw size={16}/> Refresh sensor data</button>
    </div><div className="card network"><span className="eyebrow">EDGE NETWORK</span><h2>Acquisition health</h2><NetworkRow name="ESP32 node" value={sensor?.available?"CONNECTED":"WAITING"} ok={!!sensor}/><NetworkRow name="Sensor gateway" value="ONLINE" ok/><NetworkRow name="Local inference" value="READY" ok/><NetworkRow name="Cloud dependency" value="NONE" ok/></div></div>
  </section>
}
function SensorValue({icon:Icon,label,value,unit}){return <div><Icon/><span>{label}</span><b>{value}<small>{unit}</small></b></div>}
function NetworkRow({name,value,ok}){return <div className="network-row"><span><span className={`live-dot ${ok?"on":""}`}/>{name}</span><b>{value}</b></div>}

function HistoryPage({result}){
  const r=getRisk(result), e=getEvidence(result);
  return <section><Header eyebrow="FIELD MEMORY" title="Observation history" sub="CRAI preserves evidence context so each new observation can be interpreted against what happened before."/>
    <div className="history-grid"><div className="card trend-card"><div className="card-head"><div><span className="eyebrow">RISK TREND</span><h2>{r?`${fmt(r.risk_score,1)} · ${r.risk_level}`:"Awaiting observations"}</h2></div><HistoryIcon/></div><div className="trend-visual"><div className="trend-line"><span/><span/><span/><span/><span/></div><div className="trend-labels"><span>Earlier</span><span>Latest</span></div></div></div><div className="card"><span className="eyebrow">FIELD MEMORY</span><h2>Evidence timeline</h2><div className="timeline"><TimelineItem title="Visual observation" text={getDisease(result)?diseaseName(getDisease(result)):"No observation yet"}/><TimelineItem title="Environmental evidence" text={e?.details?.environmental?.status||"Waiting"}/><TimelineItem title="Deterministic decision" text={getDecision(result)?.action?.replaceAll("_"," ")||"Waiting"}/></div></div></div>
  </section>
}
function TimelineItem({title,text}){return <div className="timeline-item"><span className="timeline-dot"/><div><b>{title}</b><span>{text}</span></div></div>}

function Reports({result}){
  if(!result || !getRisk(result)) return <section><Header eyebrow="FIELD REPORT" title="Decision-ready report" sub="A report is created after CRAI completes an observation." action={<button className="btn secondary" onClick={()=>window.print()}><Send size={16}/> Print</button>}/><div className="card empty-report"><FileText size={30}/><h2>No completed assessment yet</h2><p>Run an observation and complete the evidence loop before exporting a field report.</p></div></section>;
  const r=getRisk(result), d=getDisease(result), dec=getDecision(result), e=getEvidence(result), ad=getAdvisory(result);
  return <section><Header eyebrow="FIELD REPORT" title="Decision-ready report" sub="A concise evidence trail for operators, agronomists and judges." action={<button className="btn primary" onClick={()=>window.print()}><Send size={16}/> Export / Print</button>}/><div className="report-shell"><div className="report-brand"><div className="brand-mark"><Leaf size={21}/></div><div><b>CRAI</b><span>Adaptive Edge Agricultural Intelligence</span></div><span>FIELD REPORT · A1</span></div><div className="report-hero"><span className="eyebrow">FIELD HEALTH</span><b>{fmt(r.risk_score,1)}</b><strong>{r.risk_level||"PENDING"}</strong><p>Tomato · Vegetative · Zone A1</p></div><div className="report-sections"><div><span className="eyebrow">PRIMARY SIGNAL</span><h3>{diseaseName(d)}</h3><p>{d?.confidence!=null?`${fmt(d.confidence,1)}% visual model confidence`:"Not available"}</p></div><div><span className="eyebrow">EVIDENCE</span><p>{e?.evidence_count||0} / 4 sources available</p><p>Quality · {e?.evidence_quality||"HIGH"}</p></div><div><span className="eyebrow">DECISION</span><h3>{String(dec?.action||"PENDING").replaceAll("_"," ")}</h3><p>{dec?.message||dec?.reason||"No completed deterministic decision."}</p></div></div>{ad?.advisory&&<div className="report-sections"><div><span className="eyebrow">LOCAL AI ADVISORY</span><p>{ad.advisory}</p></div></div>}<div className="report-footer">Generated by deterministic CRAI evidence fusion · Qwen3 advisory is explanatory only · Offline capable</div></div></section>
}

function SettingsPage({language,setLanguage,aiOnline}){return <section><Header eyebrow="SYSTEM CONFIGURATION" title="CRAI settings" sub="Inspect the edge stack, evidence policy and advisory preferences."/><div className="settings-grid"><div className="card settings-card"><span className="eyebrow">EDGE AI</span><h2>Local inference stack</h2><SettingRow n="Tomato Disease AI" v="READY"/><SettingRow n="Ollama / Qwen3" v={aiOnline?"READY":"OFFLINE"}/><SettingRow n="Offline mode" v="ACTIVE"/></div><div className="card settings-card"><span className="eyebrow">EVIDENCE POLICY</span><h2>Freshness rules</h2><SettingRow n="Fresh environmental evidence" v="≤ 15 min"/><SettingRow n="Sensor validation" v="0–100 / −20–70°C"/><SettingRow n="Future timestamp tolerance" v="≤ 5 min"/></div><div className="card settings-card"><span className="eyebrow">ADVISORY</span><h2>Farmer language</h2><label className="setting-select">Language<select value={language} onChange={e=>setLanguage(e.target.value)}><option>English</option><option>Tamil</option><option>Hindi</option><option>Telugu</option><option>Kannada</option><option>Malayalam</option><option>Marathi</option><option>Bengali</option><option>Gujarati</option><option>Punjabi</option></select></label></div></div></section>}
function SettingRow({n,v}){return <div className="setting-row"><span>{n}</span><b>{v}</b></div>}
