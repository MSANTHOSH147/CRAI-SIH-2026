import React from "react";

export default function FieldPreview({ compact = false }) {
  return (
    <div className={`field-preview ${compact ? "compact" : ""}`}>
      <div className="field-sky" />
      <div className="field-base">
        {Array.from({ length: 13 }).map((_, i) => (
          <span key={i} className={`crop-row r${i}`} />
        ))}
        <div className="field-road road-a" />
        <div className="field-road road-b" />
        <div className="field-zone zone-a"><b>C3</b></div>
        <div className="field-zone zone-b"><b>D2</b></div>
        <div className="drone-marker">✦</div>
      </div>
      <div className="field-overlay-label"><i /> LIVE FIELD</div>
      <div className="field-map-scale">N</div>
    </div>
  );
}
