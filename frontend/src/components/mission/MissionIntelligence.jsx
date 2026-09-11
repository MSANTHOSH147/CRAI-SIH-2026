import React from "react";
import {
  BrainCircuit,
  ShieldAlert,
  Thermometer,
  Droplets,
  Flame,
  Check,
  Clock3,
} from "lucide-react";

import "./MissionIntelligence.css";

function formatDisease(disease) {
  if (!disease) {
    return "No disease detected";
  }

  return disease
    .replace(/^Tomato_/, "")
    .replace(/^Potato_/, "")
    .replaceAll("_", " ");
}

function getRiskClass(level) {
  return (
    level?.toLowerCase() ||
    "pending"
  );
}

function PipelineStep({
  label,
  status,
}) {
  const completed =
    status === "ready" ||
    status === "captured" ||
    status === "completed";

  return (
    <div
      className={`pipeline-step ${
        completed
          ? "completed"
          : ""
      }`}
    >
      <div className="pipeline-check">
        {completed ? (
          <Check size={11} />
        ) : (
          <Clock3 size={11} />
        )}
      </div>

      <span>
        {label}
      </span>
    </div>
  );
}

function PipelineLine() {
  return (
    <div className="pipeline-line" />
  );
}

export default function MissionIntelligence({
  observation,
}) {
  if (!observation) {
    return (
      <section className="panel mission-intelligence">

        <div className="mission-intelligence-header">

          <div>
            <span className="eyebrow">
              AI INTELLIGENCE
            </span>

            <h3>
              Awaiting observation
            </h3>
          </div>

          <span className="mission-live-badge">
            <span />
            LIVE
          </span>

        </div>

        <div className="mission-intelligence-empty">

          <BrainCircuit
            size={24}
          />

          <p>
            Start the mission to
            generate disease and
            risk intelligence.
          </p>

        </div>

      </section>
    );
  }

  const diseaseAI =
    observation.diseaseAI ||
    {};

  const riskAI =
    observation.riskAI ||
    {};

  const environment =
    observation.environment ||
    {};

  const pipeline =
    observation.pipeline ||
    {};

  const diseaseName =
    diseaseAI.disease ||
    diseaseAI.prediction ||
    null;

  const confidence =
    Number(
      diseaseAI.confidence || 0
    );

  const riskScore =
    riskAI.risk_score ??
    riskAI.score ??
    null;

  const riskLevel =
    riskAI.risk_level ||
    riskAI.level ||
    "PENDING";

  return (
    <section className="panel mission-intelligence">

      {/* HEADER */}

      <div className="mission-intelligence-header">

        <div>

          <span className="eyebrow">
            AI INTELLIGENCE
          </span>

          <h3>
            Observation{" "}
            {observation.region}
          </h3>

        </div>

        <span className="mission-live-badge">
          <span />
          LIVE
        </span>

      </div>

      {/* AI CARDS */}

      <div className="intelligence-grid">

        {/* DISEASE */}

        <div className="intelligence-card">

          <div className="intelligence-card-top">

            <div className="intelligence-icon disease">
              <BrainCircuit
                size={15}
              />
            </div>

            <span>
              DISEASE AI
            </span>

          </div>

          <strong className="intelligence-primary">

            {formatDisease(
              diseaseName
            )}

          </strong>

          <div className="intelligence-secondary">

            {confidence > 0
              ? `${confidence.toFixed(
                  1
                )}% confidence`
              : "Analysis pending"}

          </div>

          {confidence > 0 && (
            <div className="intelligence-confidence">

              <span
                style={{
                  width: `${Math.min(
                    confidence,
                    100
                  )}%`,
                }}
              />

            </div>
          )}

        </div>

        {/* RISK */}

        <div className="intelligence-card">

          <div className="intelligence-card-top">

            <div className="intelligence-icon risk">
              <ShieldAlert
                size={15}
              />
            </div>

            <span>
              RISK AI
            </span>

          </div>

          <strong
            className={`intelligence-primary risk-value ${getRiskClass(
              riskLevel
            )}`}
          >
            {riskLevel}
          </strong>

          <div className="intelligence-secondary">

            {riskScore !== null
              ? `Score ${Number(
                  riskScore
                ).toFixed(1)}`
              : "Score —"}

          </div>

        </div>

      </div>

      {/* FIELD CONDITIONS */}

      <div className="environment-section">

        <div className="environment-heading">

          <span className="eyebrow">
            FIELD CONDITIONS
          </span>

          <span className="environment-source">

            {environment.source ===
            "simulated"
              ? "SIMULATED SENSOR"
              : "FIELD SENSOR"}

          </span>

        </div>

        <div className="environment-grid">

          <div className="environment-item">

            <Thermometer
              size={14}
            />

            <div>

              <span>
                TEMPERATURE
              </span>

              <strong>
                {environment.temperature ??
                  "—"}
                °C
              </strong>

            </div>

          </div>

          <div className="environment-item">

            <Droplets
              size={14}
            />

            <div>

              <span>
                HUMIDITY
              </span>

              <strong>
                {environment.humidity ??
                  "—"}
                %
              </strong>

            </div>

          </div>

          <div className="environment-item">

            <Flame
              size={14}
            />

            <div>

              <span>
                THERMAL ANOMALY
              </span>

              <strong>
                {environment.thermal_anomaly ??
                  "—"}
                °C
              </strong>

            </div>

          </div>

        </div>

      </div>

      {/* PIPELINE */}

      <div className="mission-pipeline">

        <span className="eyebrow">
          INTELLIGENCE PIPELINE
        </span>

        <div className="pipeline-steps">

          <PipelineStep
            label="GPS"
            status={
              pipeline.gps ||
              "ready"
            }
          />

          <PipelineLine />

          <PipelineStep
            label="RGB"
            status={
              pipeline.image ||
              "captured"
            }
          />

          <PipelineLine />

          <PipelineStep
            label="DISEASE AI"
            status={
              pipeline.diseaseAI ||
              "completed"
            }
          />

          <PipelineLine />

          <PipelineStep
            label="RISK AI"
            status={
              pipeline.riskAI ||
              "completed"
            }
          />

        </div>

      </div>

    </section>
  );
}