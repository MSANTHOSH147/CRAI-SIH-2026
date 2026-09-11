import React from "react";
import { Radio, Camera, Thermometer, Navigation, Activity } from "lucide-react";
import { sensors } from "../data/demo";

const icons = [Camera, Thermometer, Navigation, Activity];

export default function Sensors() {
  return (
    <>
      <div className="page-heading compact-heading"><div><div className="eyebrow">FIELD DEVICES</div><h1>Devices</h1><p>Telemetry and payload status across the CRAI monitoring system.</p></div><span className="device-count"><Radio size={14}/> 4 connected</span></div>
      <div className="sensor-grid">{sensors.map((s,i)=>{const Icon=icons[i]; return <div className="sensor-card panel" key={s.name}><div className="sensor-card-head"><div className="sensor-icon"><Icon size={18}/></div><span className="online-badge"><i/>ONLINE</span></div><h3>{s.name}</h3><p>{s.type}</p><div className="sensor-reading"><span>STATUS</span><b>{s.value}</b></div></div>})}</div>
    </>
  );
}
