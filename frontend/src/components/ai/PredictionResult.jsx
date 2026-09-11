import React from "react";
import {
  BrainCircuit,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

export default function PredictionResult({
  result,
  onReset,
}) {
  if (!result) {
    return (
      <section className="panel ai-result-empty">
        <div className="empty-ai-orb">
          <BrainCircuit size={25} />
        </div>

        <div>
          <span className="eyebrow">CRAI DISEASE ENGINE</span>
          <h2>Awaiting observation</h2>
          <p>
            Upload an image to run the CRAI disease classifier.
            The result will appear here.
          </p>
        </div>
      </section>
    );
  }

  const confidence = Number(result.confidence || 0);

  const riskClass =
    result.severity === "High"
      ? "high"
      : result.severity === "Moderate"
        ? "medium"
        : "low";

  return (
    <section className="panel ai-result-panel">
      <div className="ai-result-top">
        <div>
          <span className="eyebrow">AI DETECTION RESULT</span>
          <h2>{result.disease}</h2>
          <p>
            {result.crop} · CRAI Disease AI · V2
          </p>
        </div>

        <button
          type="button"
          className="outline-button"
          onClick={onReset}
        >
          <RotateCcw size={13} />
          New analysis
        </button>
      </div>

      <div className="prediction-hero">
        <div className="confidence-ring">
          <div>
            <strong>{confidence.toFixed(1)}%</strong>
            <span>confidence</span>
          </div>
        </div>

        <div className="prediction-main">
          <div className="detected-status">
            <CheckCircle2 size={15} />
            Detection complete
          </div>

          <h3>{result.prediction}</h3>

          <div className="prediction-meta">
            <div>
              <span>CROP</span>
              <strong>{result.crop}</strong>
            </div>

            <div>
              <span>DISEASE</span>
              <strong>{result.disease}</strong>
            </div>

            <div>
              <span>SEVERITY</span>
              <strong className={`severity-text ${riskClass}`}>
                {result.severity}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className="top-predictions">
        <div className="subsection-title">
          <span>MODEL CONFIDENCE</span>
          <small>TOP PREDICTIONS</small>
        </div>

        {result.top_predictions?.map((item, index) => (
          <div className="prediction-row" key={item.class}>
            <div className="prediction-rank">
              0{index + 1}
            </div>

            <div className="prediction-name">
              <strong>{item.class.replaceAll("_", " ")}</strong>
              <div className="prediction-track">
                <span
                  style={{
                    width: `${Math.min(
                      Number(item.confidence || 0),
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>

            <strong className="prediction-percent">
              {Number(item.confidence || 0).toFixed(2)}%
            </strong>
          </div>
        ))}
      </div>

      <div className="ai-result-note">
        <AlertTriangle size={15} />

        <div>
          <strong>Prototype AI observation</strong>
          <span>
            Disease classification is based on the uploaded visual
            observation. Environmental and spatial signals will be
            combined by the CRAI risk engine during mission analysis.
          </span>
        </div>
      </div>
    </section>
  );
}

import "./PredictionResult.css";
