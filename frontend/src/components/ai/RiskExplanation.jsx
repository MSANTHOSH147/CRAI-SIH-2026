import React from "react";
import {
  BrainCircuit,
  Thermometer,
  MapPinned,
  History,
  ShieldCheck,
  Droplets,
  Gauge,
  CheckCircle2,
  CircleAlert,
  Activity,
  Info,
} from "lucide-react";

import "./RiskExplanation.css";


/* =========================================================
   HELPERS
========================================================= */

function safeNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}


function formatName(value) {
  if (!value) {
    return "Unknown";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}


function formatDisease(value) {
  if (!value) {
    return "Unknown";
  }

  return formatName(value)
    .replace(/^Tomato\s+/i, "")
    .replace(/^Potato\s+/i, "");
}


function getTone(score) {
  const value = safeNumber(score);

  if (value >= 70) {
    return "high";
  }

  if (value >= 40) {
    return "medium";
  }

  return "low";
}


function getSeverityLabel(score) {
  const value = safeNumber(score);

  if (value >= 70) {
    return "HIGH";
  }

  if (value >= 40) {
    return "MODERATE";
  }

  return "LOW";
}


function formatContribution(value) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return Number(value).toFixed(2);
}


function formatScore(value) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return Number(value).toFixed(1);
}


/* =========================================================
   SAFE TEXT HELPER
   Prevents React from trying to render backend objects.
========================================================= */

function safeText(value, fallback = "") {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) =>
        safeText(item, "")
      )
      .filter(Boolean)
      .join(" ");
  }

  if (typeof value === "object") {
    return (
      value.reason ||
      value.message ||
      value.explanation ||
      value.text ||
      value.description ||
      fallback
    );
  }

  return fallback;
}


/* =========================================================
   SAFE EXPLANATION NORMALIZER
========================================================= */

function normalizeExplanation(value) {
  if (!value) {
    return [];
  }

  const items = Array.isArray(value)
    ? value
    : [value];

  return items
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (
        item &&
        typeof item === "object"
      ) {
        return (
          item.reason ||
          item.message ||
          item.explanation ||
          item.text ||
          item.description ||
          ""
        );
      }

      return "";
    })
    .filter(Boolean);
}


/* =========================================================
   PREDICTION
========================================================= */

function getPrediction(
  riskAI,
  breakdown
) {
  return (
    riskAI?.prediction ||
    riskAI?.dominant_disease ||
    riskAI?.disease ||
    breakdown?.visual?.prediction ||
    breakdown?.visual?.disease ||
    breakdown?.visual?.label ||
    "Unknown"
  );
}


/* =========================================================
   EVIDENCE CONFIG
========================================================= */

const evidenceConfig = {
  visual: {
    title: "Visual Intelligence",
    subtitle: "Disease signal",
    icon: BrainCircuit,
  },

  environmental: {
    title: "Environmental Conditions",
    subtitle: "Field conditions",
    icon: Thermometer,
  },

  spatial: {
    title: "Spatial Spread",
    subtitle: "Observed-zone spread",
    icon: MapPinned,
  },

  temporal: {
    title: "Temporal Trend",
    subtitle: "Recent risk trend",
    icon: History,
  },
};


const evidenceOrder = [
  "visual",
  "environmental",
  "spatial",
  "temporal",
];


/* =========================================================
   ENVIRONMENT DETAILS
========================================================= */

