import React, {
  useMemo,
} from "react";

import {
  AlertTriangle,
  ShieldCheck,
  Activity,
  MapPinned,
} from "lucide-react";

import {
  useCrai,
} from "../context/CraiContext";

import "./RiskMap.css";

const ROUTE = [
  "A1", "A2", "A3", "A4", "A5",
  "B5", "B4", "B3", "B2", "B1",
  "C1", "C2", "C3", "C4", "C5",
  "D5", "D4", "D3", "D2", "D1",
];

function getRiskClass(level) {
  return (
    level?.toLowerCase() ||
    "unscanned"
  );
}

function getRiskScore(observation) {
  return (
    observation?.riskAI
      ?.risk_score ??
    observation?.riskAI
      ?.score ??
    null
  );
}

function getDisease(observation) {
  return (
    observation?.diseaseAI
      ?.disease ||
    observation?.diseaseAI
      ?.prediction ||
    "—"
  )
    .replaceAll("_", " ");
}

export default function RiskMap() {
  const {
    observations,
    riskSummary,
    mission,
  } = useCrai();

  const observationMap =
    useMemo(() => {
      return new Map(
        observations.map(
          (observation) => [
            observation.region,
            observation,
          ]
        )
      );
    }, [observations]);

  const averageRisk = useMemo(() => {
    const scores =
      observations
        .map(
          (item) =>
            getRiskScore(item)
        )
        .filter(
          (score) =>
            typeof score ===
            "number"
        );

    if (!scores.length) {
      return null;
    }

    return (
      scores.reduce(
        (sum, score) =>
          sum + score,
        0
      ) / scores.length
    );
  }, [observations]);

  return (
    <>
      <div className="page-heading">

        <div>
          <div className="eyebrow">
            AGRICULTURAL INTELLIGENCE
          </div>

          <h1>
            Risk Map
          </h1>

          <p>
            Spatial crop-risk intelligence
            generated from the latest CRAI
            mission observations.
          </p>
        </div>

        <div className="risk-map-context">

          <span>
            MISSION
          </span>

          <strong>
            {mission.id}
          </strong>

        </div>

      </div>

      {/* SUMMARY */}

      <div className="risk-summary-grid">

        <SummaryCard
          label="OBSERVATIONS"
          value={
            riskSummary.total
          }
          icon={Activity}
        />

        <SummaryCard
          label="LOW RISK"
          value={
            riskSummary.low
          }
          icon={ShieldCheck}
          tone="low"
        />

        <SummaryCard
          label="HIGH RISK"
          value={
            riskSummary.high
          }
          icon={AlertTriangle}
          tone="high"
        />

        <SummaryCard
          label="CRITICAL"
          value={
            riskSummary.critical
          }
          icon={AlertTriangle}
          tone="critical"
        />

      </div>

      <div className="risk-map-layout">

        {/* MAP */}

        <section className="panel risk-field-panel">

          <div className="risk-panel-header">

            <div>
              <span className="eyebrow">
                FIELD RISK MODEL
              </span>

              <h2>
                Farm A-104
              </h2>

              <p>
                Tomato Field ·{" "}
                {mission.area} acres
              </p>
            </div>

            <div className="risk-average">

              <span>
                AVG RISK
              </span>

              <strong>
                {averageRisk !== null
                  ? averageRisk.toFixed(
                      1
                    )
                  : "—"}
              </strong>

            </div>

          </div>

          <div className="risk-field-map">

            <div className="risk-grid">

              {ROUTE.map(
                (region) => {
                  const observation =
                    observationMap.get(
                      region
                    );

                  const level =
                    observation
                      ?.riskAI
                      ?.risk_level;

                  const score =
                    getRiskScore(
                      observation
                    );

                  const disease =
                    getDisease(
                      observation
                    );

                  return (
                    <div
                      key={region}
                      className={`risk-cell ${getRiskClass(
                        level
                      )}`}
                    >

                      <div className="risk-cell-region">
                        {region}
                      </div>

                      {observation ? (
                        <>
                          <strong>
                            {level}
                          </strong>

                          <span>
                            {score !== null
                              ? score.toFixed(
                                  1
                                )
                              : "—"}
                          </span>
                        </>
                      ) : (
                        <small>
                          NOT SCANNED
                        </small>
                      )}

                      {observation && (
                        <div className="risk-cell-tooltip">

                          <b>
                            {region}
                          </b>

                          <span>
                            {disease}
                          </span>

                          <span>
                            Risk:{" "}
                            {score !== null
                              ? score.toFixed(
                                  1
                                )
                              : "—"}
                          </span>

                        </div>
                      )}

                    </div>
                  );
                }
              )}

            </div>

            <div className="risk-map-overlay">

              <MapPinned
                size={13}
              />

              <span>
                GPS GRID · FIELD A-104
              </span>

            </div>

          </div>

          {/* LEGEND */}

          <div className="risk-legend">

            <span>
              <i className="low" />
              Low
            </span>

            <span>
              <i className="moderate" />
              Moderate
            </span>

            <span>
              <i className="high" />
              High
            </span>

            <span>
              <i className="critical" />
              Critical
            </span>

            <span>
              <i className="unscanned" />
              Not scanned
            </span>

          </div>

        </section>

        {/* DETAILS */}

        <section className="panel risk-details-panel">

          <div className="risk-panel-header">

            <div>
              <span className="eyebrow">
                AI SIGNALS
              </span>

              <h2>
                Risk Observations
              </h2>
            </div>

          </div>

          {observations.length === 0 ? (
            <div className="risk-empty">

              <MapPinned
                size={22}
              />

              <strong>
                No mission observations
              </strong>

              <p>
                Run a mission to populate
                the field risk model.
              </p>

            </div>
          ) : (
            <div className="risk-observation-list">

              {[...observations]
                .reverse()
                .map(
                  (
                    observation
                  ) => (
                    <div
                      className="risk-observation"
                      key={
                        observation.id
                      }
                    >

                      <div className="risk-observation-region">
                        {
                          observation.region
                        }
                      </div>

                      <div className="risk-observation-main">

                        <strong>
                          {getDisease(
                            observation
                          )}
                        </strong>

                        <span>
                          Disease confidence{" "}
                          {Number(
                            observation
                              .diseaseAI
                              ?.confidence ||
                              0
                          ).toFixed(
                            1
                          )}
                          %
                        </span>

                      </div>

                      <div
                        className={`risk-observation-score ${getRiskClass(
                          observation
                            .riskAI
                            ?.risk_level
                        )}`}
                      >

                        <strong>
                          {
                            observation
                              .riskAI
                              ?.risk_level
                          }
                        </strong>

                        <span>
                          {getRiskScore(
                            observation
                          ) !== null
                            ? getRiskScore(
                                observation
                              ).toFixed(
                                1
                              )
                            : "—"}
                        </span>

                      </div>

                    </div>
                  )
                )}

            </div>
          )}

        </section>

      </div>
    </>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}) {
  return (
    <section className="panel risk-summary-card">

      <div
        className={`risk-summary-icon ${
          tone || ""
        }`}
      >
        <Icon size={16} />
      </div>

      <div>

        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>

      </div>

    </section>
  );
}