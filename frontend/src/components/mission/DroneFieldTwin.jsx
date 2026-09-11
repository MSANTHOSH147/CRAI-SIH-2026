import React, { useMemo } from "react";
import { Crosshair, Navigation, ScanLine, Wind } from "lucide-react";
import "./DroneFieldTwin.css";

const CELLS = [
  ["A1","A2","A3","A4","A5"],
  ["B1","B2","B3","B4","B5"],
  ["C1","C2","C3","C4","C5"],
  ["D1","D2","D3","D4","D5"],
];

function levelClass(level) {
  return String(level || "pending").toLowerCase();
}

export default function DroneFieldTwin({
  cells = [],
  droneCell,
  targetCell,
  mode = "MANUAL",
  onSelectCell,
  scanning = false,
}) {
  const map = useMemo(() => new Map(cells.map((c) => [c.id, c])), [cells]);

  return (
    <section className="field-twin">
      <div className="field-twin-toolbar">
        <div>
          <span className="eyebrow">FIELD DIGITAL TWIN</span>
          <h2>Live crop intelligence</h2>
          <p>Operator view · RGB observation · thermal context · AI risk layer</p>
        </div>
        <div className="twin-toolbar-meta">
          <span><i className="pulse-dot" /> {mode}</span>
          <span><Wind size={13} /> 3.2 m/s</span>
        </div>
      </div>

      <div className="twin-stage">
        <div className="twin-skyline" />
        <div className="field-plane">
          <div className="field-furrows" />
          <div className="field-cells">
            {CELLS.flat().map((id) => {
              const cell = map.get(id);
              const active = id === droneCell;
              const target = id === targetCell;
              const scanned = Boolean(cell?.scanned);
              const risk = levelClass(cell?.risk || "pending");
              return (
                <button
                  type="button"
                  key={id}
                  className={`twin-cell ${risk} ${active ? "drone-here" : ""} ${target ? "targeted" : ""} ${scanned ? "is-scanned" : ""}`}
                  onClick={() => onSelectCell?.(id)}
                  aria-label={`${id}${scanned ? ` ${cell.risk}` : " unscanned"}`}
                >
                  <span className="cell-label">{id}</span>
                  <span className="crop-row"><b /><b /><b /></span>
                  <span className="cell-risk">{scanned ? String(cell.risk).toUpperCase() : "UNSCANNED"}</span>
                  {target && <span className="target-ring"><Crosshair size={15} /></span>}
                  {active && (
                    <span className="drone-token">
                      <Navigation size={14} />
                    </span>
                  )}
                  {scanning && active && <span className="scan-beam" />}
                </button>
              );
            })}
          </div>
          <div className="twin-grid-axis axis-a">A</div>
          <div className="twin-grid-axis axis-d">D</div>
          <div className="twin-overlay twin-overlay-top">
            <span>12.4 ACRES</span><strong>FARM A-104</strong>
          </div>
          <div className="twin-overlay twin-overlay-bottom">
            <ScanLine size={13} /><span>GPS · RGB · THERMAL</span>
          </div>
        </div>
      </div>
    </section>
  );
}
