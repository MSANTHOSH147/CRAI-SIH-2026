import React from "react";

export default function KpiCard({ label, value, meta, icon: Icon, tone = "normal" }) {
  return (
    <div className={`kpi-card ${tone}`}>
      <div className="kpi-top">
        <span>{label}</span>
        <div className="kpi-icon"><Icon size={15} /></div>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-meta">{meta}</div>
    </div>
  );
}
