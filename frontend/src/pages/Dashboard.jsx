import React, { useMemo } from "react";

import {
  CloudSun,
  ShieldAlert,
  Thermometer,
  Activity,
  Plane,
  ArrowUpRight,
  Plus,
  Map,
  BrainCircuit,
} from "lucide-react";

import DroneFieldTwin from "../components/mission/DroneFieldTwin";
import KpiCard from "../components/ui/KpiCard";
import StatusPill from "../components/ui/StatusPill";
import SectionHeader from "../components/ui/SectionHeader";

import { useCrai } from "../context/CraiContext";

import "./Dashboard.css";


const TOTAL_CELLS = 20;
const FIELD_CELLS = ["A1","A2","A3","A4","A5","B1","B2","B3","B4","B5","C1","C2","C3","C4","C5","D1","D2","D3","D4","D5"];


/* =========================================================
   HELPERS
========================================================= */

function getRiskScore(observation) {
  const score =
    observation?.riskAI?.risk_score ??
    observation?.riskAI?.score ??
    null;

  const numericScore = Number(score);

  return Number.isFinite(numericScore)
    ? numericScore
    : null;
}


function getRiskLevel(observation) {
  return (
    observation?.riskAI?.risk_level ||
    observation?.riskAI?.level ||
    null
  );
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
   DASHBOARD
========================================================= */

export default function Dashboard({
  onNavigate,
}) {

  /* =======================================================
     CRAI SHARED STATE
  ======================================================= */

  const {
    observations,
    riskSummary,
    mission,
  } = useCrai();


  /* =======================================================
     LIVE DASHBOARD METRICS
  ======================================================= */

  const metrics = useMemo(() => {

    const total =
      observations.length;


    /* -------------------------------------------------------
       RISK
    ------------------------------------------------------- */

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


    const highestRisk =
      [...observations]
        .sort(
          (a, b) =>
            (getRiskScore(b) ?? -1) -
            (getRiskScore(a) ?? -1)
        )[0] || null;


    /* -------------------------------------------------------
       DISEASE CONFIDENCE
    ------------------------------------------------------- */

    const confidenceValues =
      observations
        .map(
          (item) =>
            Number(
              item.diseaseAI
                ?.confidence || 0
            )
        )
        .filter(
          (value) =>
            value > 0
        );


    const averageConfidence =
      confidenceValues.length
        ? confidenceValues.reduce(
            (sum, value) =>
              sum + value,
            0
          ) /
          confidenceValues.length
        : null;


    /* -------------------------------------------------------
       TEMPERATURE
    ------------------------------------------------------- */

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
          ) /
          temperatures.length
        : null;


    /* -------------------------------------------------------
       THERMAL ANOMALIES
    ------------------------------------------------------- */

    const anomalyCount =
      observations.filter(
        (item) =>
          Number(
            item.environment
              ?.thermal_anomaly ||
            0
          ) > 2
      ).length;


    /* -------------------------------------------------------
       FIELD HEALTH INDEX
       
       This is a prototype dashboard indicator derived
       from observed field risk.

       100 = lowest observed risk
       0   = highest observed risk
    ------------------------------------------------------- */

    const cropHealth =
      total &&
      averageRisk !== null
        ? Math.max(
            0,
            Math.min(
              100,
              100 - averageRisk
            )
          )
        : null;


    return {
      total,
      averageRisk,
      averageConfidence,
      highestRisk,
      averageTemperature,
      anomalyCount,
      cropHealth,
    };

  }, [
    observations,
  ]);


  const twinCells = useMemo(() => FIELD_CELLS.map((id) => {
    const observation = observations.find((item) => item.region === id);
    return {
      id,
      scanned: Boolean(observation),
      risk: getRiskLevel(observation)?.toLowerCase() || "pending",
      riskScore: getRiskScore(observation),
      disease: getDisease(observation),
      confidence: Number(observation?.diseaseAI?.confidence || 0),
    };
  }), [observations]);

  /* =======================================================
     LATEST OBSERVATION
  ======================================================= */

  const latestObservation =
    observations.length
      ? observations[
          observations.length - 1
        ]
      : null;


  /* =======================================================
     MISSION COVERAGE
  ======================================================= */

  const coverage =
    Math.round(
      Math.min(
        100,
        (observations.length /
          TOTAL_CELLS) *
          100
      )
    );


  /* =======================================================
     DISPLAY VALUES
  ======================================================= */

  const healthValue =
    metrics.cropHealth !== null
      ? `${Math.round(
          metrics.cropHealth
        )}%`
      : "—";


  const riskValue =
    observations.length
      ? riskSummary.critical > 0
        ? "Critical"
        : riskSummary.high > 0
          ? "High"
          : riskSummary.moderate > 0
            ? "Moderate"
            : "Low"
      : "—";


  const temperatureValue =
    metrics.averageTemperature !==
    null
      ? `${metrics.averageTemperature.toFixed(
          1
        )}°C`
      : "—";


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <>

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="page-heading">

        <div>

          <div className="eyebrow">
            AGRICULTURAL INTELLIGENCE
          </div>

          <h1>
            Good morning, Officer.
          </h1>

          <p>
            Here's the latest health
            overview of your monitored
            fields.
          </p>

        </div>


        <div className="heading-context">

          <div className="weather-mini">

            <CloudSun size={17} />

            <span>

              <b>
                Field monitoring active
              </b>

              <small>
                Farm A-104 · Tamil Nadu
              </small>

            </span>

          </div>


          <div className="farm-select">

            <span>
              CURRENT FIELD
            </span>

            <b>
              Farm A-104 — Tomato
            </b>

          </div>


          <StatusPill>

            {mission.status ===
            "SCANNING"
              ? "Mission active"
              : mission.status ===
                  "COMPLETED"
                ? "Mission completed"
                : "System operational"}

          </StatusPill>

        </div>

      </div>


      {/* =====================================================
          LIVE KPI GRID
      ===================================================== */}

      <div className="kpi-grid">

        {/* CROP HEALTH */}

        <KpiCard
          label="CROP HEALTH"
          value={
            healthValue
          }
          meta={
            observations.length
              ? `${observations.length} observations analyzed`
              : "Awaiting mission data"
          }
          icon={Activity}
        />


        {/* FIELD RISK */}

        <KpiCard
          label="RISK LEVEL"
          value={
            riskValue
          }
          meta={
            observations.length
              ? `${
                  riskSummary.high +
                  riskSummary.critical
                } high-priority regions`
              : "No risk observations yet"
          }
          icon={ShieldAlert}
          tone={
            riskSummary.critical >
              0 ||
            riskSummary.high > 0
              ? "danger"
              : undefined
          }
        />


        {/* FIELD TEMPERATURE */}

        <KpiCard
          label="FIELD TEMP"
          value={
            temperatureValue
          }
          meta={
            observations.length
              ? "Mission environmental observations"
              : "Awaiting field readings"
          }
          icon={Thermometer}
          tone="warning"
        />


        {/* THERMAL ANOMALIES */}

        <KpiCard
          label="ANOMALIES"
          value={
            metrics.anomalyCount
          }
          meta={
            observations.length
              ? "Thermal anomalies detected"
              : "No observations yet"
          }
          icon={Activity}
        />


        {/* MISSION COVERAGE */}

        <KpiCard
          label="MISSION"
          value={
            `${coverage}%`
          }
          meta={
            `${observations.length} / ${TOTAL_CELLS} cells analyzed`
          }
          icon={Plane}
          tone="success"
        />

      </div>


      {/* =====================================================
          DASHBOARD GRID
      ===================================================== */}

      <div className="dashboard-grid">


        {/* ===================================================
            LIVE FIELD VIEW
        =================================================== */}

        <section className="panel field-panel">

          <SectionHeader
            eyebrow="LIVE FIELD VIEW"
            title="Live Field View"
            action={

              <button
                className="text-action"
                onClick={() =>
                  onNavigate(
                    "risk"
                  )
                }
              >

                View risk map

                <ArrowUpRight
                  size={13}
                />

              </button>

            }
          />


          {/* =================================================
              REAL CRAI MISSION FIELD MAP
          ================================================= */}

          <DroneFieldTwin
            cells={twinCells}
            droneCell={latestObservation?.region || null}
            targetCell={latestObservation?.region || null}
            mode={mission.status === "SCANNING" ? "AUTONOMOUS" : "FIELD VIEW"}
            onSelectCell={() => onNavigate("risk")}
          />


          {/* =================================================
              FIELD SUMMARY
          ================================================= */}

          <div className="field-footer">

            <span>

              <i className="legend-dot green" />

              Normal

            </span>


            <span>

              <i className="legend-dot amber" />

              Monitor

            </span>


            <span>

              <i className="legend-dot red" />

              High Risk

            </span>


            <small>

              {observations.length
                ? `${observations.length} observations processed`
                : "Awaiting mission"}

            </small>

          </div>

        </section>


        {/* ===================================================
            QUICK ACTIONS
        =================================================== */}

        <section className="panel quick-panel">

          <SectionHeader
            eyebrow="OPERATIONS"
            title="Quick Actions"
          />


          <button
            className="action-button primary"
            onClick={() =>
              onNavigate(
                "missions"
              )
            }
          >

            <Plane size={15} />

            Start New Mission

            <ArrowUpRight
              size={13}
            />

          </button>


          <button
            className="action-button"
            onClick={() =>
              onNavigate(
                "risk"
              )
            }
          >

            <Map size={15} />

            View Risk Map

            <ArrowUpRight
              size={13}
            />

          </button>


          <button
            className="action-button"
            onClick={() =>
              onNavigate(
                "reports"
              )
            }
          >

            <Activity
              size={15}
            />

            View Reports

            <ArrowUpRight
              size={13}
            />

          </button>


          <button
            className="action-button"
            onClick={() =>
              onNavigate(
                "farms"
              )
            }
          >

            <Plus size={15} />

            Add Farm

            <ArrowUpRight
              size={13}
            />

          </button>

        </section>


        {/* ===================================================
            LATEST AI ANALYSIS
        =================================================== */}

        <section className="panel latest-panel">

          <SectionHeader
            eyebrow="AI INTELLIGENCE"
            title="Latest Analysis"
            action={

              <span className="model-badge">

                <BrainCircuit
                  size={13}
                />

                V2

              </span>

            }
          />


          {latestObservation ? (

            <>

              <div className="analysis-highlight">

                <div className="analysis-icon">

                  <Activity
                    size={20}
                  />

                </div>


                <div>

                  <small>
                    {
                      latestObservation
                        .summary
                        ?.crop ||
                      "FIELD"
                    }
                  </small>


                  <h3>

                    {formatDisease(
                      getDisease(
                        latestObservation
                      )
                    )}

                  </h3>


                  <span>

                    Observation{" "}

                    {
                      latestObservation
                        .region
                    }

                    {" "}· Mission AI

                  </span>

                </div>

              </div>


              <div className="confidence-row">

                <span>
                  Confidence
                </span>

                <b>

                  {Number(
                    latestObservation
                      .diseaseAI
                      ?.confidence ||
                    0
                  ).toFixed(
                    1
                  )}

                  %

                </b>

              </div>


              <div className="confidence-bar">

                <i
                  style={{
                    width: `${Math.min(
                      Number(
                        latestObservation
                          .diseaseAI
                          ?.confidence ||
                        0
                      ),
                      100
                    )}%`,
                  }}
                />

              </div>


              <div className="analysis-facts">

                <div>

                  <span>
                    Region
                  </span>

                  <b>
                    {
                      latestObservation
                        .region
                    }
                  </b>

                </div>


                <div>

                  <span>
                    Risk
                  </span>

                  <b className="red-text">

                    {
                      getRiskLevel(
                        latestObservation
                      ) ||
                      "—"
                    }

                  </b>

                </div>


                <div>

                  <span>
                    Score
                  </span>

                  <b>

                    {getRiskScore(
                      latestObservation
                    ) !== null
                      ? getRiskScore(
                          latestObservation
                        ).toFixed(
                          1
                        )
                      : "—"}

                  </b>

                </div>

              </div>

            </>

          ) : (

            <div className="dashboard-empty">

              <BrainCircuit
                size={22}
              />

              <strong>
                Awaiting AI analysis
              </strong>

              <span>

                Start a mission to populate
                live disease intelligence.

              </span>

            </div>

          )}


          <button
            className="outline-button"
            onClick={() =>
              onNavigate(
                "ai"
              )
            }
          >

            Open AI Analysis

            <ArrowUpRight
              size={13}
            />

          </button>

        </section>


        {/* ===================================================
            RECENT DETECTIONS
        =================================================== */}

        <section className="panel detections-panel">

          <SectionHeader
            eyebrow="RECENT DETECTIONS"
            title="Field Signals"
            action={

              <button
                className="text-action"
                onClick={() =>
                  onNavigate(
                    "risk"
                  )
                }
              >

                View all

                <ArrowUpRight
                  size={13}
                />

              </button>

            }
          />


          {observations.length ? (

            <div className="detection-list">

              {[...observations]
                .reverse()
                .slice(
                  0,
                  5
                )
                .map(
                  (
                    observation
                  ) => {

                    const risk =
                      getRiskLevel(
                        observation
                      ) ||
                      "LOW";


                    return (

                      <div
                        className="detection-row"
                        key={
                          observation.id
                        }
                      >

                        <div className="region-chip">

                          {
                            observation.region
                          }

                        </div>


                        <div className="detection-main">

                          <b>

                            {formatDisease(
                              getDisease(
                                observation
                              )
                            )}

                          </b>


                          <span>

                            {Number(
                              observation
                                .diseaseAI
                                ?.confidence ||
                              0
                            ).toFixed(
                              1
                            )}

                            % confidence

                          </span>

                        </div>


                        <span
                          className={`risk-tag ${risk.toLowerCase()}`}
                        >

                          {risk}

                        </span>

                      </div>

                    );

                  }
                )}

            </div>

          ) : (

            <div className="dashboard-empty">

              <Activity
                size={22}
              />

              <strong>
                No field signals yet
              </strong>

              <span>

                Mission observations will
                appear here automatically.

              </span>

            </div>

          )}

        </section>


      </div>

    </>
  );
}