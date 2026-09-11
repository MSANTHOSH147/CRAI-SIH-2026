import React, { useMemo } from "react";
import {
  MapPinned,
  Radio,
  ScanLine,
} from "lucide-react";

import { useCrai } from "../../context/CraiContext";

import "./LiveFieldMap.css";

const ROUTE = [
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
  "B5",
  "B4",
  "B3",
  "B2",
  "B1",
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "D5",
  "D4",
  "D3",
  "D2",
  "D1",
];

function getRiskLevel(observation) {
  return (
    observation?.riskAI?.risk_level ||
    "unscanned"
  ).toLowerCase();
}

function getRiskScore(observation) {
  const score = Number(
    observation?.riskAI?.risk_score
  );

  return Number.isFinite(score)
    ? Math.round(score)
    : null;
}

function getDiseaseName(observation) {
  return (
    observation?.diseaseAI?.disease ||
    observation?.diseaseAI?.prediction ||
    "No detection"
  );
}

export default function LiveFieldMap() {
  const { observations, mission } = useCrai();

  const observationMap = useMemo(() => {
    return new Map(
      observations.map((observation) => [
        observation.region,
        observation,
      ])
    );
  }, [observations]);

  const scannedCount = observations.length;

  const missionStatus =
    mission?.status || "READY";

  return (
    <section className="live-field-card">
      {/* HEADER */}
      <div className="live-field-header">
        <div className="live-field-title">
          <div className="live-field-icon">
            <MapPinned size={15} />
          </div>

          <div>
            <span className="eyebrow">
              FIELD A-104
            </span>

            <h3>
              Tomato Field
            </h3>

            <p>
              12.4 acres · Mission CRAI-M001
            </p>
          </div>
        </div>

        <div
          className={`live-field-status ${missionStatus.toLowerCase()}`}
        >
          <span className="live-status-dot" />
          {missionStatus === "COMPLETED"
            ? "MISSION COMPLETE"
            : missionStatus === "SCANNING"
            ? "SCANNING"
            : missionStatus}
        </div>
      </div>

      {/* MAP */}
      <div className="live-field-map-wrapper">
        <div className="live-field-axis-y">
          <span>A</span>
          <span>B</span>
          <span>C</span>
          <span>D</span>
        </div>

        <div className="live-field-map-grid">
          {ROUTE.map((region, index) => {
            const observation =
              observationMap.get(region);

            const risk =
              getRiskLevel(observation);

            const score =
              getRiskScore(observation);

            const disease =
              getDiseaseName(observation);

            const isScanned =
              Boolean(observation);

            const isLastScanned =
              index ===
              scannedCount - 1;

            return (
              <div
                key={region}
                className={[
                  "live-field-cell",
                  risk,
                  isScanned
                    ? "scanned"
                    : "pending",
                  isLastScanned
                    ? "latest"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={
                  isScanned
                    ? `${region} · ${disease} · Risk ${score}`
                    : `${region} · Not scanned`
                }
              >
                <span className="live-cell-region">
                  {region}
                </span>

                {isScanned ? (
                  <strong className="live-cell-score">
                    {score}
                  </strong>
                ) : (
                  <span className="live-cell-empty">
                    —
                  </span>
                )}

                {isLastScanned && (
                  <span className="live-cell-pulse" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* LEGEND */}
      <div className="live-field-legend">
        <div className="legend-item">
          <span className="legend-dot low" />
          <span>Low</span>
        </div>

        <div className="legend-item">
          <span className="legend-dot moderate" />
          <span>Moderate</span>
        </div>

        <div className="legend-item">
          <span className="legend-dot high" />
          <span>High</span>
        </div>

        <div className="legend-item">
          <span className="legend-dot critical" />
          <span>Critical</span>
        </div>

        <div className="legend-item">
          <span className="legend-dot unscanned" />
          <span>Pending</span>
        </div>
      </div>

      {/* FOOTER */}
      <div className="live-field-footer">
        <div className="live-field-footer-left">
          <span className="telemetry-icon">
            <Radio size={12} />
          </span>

          <span>
            GPS GRID · RGB + THERMAL
          </span>
        </div>

        <div className="live-field-coverage">
          <ScanLine size={13} />

          <strong>
            {scannedCount}
          </strong>

          <span>
            / 20 scanned
          </span>
        </div>
      </div>
    </section>
  );
}