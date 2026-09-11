import React from "react";
import {
  Radio,
  ScanLine,
  MapPinned,
} from "lucide-react";

export default function MissionProgress({
  status,
  coverage,
  currentCell,
  scannedCells,
  totalCells,
}) {
  const statusText =
    status === "SCANNING"
      ? "Scanning field..."
      : status === "PAUSED"
        ? "Mission paused"
        : status === "COMPLETED"
          ? "Mission completed"
          : "Mission ready";

  return (
    <section className="panel mission-progress-panel">
      <div className="mission-section-title">
        <div>
          <span className="eyebrow">MISSION STATUS</span>
          <h3>{statusText}</h3>
        </div>

        <span className={`mission-status-pill ${status.toLowerCase()}`}>
          <Radio size={12} />
          {status}
        </span>
      </div>

      <div className="mission-progress-main">
        <div className="coverage-number">
          <strong>{Math.round(coverage)}%</strong>
          <span>FIELD SCANNED</span>
        </div>

        <div className="coverage-details">
          <div className="coverage-bar">
            <span style={{ width: `${coverage}%` }} />
          </div>

          <div className="coverage-meta">
            <span>
              <ScanLine size={12} />
              {scannedCells} / {totalCells} grid cells
            </span>

            <strong>
              Current: {currentCell || "—"}
            </strong>
          </div>
        </div>
      </div>

      <div className="mission-signal">
        <div>
          <MapPinned size={14} />
          <span>SCAN POSITION</span>
        </div>

        <strong>
          {currentCell || "Waiting for launch"}
        </strong>
      </div>
    </section>
  );
}
