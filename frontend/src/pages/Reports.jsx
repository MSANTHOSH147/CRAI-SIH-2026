import React, { useMemo } from "react";

import {
  FileText,
  Download,
  ArrowUpRight,
  Activity,
  ShieldAlert,
  MapPinned,
  BrainCircuit,
  Thermometer,
  CheckCircle2,
} from "lucide-react";

import { useCrai } from "../context/CraiContext";
import "./Reports.css";


const TOTAL_CELLS = 20;


/* =========================================================
   HELPERS
========================================================= */

function getRiskScore(observation) {
  const value =
    observation?.riskAI?.risk_score ??
    observation?.riskAI?.score ??
    null;

  const score = Number(value);

  return Number.isFinite(score)
    ? score
    : null;
}


function getRiskLevel(observation) {
  return (
    observation?.riskAI?.risk_level ||
    observation?.riskAI?.level ||
    "UNKNOWN"
  ).toUpperCase();
}


function getDisease(observation) {
  return (
    observation?.diseaseAI?.disease ||
    observation?.diseaseAI?.prediction ||
    "Healthy"
  );
}


function formatDisease(disease) {
  return String(disease)
    .replace(/^Tomato_/, "")
    .replace(/^Potato_/, "")
    .replaceAll("_", " ");
}


/* =========================================================
   REPORTS PAGE
========================================================= */