function EnvironmentalDetails({
  components = {},
}) {
  const values = [
    {
      label: "Soil moisture",
      value:
        components.soil_moisture !== null &&
        components.soil_moisture !== undefined
          ? `${safeNumber(
              components.soil_moisture
            ).toFixed(1)}%`
          : "Unavailable",
      icon: Droplets,
    },

    {
      label: "Temperature",
      value:
        components.temperature !== null &&
        components.temperature !== undefined
          ? `${safeNumber(
              components.temperature
            ).toFixed(1)}°C`
          : "Unavailable",
      icon: Thermometer,
    },

    {
      label: "Humidity",
      value:
        components.humidity !== null &&
        components.humidity !== undefined
          ? `${safeNumber(
              components.humidity
            ).toFixed(1)}%`
          : "Unavailable",
      icon: Activity,
    },

    {
      label: "Thermal anomaly",
      value:
        components.thermal_anomaly !== null &&
        components.thermal_anomaly !== undefined
          ? safeNumber(
              components.thermal_anomaly
            ).toFixed(1)
          : "Unavailable",
      icon: Gauge,
    },
  ];

  return (
    <div className="crai-detail-grid crai-detail-grid--four">

      {values.map(
        ({
          label,
          value,
          icon: Icon,
        }) => (
          <div
            className="crai-detail-item"
            key={label}
          >
            <Icon
              size={16}
              className="crai-detail-icon"
            />

            <span>
              {label}
            </span>

            <strong>
              {value}
            </strong>
          </div>
        )
      )}

    </div>
  );
}


/* =========================================================
   SPATIAL DETAILS
========================================================= */

function SpatialDetails({
  components = {},
}) {
  const affected = safeNumber(
    components.infected_neighbors
  );

  const observed = safeNumber(
    components.total_neighbors
  );

  const ratio =
    components.infection_ratio !== null &&
    components.infection_ratio !== undefined
      ? safeNumber(
          components.infection_ratio
        )
      : observed > 0
      ? (affected / observed) * 100
      : 0;

  const clusterDensity = safeNumber(
    components.cluster_density
  );

  return (
    <div className="crai-detail-grid crai-detail-grid--four">

      <div className="crai-detail-item">
        <MapPinned
          size={16}
          className="crai-detail-icon"
        />

        <span>
          Affected
        </span>

        <strong>
          {affected}
        </strong>
      </div>


      <div className="crai-detail-item">
        <Activity
          size={16}
          className="crai-detail-icon"
        />

        <span>
          Observed
        </span>

        <strong>
          {observed}
        </strong>
      </div>


      <div className="crai-detail-item">
        <Activity
          size={16}
          className="crai-detail-icon"
        />

        <span>
          Infection ratio
        </span>

        <strong>
          {ratio.toFixed(1)}%
        </strong>
      </div>


      <div className="crai-detail-item">
        <MapPinned
          size={16}
          className="crai-detail-icon"
        />

        <span>
          Cluster density
        </span>

        <strong>
          {clusterDensity.toFixed(1)}%
        </strong>
      </div>

    </div>
  );
}


/* =========================================================
   TEMPORAL DETAILS
========================================================= */

function TemporalDetails({
  data,
}) {
  const available =
    data?.available !== false;

  const trend =
    String(
      data?.trend ||
      "UNKNOWN"
    ).toUpperCase();

  const reason = safeText(
    data?.reason,
    "Recent observations are available for trend analysis."
  );

  return (
    <>
      {available ? (
        <div className="crai-temporal-box">

          <div className="crai-temporal-top">

            <div className="crai-trend-label">

              <History size={15} />

              <span>
                RECENT RISK TREND
              </span>

            </div>

            <strong>
              {trend}
            </strong>

          </div>

          <p>
            {reason}
          </p>

        </div>
      ) : (
        <div className="crai-temporal-empty">

          <CircleAlert size={16} />

          <div>

            <strong>
              Temporal evidence unavailable
            </strong>

            <p>
              {safeText(
                data?.reason,
                "Not enough historical observations are available to determine a trend."
              )}
            </p>

          </div>

        </div>
      )}
    </>
  );
}


/* =========================================================
   EVIDENCE CARD
========================================================= */

