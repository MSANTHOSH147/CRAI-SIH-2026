import React, {
  useEffect,
  useState,
} from "react";

import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Database,
  Droplets,
  Loader2,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Upload,
} from "lucide-react";

import RiskExplanation from "../components/ai/RiskExplanation";

import {
  analyzeFieldImage,
  createFieldSensorReading,
  getAIStatus,
} from "../services/api";

import "./AIAnalysis.css";


/* =========================================================
   HELPERS
========================================================= */

function formatDisease(value) {
  return String(value || "Unknown")
    .replace(/^Tomato_/i, "")
    .replace(/^Potato_/i, "")
    .replaceAll("_", " ");
}


function getRiskTone(level) {
  const value = String(level || "").toUpperCase();

  if (value === "CRITICAL") {
    return "critical";
  }

  if (value === "HIGH") {
    return "high";
  }

  if (value === "MODERATE") {
    return "moderate";
  }

  if (value === "LOW") {
    return "low";
  }

  return "pending";
}


function getSensorReading(sensor) {
  if (!sensor) {
    return null;
  }

  return (
    sensor.reading ||
    sensor.latest_reading ||
    sensor.latest ||
    sensor
  );
}


/* =========================================================
   COMPONENT
========================================================= */

export default function AIAnalysis() {

  /* -------------------------------------------------------
     FIELD CONTEXT
  ------------------------------------------------------- */

  const [zoneId, setZoneId] =
    useState("C3");

  const [crop, setCrop] =
    useState("Tomato");

  const [
    growthStage,
    setGrowthStage,
  ] = useState("Vegetative");


  /* -------------------------------------------------------
     IMAGE
  ------------------------------------------------------- */

  const [file, setFile] =
    useState(null);

  const [preview, setPreview] =
    useState("");


  /* -------------------------------------------------------
     ANALYSIS
  ------------------------------------------------------- */

  const [analysis, setAnalysis] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");


  /* -------------------------------------------------------
     RISK EXPLANATION
  ------------------------------------------------------- */

  const [
    showRiskExplanation,
    setShowRiskExplanation,
  ] = useState(false);


  /* -------------------------------------------------------
     AI STATUS
  ------------------------------------------------------- */

  const [aiStatus, setAiStatus] =
    useState(null);


  /* -------------------------------------------------------
     SENSOR
  ------------------------------------------------------- */

  const [
    showSensorForm,
    setShowSensorForm,
  ] = useState(false);

  const [
    sensorSubmitting,
    setSensorSubmitting,
  ] = useState(false);

  const [
    sensorForm,
    setSensorForm,
  ] = useState({
    soilMoisture: "27",
    temperature: "34.2",
    humidity: "72",
  });


  /* =========================================================
     LOAD AI STATUS
  ========================================================= */

  useEffect(() => {

    let active = true;

    getAIStatus()
      .then((data) => {

        if (active) {
          setAiStatus(data);
        }

      })
      .catch(() => {

        if (active) {

          setAiStatus({
            status: "offline",
          });

        }

      });

    return () => {
      active = false;
    };

  }, []);


  /* =========================================================
     CLEAN IMAGE PREVIEW
  ========================================================= */

  useEffect(() => {

    return () => {

      if (preview) {

        URL.revokeObjectURL(
          preview
        );

      }

    };

  }, [preview]);


  /* =========================================================
     RUN FIELD ANALYSIS
  ========================================================= */

  async function runAnalysis(
    selectedFile = file
  ) {

    if (!selectedFile) {
      return null;
    }

    setLoading(true);
    setError("");

    try {

      const result =
        await analyzeFieldImage(
          selectedFile,
          {
            zoneId,
            crop,
            growthStage,
          }
        );


      console.log(
        "CRAI RESPONSE:",
        result
      );


      /*
       * Backend response is the
       * single source of truth.
       */

      setAnalysis(result);


      /*
       * Close risk explanation after
       * every fresh analysis.
       */

      setShowRiskExplanation(false);


      const nextStatus =
        result?.analysis?.status;


      /*
       * Automatically show the sensor
       * form when backend explicitly
       * requests more evidence.
       */

      setShowSensorForm(
        nextStatus ===
          "ADDITIONAL_EVIDENCE_REQUIRED"
      );


      return result;

    } catch (err) {

      console.error(
        "CRAI analysis error:",
        err
      );

      setError(
        err?.message ||
        "Unable to analyze field observation."
      );

      return null;

    } finally {

      setLoading(false);

    }

  }


  /* =========================================================
     IMAGE UPLOAD
  ========================================================= */

  async function handleImageChange(
    event
  ) {

    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      return;
    }


    if (preview) {

      URL.revokeObjectURL(
        preview
      );

    }


    const objectUrl =
      URL.createObjectURL(
        selectedFile
      );


    setFile(selectedFile);

    setPreview(objectUrl);

    setAnalysis(null);

    setError("");

    setMessage("");

    setShowSensorForm(false);

    setShowRiskExplanation(false);


    await runAnalysis(
      selectedFile
    );

  }


  /* =========================================================
     OPEN / UPDATE SENSOR FORM
  ========================================================= */

  function openSensorCollection() {

    const currentSensor =
      getSensorReading(
        analysis?.sensor
      );


    /*
     * If CRAI already has evidence for
     * the zone, preload those values.
     *
     * Otherwise keep useful prototype
     * defaults.
     */

    setSensorForm({

      soilMoisture:
        currentSensor?.soil_moisture != null
          ? String(
              currentSensor.soil_moisture
            )
          : "27",

      temperature:
        currentSensor?.temperature != null
          ? String(
              currentSensor.temperature
            )
          : "34.2",

      humidity:
        currentSensor?.humidity != null
          ? String(
              currentSensor.humidity
            )
          : "72",

    });


    setError("");

    setShowSensorForm(true);

  }


  /* =========================================================
     SENSOR SUBMISSION
  ========================================================= */

  async function submitSensorReading() {

    if (!file) {

      setError(
        "Upload a crop image first."
      );

      return;

    }


    const soilMoisture =
      Number(
        sensorForm.soilMoisture
      );

    const temperature =
      Number(
        sensorForm.temperature
      );

    const humidity =
      Number(
        sensorForm.humidity
      );


    if (
      !Number.isFinite(
        soilMoisture
      ) ||
      !Number.isFinite(
        temperature
      ) ||
      !Number.isFinite(
        humidity
      )
    ) {

      setError(
        "Enter valid sensor values."
      );

      return;

    }


    if (
      soilMoisture < 0 ||
      soilMoisture > 100
    ) {

      setError(
        "Soil moisture must be between 0 and 100%."
      );

      return;

    }


    if (
      humidity < 0 ||
      humidity > 100
    ) {

      setError(
        "Humidity must be between 0 and 100%."
      );

      return;

    }


    setSensorSubmitting(true);

    setError("");

    setMessage(
      "Saving fresh field evidence..."
    );


    try {

      /*
       * Store the fresh sensor reading.
       */

      const savedReading =
        await createFieldSensorReading({

          deviceId:
            "CRAI-ESP32-01",

          farmId:
            1,

          zoneId,

          source:
            "SIMULATED",

          soilMoisture,

          temperature,

          humidity,

        });


      console.log(
        "CRAI SENSOR SAVED:",
        savedReading
      );


      setMessage(
        "Fresh reading received. Re-running CRAI evidence fusion..."
      );


      /*
       * Re-run the SAME image.
       *
       * The backend will now find
       * the newest evidence for this
       * exact field zone.
       */

      const refreshed =
        await runAnalysis(
          file
        );


      if (
        refreshed?.analysis?.status ===
        "ANALYSIS_COMPLETE"
      ) {

        setShowSensorForm(
          false
        );

        setMessage(
          "Fresh field evidence validated."
        );

      } else if (
        refreshed?.analysis?.status ===
        "ADDITIONAL_EVIDENCE_REQUIRED"
      ) {

        setShowSensorForm(
          true
        );

        setMessage(
          "CRAI still requires additional evidence."
        );

      }

    } catch (err) {

      console.error(
        "Sensor collection error:",
        err
      );

      setError(
        err?.message ||
        "Unable to save sensor evidence."
      );

      setMessage("");

    } finally {

      setSensorSubmitting(false);

    }

  }


  /* =========================================================
     RESET
  ========================================================= */

  function resetObservation() {

    if (preview) {

      URL.revokeObjectURL(
        preview
      );

    }


    setFile(null);

    setPreview("");

    setAnalysis(null);

    setError("");

    setMessage("");

    setShowSensorForm(false);

    setShowRiskExplanation(false);

  }


  /* =========================================================
     BACKEND RESPONSE
  ========================================================= */

  const diseaseAI =
    analysis?.disease_ai;


  const innerAnalysis =
    analysis?.analysis;


  const evidence =
    innerAnalysis?.evidence;


  const risk =
    innerAnalysis?.risk;


  const decision =
    innerAnalysis?.decision;


  const sensor =
    analysis?.sensor;


  const currentSensor =
    getSensorReading(
      sensor
    );


  const status =
    innerAnalysis?.status;


  const analysisComplete =
    status ===
    "ANALYSIS_COMPLETE";


  const needsEvidence =
    status ===
    "ADDITIONAL_EVIDENCE_REQUIRED";


  const disease =
    diseaseAI?.prediction ||
    innerAnalysis
      ?.disease
      ?.prediction ||
    "Unknown";


  const diseaseLabel =
    diseaseAI?.disease ||
    formatDisease(disease);


  const confidence =
    Number(
      diseaseAI?.confidence ??
      innerAnalysis
        ?.disease
        ?.confidence ??
      0
    );


  const riskLevel =
    String(
      risk?.risk_level ||
      "PENDING"
    ).toUpperCase();


  const riskScore =
    Number(
      risk?.risk_score
    );


  const riskTone =
    getRiskTone(
      riskLevel
    );


  const sensorSoil =
    currentSensor?.soil_moisture;


  const sensorTemperature =
    currentSensor?.temperature;


  const sensorHumidity =
    currentSensor?.humidity;


  const sensorFreshness =
    sensor?.freshness ||
    sensor?.freshness_label ||
    sensor?.status ||
    (
      currentSensor
        ? "AVAILABLE"
        : "UNAVAILABLE"
    );


  /* =========================================================
     UI
  ========================================================= */

  return (

    <div className="ai-analysis-page">


      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="ai-page-heading">

        <div>

          <span className="eyebrow">
            AGRICULTURAL INTELLIGENCE · FIELD OBSERVATION
          </span>

          <h1>
            AI Analysis
          </h1>

          <p>
            Observe crops, validate evidence,
            assess field risk and generate an action.
          </p>

        </div>


        <div className="model-badge large">

          <BrainCircuit
            size={14}
          />

          Disease AI ·{" "}
          {aiStatus?.version ||
            "V2"}

        </div>

      </div>


      {/* =====================================================
          AI STATUS
      ===================================================== */}

      <div className="stat-strip ai-stat-strip">

        <div>

          <span>
            DISEASE AI
          </span>

          <b className="green-text">
            {aiStatus?.status ===
            "ready"
              ? "READY"
              : "OFFLINE"}
          </b>

        </div>


        <div>

          <span>
            MODEL
          </span>

          <b>
            {aiStatus?.model ||
              "MobileNetV3-Small"}
          </b>

        </div>


        <div>

          <span>
            CLASSES
          </span>

          <b>
            {aiStatus?.classes ||
              11}
          </b>

        </div>


        <div>

          <span>
            DEVICE
          </span>

          <b>
            {String(
              aiStatus?.device ||
              "CPU"
            ).toUpperCase()}
          </b>

        </div>


        <div>

          <span>
            PLANTDOC
          </span>

          <b>
            {aiStatus
              ?.plantdoc_accuracy !=
            null
              ? `${aiStatus.plantdoc_accuracy}%`
              : "49.35%"}
          </b>

        </div>

      </div>


      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (

        <div className="ai-alert danger">

          <AlertTriangle
            size={16}
          />

          <span>
            {error}
          </span>

        </div>

      )}


      {message && !error && (

        <div className="ai-alert">

          <RefreshCw
            size={14}
            className={
              loading
                ? "spin"
                : ""
            }
          />

          <span>
            {message}
          </span>

        </div>

      )}


      {/* =====================================================
          FIELD CONTEXT
      ===================================================== */}

      <section className="panel">

        <div
          style={{
            padding:
              "18px 20px 0",
          }}
        >

          <span className="eyebrow">
            FIELD CONTEXT
          </span>

          <h2
            style={{
              margin:
                "5px 0 0",
              fontSize:
                "18px",
            }}
          >
            Observation details
          </h2>

        </div>


        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",

            gap:
              "12px",

            padding:
              "18px 20px",
          }}
        >

          <FieldSelect
            label="ZONE"
            value={zoneId}
            disabled={
              Boolean(file)
            }
            onChange={
              setZoneId
            }
          >

            <option value="A1">
              A1
            </option>

            <option value="B2">
              B2
            </option>

            <option value="C3">
              C3
            </option>

            <option value="D1">
              D1
            </option>

          </FieldSelect>


          <FieldSelect
            label="CROP"
            value={crop}
            disabled={
              Boolean(file)
            }
            onChange={
              setCrop
            }
          >

            <option value="Tomato">
              Tomato
            </option>

            <option value="Potato">
              Potato
            </option>

          </FieldSelect>


          <FieldSelect
            label="GROWTH STAGE"
            value={
              growthStage
            }
            disabled={
              Boolean(file)
            }
            onChange={
              setGrowthStage
            }
          >

            <option value="Seedling">
              Seedling
            </option>

            <option value="Vegetative">
              Vegetative
            </option>

            <option value="Flowering">
              Flowering
            </option>

            <option value="Fruiting">
              Fruiting
            </option>

            <option value="Mature">
              Mature
            </option>

          </FieldSelect>

        </div>

      </section>


      {/* =====================================================
          IMAGE OBSERVATION
      ===================================================== */}

      <section
        className="panel"
        style={{
          marginTop:
            "14px",
        }}
      >

        <div
          style={{
            padding:
              "18px 20px 0",
          }}
        >

          <span className="eyebrow">
            IMAGE OBSERVATION
          </span>

          <h2
            style={{
              margin:
                "5px 0 0",
              fontSize:
                "18px",
            }}
          >
            Analyze crop image
          </h2>

        </div>


        <div
          style={{
            padding:
              "18px 20px 20px",
          }}
        >

          {!file ? (

            <label
              style={{
                minHeight:
                  "180px",

                display:
                  "flex",

                flexDirection:
                  "column",

                alignItems:
                  "center",

                justifyContent:
                  "center",

                gap:
                  "9px",

                border:
                  "1px dashed #cfdacb",

                borderRadius:
                  "12px",

                background:
                  "#fafcf9",

                cursor:
                  "pointer",
              }}
            >

              <Upload
                size={28}
              />

              <strong>
                Upload a crop image
              </strong>

              <span
                style={{
                  fontSize:
                    "11px",

                  opacity:
                    0.65,
                }}
              >
                Disease AI V2 will
                analyze the observation.
              </span>


              <input
                type="file"
                accept="image/*"
                onChange={
                  handleImageChange
                }
                style={{
                  display:
                    "none",
                }}
              />

            </label>

          ) : (

            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "minmax(0, 1fr) 270px",

                gap:
                  "16px",
              }}
            >

              <div
                style={{
                  height:
                    "320px",

                  display:
                    "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "center",

                  overflow:
                    "hidden",

                  border:
                    "1px solid var(--crai-border-soft)",

                  borderRadius:
                    "10px",

                  background:
                    "#f4f7f3",
                }}
              >

                <img
                  src={preview}
                  alt="Crop observation"
                  style={{
                    width:
                      "100%",

                    height:
                      "100%",

                    objectFit:
                      "contain",
                  }}
                />

              </div>


              <div
                style={{
                  padding:
                    "18px",

                  border:
                    "1px solid var(--crai-border-soft)",

                  borderRadius:
                    "10px",
                }}
              >

                <ScanLine
                  size={22}
                />

                <h3>
                  Zone {zoneId}
                </h3>

                <p
                  style={{
                    fontSize:
                      "11px",

                    lineHeight:
                      1.5,

                    opacity:
                      0.7,

                    wordBreak:
                      "break-word",
                  }}
                >
                  {file.name}
                </p>


                <button
                  type="button"
                  onClick={
                    resetObservation
                  }
                  style={{
                    marginTop:
                      "14px",

                    padding:
                      "9px 12px",

                    border:
                      "1px solid var(--crai-border)",

                    borderRadius:
                      "8px",

                    background:
                      "#fff",

                    cursor:
                      "pointer",
                  }}
                >
                  New observation
                </button>

              </div>

            </div>

          )}

        </div>

      </section>


      {/* =====================================================
          LOADING
      ===================================================== */}

      {loading && (

        <section
          className="panel"
          style={{
            marginTop:
              "14px",

            padding:
              "15px 20px",

            display:
              "flex",

            gap:
              "9px",

            alignItems:
              "center",
          }}
        >

          <Loader2
            size={17}
            className="spin"
          />

          <strong>
            CRAI is analyzing the field observation...
          </strong>

        </section>

      )}


      {/* =====================================================
          DISEASE RESULT
      ===================================================== */}

      {analysis && (

        <section
          className="panel"
          style={{
            marginTop:
              "14px",

            padding:
              "18px",
          }}
        >

          <span className="eyebrow">
            VISUAL INTELLIGENCE
          </span>

          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",

              gap:
                "20px",
            }}
          >

            <div>

              <h2
                style={{
                  margin:
                    "8px 0 5px",

                  fontSize:
                    "27px",
                }}
              >
                {diseaseLabel}
              </h2>

              <p
                style={{
                  margin:
                    0,

                  fontSize:
                    "11px",

                  opacity:
                    0.7,
                }}
              >
                Disease AI V2 prediction
              </p>

            </div>


            <strong
              style={{
                fontSize:
                  "31px",
              }}
            >
              {confidence.toFixed(
                2
              )}%
            </strong>

          </div>

        </section>

      )}


      {/* =====================================================
          ADAPTIVE EVIDENCE
      ===================================================== */}

      {needsEvidence && (

        <section
          className="panel decision-panel moderate"
          style={{
            marginTop:
              "14px",
          }}
        >

          <div className="decision-header">

            <div className="decision-icon">

              <AlertTriangle
                size={18}
              />

            </div>


            <div>

              <span className="eyebrow">
                ADAPTIVE EVIDENCE
              </span>

              <h2>
                Additional field evidence required
              </h2>

              <p>
                {evidence?.reason ||
                  "CRAI requires additional field evidence before generating the final risk assessment."}
              </p>

            </div>

          </div>


          {!showSensorForm && (

            <button
              type="button"
              onClick={
                openSensorCollection
              }
              style={{
                marginTop:
                  "14px",

                display:
                  "inline-flex",

                alignItems:
                  "center",

                gap:
                  "8px",

                padding:
                  "10px 14px",

                border:
                  "none",

                borderRadius:
                  "8px",

                background:
                  "#243329",

                color:
                  "#fff",

                cursor:
                  "pointer",

                fontSize:
                  "10px",

                fontWeight:
                  800,
              }}
            >

              <Droplets
                size={14}
              />

              Collect soil evidence

            </button>

          )}

        </section>

      )}


      {/* =====================================================
          PERMANENT FIELD SENSOR ACCESS
      ===================================================== */}

      {analysisComplete &&
        file &&
        !showSensorForm && (

          <section
            className="panel"
            style={{
              marginTop:
                "14px",

              padding:
                "18px",
            }}
          >

            <div
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                justifyContent:
                  "space-between",

                gap:
                  "20px",

                flexWrap:
                  "wrap",
              }}
            >

              <div>

                <span className="eyebrow">
                  FIELD SENSOR
                </span>

                <h2
                  style={{
                    margin:
                      "6px 0 5px",
                  }}
                >
                  Update field evidence
                </h2>

                <p
                  style={{
                    margin:
                      0,

                    maxWidth:
                      "650px",

                    fontSize:
                      "11px",

                    lineHeight:
                      1.6,

                    opacity:
                      0.7,
                  }}
                >
                  Submit a fresh soil and environmental reading
                  for Zone {zoneId}. CRAI will store the new
                  evidence and automatically re-run the same
                  crop observation.
                </p>

              </div>


              <button
                type="button"
                onClick={
                  openSensorCollection
                }
                disabled={
                  sensorSubmitting ||
                  loading
                }
                style={{
                  display:
                    "inline-flex",

                  alignItems:
                    "center",

                  gap:
                    "8px",

                  padding:
                    "11px 15px",

                  border:
                    "none",

                  borderRadius:
                    "8px",

                  background:
                    "#243329",

                  color:
                    "#fff",

                  cursor:
                    sensorSubmitting ||
                    loading
                      ? "wait"
                      : "pointer",

                  fontSize:
                    "10px",

                  fontWeight:
                    800,
                }}
              >

                <RefreshCw
                  size={14}
                />

                Update reading

              </button>

            </div>


            <div
              style={{
                marginTop:
                  "16px",

                padding:
                  "12px 14px",

                border:
                  "1px solid var(--crai-border-soft)",

                borderRadius:
                  "9px",

                background:
                  "#fafcf9",

                display:
                  "flex",

                alignItems:
                  "center",

                gap:
                  "10px",

                flexWrap:
                  "wrap",

                fontSize:
                  "10px",
              }}
            >

              <Database
                size={14}
              />

              <strong>
                CRAI-ESP32-01
              </strong>

              <span>
                ·
              </span>

              <span>
                SIMULATED
              </span>

              <span>
                ·
              </span>

              <span>
                {String(
                  sensorFreshness
                ).replaceAll(
                  "_",
                  " "
                )}
              </span>


              {sensorSoil != null && (
                <>
                  <span>·</span>

                  <span>
                    Soil{" "}
                    <strong>
                      {sensorSoil}%
                    </strong>
                  </span>
                </>
              )}


              {sensorTemperature != null && (
                <>
                  <span>·</span>

                  <span>
                    Temp{" "}
                    <strong>
                      {sensorTemperature}°C
                    </strong>
                  </span>
                </>
              )}


              {sensorHumidity != null && (
                <>
                  <span>·</span>

                  <span>
                    Humidity{" "}
                    <strong>
                      {sensorHumidity}%
                    </strong>
                  </span>
                </>
              )}

            </div>

          </section>

        )}


      {/* =====================================================
          SENSOR FORM
      ===================================================== */}

      {showSensorForm &&
        file && (

          <section
            className="panel"
            style={{
              marginTop:
                "14px",

              padding:
                "18px",
            }}
          >

            <div
              style={{
                display:
                  "flex",

                justifyContent:
                  "space-between",

                alignItems:
                  "flex-start",

                gap:
                  "15px",
              }}
            >

              <div>

                <span className="eyebrow">
                  FIELD SENSOR
                </span>

                <h2
                  style={{
                    marginBottom:
                      "6px",
                  }}
                >
                  {analysisComplete
                    ? "Update field evidence"
                    : "Collect additional evidence"}
                </h2>

                <p
                  style={{
                    margin:
                      "0 0 14px",

                    fontSize:
                      "11px",

                    opacity:
                      0.7,

                    lineHeight:
                      1.5,
                  }}
                >
                  {analysisComplete
                    ? "Enter a new reading to test how changing environmental evidence affects CRAI's field risk assessment."
                    : "CRAI needs fresh environmental evidence before it can complete the field risk assessment."}
                </p>

              </div>


              {analysisComplete && (

                <button
                  type="button"
                  onClick={() =>
                    setShowSensorForm(
                      false
                    )
                  }
                  disabled={
                    sensorSubmitting
                  }
                  style={{
                    padding:
                      "8px 11px",

                    border:
                      "1px solid var(--crai-border)",

                    borderRadius:
                      "8px",

                    background:
                      "#fff",

                    cursor:
                      "pointer",

                    fontSize:
                      "10px",

                    fontWeight:
                      700,
                  }}
                >
                  Cancel
                </button>

              )}

            </div>


            <div
              style={{
                display:
                  "flex",

                gap:
                  "8px",

                alignItems:
                  "center",

                marginBottom:
                  "15px",

                fontSize:
                  "10px",
              }}
            >

              <Database
                size={14}
              />

              CRAI-ESP32-01 · SIMULATED · Zone {zoneId}

            </div>


            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",

                gap:
                  "12px",
              }}
            >

              <SensorInput
                label="SOIL MOISTURE"
                suffix="%"
                value={
                  sensorForm.soilMoisture
                }
                onChange={(value) =>
                  setSensorForm(
                    (previous) => ({
                      ...previous,
                      soilMoisture:
                        value,
                    })
                  )
                }
              />


              <SensorInput
                label="TEMPERATURE"
                suffix="°C"
                value={
                  sensorForm.temperature
                }
                onChange={(value) =>
                  setSensorForm(
                    (previous) => ({
                      ...previous,
                      temperature:
                        value,
                    })
                  )
                }
              />


              <SensorInput
                label="HUMIDITY"
                suffix="%"
                value={
                  sensorForm.humidity
                }
                onChange={(value) =>
                  setSensorForm(
                    (previous) => ({
                      ...previous,
                      humidity:
                        value,
                    })
                  )
                }
              />

            </div>


            {analysisComplete && (

              <div
                style={{
                  marginTop:
                    "14px",

                  padding:
                    "11px 13px",

                  border:
                    "1px solid #dfe7dc",

                  borderRadius:
                    "8px",

                  background:
                    "#fafcf9",

                  fontSize:
                    "10px",

                  lineHeight:
                    1.6,
                }}
              >
                <strong>
                  Test scenario:
                </strong>{" "}
                try Soil 55%, Temperature 27°C,
                Humidity 55% and compare the new risk
                score with the previous assessment.
              </div>

            )}


            <button
              type="button"
              onClick={
                submitSensorReading
              }
              disabled={
                sensorSubmitting ||
                loading
              }
              style={{
                marginTop:
                  "16px",

                display:
                  "inline-flex",

                alignItems:
                  "center",

                gap:
                  "8px",

                padding:
                  "11px 15px",

                border:
                  "none",

                borderRadius:
                  "8px",

                background:
                  "#243329",

                color:
                  "#fff",

                cursor:
                  sensorSubmitting ||
                  loading
                    ? "wait"
                    : "pointer",

                fontWeight:
                  800,
              }}
            >

              {sensorSubmitting ? (

                <>

                  <Loader2
                    size={14}
                    className="spin"
                  />

                  Re-analyzing...

                </>

              ) : (

                <>

                  <RefreshCw
                    size={14}
                  />

                  {analysisComplete
                    ? "Update & re-analyze"
                    : "Submit fresh reading"}

                </>

              )}

            </button>

          </section>

        )}


      {/* =====================================================
          SINGLE RISK SECTION
      ===================================================== */}

      {analysisComplete &&
        risk && (

          <section
            className="panel ai-risk-panel"
            style={{
              marginTop:
                "14px",
            }}
          >

            <span className="eyebrow">
              FIELD RISK
            </span>

            <h2>
              CRAI Risk Assessment
            </h2>


            <div className="risk-status-grid">


              {/* -------------------------------------------
                  SCORE
              ------------------------------------------- */}

              <div className="risk-score">

                <span>
                  RISK SCORE
                </span>

                <strong>
                  {Number.isFinite(
                    riskScore
                  )
                    ? riskScore.toFixed(
                        2
                      )
                    : "--"}
                </strong>

                <small>
                  CRAI Explainable Evidence Fusion
                </small>

              </div>


              {/* -------------------------------------------
                  LEVEL
              ------------------------------------------- */}

              <div
                className={`risk-level ${riskTone}`}
              >

                <span>
                  RISK LEVEL
                </span>

                <strong>
                  {riskLevel}
                </strong>

                <small>
                  {risk.model_type ||
                    "CRAI Explainable Evidence Fusion"}
                  {" · "}
                  {risk.version ||
                    "FUSION_V1"}
                </small>

              </div>


              {/* -------------------------------------------
                  DISEASE
              ------------------------------------------- */}

              <div className="risk-signal">

                <span>
                  DISEASE SIGNAL
                </span>

                <strong>
                  {formatDisease(
                    risk?.dominant_disease ||
                    disease
                  )}
                </strong>

                <small>
                  {confidence.toFixed(
                    2
                  )}% model confidence
                </small>

              </div>

            </div>


            {/* =================================================
                WHY THIS RISK BUTTON
            ================================================= */}

            <button
              type="button"
              className="crai-why-risk-button"
              onClick={() =>
                setShowRiskExplanation(
                  (previous) =>
                    !previous
                )
              }
            >

              <span>
                {showRiskExplanation
                  ? "HIDE RISK EXPLANATION"
                  : "WHY THIS RISK?"}
              </span>

              <span>
                {showRiskExplanation
                  ? "-"
                  : "+"}
              </span>

            </button>


            {/* =================================================
                REAL BACKEND BREAKDOWN
            ================================================= */}

            {showRiskExplanation && (

              <div
                className="crai-risk-explanation-wrapper"
              >

                <RiskExplanation
                  riskAI={risk}
                />

              </div>

            )}

          </section>

        )}


      {/* =====================================================
          DECISION
      ===================================================== */}

      {analysisComplete &&
        decision && (

          <section
            className={`panel decision-panel ${riskTone}`}
            style={{
              marginTop:
                "14px",
            }}
          >

            <div className="decision-header">

              <div className="decision-icon">

                <CheckCircle2
                  size={18}
                />

              </div>


              <div>

                <span className="eyebrow">
                  FIELD DECISION
                </span>

                <h2>
                  {decision.title ||
                    "Field recommendation"}
                </h2>

                <p>
                  {decision.message ||
                    "CRAI generated this recommendation from the available field evidence."}
                </p>

              </div>

            </div>


            {decision
              ?.reasons
              ?.length > 0 && (

              <div
                style={{
                  marginTop:
                    "16px",
                }}
              >

                <span className="eyebrow">
                  WHY CRAI RECOMMENDS THIS
                </span>


                {decision.reasons.map(
                  (
                    reason,
                    index
                  ) => (

                    <p
                      key={
                        index
                      }
                      style={{
                        margin:
                          "8px 0 0",

                        fontSize:
                          "11px",
                      }}
                    >
                      ✓ {reason}
                    </p>

                  )
                )}

              </div>

            )}


            {decision
              ?.recommended_steps
              ?.length > 0 && (

              <div
                className="decision-actions"
              >

                {decision.recommended_steps.map(
                  (
                    step,
                    index
                  ) => (

                    <div
                      className="decision-action"
                      key={
                        index
                      }
                    >

                      <span>
                        {String(
                          index + 1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </span>

                      <strong>
                        {step}
                      </strong>

                    </div>

                  )
                )}

              </div>

            )}

          </section>

        )}


      {/* =====================================================
          PIPELINE
      ===================================================== */}

      {analysis && (

        <section
          className="panel pipeline-panel"
          style={{
            marginTop:
              "14px",
          }}
        >

          <span className="eyebrow">
            MODEL FLOW
          </span>

          <h2>
            Adaptive inference pipeline
          </h2>


          <div className="pipeline">

            <PipelineStep
              icon={ScanLine}
              label="IMAGE"
              value="Captured"
              active
            />


            <PipelineLine />


            <PipelineStep
              icon={BrainCircuit}
              label="DISEASE AI"
              value="Completed"
              active
            />


            <PipelineLine />


            <PipelineStep
              icon={Database}
              label="EVIDENCE"
              value={
                needsEvidence
                  ? "Required"
                  : "Validated"
              }
              active={
                Boolean(
                  evidence
                )
              }
            />


            <PipelineLine />


            <PipelineStep
              icon={ShieldCheck}
              label="RISK"
              value={
                analysisComplete
                  ? "Completed"
                  : "Blocked"
              }
              active={
                analysisComplete
              }
            />


            <PipelineLine />


            <PipelineStep
              icon={CheckCircle2}
              label="DECISION"
              value={
                analysisComplete
                  ? "Ready"
                  : "Waiting"
              }
              active={
                analysisComplete
              }
            />

          </div>

        </section>

      )}

    </div>

  );

}


