import React from "react";
export default function Settings() {
  return <>
    <div className="page-heading compact-heading"><div><div className="eyebrow">SYSTEM CONFIGURATION</div><h1>Settings</h1><p>Configure the CRAI prototype environment and operational preferences.</p></div></div>
    <div className="settings-grid">
      <section className="panel settings-card"><h3>AI Engine</h3><p>Current disease classifier configuration.</p><div className="setting-row"><span>Model</span><b>MobileNetV3-Small</b></div><div className="setting-row"><span>Version</span><b>V2</b></div><div className="setting-row"><span>Classes</span><b>11 disease classes</b></div><div className="setting-row"><span>PlantDoc validation</span><b>49.35%</b></div></section>
      <section className="panel settings-card"><h3>Platform</h3><p>Prototype connectivity status.</p><div className="setting-row"><span>Backend API</span><b className="green-text">Connected</b></div><div className="setting-row"><span>Database</span><b>SQLite</b></div><div className="setting-row"><span>Drone simulator</span><b className="green-text">Ready</b></div><div className="setting-row"><span>Risk engine</span><b>Integration ready</b></div></section>
    </div>
  </>;
}