function EvidenceCard({
  source,
  data,
}) {
  const config =
    evidenceConfig[source];

  if (!config) {
    return null;
  }

  const Icon = config.icon;

  const available =
    data?.available !== false;

  const score =
    available
      ? safeNumber(data?.score)
      : 0;

  const contribution =
    available
      ? data?.contribution
      : null;

  const tone =
    available
      ? getTone(score)
      : "neutral";

  const severity =
    available
      ? getSeverityLabel(score)
      : "UNAVAILABLE";

  const reason = safeText(
    data?.reason,
    available
      ? "Evidence contributed to the field-risk assessment."
      : "This evidence source is currently unavailable."
  );

  return (
    <article
      className={`crai-evidence-card crai-evidence-card--${tone} ${
        !available
          ? "is-unavailable"
          : ""
      }`}
    >

      {/* TOP */}
      <div className="crai-evidence-card-top">

        <div className="crai-evidence-heading">

          <div className="crai-evidence-icon">
            <Icon size={19} />
          </div>

          <div>

            <h3>
              {config.title}
            </h3>

            <span>
              {config.subtitle}
            </span>

          </div>

        </div>


        <div className="crai-evidence-score">

          <strong>
            {available
              ? formatScore(score)
              : "—"}
          </strong>

          <span>
            SIGNAL SCORE
          </span>

        </div>

      </div>


      {/* BAR */}
      <div className="crai-score-track">

        <div
          className="crai-score-fill"
          style={{
            width: `${
              available
                ? Math.max(
                    0,
                    Math.min(
                      100,
                      score
                    )
                  )
                : 0
            }%`,
          }}
        />

      </div>


      {/* STATUS */}
      <div className="crai-evidence-reason">

        {available ? (
          <CheckCircle2
            size={16}
          />
        ) : (
          <CircleAlert
            size={16}
          />
        )}

        <p>
          {reason}
        </p>

      </div>


      {/* CONTRIBUTION */}
      {available && (
        <div className="crai-contribution-row">

          <span>
            Risk contribution
          </span>

          <strong>
            {formatContribution(
              contribution
            )}
          </strong>

        </div>
      )}


      {/* DETAILS */}
      {source === "environmental" &&
        available && (
          <EnvironmentalDetails
            components={
              data?.components || {}
            }
          />
        )}


      {source === "spatial" &&
        available && (
          <SpatialDetails
            components={
              data?.components || {}
            }
          />
        )}


      {source === "temporal" && (
        <TemporalDetails
          data={data}
        />
      )}

    </article>
  );
}