export default function Reports() {

  const {
    observations,
    riskSummary,
    diseaseSummary,
    mission,
  } = useCrai();


  /* =======================================================
     REPORT METRICS
  ======================================================= */

  const report = useMemo(() => {

    const scores =
      observations
        .map(getRiskScore)
        .filter(
          (score) =>
            score !== null
        );


    const averageRisk =
      scores.length
        ? scores.reduce(
            (sum, score) =>
              sum + score,
            0
          ) / scores.length
        : null;


    const maximumRisk =
      scores.length
        ? Math.max(...scores)
        : null;


    const highestRiskObservation =
      observations.reduce(
        (highest, current) => {

          const currentScore =
            getRiskScore(current) ?? -1;

          const highestScore =
            highest
              ? getRiskScore(highest) ?? -1
              : -1;

          return currentScore >
            highestScore
            ? current
            : highest;

        },
        null
      );


    const temperatures =
      observations
        .map(
          (item) =>
            Number(
              item.environment
                ?.temperature
            )
        )
        .filter(
          (value) =>
            Number.isFinite(value)
        );


    const averageTemperature =
      temperatures.length
        ? temperatures.reduce(
            (sum, value) =>
              sum + value,
            0
          ) / temperatures.length
        : null;


    const anomalies =
      observations.filter(
        (item) =>
          Number(
            item.environment
              ?.thermal_anomaly ||
            0
          ) > 2
      ).length;


    const coverage =
      Math.round(
        Math.min(
          100,
          (observations.length /
            TOTAL_CELLS) *
            100
        )
      );


    const priorityZones =
      [...observations]
        .filter(
          (observation) => {

            const risk =
              getRiskScore(
                observation
              );

            return (
              risk !== null &&
              risk >= 60
            );

          }
        )
        .sort(
          (a, b) =>
            (getRiskScore(b) ?? 0) -
            (getRiskScore(a) ?? 0)
        );


    const diseaseEntries =
      Object.entries(
        diseaseSummary || {}
      ).sort(
        (a, b) =>
          b[1] - a[1]
      );


    return {
      averageRisk,
      maximumRisk,
      highestRiskObservation,
      averageTemperature,
      anomalies,
      coverage,
      priorityZones,
      diseaseEntries,
    };

  }, [
    observations,
    diseaseSummary,
  ]);


  /* =======================================================
     FIELD RISK LABEL
  ======================================================= */

  const fieldRisk =
    report.averageRisk === null
      ? "NO DATA"
      : report.averageRisk >= 80
        ? "CRITICAL"
        : report.averageRisk >= 60
          ? "HIGH"
          : report.averageRisk >= 30
            ? "MODERATE"
            : "LOW";


  /* =======================================================
     REPORT STATUS
  ======================================================= */

  const reportReady =
    observations.length > 0;


  /* =======================================================
     EXPORT REPORT
  ======================================================= */

  const handleExport = () => {

    const lines = [
      "CRAI FIELD INTELLIGENCE REPORT",
      "================================",
      "",
      `Mission: ${
        mission?.id ||
        "CRAI-M001"
      }`,
      `Farm: ${
        mission?.farmId ||
        "A-104"
      }`,
      `Crop: ${
        mission?.crop ||
        "Tomato"
      }`,
      `Area: ${
        mission?.area ||
        "12.4"
      } acres`,
      "",
      "FIELD SUMMARY",
      "-------------",
      `Observations: ${
        observations.length
      } / ${TOTAL_CELLS}`,
      `Coverage: ${
        report.coverage
      }%`,
      `Average Risk: ${
        report.averageRisk !== null
          ? report.averageRisk.toFixed(1)
          : "N/A"
      }`,
      `Field Risk: ${fieldRisk}`,
      `Maximum Risk: ${
        report.maximumRisk !== null
          ? report.maximumRisk.toFixed(1)
          : "N/A"
      }`,
      `Thermal Anomalies: ${
        report.anomalies
      }`,
      "",
      "RISK DISTRIBUTION",
      "-----------------",
      `Low: ${
        riskSummary.low
      }`,
      `Moderate: ${
        riskSummary.moderate
      }`,
      `High: ${
        riskSummary.high
      }`,
      `Critical: ${
        riskSummary.critical
      }`,
      "",
      "PRIORITY ZONES",
      "--------------",
    ];


    report.priorityZones
      .slice(0, 10)
      .forEach(
        (observation) => {

          lines.push(
            `${
              observation.region
            } | ${
              getRiskLevel(
                observation
              )
            } | ${
              getRiskScore(
                observation
              )?.toFixed(1)
            } | ${
              formatDisease(
                getDisease(
                  observation
                )
              )
            }`
          );

        }
      );


    lines.push(
      "",
      "DISEASE SIGNALS",
      "---------------"
    );


    report.diseaseEntries
      .forEach(
        ([disease, count]) => {

          lines.push(
            `${formatDisease(
              disease
            )}: ${count}`
          );

        }
      );


    lines.push(
      "",
      "AI MODELS",
      "---------",
      "Disease AI: MobileNetV3-Small V2",
      "Risk AI: GradientBoosting V1",
      "Risk Features: 27",
      "",
      "NOTE",
      "----",
      "Environmental values in the current mission prototype may be simulated.",
      "Risk AI V1 uses synthetic prototype training data.",
    );


    const blob =
      new Blob(
        [lines.join("\n")],
        {
          type: "text/plain",
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );


    const anchor =
      document.createElement(
        "a"
      );

    anchor.href = url;

    anchor.download =
      `${
        mission?.id ||
        "CRAI-M001"
      }-field-report.txt`;

    document.body.appendChild(
      anchor
    );

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(
      url
    );
  };


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="reports-page">

      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="reports-header">

        <div>

          <div className="eyebrow">
            FIELD INTELLIGENCE
          </div>

          <h1>
            Reports
          </h1>

          <p>
            Mission-derived crop risk,
            disease signals and priority
            zones for Farm A-104.
          </p>

        </div>


        <div className="reports-header-actions">

          <span
            className={`report-status ${
              reportReady
                ? "ready"
                : "waiting"
            }`}
          >

            {reportReady ? (
              <CheckCircle2
                size={13}
              />
            ) : (
              <Activity
                size={13}
              />
            )}

            {reportReady
              ? "REPORT READY"
              : "AWAITING MISSION"}

          </span>


          <button
            className="report-export-button"
            onClick={
              handleExport
            }
            disabled={
              !reportReady
            }
          >

            <Download
              size={14}
            />

            Export Report

          </button>

        </div>

      </div>


      {/* ===================================================
          REPORT IDENTITY
      =================================================== */}

      <section className="report-identity panel">

        <div className="report-identity-main">

          <div className="report-file-icon">

            <FileText
              size={18}
            />

          </div>


          <div>

            <span className="eyebrow">
              CRAI FIELD REPORT
            </span>

            <h2>
              {mission?.id ||
                "CRAI-M001"}
            </h2>

            <p>
              Farm{" "}
              {mission?.farmId ||
                "A-104"}{" "}
              ·{" "}
              {mission?.crop ||
                "Tomato"}{" "}
              Field ·{" "}
              {mission?.area ||
                "12.4"}{" "}
              acres
            </p>

          </div>

        </div>


        <div className="report-meta">

          <span>
            REPORT STATUS
          </span>

          <strong>
            {reportReady
              ? "COMPLETE"
              : "PENDING"}
          </strong>

        </div>

      </section>


      {/* ===================================================
          SUMMARY CARDS
      =================================================== */}

      <div className="report-summary-grid">

        <div className="report-stat">

          <div className="report-stat-icon">

            <Activity
              size={15}
            />

          </div>

          <span>
            OBSERVATIONS
          </span>

          <strong>
            {observations.length}
            <small>
              / {TOTAL_CELLS}
            </small>
          </strong>

          <p>
            Mission coverage
          </p>

        </div>


        <div className="report-stat">

          <div className="report-stat-icon">

            <ShieldAlert
              size={15}
            />

          </div>

          <span>
            FIELD RISK
          </span>

          <strong>
            {fieldRisk}
          </strong>

          <p>
            Avg. score{" "}
            {report.averageRisk !==
            null
              ? report.averageRisk.toFixed(
                  1
                )
              : "—"}
          </p>

        </div>


        <div className="report-stat">

          <div className="report-stat-icon">

            <MapPinned
              size={15}
            />

          </div>

          <span>
            PRIORITY ZONES
          </span>

          <strong>
            {
              report.priorityZones
                .length
            }
          </strong>

          <p>
            High + critical
          </p>

        </div>


        <div className="report-stat">

          <div className="report-stat-icon">

            <Thermometer
              size={15}
            />

          </div>

          <span>
            THERMAL SIGNALS
          </span>

          <strong>
            {report.anomalies}
          </strong>

          <p>
            Anomalies &gt; 2°C
          </p>

        </div>

      </div>


      {/* ===================================================
          MAIN REPORT GRID
      =================================================== */}

      <div className="reports-grid">


        {/* =================================================
            RISK DISTRIBUTION
        ================================================= */}

        <section className="panel report-panel">

          <div className="report-panel-header">

            <div>

              <span className="eyebrow">
                RISK DISTRIBUTION
              </span>

              <h2>
                Field Risk Profile
              </h2>

            </div>

            <ShieldAlert
              size={17}
            />

          </div>


          <div className="risk-distribution">

            {[
              {
                label: "Low",
                value: riskSummary.low,
                className: "low",
              },
              {
                label: "Moderate",
                value:
                  riskSummary.moderate,
                className:
                  "moderate",
              },
              {
                label: "High",
                value:
                  riskSummary.high,
                className: "high",
              },
              {
                label: "Critical",
                value:
                  riskSummary.critical,
                className:
                  "critical",
              },
            ].map(
              (item) => {

                const percentage =
                  observations.length
                    ? (
                        (item.value /
                          observations.length) *
                        100
                      )
                    : 0;

                return (

                  <div
                    className="risk-distribution-row"
                    key={
                      item.label
                    }
                  >

                    <div className="risk-row-label">

                      <span
                        className={`risk-indicator ${item.className}`}
                      />

                      <span>
                        {item.label}
                      </span>

                      <strong>
                        {item.value}
                      </strong>

                    </div>


                    <div className="risk-bar">

                      <i
                        className={
                          item.className
                        }
                        style={{
                          width: `${percentage}%`,
                        }}
                      />

                    </div>


                    <small>
                      {Math.round(
                        percentage
                      )}%
                    </small>

                  </div>

                );

              }
            )}

          </div>

        </section>


        {/* =================================================
            DISEASE SIGNALS
        ================================================= */}

        <section className="panel report-panel">

          <div className="report-panel-header">

            <div>

              <span className="eyebrow">
                DISEASE SIGNALS
              </span>

              <h2>
                Detected Conditions
              </h2>

            </div>

            <BrainCircuit
              size={17}
            />

          </div>


          {report.diseaseEntries.length ? (

            <div className="disease-report-list">

              {report.diseaseEntries
                .slice(0, 7)
                .map(
                  (
                    [
                      disease,
                      count,
                    ]
                  ) => (

                    <div
                      className="disease-report-row"
                      key={
                        disease
                      }
                    >

                      <div className="disease-report-name">

                        <span />

                        <strong>
                          {formatDisease(
                            disease
                          )}
                        </strong>

                      </div>


                      <div className="disease-report-count">

                        <b>
                          {count}
                        </b>

                        <small>
                          observations
                        </small>

                      </div>

                    </div>

                  )
                )}

            </div>

          ) : (

            <div className="report-empty">

              <BrainCircuit
                size={22}
              />

              <strong>
                No disease signals
              </strong>

              <span>
                Complete a mission to
                populate this report.
              </span>

            </div>

          )}

        </section>


        {/* =================================================
            PRIORITY ZONES
        ================================================= */}

        <section className="panel report-panel priority-panel">

          <div className="report-panel-header">

            <div>

              <span className="eyebrow">
                PRIORITY ZONES
              </span>

              <h2>
                Areas Requiring Attention
              </h2>

            </div>

            <MapPinned
              size={17}
            />

          </div>


          {report.priorityZones.length ? (

            <div className="priority-table">

              <div className="priority-table-head">

                <span>
                  REGION
                </span>

                <span>
                  SIGNAL
                </span>

                <span>
                  RISK
                </span>

                <span>
                  SCORE
                </span>

              </div>


              {report.priorityZones
                .slice(0, 8)
                .map(
                  (
                    observation
                  ) => {

                    const risk =
                      getRiskLevel(
                        observation
                      );

                    return (

                      <div
                        className="priority-table-row"
                        key={
                          observation.id
                        }
                      >

                        <strong>
                          {
                            observation.region
                          }
                        </strong>


                        <span>
                          {formatDisease(
                            getDisease(
                              observation
                            )
                          )}
                        </span>


                        <b
                          className={`priority-risk ${risk.toLowerCase()}`}
                        >
                          {risk}
                        </b>


                        <strong>
                          {getRiskScore(
                            observation
                          )?.toFixed(
                            1
                          ) ?? "—"}
                        </strong>

                      </div>

                    );

                  }
                )}

            </div>

          ) : (

            <div className="report-empty">

              <MapPinned
                size={22}
              />

              <strong>
                No priority zones
              </strong>

              <span>
                High-risk observations
                will appear here.
              </span>

            </div>

          )}

        </section>


        {/* =================================================
            MODEL & MISSION INFO
        ================================================= */}

        <section className="panel report-panel">

          <div className="report-panel-header">

            <div>

              <span className="eyebrow">
                SYSTEM CONTEXT
              </span>

              <h2>
                AI & Mission Metadata
              </h2>

            </div>

            <BrainCircuit
              size={17}
            />

          </div>


          <div className="metadata-list">

            <div>

              <span>
                Disease AI
              </span>

              <strong>
                MobileNetV3-Small V2
              </strong>

            </div>


            <div>

              <span>
                Disease Classes
              </span>

              <strong>
                11
              </strong>

            </div>


            <div>

              <span>
                Risk AI
              </span>

              <strong>
                GradientBoosting V1
              </strong>

            </div>


            <div>

              <span>
                Risk Features
              </span>

              <strong>
                27
              </strong>

            </div>


            <div>

              <span>
                Mission Payload
              </span>

              <strong>
                RGB + THERMAL
              </strong>

            </div>


            <div>

              <span>
                GPS Grid
              </span>

              <strong>
                A1 — D5
              </strong>

            </div>

          </div>


          <div className="report-disclaimer">

            <ShieldAlert
              size={13}
            />

            <span>
              Current mission environmental
              values are prototype/simulated
              inputs. Risk AI V1 was trained
              using synthetic prototype data.
            </span>

          </div>

        </section>

      </div>


      {/* ===================================================
          REPORT FOOTER
      =================================================== */}

      <div className="report-footer">

        <div>

          <CheckCircle2
            size={14}
          />

          <span>
            CRAI intelligence pipeline
            processed{" "}
            {observations.length}
            {" "}observations.
          </span>

        </div>


        <span>
          Disease AI V2 · Risk AI V1
        </span>

      </div>

    </div>
  );
}