/* =========================================================
   FIELD SELECT
========================================================= */

function FieldSelect({
  label,
  value,
  onChange,
  disabled,
  children,
}) {

  return (

    <label
      style={{
        display:
          "flex",

        flexDirection:
          "column",

        gap:
          "7px",

        fontSize:
          "9px",

        fontWeight:
          800,

        letterSpacing:
          ".08em",
      }}
    >

      {label}


      <select
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        style={{
          padding:
            "10px 11px",

          border:
            "1px solid var(--crai-border)",

          borderRadius:
            "8px",

          background:
            "#fff",
        }}
      >

        {children}

      </select>

    </label>

  );

}


/* =========================================================
   SENSOR INPUT
========================================================= */

function SensorInput({
  label,
  suffix,
  value,
  onChange,
}) {

  return (

    <label
      style={{
        display:
          "flex",

        flexDirection:
          "column",

        gap:
          "7px",

        fontSize:
          "9px",

        fontWeight:
          800,
      }}
    >

      {label}


      <div
        style={{
          display:
            "flex",

          alignItems:
            "center",

          overflow:
            "hidden",

          border:
            "1px solid var(--crai-border)",

          borderRadius:
            "8px",
        }}
      >

        <input
          type="number"
          step="0.1"
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          style={{
            width:
              "100%",

            padding:
              "11px",

            border:
              "none",

            outline:
              "none",

            fontWeight:
              700,
          }}
        />


        <span
          style={{
            padding:
              "0 10px",

            opacity:
              0.6,
          }}
        >
          {suffix}
        </span>

      </div>

    </label>

  );

}


/* =========================================================
   PIPELINE
========================================================= */

function PipelineStep({
  icon: Icon,
  label,
  value,
  active,
}) {

  return (

    <div
      className={`pipeline-step ${
        active
          ? "active"
          : ""
      }`}
    >

      <div>

        <Icon
          size={17}
        />

      </div>

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>

  );

}


function PipelineLine() {

  return (
    <div className="pipeline-line" />
  );

}