/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function RiskExplanation({
  riskAI,
}) {
  if (!riskAI) {
    return null;
  }

  const breakdown =
    riskAI?.breakdown &&
    typeof riskAI.breakdown === "object" &&
    !Array.isArray(riskAI.breakdown)
      ? riskAI.breakdown
      : {};


  const evidenceSummary =
    riskAI?.evidence_summary &&
    typeof riskAI.evidence_summary === "object" &&
    !Array.isArray(riskAI.evidence_summary)
      ? riskAI.evidence_summary
      : {};


  const riskScore =
    safeNumber(
      riskAI?.risk_score
    );


  const riskLevel =
    String(
      riskAI?.risk_level ||
      "UNKNOWN"
    ).toUpperCase();


  const assessmentConfidence =
    String(
      riskAI?.assessment_confidence ||
      "LOW"
    ).toUpperCase();


  const prediction =
    getPrediction(
      riskAI,
      breakdown
    );


  const availableSources =
    evidenceOrder.filter(
      (source) =>
        breakdown[source] &&
        breakdown[source].available !== false
    );


  const availableCount =
    evidenceSummary.available_sources ??
    availableSources.length;


  const totalSources =
    evidenceSummary.total_sources ??
    evidenceOrder.length;


  const completeness =
    evidenceSummary.completeness_percent ??
    (
      totalSources > 0
        ? (availableCount / totalSources) *
          100
        : 0
    );


  /* =======================================================
     FIXED EXPLANATION HANDLING

     Backend may return:
       string
       object
       array of strings
       array of objects

     Normalize everything into strings.
  ======================================================= */

  const explanationItems =
    normalizeExplanation(
      riskAI?.explanation
    );


  const explanation =
    explanationItems.length > 0
      ? explanationItems.join(" ")
      : "CRAI combines visual, environmental, spatial and temporal evidence to produce an explainable field-risk assessment.";


  return (
    <section className="crai-risk-explanation">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="crai-risk-explanation-header">

        <div>

          <div className="crai-eyebrow">
            RISK EXPLANATION
          </div>

          <h2>
            Why CRAI assigned this risk
          </h2>

          <p>
            The score combines independent
            evidence sources instead of relying
            on the disease model alone.
          </p>

        </div>


        <div className="crai-header-badge">

          <ShieldCheck size={16} />

          <span>
            Explainable assessment
          </span>

        </div>

      </div>


      {/* =====================================================
          SCORE SUMMARY
      ===================================================== */}

      <div className="crai-risk-summary">

        <div className="crai-score-panel">

          <span>
            FIELD RISK SCORE
          </span>

          <div className="crai-score-number">
            {riskScore.toFixed(2)}
          </div>

          <div
            className={`crai-risk-pill crai-risk-pill--${riskLevel.toLowerCase()}`}
          >
            {riskLevel}
          </div>

        </div>


        <div className="crai-summary-card">

          <div className="crai-summary-icon">
            <ShieldCheck size={19} />
          </div>

          <div>

            <span>
              ASSESSMENT CONFIDENCE
            </span>

            <strong>
              {assessmentConfidence}
            </strong>

            <small>
              Confidence in the completeness
              of the current evidence set.
            </small>

          </div>

        </div>


        <div className="crai-summary-card">

          <div className="crai-summary-icon">
            <BrainCircuit size={19} />
          </div>

          <div>

            <span>
              EVIDENCE COMPLETENESS
            </span>

            <strong>
              {availableCount}/{totalSources}
            </strong>

            <small>
              {Math.round(
                safeNumber(completeness)
              )}% of evidence sources available.
            </small>

          </div>

        </div>

      </div>


      {/* =====================================================
          PRIMARY VISUAL SIGNAL
      ===================================================== */}

      <div className="crai-primary-signal">

        <div className="crai-primary-signal-icon">
          <BrainCircuit size={18} />
        </div>

        <div>

          <span>
            PRIMARY VISUAL SIGNAL
          </span>

          <strong>
            {formatDisease(
              prediction
            )}
          </strong>

          <small>
            {breakdown.visual?.score !==
              undefined
              ? `${safeNumber(
                  breakdown.visual.score
                ).toFixed(1)}% model signal`
              : `${safeNumber(
                  riskAI?.confidence ||
                  breakdown.visual?.confidence
                ).toFixed(1)}% model signal`}
          </small>

        </div>

      </div>


      {/* =====================================================
          EVIDENCE FUSION
      ===================================================== */}

      <div className="crai-fusion-section">

        <div className="crai-fusion-header">

          <div>

            <span>
              EVIDENCE FUSION
            </span>

            <strong>
              What CRAI considered
            </strong>

          </div>

          <div className="crai-source-count">
            {availableCount}/{totalSources}
          </div>

        </div>


        <div className="crai-source-chips">

          {evidenceOrder.map(
            (source) => {

              const config =
                evidenceConfig[source];

              const Icon =
                config.icon;

              const active =
                breakdown[source] &&
                breakdown[source].available !== false;

              return (
                <div
                  key={source}
                  className={`crai-source-chip ${
                    active
                      ? "is-active"
                      : "is-muted"
                  }`}
                >

                  <Icon size={13} />

                  <span>
                    {config.title}
                  </span>

                </div>
              );
            }
          )}

        </div>


        <div className="crai-evidence-list">

          {evidenceOrder.map(
            (source) => (
              <EvidenceCard
                key={source}
                source={source}
                data={
                  breakdown[source] || {
                    available: false,
                    reason:
                      "No evidence data returned."
                  }
                }
              />
            )
          )}

        </div>

      </div>


      {/* =====================================================
          ASSESSMENT SUMMARY
      ===================================================== */}

      <div className="crai-assessment-summary">

        <div className="crai-assessment-summary-header">

          <div className="crai-summary-title-icon">
            <Activity size={18} />
          </div>

          <div>

            <span>
              ASSESSMENT SUMMARY
            </span>

            <strong>
              What influenced this risk
            </strong>

          </div>

        </div>


        <div className="crai-summary-list">

          {evidenceOrder.map(
            (source) => {

              const data =
                breakdown[source];

              if (!data) {
                return null;
              }

              const available =
                data.available !== false;

              const score =
                safeNumber(
                  data.score
                );

              const contribution =
                data.contribution;

              const severity =
                available
                  ? getSeverityLabel(
                      score
                    )
                  : "UNAVAILABLE";

              const title =
                source === "visual"
                  ? "Disease Evidence"
                  : source === "environmental"
                  ? "Environmental Stress"
                  : source === "spatial"
                  ? "Spatial Evidence"
                  : "Temporal Trend";

              return (
                <div
                  className={`crai-summary-row ${
                    available
                      ? ""
                      : "is-muted"
                  }`}
                  key={source}
                >

                  <div className="crai-summary-row-icon">

                    {available ? (
                      <CheckCircle2
                        size={16}
                      />
                    ) : (
                      <CircleAlert
                        size={16}
                      />
                    )}

                  </div>


                  <div className="crai-summary-row-main">

                    <div className="crai-summary-row-heading">

                      <strong>
                        {title}
                      </strong>

                      <span
                        className={`crai-severity crai-severity--${severity.toLowerCase()}`}
                      >
                        {severity}
                      </span>

                    </div>

                    <p>
                      {safeText(
                        data.reason,
                        "No additional explanation available."
                      )}
                    </p>

                  </div>


                  <div className="crai-summary-row-values">

                    <div>
                      <span>
                        Score
                      </span>

                      <strong>
                        {available
                          ? `${score.toFixed(1)}%`
                          : "—"}
                      </strong>
                    </div>


                    <div>
                      <span>
                        Contribution
                      </span>

                      <strong>
                        {available
                          ? formatContribution(
                              contribution
                            )
                          : "—"}
                      </strong>
                    </div>

                  </div>

                </div>
              );
            }
          )}

        </div>

      </div>


      {/* =====================================================
          OVERALL EXPLANATION
      ===================================================== */}

      <div className="crai-overall-explanation">

        <div className="crai-overall-icon">
          <Info size={17} />
        </div>

        <div>

          <span>
            CRAI ASSESSMENT
          </span>

          <p>
            {explanation}
          </p>

        </div>

      </div>


      {/* =====================================================
          ENGINE
      ===================================================== */}

      <div className="crai-engine-footer">

        <div className="crai-engine-main">

          <BrainCircuit
            size={17}
          />

          <div>

            <span>
              RISK ENGINE
            </span>

            <strong>
              {safeText(
                riskAI?.model_type,
                "CRAI_EXPLAINABLE_EVIDENCE_FUSION"
              )}
            </strong>

          </div>

        </div>


        <div className="crai-engine-version">

          <span>
            VERSION
          </span>

          <strong>
            {safeText(
              riskAI?.version,
              "FUSION_V1"
            )}
          </strong>

        </div>

      </div>


      {/* =====================================================
          DISCLAIMER
      ===================================================== */}

      <div className="crai-risk-disclaimer">

        <Info size={14} />

        <span>
          Prototype evidence-fusion risk index.
          This is not a validated agronomic
          probability or diagnosis. Calibration
          against real field outcomes is required
          before deployment.
        </span>

      </div>

    </section>
  );
}
