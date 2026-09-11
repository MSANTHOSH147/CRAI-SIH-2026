import React from "react";
import { Navigation } from "lucide-react";

export default function MissionGrid({
  cells,
  currentCell,
  dronePosition,
}) {
  return (
    <section className="panel mission-grid-panel">
      <div className="mission-grid-header">
        <div>
          <span className="eyebrow">LIVE MISSION</span>
          <h2>Field Scan Grid</h2>
          <p>
            Simulated drone flight path and crop observation zones.
          </p>
        </div>

        <div className="scan-legend">
          <span>
            <i className="legend-dot normal" />
            Normal
          </span>

          <span>
            <i className="legend-dot monitor" />
            Monitor
          </span>

          <span>
            <i className="legend-dot high" />
            High Risk
          </span>
        </div>
      </div>

      <div className="mission-map">
        <div className="field-grid">
          {cells.map((cell) => {
            const active = cell.id === currentCell;

            return (
              <div
                key={cell.id}
                className={[
                  "field-cell",
                  cell.state,
                  active ? "current" : "",
                  cell.scanned ? "scanned" : "",
                ].join(" ")}
              >
                <span>{cell.id}</span>

                {cell.scanned && (
  <small>
    {cell.risk || "ANALYZING"}
  </small>
)}

                {active && (
                  <div className="drone-marker">
                    <Navigation size={15} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="map-overlay top-left">
          <span>FIELD A-104</span>
          <strong>12.4 ACRES</strong>
        </div>

        <div className="map-overlay bottom-right">
          <span>FLIGHT PATH</span>
          <strong>
            {dronePosition + 1} / {cells.length}
          </strong>
        </div>
      </div>
    </section>
  );
}
