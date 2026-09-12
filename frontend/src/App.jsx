import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Cpu,
  Droplets,
  FileText,
  Gauge,
  History as HistoryIcon,
  Leaf,
  MapPin,
  Menu,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Upload,
  Wifi,
  X,
  Zap,
} from "lucide-react";

import {
  getHealth,
  getAIStatus,
  analyzeFieldImage,
  createSensorRequest,
  getSensorReadings,
} from "./services/api";

import "./integration-additions.css";
import "./scroll-fix.css";
import FarmerVoice from "./components/farmer/FarmerVoice";


/* ============================================================
   NAVIGATION
============================================================ */

const NAV = [
  "Overview",
  "Observe",
  "Field Intelligence",
  "Sensors",
  "History",
  "Reports",
];


const LANGUAGE_OPTIONS = [
  "English",
  "Tamil",
  "Hindi",
];


/* ============================================================
   DEMO FIELD ZONES
============================================================ */

const zones = [
  {
    id: "A1",
    x: 18,
    y: 28,
    risk: 70.9,
    level: "critical",
  },
  {
    id: "B2",
    x: 42,
    y: 52,
    risk: 46,
    level: "moderate",
  },
  {
    id: "C3",
    x: 68,
    y: 31,
    risk: 38,
    level: "moderate",
  },
  {
    id: "D1",
    x: 75,
    y: 68,
    risk: 24,
    level: "low",
  },
];


/* ============================================================
   HELPERS
============================================================ */

function num(
  value,
  fallback = null,
) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return fallback;
  }

  return Number(value);
}


function diseaseName(
  disease,
) {
  const value = disease || {};

  return (
    value.disease ||
    value.prediction?.replaceAll("_", " ") ||
    "No disease signal"
  );
}


function getDisease(
  result,
) {
  return (
    result?.disease ||
    result?.disease_ai ||
    result?.analysis?.disease ||
    result?.analysis?.disease_ai ||
    null
  );
}


function getRisk(
  result,
) {
  return (
    result?.risk ||
    result?.analysis?.risk ||
    null
  );
}


function getDecision(
  result,
) {
  return (
    result?.decision ||
    result?.analysis?.decision ||
    null
  );
}


function getEvidence(
  result,
) {
  return (
    result?.evidence ||
    result?.analysis?.evidence ||
    null
  );
}


function getAdaptive(
  result,
) {
  return (
    result?.adaptive_evidence ||
    result?.analysis?.evidence?.adaptive ||
    result?.analysis?.adaptive_evidence ||
    null
  );
}


function getSensor(
  result,
) {
  return (
    result?.sensor ||
    result?.analysis?.sensor ||
    null
  );
}


function getAdvisory(
  result,
) {
  return (
    result?.advisory ||
    result?.analysis?.advisory ||
    null
  );
}


function getJudgeIntelligence(
  result,
) {
  return (
    result?.judge_intelligence ||
    result?.analysis?.judge_intelligence ||
    null
  );
}


function riskClass(
  level = "",
) {
  return String(level)
    .toLowerCase()
    .replaceAll(" ", "-");
}


function parseCRAITimestamp(timestamp) {
  if (!timestamp) {
    return null;
  }

  let value = String(timestamp).trim();

  if (!value) {
    return null;
  }

  /*
   * CRAI backend may return UTC timestamps without
   * an explicit timezone suffix, for example:
   *
   * 2026-09-12T05:43:26.330387
   *
   * That value is UTC, not browser-local time.
   *
   * JavaScript otherwise interprets a timezone-less
   * ISO timestamp as local time.
   *
   * Therefore explicitly mark CRAI naive timestamps
   * as UTC.
   */
  if (
    !/[zZ]$/.test(value) &&
    !/[+-]\d{2}:?\d{2}$/.test(value)
  ) {
    value = `${value}Z`;
  }

  const parsed =
    new Date(value);

  const milliseconds =
    parsed.getTime();

  if (!Number.isFinite(milliseconds)) {
    return null;
  }

  return milliseconds;
}


function ageMinutes(
  timestamp,
) {
  const time =
    parseCRAITimestamp(
      timestamp,
    );

  if (time === null) {
    return null;
  }

  return Math.max(
    0,
    (Date.now() - time) / 60000,
  );
}


function evidenceCount(
  evidence,
) {
  const available =
    evidence?.available || {};

  return [
    "visual",
    "environmental",
    "spatial",
    "temporal",
  ].filter(
    (key) => available[key],
  ).length;
}


function fmt(
  value,
  decimals = 1,
) {
  const n = num(value);

  return n === null
    ? "—"
    : n.toFixed(decimals);
}


/* ============================================================
   APP
============================================================ */

export default function App() {

  const [page, setPage] =
    useState("Overview");

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [result, setResult] =
    useState(null);

  const [selectedZone, setSelectedZone] =
    useState("A1");

  const [file, setFile] =
    useState(null);

  const [preview, setPreview] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [sensorBusy, setSensorBusy] =
    useState(false);

  const [health, setHealth] =
    useState(false);

  const [aiOnline, setAiOnline] =
    useState(false);

  const [sensor, setSensor] =
    useState(null);

  const [error, setError] =
    useState("");

  const [language, setLanguage] =
    useState("English");

  const [lastUpdated, setLastUpdated] =
    useState(null);

  const inputRef =
    useRef(null);


  /* ==========================================================
     BACKEND + SENSOR POLLING
  ========================================================== */

  useEffect(() => {

    Promise.allSettled([
      getHealth(),
      getAIStatus(),
    ]).then(
      ([healthResult, aiResult]) => {

        setHealth(
          healthResult.status ===
            "fulfilled",
        );

        setAiOnline(
          aiResult.status ===
            "fulfilled",
        );
      },
    );


    refreshSensor();


    const sensorTimer =
      window.setInterval(
        () => {
          refreshSensor();
        },
        10000,
      );


    return () => {
      window.clearInterval(
        sensorTimer,
      );
    };

  }, []);


  /* ==========================================================
     REFRESH SENSOR
     
     HARDWARE STATUS:
     
     REAL + <= 2 min
       -> ONLINE
     
     REAL + > 2 min
       -> OFFLINE
     
     No reading
       -> WAITING
     
     EVIDENCE STATUS:
     
     REAL + <= 15 min
       -> usable evidence
  ========================================================== */

  async function refreshSensor() {

    try {

      const data =
        await getSensorReadings();


      const rows =
        Array.isArray(data?.value)
          ? data.value
          : Array.isArray(data)
            ? data
            : [];


      if (!rows.length) {

        setSensor(null);

        return;
      }


      const sorted =
        [...rows]
          .filter(Boolean)
          .sort(
            (a, b) =>
              new Date(
                b.timestamp,
              ).getTime() -
              new Date(
                a.timestamp,
              ).getTime(),
          );


      /*
       * Prefer the actual CRAI ESP32 node.
       */
      const esp32Rows =
        sorted.filter(
          (item) =>
            String(
              item.device_id || "",
            ).toUpperCase() ===
            "CRAI-ESP32-01",
        );


      const latest =
        esp32Rows[0] ||
        sorted[0];


      if (!latest) {

        setSensor(null);

        return;
      }


      const age =
        ageMinutes(
          latest.timestamp,
        );


      const source =
        String(
          latest.source || "",
        ).toUpperCase();


      const isReal =
        source === "REAL";


      /*
       * Live hardware connection:
       * <= 2 minutes.
       */
      const online =
        isReal &&
        age !== null &&
        age <= 2;


      /*
       * Evidence usability:
       * <= 15 minutes.
       */
      const usable =
        isReal &&
        age !== null &&
        age <= 15;


      setSensor({
        ...latest,

        available:
          usable,

        online,

        stale:
          !usable,

        age_minutes:
          age,

        connection_status:
          online
            ? "ONLINE"
            : "OFFLINE",
      });


      setLastUpdated(
        new Date(),
      );

    } catch {

      /*
       * Do not make an old reading
       * look fresh when polling fails.
       */
      setSensor(
        (current) =>
          current
            ? {
                ...current,

                available:
                  false,

                online:
                  false,

                connection_status:
                  "OFFLINE",
              }
            : null,
      );
    }
  }


  /* ==========================================================
     SELECT IMAGE
  ========================================================== */

  function selectFile(
    selectedFile,
  ) {

    if (!selectedFile) {
      return;
    }


    setError("");


    setFile(
      selectedFile,
    );


    setPreview(
      URL.createObjectURL(
        selectedFile,
      ),
    );


    setResult(null);


    setPage(
      "Observe",
    );
  }


  /* ==========================================================
     RUN CRAI ANALYSIS
  ========================================================== */

  async function runAnalysis(
    currentFile = file,
    advisoryLanguageOverride = null,
  ) {

    if (!currentFile) {
      return;
    }


    const requestedLanguage =
      advisoryLanguageOverride ||
      language ||
      "English";


    setBusy(true);
    setError("");


    try {

      const analysis =
        await analyzeFieldImage({
          file:
            currentFile,

          zoneId:
            selectedZone,

          farmId:
            1,

          crop:
            "Tomato",

          growthStage:
            "Vegetative",

          advisoryLanguage:
            requestedLanguage,
        });


      setResult(
        analysis,
      );


      setLastUpdated(
        new Date(),
      );


      const acquisition =
        analysis?.sensor_acquisition;


      const risk =
        getRisk(
          analysis,
        );


      const adaptive =
        getAdaptive(
          analysis,
        );


      /* ======================================================
         CRAI REQUESTED FRESH SENSOR
      ====================================================== */

      if (
        !risk &&
        (
          acquisition?.status ===
            "PENDING" ||
          adaptive?.action ===
            "REQUEST_SENSOR"
        )
      ) {

        setSensorBusy(
          true,
        );


        await createSensorRequest({
          farmId:
            1,

          zoneId:
            selectedZone,

          deviceId:
            "CRAI-ESP32-01",

          source:
            "ESP32",

          requestedEvidence:
            acquisition?.requested_evidence ||
            "FRESH_SENSOR",

          reason:
            acquisition?.reason ||
            adaptive?.evidence_gap ||
            "ENVIRONMENT",

          priority:
            acquisition?.priority ||
            adaptive?.priority ||
            "HIGH",
        }).catch(
          () => null,
        );


        const started =
          Date.now();


        while (
          Date.now() -
            started <
          90000
        ) {

          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                3000,
              ),
          );


          const sensorData =
            await getSensorReadings()
              .catch(
                () => null,
              );


          const rows =
            Array.isArray(
              sensorData?.value,
            )
              ? sensorData.value
              : Array.isArray(
                    sensorData,
                  )
                ? sensorData
                : [];


          const fresh =
            rows
              .filter(
                (item) =>
                  String(
                    item.zone_id ||
                      "",
                  ).toUpperCase() ===
                  String(
                    selectedZone,
                  ).toUpperCase(),
              )
              .sort(
                (a, b) =>
                  new Date(
                    b.timestamp,
                  ).getTime() -
                  new Date(
                    a.timestamp,
                  ).getTime(),
              )[0];


          const freshAge =
            ageMinutes(
              fresh?.timestamp,
            );


          const freshIsReal =
            String(
              fresh?.source ||
                "",
            ).toUpperCase() ===
            "REAL";


          if (
            fresh &&
            freshIsReal &&
            freshAge !== null &&
            freshAge <= 15
          ) {

            setSensor({
              ...fresh,

              available:
                true,

              online:
                freshAge <= 2,

              stale:
                false,

              age_minutes:
                freshAge,

              connection_status:
                freshAge <= 2
                  ? "ONLINE"
                  : "OFFLINE",
            });


            /*
             * Re-run CRAI so the
             * backend itself consumes
             * the fresh evidence.
             */
            const finalResult =
              await analyzeFieldImage({
                file:
                  currentFile,

                zoneId:
                  selectedZone,

                farmId:
                  1,

                crop:
                  "Tomato",

                growthStage:
                  "Vegetative",

                advisoryLanguage:
                  requestedLanguage,
              });


            setResult(
              finalResult,
            );


            setLastUpdated(
              new Date(),
            );


            break;
          }
        }


        setSensorBusy(
          false,
        );

      } else {

        const sensorResult =
          getSensor(
            analysis,
          );


        if (sensorResult) {

          const sensorAge =
            ageMinutes(
              sensorResult.timestamp,
            );


          const sensorIsReal =
            String(
              sensorResult.source ||
                "",
            ).toUpperCase() ===
            "REAL";


          setSensor({
            ...sensorResult,

            available:
              sensorIsReal &&
              sensorAge !== null &&
              sensorAge <= 15,

            online:
              sensorIsReal &&
              sensorAge !== null &&
              sensorAge <= 2,

            stale:
              sensorAge === null ||
              sensorAge > 15,

            age_minutes:
              sensorAge,

            connection_status:
              sensorIsReal &&
              sensorAge !== null &&
              sensorAge <= 2
                ? "ONLINE"
                : "OFFLINE",
          });
        }
      }

    } catch (
      exception
    ) {

      setError(
        exception?.message ||
          "CRAI analysis failed.",
      );

    } finally {

      setBusy(false);

      setSensorBusy(false);
    }
  }


  /* ==========================================================
     LANGUAGE CHANGE
     
     The same observation is re-run through CRAI so the
     backend/Qwen3 generates the advisory in the new language.
  ========================================================== */

  async function changeLanguage(
    nextLanguage,
  ) {

    if (
      !LANGUAGE_OPTIONS.includes(
        nextLanguage,
      )
    ) {
      return;
    }


    setLanguage(
      nextLanguage,
    );


    if (
      file &&
      !busy &&
      !sensorBusy
    ) {

      await runAnalysis(
        file,
        nextLanguage,
      );
    }
  }


  /* ==========================================================
     RESET OBSERVATION
  ========================================================== */

  function resetObservation() {

    if (
      preview &&
      preview.startsWith(
        "blob:",
      )
    ) {

      URL.revokeObjectURL(
        preview,
      );
    }


    setFile(null);
    setPreview("");
    setResult(null);
    setError("");
    setPage("Observe");
  }


  /* ==========================================================
     DERIVED DATA
  ========================================================== */

  const disease =
    getDisease(
      result,
    );


  const risk =
    getRisk(
      result,
    );


  const decision =
    getDecision(
      result,
    );


  const evidence =
    getEvidence(
      result,
    );


  const adaptive =
    getAdaptive(
      result,
    );


  const advisory =
    getAdvisory(
      result,
    );


  const judge =
    getJudgeIntelligence(
      result,
    );


  const ready =
    !!risk;


  const count =
    evidenceCount(
      evidence,
    );


  /*
   * IMPORTANT:
   *
   * "EDGE ONLINE" must NOT be hardcoded.
   *
   * Backend healthy + ESP32 live
   *     -> EDGE ONLINE
   *
   * Backend healthy + no live ESP32
   *     -> EDGE READY
   *
   * Backend unavailable
   *     -> EDGE OFFLINE
   */
  const edgeStatus =
    sensor?.online
      ? "EDGE ONLINE"
      : health
        ? "EDGE READY"
        : "EDGE OFFLINE";


  return (
    <div className="crai-app">

      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <aside
        className={`sidebar ${
          mobileOpen
            ? "open"
            : ""
        }`}
      >

        <div className="brand">

          <div className="brand-mark">
            <Leaf size={25} />
          </div>

          <div>

            <b>
              CRAI
            </b>

            <span>
              Adaptive Edge Intelligence
            </span>

          </div>

        </div>


        <div className="nav-label">
          FIELD OPERATIONS
        </div>


        {NAV.map(
          (item) => (

            <button
              key={item}
              className={`nav-item ${
                page === item
                  ? "active"
                  : ""
              }`}
              onClick={() => {
                setPage(
                  item,
                );

                setMobileOpen(
                  false,
                );
              }}
            >

              {item ===
              "Overview" ? (
                <Gauge size={19} />
              ) : item ===
                "Observe" ? (
                <Camera size={19} />
              ) : item ===
                "Field Intelligence" ? (
                <ShieldCheck size={19} />
              ) : item ===
                "Sensors" ? (
                <Cpu size={19} />
              ) : item ===
                "History" ? (
                <HistoryIcon size={19} />
              ) : (
                <BarChart3 size={19} />
              )}


              <span>
                {item}
              </span>


              {item ===
                "Field Intelligence" &&
                ready ? (
                <i />
              ) : null}

            </button>
          ),
        )}


        <div className="sidebar-spacer" />


        <button
          className={`nav-item ${
            page === "Settings"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setPage(
              "Settings",
            )
          }
        >

          <Settings size={19} />

          <span>
            Settings
          </span>

        </button>


        {/* ====================================================
            DYNAMIC EDGE CARD
        ==================================================== */}

        <div className="edge-card">

          <div className="edge-top">

            <span
              className={`live-dot ${
                sensor?.online
                  ? "on"
                  : ""
              }`}
            />

            {edgeStatus}

            <small>
              LOCAL
            </small>

          </div>


          <div className="edge-node">

            <Cpu size={17} />

            Raspberry Pi / Laptop

          </div>


          <div className="edge-grid">

            <div>

              <span>
                Vision AI
              </span>

              <b>
                READY
              </b>

            </div>


            <div>

              <span>
                Ollama
              </span>

              <b>
                {aiOnline
                  ? "READY"
                  : "CHECK"}
              </b>

            </div>


            <div>

              <span>
                ESP32
              </span>

              <b
                className={
                  sensor?.online
                    ? "sensor-online"
                    : sensor
                      ? "sensor-offline"
                      : "sensor-waiting"
                }
              >
                {sensor?.online
                  ? "ONLINE"
                  : sensor
                    ? "OFFLINE"
                    : "WAITING"}
              </b>

            </div>


            <div>

              <span>
                Offline mode
              </span>

              <b>
                ACTIVE
              </b>

            </div>

          </div>

        </div>

      </aside>


      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="main">

        <header className="topbar">

          <button
            className="mobile-menu"
            onClick={() =>
              setMobileOpen(
                !mobileOpen,
              )
            }
          >
            <Menu />
          </button>


          <div className="crumb">

            CRAI

            <ChevronRight
              size={15}
            />

            <b>
              {page}
            </b>

          </div>


          <div className="top-actions">

            <span className="system-pill">

              <span
                className={`live-dot ${
                  health
                    ? "on"
                    : ""
                }`}
              />

              {health
                ? "System operational"
                : "Backend offline"}

            </span>


            <button
              className="icon-btn"
            >
              <Bell size={19} />
            </button>


            <div className="avatar">
              F
            </div>

          </div>

        </header>


        <div className="content">

          {/* ==================================================
              OVERVIEW
          ================================================== */}

          {page ===
            "Overview" && (
            <Overview
              result={
                result
              }

              risk={
                risk
              }

              disease={
                disease
              }

              decision={
                decision
              }

              evidence={
                evidence
              }

              count={
                count
              }

              setPage={
                setPage
              }

              setSelectedZone={
                setSelectedZone
              }
            />
          )}


          {/* ==================================================
              OBSERVE
          ================================================== */}

          {page ===
            "Observe" && (
            <Observe
              file={
                file
              }

              preview={
                preview
              }

              inputRef={
                inputRef
              }

              busy={
                busy
              }

              sensorBusy={
                sensorBusy
              }

              error={
                error
              }

              result={
                result
              }

              selectedZone={
                selectedZone
              }

              setSelectedZone={
                setSelectedZone
              }

              selectFile={
                selectFile
              }

              runAnalysis={
                () =>
                  runAnalysis()
              }

              reset={
                resetObservation
              }

              language={
                language
              }
            />
          )}


          {/* ==================================================
              FIELD INTELLIGENCE
          ================================================== */}

          {page ===
            "Field Intelligence" && (
            <Intelligence
              result={
                result
              }

              risk={
                risk
              }

              disease={
                disease
              }

              decision={
                decision
              }

              evidence={
                evidence
              }

              adaptive={
                adaptive
              }

              advisory={
                advisory
              }

              judge={
                judge
              }

              language={
                language
              }

              setLanguage={
                setLanguage
              }

              changeLanguage={
                changeLanguage
              }

              setPage={
                setPage
              }

              currentFile={
                file
              }

              rerunAnalysis={
                runAnalysis
              }
            />
          )}


          {/* ==================================================
              SENSORS
          ================================================== */}

          {page ===
            "Sensors" && (
            <Sensors
              sensor={
                sensor
              }

              busy={
                sensorBusy
              }

              refresh={
                refreshSensor
              }

              onAcquire={() => {

                setPage(
                  "Observe",
                );

                if (file) {

                  runAnalysis(
                    file,
                  );
                }

              }}
            />
          )}


          {/* ==================================================
              HISTORY
          ================================================== */}

          {page ===
            "History" && (
            <HistoryPage
              result={
                result
              }
            />
          )}


          {/* ==================================================
              REPORTS
          ================================================== */}

          {page ===
            "Reports" && (
            <Reports
              result={
                result
              }

              language={
                language
              }

              setLanguage={
                setLanguage
              }

              changeLanguage={
                changeLanguage
              }

              currentFile={
                file
              }

              rerunAnalysis={
                runAnalysis
              }
            />
          )}


          {/* ==================================================
              SETTINGS
          ================================================== */}

          {page ===
            "Settings" && (
            <SettingsPage
              language={
                language
              }

              setLanguage={
                setLanguage
              }

              changeLanguage={
                changeLanguage
              }

              aiOnline={
                aiOnline
              }
            />
          )}

        </div>

      </main>

    </div>
  );
}


/* ============================================================
   HEADER
============================================================ */

function Header({
  eyebrow,
  title,
  sub,
  action,
}) {

  return (
    <div className="page-header">

      <div>

        <span className="eyebrow">
          {eyebrow}
        </span>

        <h1>
          {title}
        </h1>

        <p>
          {sub}
        </p>

      </div>


      {action && (
        <div className="head-action">
          {action}
        </div>
      )}

    </div>
  );
}


/* ============================================================
   OVERVIEW
============================================================ */

function Overview({
  result,
  risk,
  disease,
  decision,
  evidence,
  count,
  setPage,
  setSelectedZone,
}) {

  const ready =
    !!risk;


  return (
    <section>

      <Header
        eyebrow="FRIDAY · SEPTEMBER 11"
        title="Field intelligence overview"
        sub="A single evidence-driven view of what matters in your field."
        action={

          <div className="head-actions">

            <button
              className="btn secondary"
              onClick={() =>
                setPage(
                  "Sensors",
                )
              }
            >

              <RefreshCw
                size={16}
              />

              Refresh evidence

            </button>


            <button
              className="btn primary"
              onClick={() =>
                setPage(
                  "Observe",
                )
              }
            >

              <Camera
                size={16}
              />

              New observation

            </button>

          </div>
        }
      />


      <div className="kpi-grid">

        <Metric
          label="FIELD RISK"

          value={
            ready
              ? fmt(
                  risk.risk_score,
                )
              : "—"
          }

          suffix={
            ready
              ? risk.risk_level ||
                "PENDING"
              : "AWAITING EVIDENCE"
          }

          sub={
            ready
              ? "Deterministic fusion"
              : "Start an observation"
          }
        />


        <Metric
          label="ACTIVE SIGNAL"

          value={
            disease
              ? diseaseName(
                  disease,
                )
              : "—"
          }

          suffix={
            disease
              ? `${fmt(
                  disease.confidence,
                  1,
                )}% confidence`
              : "Awaiting image"
          }

          sub={
            disease
              ? "Visual AI · Model output"
              : "No observation yet"
          }
        />


        <Metric
          label="EVIDENCE"

          value={`${count} / 4`}

          suffix={
            ready
              ? "COMPLETE"
              : "IN PROGRESS"
          }

          sub={
            ready
              ? "All accepted sources usable"
              : "CRAI will request what is missing"
          }
        />


        <Metric
          label="ASSESSMENT"

          value={
            ready
              ? risk.assessment_confidence ||
                "HIGH"
              : "WAITING"
          }

          suffix={
            ready
              ? "confidence"
              : "for evidence"
          }

          sub={
            ready
              ? "Deterministic CRAI decision"
              : "Start an observation"
          }
        />

      </div>


      <div className="overview-grid">

        <div className="card field-card">

          <div className="card-head">

            <div>

              <span className="eyebrow">
                FIELD INTELLIGENCE
              </span>

              <h2>
                Farm 01{" "}
                <span>·</span>{" "}
                Zone network
              </h2>

            </div>


            <button
              className="link-btn"
              onClick={() =>
                setPage(
                  "Field Intelligence",
                )
              }
            >

              Open intelligence

              <ChevronRight
                size={16}
              />

            </button>

          </div>


          <FieldMap
            onSelect={(zone) => {

              setSelectedZone(
                zone.id,
              );

              setPage(
                "Observe",
              );

            }}
          />


          <div className="map-legend">

            <span>
              <i className="dot low" />
              Low
            </span>

            <span>
              <i className="dot moderate" />
              Moderate
            </span>

            <span>
              <i className="dot high" />
              High
            </span>

            <span>
              <i className="dot critical" />
              Critical
            </span>

          </div>

        </div>


        <div className="card recommendation">

          <div className="card-head">

            <div>

              <span className="eyebrow">
                CRAI RECOMMENDATION
              </span>

              <h2>
                {ready
                  ? "Prioritize field inspection"
                  : "Ready for observation"}
              </h2>

            </div>


            <Sparkles
              size={20}
              className="spark"
            />

          </div>


          {ready ? (

            <>

              <div className="signal-line">

                <div
                  className={`risk-badge ${riskClass(
                    risk.risk_level,
                  )}`}
                >
                  {risk.risk_level}
                </div>


                <div>

                  <b>
                    {diseaseName(
                      disease,
                    )}
                  </b>

                  <span>
                    {fmt(
                      disease?.confidence,
                      1,
                    )}
                    % visual confidence
                  </span>

                </div>

              </div>


              <p>
                {decision?.message ||
                  decision?.reason ||
                  "CRAI generated a deterministic decision."}
              </p>


              <div className="steps">

                {(
                  decision?.recommended_steps ||
                  []
                )
                  .slice(0, 3)
                  .map(
                    (
                      step,
                      index,
                    ) => (

                      <div
                        key={
                          index
                        }
                      >

                        <span>
                          {String(
                            index +
                              1,
                          ).padStart(
                            2,
                            "0",
                          )}
                        </span>

                        {step}

                      </div>
                    ),
                  )}

              </div>


              <button
                className="btn soft"
                onClick={() =>
                  setPage(
                    "Field Intelligence",
                  )
                }
              >

                Why this score?

                <ChevronRight
                  size={16}
                />

              </button>

            </>

          ) : (

            <>

              <p>
                Upload a crop image.
                CRAI validates image
                quality, runs disease AI,
                and requests only the
                evidence needed for a
                reliable decision.
              </p>


              <button
                className="btn primary"
                onClick={() =>
                  setPage(
                    "Observe",
                  )
                }
              >

                <Camera
                  size={16}
                />

                Start observation

              </button>

            </>
          )}

        </div>

      </div>


      <div className="pipeline-card card">

        <div className="pipeline-title">

          <div>

            <span className="eyebrow">
              THE CRAI LOOP
            </span>

            <h2>
              Observe → Evidence → Fuse → Decide
            </h2>

          </div>


          <span className="fresh-pill">

            <span className="live-dot on" />

            Live evidence

          </span>

        </div>


        <EvidencePipeline
          evidence={
            evidence
          }

          risk={
            risk
          }
        />

      </div>

    </section>
  );
}


/* ============================================================
   METRIC
============================================================ */

function Metric({
  label,
  value,
  suffix,
  sub,
}) {

  return (
    <div className="card metric">

      <div className="metric-label">

        {label}

        <CircleDot
          size={14}
        />

      </div>


      <div className="metric-value">
        {value}
      </div>


      <div className="metric-suffix">
        {suffix}
      </div>


      <div className="metric-sub">
        {sub}
      </div>

    </div>
  );
}


/* ============================================================
   FIELD MAP
============================================================ */

function FieldMap({
  onSelect,
}) {

  return (
    <div className="field-map">

      <div className="field-boundary">

        <div className="field-row-lines" />

        <div className="field-water" />


        {zones.map(
          (zone) => (

            <button
              key={
                zone.id
              }

              className={`zone ${riskClass(
                zone.level,
              )}`}

              style={{
                left:
                  `${zone.x}%`,

                top:
                  `${zone.y}%`,
              }}

              onClick={() =>
                onSelect(
                  zone,
                )
              }
            >

              <span>
                {zone.id}
              </span>

              <i>
                {zone.risk}
              </i>

            </button>

          ),
        )}

      </div>


      <div className="north">
        N
      </div>

    </div>
  );
}


/* ============================================================
   EVIDENCE PIPELINE
============================================================ */

function EvidencePipeline({
  evidence,
  risk,
}) {

  const details =
    evidence?.details ||
    {};


  const items = [

    [
      "VISUAL",
      Camera,
      details.visual?.confidence,
      "STRONG",
    ],

    [
      "ENVIRONMENT",
      Thermometer,
      details.environmental?.status,
      details.environmental?.age_minutes != null
        ? `${fmt(
            details.environmental.age_minutes,
            0,
          )} min ago`
        : "MISSING",
    ],

    [
      "SPATIAL",
      MapPin,
      details.spatial?.infected_neighbors != null
        ? `${details.spatial.infected_neighbors} / ${details.spatial.total_observations}`
        : "—",
      details.spatial?.available
        ? "OBSERVED"
        : "MISSING",
    ],

    [
      "TEMPORAL",
      HistoryIcon,
      details.temporal?.trend?.replaceAll(
        "_",
        " ",
      ) || "—",
      details.temporal?.delta != null
        ? `Δ ${
            details.temporal.delta >
            0
              ? "+"
              : ""
          }${fmt(
            details.temporal.delta,
            1,
          )}`
        : "MISSING",
    ],
  ];


  return (
    <div className="evidence-pipeline">

      {items.map(
        ([
          name,
          Icon,
          value,
          status,
        ]) => (

          <div
            className="evidence-item"
            key={
              name
            }
          >

            <div className="evidence-icon">

              <Icon
                size={18}
              />

            </div>


            <div>

              <span>
                {name}
              </span>

              <b>
                {value == null
                  ? "—"
                  : typeof value ===
                      "number"
                    ? fmt(
                        value,
                        1,
                      )
                    : value}
              </b>

              <small>
                {status}
              </small>

            </div>

          </div>

        ),
      )}


      <div className="pipeline-arrow">
        →
      </div>


      <div className="evidence-result">

        <ShieldCheck
          size={19}
        />

        <div>

          <span>
            FUSED RISK
          </span>

          <b>
            {risk?.risk_score !=
            null
              ? fmt(
                  risk.risk_score,
                  1,
                )
              : "WAITING"}
          </b>

          <small>
            {risk?.risk_level ||
              "ADDITIONAL EVIDENCE"}
          </small>

        </div>

      </div>

    </div>
  );
}


/* ============================================================
   OBSERVE
============================================================ */

function Observe({
  file,
  preview,
  inputRef,
  busy,
  sensorBusy,
  error,
  result,
  selectedZone,
  setSelectedZone,
  selectFile,
  runAnalysis,
  reset,
  language,
}) {

  const disease =
    getDisease(
      result,
    );


  const risk =
    getRisk(
      result,
    );


  const decision =
    getDecision(
      result,
    );


  const adaptive =
    getAdaptive(
      result,
    );


  const environmentalSensor =
    getSensor(
      result,
    );


  const environmentalFresh =
    !!environmentalSensor &&
    ageMinutes(
      environmentalSensor?.timestamp,
    ) <= 15;


  return (
    <section>

      <Header
        eyebrow="FIELD OBSERVATION"
        title="Observe a crop"
        sub="Start with the smartphone. CRAI decides what additional evidence is actually needed."
        action={

          <span className="fresh-pill">

            <span className="live-dot on" />

            EDGE INFERENCE

          </span>
        }
      />


      <div className="observe-grid">

        <div className="card upload-card">

          <div className="card-head">

            <div>

              <span className="eyebrow">
                SMARTPHONE VISION
              </span>

              <h2>
                Crop image
              </h2>

            </div>

            <Camera size={20} />

          </div>


          {!preview ? (

            <button
              className="upload-zone"
              onClick={() =>
                inputRef.current?.click()
              }
            >

              <Upload
                size={28}
              />

              <strong>
                Select an image
              </strong>

              <span>
                JPG, JPEG, PNG or WEBP · Crop / leaf imagery
              </span>

              <div className="upload-button">
                Choose Image
              </div>

            </button>

          ) : (

            <div className="preview-wrap">

              <img
                src={preview}
                alt="Selected crop"
              />

              <div className="preview-overlay">

                <b>
                  {file?.name}
                </b>

                <button
                  onClick={
                    reset
                  }
                >

                  <X
                    size={16}
                  />

                </button>

              </div>

            </div>

          )}


          <input
            ref={
              inputRef
            }

            type="file"

            accept="image/png,image/jpeg,image/jpg,image/webp"

            hidden

            onChange={(event) =>
              selectFile(
                event.target.files?.[0],
              )
            }
          />


          <div className="context-row">

            <label>

              Zone

              <select
                value={
                  selectedZone
                }

                onChange={(event) =>
                  setSelectedZone(
                    event.target.value,
                  )
                }
              >

                <option>
                  A1
                </option>

                <option>
                  B2
                </option>

                <option>
                  C3
                </option>

                <option>
                  D1
                </option>

              </select>

            </label>


            <label>

              Crop

              <select
                defaultValue="Tomato"
              >

                <option>
                  Tomato
                </option>

              </select>

            </label>


            <label>

              Growth stage

              <select
                defaultValue="Vegetative"
              >

                <option>
                  Vegetative
                </option>

                <option>
                  Flowering
                </option>

                <option>
                  Fruiting
                </option>

              </select>

            </label>

          </div>


          <button
            className="btn primary wide"

            disabled={
              !file ||
              busy ||
              sensorBusy
            }

            onClick={
              runAnalysis
            }
          >

            {busy ? (

              <>

                <RefreshCw
                  className="spin"
                />

                Running CRAI…

              </>

            ) : sensorBusy ? (

              <>

                <Wifi
                  className="pulse"
                />

                Waiting for fresh ESP32 evidence…

              </>

            ) : (

              <>

                <Sparkles
                  size={17}
                />

                Analyze with CRAI

              </>
            )}

          </button>


          {error && (

            <div className="error-box">

              <AlertTriangle
                size={17}
              />

              {error}

            </div>

          )}

        </div>


        <div className="card observe-status">

          <span className="eyebrow">
            ADAPTIVE EVIDENCE
          </span>

          <h2>
            CRAI only senses what matters.
          </h2>


          <EvidenceStatus
            label="Image quality"

            ok={
              result?.image_quality?.status ===
              "GOOD"
            }

            text={
              result?.image_quality?.status ||
              "Waiting for image"
            }
          />


          <EvidenceStatus
            label="Visual disease AI"

            ok={
              !!disease
            }

            text={
              disease
                ? `${diseaseName(
                    disease,
                  )} · ${fmt(
                    disease.confidence,
                    1,
                  )}%`
                : "Waiting"
            }
          />


          <EvidenceStatus
            label="Environmental"

            ok={
              environmentalFresh
            }

            text={
              environmentalSensor
                ? `${fmt(
                    environmentalSensor.soil_moisture,
                    1,
                  )}% soil · ${fmt(
                    environmentalSensor.temperature,
                    1,
                  )}°C`
                : "Waiting for ESP32"
            }
          />


          <EvidenceStatus
            label="Field decision"

            ok={
              !!risk
            }

            text={
              risk
                ? `${fmt(
                    risk.risk_score,
                    1,
                  )} · ${
                    risk.risk_level
                  }`
                : adaptive?.reason ||
                  "Additional evidence may be requested"
            }
          />


          {decision && (

            <div
              className={`decision-mini ${
                risk
                  ? "ready"
                  : "pending"
              }`}
            >

              <ShieldCheck
                size={18}
              />

              <div>

                <b>
                  {decision.title ||
                    decision.action ||
                    "CRAI decision"}
                </b>

                <span>
                  {decision.message ||
                    decision.reason}
                </span>

              </div>

            </div>

          )}

        </div>

      </div>

    </section>
  );
}


/* ============================================================
   EVIDENCE STATUS
============================================================ */

function EvidenceStatus({
  label,
  ok,
  text,
}) {

  return (
    <div className="status-row">

      <span>

        {ok ? (

          <CheckCircle2
            size={18}
          />

        ) : (

          <CircleDot
            size={18}
          />

        )}

        <b>
          {label}
        </b>

      </span>


      <small>
        {text}
      </small>

    </div>
  );
}


/* ============================================================
   FIELD INTELLIGENCE
============================================================ */

function Intelligence({
  result,
  risk,
  disease,
  decision,
  evidence,
  adaptive,
  advisory,
  judge,
  language,
  setLanguage,
  changeLanguage,
  setPage,
  currentFile,
  rerunAnalysis,
}) {

  if (!risk) {

    return (
      <section>

        <Header
          eyebrow="FIELD INTELLIGENCE"
          title="Decision intelligence"
          sub="Complete an observation to unlock deterministic field risk."
        />


        <div className="card empty-report">

          <Gauge
            size={30}
          />

          <h2>
            No completed assessment yet
          </h2>

          <p>
            CRAI will show the score only
            after the evidence gate is
            satisfied.
          </p>


          {adaptive && (

            <div className="evidence-gap-card">

              <AlertTriangle
                size={18}
              />

              <div>

                <b>
                  Additional evidence required
                </b>

                <span>
                  {adaptive.reason ||
                    "CRAI needs more evidence before finalizing the assessment."}
                </span>

              </div>

            </div>

          )}


          <button
            className="btn primary"
            onClick={() =>
              setPage(
                "Observe",
              )
            }
          >

            <Camera
              size={16}
            />

            Start observation

          </button>

        </div>

      </section>
    );
  }


  const breakdown =
    risk.breakdown ||
    {};


  const contributions =
    risk.contributions ||
    {};


  const judgeRisk =
    judge?.why_risk;


  const judgeSensor =
    judge?.why_sensor;


  const provenance =
    judge?.evidence_provenance ||
    [];


  return (
    <section>

      <Header
        eyebrow="FIELD INTELLIGENCE · FARM 01 / A1"

        title={`Why is this field at ${risk.risk_level} risk?`}

        sub="CRAI combines independent evidence sources before producing a deterministic field decision."

        action={

          <button
            className="btn primary"
            onClick={() =>
              setPage(
                "Observe",
              )
            }
          >

            <Camera
              size={16}
            />

            New observation

          </button>
        }
      />


      {/* ====================================================
          RISK HERO
      ==================================================== */}

      <div className="risk-hero card">

        <div>

          <span className="eyebrow">
            FUSED FIELD RISK
          </span>


          <div className="risk-number">

            {fmt(
              risk.risk_score,
              1,
            )}

            <span>
              {risk.risk_level}
            </span>

          </div>


          <p>
            Assessment confidence{" "}

            <b>
              {risk.assessment_confidence ||
                "HIGH"}
            </b>
          </p>

        </div>


        <div
          className={`risk-gauge ${riskClass(
            risk.risk_level,
          )}`}
        >

          <div
            style={{
              "--score": `${Math.min(
                100,
                Math.max(
                  0,
                  num(
                    risk.risk_score,
                    0,
                  ),
                ),
              )}%`,
            }}
          />

          <b>
            {fmt(
              risk.risk_score,
              1,
            )}
          </b>

        </div>

      </div>


      {/* ====================================================
          WHY RISK
      ==================================================== */}

      <div className="card">

        <div className="card-head">

          <div>

            <span className="eyebrow">
              WHY THIS SCORE
            </span>

            <h2>
              What moved the score
            </h2>

          </div>


          <span className="fresh-pill">

            {evidence?.evidence_count ||
              4}{" "}

            / 4 sources

          </span>

        </div>


        <div className="contrib-grid">

          {[
            [
              "Visual",
              breakdown.visual,
              contributions.visual,
              Camera,
            ],

            [
              "Environment",
              breakdown.environmental,
              contributions.environmental,
              Thermometer,
            ],

            [
              "Spatial",
              breakdown.spatial,
              contributions.spatial,
              MapPin,
            ],

            [
              "Temporal",
              breakdown.temporal,
              contributions.temporal,
              HistoryIcon,
            ],

          ].map(
            ([
              name,
              score,
              contribution,
              Icon,
            ]) => (

              <div
                className="contrib"
                key={
                  name
                }
              >

                <div>

                  <Icon
                    size={17}
                  />

                  <span>
                    {name}
                  </span>

                  <b>
                    {fmt(
                      contribution,
                      1,
                    )}
                  </b>

                </div>


                <div className="bar">

                  <i
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          num(
                            score,
                            0,
                          ),
                        ),
                      )}%`,
                    }}
                  />

                </div>


                <small>
                  Evidence score{" "}
                  {fmt(
                    score,
                    1,
                  )}
                </small>

              </div>

            ),
          )}

        </div>


        {judgeRisk && (

          <div className="why-risk-explanation">

            <div className="why-risk-main">

              <ShieldCheck
                size={18}
              />

              <div>

                <b>
                  Deterministic explanation
                </b>

                <span>
                  {judgeRisk.explanation ||
                    `The strongest contribution came from ${
                      judgeRisk.strongest_contributor?.source ||
                      "available evidence"
                    }.`}
                </span>

              </div>

            </div>


            <div className="formula-row">

              <span>
                Visual
              </span>

              <b>
                35%
              </b>

              <span>
                Environment
              </span>

              <b>
                25%
              </b>

              <span>
                Spatial
              </span>

              <b>
                25%
              </b>

              <span>
                Temporal
              </span>

              <b>
                15%
              </b>

            </div>

          </div>

        )}

      </div>


      {/* ====================================================
          WHY SENSOR
      ==================================================== */}

      {judgeSensor?.needed && (

        <div className="card evidence-gap-card-large">

          <div className="gap-icon">

            <Wifi
              size={20}
            />

          </div>


          <div className="gap-copy">

            <span className="eyebrow">
              ADAPTIVE EVIDENCE REQUEST
            </span>

            <h2>
              Why did CRAI ask for a sensor reading?
            </h2>

            <p>
              {judgeSensor.reason}
            </p>


            <div className="gap-meta">

              <span>

                Required:{" "}

                <b>
                  {judgeSensor.required_evidence ||
                    "FRESH_ENVIRONMENTAL"}
                </b>

              </span>


              <span>

                Source:{" "}

                <b>
                  {judgeSensor.requested_source ||
                    "ESP32"}
                </b>

              </span>


              <span>

                Policy:{" "}

                <b>

                  ≤{" "}

                  {judgeSensor.policy?.freshness_limit_minutes ||
                    15}{" "}

                  min

                </b>

              </span>

            </div>

          </div>

        </div>

      )}


      {/* ====================================================
          PROVENANCE
      ==================================================== */}

      <div className="card">

        <div className="card-head">

          <div>

            <span className="eyebrow">
              EVIDENCE PROVENANCE
            </span>

            <h2>
              Where did this decision come from?
            </h2>

          </div>


          <span className="fresh-pill">
            Traceable evidence
          </span>

        </div>


        <div className="provenance-grid">

          {provenance.map(
            (
              item,
              index,
            ) => (

              <div
                className="provenance-item"
                key={
                  `${item.type}-${index}`
                }
              >

                <div className="provenance-top">

                  <span>
                    {String(
                      item.type ||
                        "evidence",
                    ).toUpperCase()}
                  </span>

                  <b>
                    {item.used_in_decision
                      ? "USED"
                      : "NOT USED"}
                  </b>

                </div>


                <strong>
                  {item.source ||
                    "Unknown source"}
                </strong>


                {item.type ===
                  "visual" && (

                  <small>

                    {item.value ||
                      "Visual signal"}

                    {" · "}

                    {item.confidence !=
                    null
                      ? `${fmt(
                          item.confidence,
                          1,
                        )}% confidence`
                      : "—"}

                  </small>

                )}


                {item.type ===
                  "environmental" && (

                  <small>

                    Soil{" "}
                    {item.values?.soil_moisture ??
                      "—"}
                    % ·{" "}

                    {item.values?.temperature ??
                      "—"}
                    °C ·{" "}

                    {item.values?.humidity ??
                      "—"}
                    % RH

                    <br />

                    {item.freshness ||
                      "UNKNOWN"}

                    {" · "}

                    {item.age_minutes !=
                    null
                      ? `${fmt(
                          item.age_minutes,
                          1,
                        )} min old`
                      : "age unavailable"}

                  </small>

                )}


                {item.type ===
                  "spatial" && (

                  <small>

                    {item.values
                      ?.infected_neighbors ??
                      "—"}

                    {" / "}

                    {item.values
                      ?.total_observed_zones ??
                      "—"}

                    {" "}observed areas affected

                  </small>

                )}


                {item.type ===
                  "temporal" && (

                  <small>

                    {item.observation_count ??
                      "—"}

                    {" "}field-memory observations

                  </small>

                )}

              </div>

            ),
          )}

        </div>

      </div>


      {/* ====================================================
          DECISION TRACE
      ==================================================== */}

      <div className="card">

        <div className="card-head">

          <div>

            <span className="eyebrow">
              DECISION TRACE
            </span>

            <h2>
              From evidence to action
            </h2>

          </div>


          <span className="fresh-pill">
            DETERMINISTIC
          </span>

        </div>


        <div className="decision-trace">

          {(
            judge?.decision_trace?.stages ||
            [
              {
                stage:
                  "EVIDENCE_EVALUATION",
                status:
                  "COMPLETE",
              },

              {
                stage:
                  "ADAPTIVE_EVIDENCE_GATE",
                status:
                  "DECISION_READY",
              },

              {
                stage:
                  "FUSION_V1_5",
                status:
                  "COMPLETE",
              },

              {
                stage:
                  "DETERMINISTIC_DECISION",
                status:
                  "READY",
              },
            ]
          ).map(
            (
              stage,
              index,
            ) => (

              <div
                className="trace-item"
                key={
                  `${stage.stage}-${index}`
                }
              >

                <div className="trace-number">

                  {String(
                    index + 1,
                  ).padStart(
                    2,
                    "0",
                  )}

                </div>


                <div>

                  <b>
                    {String(
                      stage.stage ||
                        "",
                    ).replaceAll(
                      "_",
                      " ",
                    )}
                  </b>

                  <span>
                    {stage.status ||
                      "COMPLETE"}
                  </span>

                </div>


                {index <
                  3 && (

                  <ChevronRight
                    size={15}
                  />

                )}

              </div>

            ),
          )}

        </div>

      </div>


      {/* ====================================================
          DECISION
      ==================================================== */}

      <div className="two-col">

        <div className="card">

          <span className="eyebrow">
            EVIDENCE QUALITY
          </span>

          <h2>

            {evidence?.evidence_count ||
              4}

            {" / 4 sources ready"}

          </h2>


          <div className="quality-list">

            <Quality
              n="Visual"

              v={
                evidence?.details?.visual
                  ?.status ||
                "STRONG"
              }

              d={`${fmt(
                evidence?.details?.visual
                  ?.confidence,
                1,
              )}%`}
            />


            <Quality
              n="Environment"

              v={
                evidence?.details
                  ?.environmental
                  ?.status ||
                "FRESH"
              }

              d={
                evidence?.details
                  ?.environmental
                  ?.age_minutes !=
                null
                  ? `${fmt(
                      evidence.details
                        .environmental
                        .age_minutes,
                      0,
                    )} min ago`
                  : "—"
              }
            />


            <Quality
              n="Spatial"

              v={
                evidence?.details
                  ?.spatial
                  ?.available
                  ? "Observed"
                  : "Missing"
              }

              d={
                evidence?.details
                  ?.spatial
                  ?.infected_neighbors !=
                null
                  ? `${
                      evidence.details
                        .spatial
                        .infected_neighbors
                    } / ${
                      evidence.details
                        .spatial
                        .total_observations
                    } affected`
                  : "—"
              }
            />


            <Quality
              n="Temporal"

              v={
                evidence?.details
                  ?.temporal
                  ?.trend?.replaceAll(
                    "_",
                    " ",
                  ) || "—"
              }

              d={
                evidence?.details
                  ?.temporal
                  ?.delta !=
                null
                  ? `Δ ${fmt(
                      evidence.details
                        .temporal
                        .delta,
                      1,
                    )}`
                  : "—"
              }
            />

          </div>

        </div>


        <div className="card decision-card">

          <div className="decision-top">

            <div className="decision-icon">
              <ShieldCheck />
            </div>


            <div>

              <span className="eyebrow">
                DETERMINISTIC DECISION
              </span>

              <h2>

                {decision?.title ||
                  String(
                    decision?.action ||
                      "Decision",
                  ).replaceAll(
                    "_",
                    " ",
                  )}

              </h2>

            </div>

          </div>


          <div className="decision-action">

            {String(
              decision?.action ||
                "WAITING_FOR_EVIDENCE",
            ).replaceAll(
              "_",
              " ",
            )}

          </div>


          <p>

            {decision?.message ||
              decision?.reason ||
              "Decision generated by CRAI."}

          </p>


          <div className="steps">

            {(
              decision?.recommended_steps ||
              []
            ).map(
              (
                step,
                index,
              ) => (

                <div
                  key={
                    index
                  }
                >

                  <span>

                    {String(
                      index + 1,
                    ).padStart(
                      2,
                      "0",
                    )}

                  </span>

                  {step}

                </div>

              ),
            )}

          </div>

        </div>

      </div>


      {/* ====================================================
          FARMER ADVISOR
      ==================================================== */}

      {advisory && (

        <div className="card advisory">

          <div className="advisory-mark">
            <Sparkles />
          </div>


          <div>

            <span className="eyebrow">
              CRAI FIELD ADVISOR · LOCAL AI
            </span>

            <h2>
              Farmer-friendly explanation
            </h2>


            {advisory.advisory && (

              <p>
                {advisory.advisory}
              </p>

            )}


            <div className="advisory-meta">

              <span className="local-badge">

                {advisory.model ||
                  "CRAI FALLBACK"}

                {" · "}

                {advisory.offline
                  ? "OFFLINE"
                  : "LOCAL"}

              </span>


              {advisory.fallback && (

                <span className="fallback-badge">
                  Safe deterministic fallback
                </span>

              )}

            </div>


            <FarmerVoice

              advisory={
                advisory.advisory ||
                ""
              }

              language={
                language
              }

              onLanguageChange={
                changeLanguage
              }

            />

          </div>

        </div>

      )}

    </section>
  );
}


/* ============================================================
   JUDGE WHY SENSOR
============================================================ */

function JudgeWhySensor({
  judgeSensor,
}) {

  if (!judgeSensor) {
    return null;
  }


  const needed =
    judgeSensor.needed;


  const trigger =
    judgeSensor.trigger;


  const reason =
    judgeSensor.reason;


  const requestedEvidence =
    judgeSensor.required_evidence ||
    judgeSensor.requested_evidence ||
    "FRESH_ENVIRONMENTAL";


  const source =
    judgeSensor.requested_source ||
    "CRAI-ESP32-01";


  const policy =
    judgeSensor.policy_minutes ??
    15;


  return (
    <div className="judge-card card">

      <div className="judge-card-header">

        <div className="judge-card-icon">

          <Cpu size={18} />

        </div>


        <div>

          <span className="eyebrow">
            EVIDENCE ECONOMY
          </span>

          <h3>
            Why did CRAI ask for sensor data?
          </h3>

        </div>

      </div>


      <div className="judge-sensor-grid">

        <div className="judge-sensor-status">

          <span
            className={
              needed
                ? "judge-status warning"
                : "judge-status success"
            }
          >

            {needed
              ? "EVIDENCE REQUIRED"
              : "EVIDENCE SUFFICIENT"}

          </span>


          <strong>

            {trigger ===
              "ENVIRONMENTAL_EVIDENCE_STALE"

              ? "Environmental evidence is stale"

              : trigger ===
                  "ENVIRONMENTAL_EVIDENCE_MISSING"

                ? "Environmental evidence is missing"

                : "Fresh environmental evidence is required"}

          </strong>


          <p>

            {reason ||
              "CRAI requires fresh environmental evidence before finalizing the field decision."}

          </p>

        </div>


        <div className="judge-request-box">

          <span className="eyebrow">
            REQUIRED EVIDENCE
          </span>

          <strong>
            {requestedEvidence.replaceAll(
              "_",
              " ",
            )}
          </strong>

          <span>
            Source: {source}
          </span>

          <span>
            Freshness policy: ≤ {policy} min
          </span>

        </div>

      </div>

    </div>
  );
}


/* ============================================================
   JUDGE EVIDENCE PROVENANCE
============================================================ */

function JudgeEvidenceProvenance({
  provenance,
}) {

  if (
    !Array.isArray(
      provenance,
    ) ||
    provenance.length ===
      0
  ) {
    return null;
  }


  return (
    <div className="judge-card card">

      <div className="judge-card-header">

        <div className="judge-card-icon">

          <ShieldCheck size={18} />

        </div>


        <div>

          <span className="eyebrow">
            EVIDENCE PROVENANCE
          </span>

          <h3>
            What evidence did CRAI actually use?
          </h3>

        </div>

      </div>


      <div className="provenance-grid">

        {provenance.map(
          (
            item,
            index,
          ) => {

            const source =
              item?.source ||
              item?.name ||
              `Evidence ${index + 1}`;


            const status =
              item?.status ||
              (item?.used
                ? "USED"
                : "AVAILABLE");


            const quality =
              item?.quality ||
              item?.freshness ||
              "—";


            const used =
              item?.used === true ||
              String(
                status,
              ).toUpperCase() ===
                "USED";


            return (
              <div
                className="provenance-item"
                key={
                  `${source}-${index}`
                }
              >

                <div className="provenance-top">

                  <span className="provenance-source">

                    {source}

                  </span>


                  <span
                    className={
                      used
                        ? "provenance-status used"
                        : "provenance-status"
                    }
                  >

                    {used
                      ? "✓ USED"
                      : status}

                  </span>

                </div>


                <div className="provenance-value">

                  {item?.prediction && (

                    <strong>
                      {item.prediction}
                    </strong>

                  )}


                  {item?.confidence != null && (

                    <span>

                      Confidence{" "}

                      {fmt(
                        item.confidence,
                        1,
                      )}%

                    </span>

                  )}


                  {item?.soil_moisture != null && (

                    <span>

                      Soil moisture{" "}

                      {fmt(
                        item.soil_moisture,
                        1,
                      )}%

                    </span>

                  )}


                  {item?.temperature != null && (

                    <span>

                      Temperature{" "}

                      {fmt(
                        item.temperature,
                        1,
                      )}°C

                    </span>

                  )}


                  {item?.humidity != null && (

                    <span>

                      Humidity{" "}

                      {fmt(
                        item.humidity,
                        1,
                      )}% RH

                    </span>

                  )}


                  {item?.infected != null &&
                    item?.total != null && (

                    <span>

                      Spatial evidence{" "}

                      {item.infected}/
                      {item.total}

                      {" "}infected

                    </span>

                  )}


                  {item?.observation_count != null && (

                    <span>

                      Field memory{" "}

                      {item.observation_count}

                      {" "}observations

                    </span>

                  )}


                  {item?.age_minutes != null && (

                    <span>

                      Age{" "}

                      {fmt(
                        item.age_minutes,
                        1,
                      )}

                      {" "}min

                    </span>

                  )}

                </div>


                <div className="provenance-bottom">

                  <span>
                    Quality: {quality}
                  </span>


                  {item?.timestamp && (

                    <span>

                      {new Date(
                        item.timestamp,
                      ).toLocaleTimeString(
                        [],
                        {
                          hour:
                            "2-digit",
                          minute:
                            "2-digit",
                        },
                      )}

                    </span>

                  )}

                </div>

              </div>
            );
          },
        )}

      </div>

    </div>
  );
}


/* ============================================================
   JUDGE WHY RISK
============================================================ */

function JudgeWhyRisk({
  judgeRisk,
  risk,
}) {

  if (
    !judgeRisk ||
    !risk
  ) {
    return null;
  }


  const contributions =
    judgeRisk.contributions ||
    risk.contributions ||
    {};


  const labels = {
    visual:
      "Visual",

    environmental:
      "Environmental",

    spatial:
      "Spatial",

    temporal:
      "Temporal",
  };


  const rows =
    Object.entries(
      contributions,
    )

      .filter(
        ([, value]) =>
          Number.isFinite(
            Number(value),
          ),
      )

      .map(
        ([
          key,
          value,
        ]) => ({
          key,

          label:
            labels[key] ||
            key,

          value:
            Number(value),
        }),
      )

      .sort(
        (a, b) =>
          b.value -
          a.value,
      );


  return (
    <div className="judge-card card">

      <div className="judge-card-header">

        <div className="judge-card-icon">

          <Gauge size={18} />

        </div>


        <div>

          <span className="eyebrow">
            DETERMINISTIC FUSION
          </span>

          <h3>

            Why is this field at{" "}
            {risk.risk_level}
            {" "}risk?

          </h3>


          <p className="judge-subtitle">

            CRAI combines independent
            evidence sources. The language
            model does not calculate this score.

          </p>

        </div>

      </div>


      <div className="judge-risk-summary">

        <div className="judge-score">

          <span>
            FUSED FIELD RISK
          </span>

          <strong>
            {fmt(
              risk.risk_score,
              1,
            )}
          </strong>


          <b
            className={`risk-pill ${riskClass(
              risk.risk_level,
            )}`}
          >
            {risk.risk_level}
          </b>

        </div>


        <div className="judge-formula">

          <span className="eyebrow">
            CRAI FUSION V1.5
          </span>


          {rows.map(
            (row) => (

              <div
                className="judge-contribution"
                key={
                  row.key
                }
              >

                <span>
                  {row.label}
                </span>

                <b>
                  +{row.value.toFixed(1)}
                </b>


                <div className="judge-bar">

                  <span
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          row.value *
                            2.5,
                        ),
                      )}%`,
                    }}
                  />

                </div>

              </div>

            ),
          )}

        </div>

      </div>


      <div className="judge-explanation">

        <Sparkles
          size={16}
        />

        <span>

          {judgeRisk.explanation ||
            judgeRisk.summary ||
            "The field risk is derived from CRAI's deterministic evidence-fusion engine."}

        </span>

      </div>

    </div>
  );
}


/* ============================================================
   JUDGE DECISION TRACE
============================================================ */

function JudgeDecisionTrace({
  judge,
  decision,
}) {

  const trace =
    judge?.decision_trace;


  if (!trace) {
    return null;
  }


  const stages =
    Array.isArray(
      trace.stages,
    )

      ? trace.stages

      : Array.isArray(
          trace,
        )

        ? trace

        : [];


  return (
    <div className="judge-card card">

      <div className="judge-card-header">

        <div className="judge-card-icon">

          <Activity size={18} />

        </div>


        <div>

          <span className="eyebrow">
            DECISION TRACE
          </span>

          <h3>
            How CRAI reached the decision
          </h3>

        </div>

      </div>


      <div className="decision-trace">

        {stages.length > 0

          ? stages.map(
              (
                stage,
                index,
              ) => (

                <div
                  className="trace-step"
                  key={
                    `${stage?.name || "stage"}-${index}`
                  }
                >

                  <div className="trace-number">
                    {index + 1}
                  </div>


                  <div className="trace-content">

                    <strong>

                      {String(
                        stage?.name ||
                          stage?.stage ||
                          "Evidence stage",
                      ).replaceAll(
                        "_",
                        " ",
                      )}

                    </strong>


                    <span>

                      {stage?.description ||
                        stage?.reason ||
                        stage?.status ||
                        ""}

                    </span>

                  </div>

                </div>

              ),
            )

          : (

            <div className="trace-step">

              <div className="trace-number">
                1
              </div>


              <div className="trace-content">

                <strong>
                  Deterministic decision
                </strong>

                <span>

                  {decision?.action ||
                    "Decision completed from validated evidence."}

                </span>

              </div>

            </div>

          )}

      </div>


      {decision?.action && (

        <div className="trace-result">

          <span>
            FINAL ACTION
          </span>

          <strong>

            {String(
              decision.action,
            ).replaceAll(
              "_",
              " ",
            )}

          </strong>


          {decision?.priority && (

            <b>
              {decision.priority}
            </b>

          )}

        </div>

      )}

    </div>
  );
}


/* ============================================================
   QUALITY
============================================================ */

function Quality({
  n,
  v,
  d,
}) {

  return (
    <div className="quality-row">

      <span>

        <span className="live-dot on" />

        {n}

      </span>


      <b>
        {v}
      </b>


      <small>
        {d}
      </small>

    </div>
  );
}


/* ============================================================
   SENSORS
============================================================ */

function Sensors({
  sensor,
  busy,
  refresh,
  onAcquire,
}) {

  const age =
    ageMinutes(
      sensor?.timestamp,
    );


  return (
    <section>

      <Header
        eyebrow="SENSOR NETWORK"
        title="Environmental evidence"
        sub="Every reading carries a timestamp. Freshness determines whether CRAI can use it."

        action={

          <button
            className="btn primary"

            onClick={
              onAcquire
            }

            disabled={
              busy
            }
          >

            <Zap
              size={16}
            />

            {busy
              ? "Waiting for ESP32"
              : "Acquire fresh reading"}

          </button>
        }
      />


      <div className="sensor-grid">

        <div className="card sensor-main">

          <div className="sensor-head">

            <div className="device-icon">
              <Cpu />
            </div>


            <div>

              <span className="eyebrow">
                ESP32 · NODE 01
              </span>

              <h2>
                CRAI-ESP32-01
              </h2>

              <span className="muted">
                Zone A1 · REAL-TIME NODE
              </span>

            </div>


            <span className="fresh-pill">

              <span
                className={`live-dot ${
                  sensor?.online
                    ? "on"
                    : ""
                }`}
              />

              {sensor?.online
                ? "LIVE"
                : sensor
                  ? "OFFLINE"
                  : "NO READING"}

            </span>

          </div>


          <div className="sensor-values">

            <SensorValue
              icon={
                Droplets
              }

              label="Soil moisture"

              value={fmt(
                sensor?.soil_moisture,
                1,
              )}

              unit="%"
            />


            <SensorValue
              icon={
                Thermometer
              }

              label="Temperature"

              value={fmt(
                sensor?.temperature,
                1,
              )}

              unit="°C"
            />


            <SensorValue
              icon={
                Activity
              }

              label="Humidity"

              value={fmt(
                sensor?.humidity,
                1,
              )}

              unit="% RH"
            />

          </div>


          <div className="freshness">

            <div>

              <span>
                Evidence freshness
              </span>

              <b>

                {age != null

                  ? `${fmt(
                      age,
                      0,
                    )} min · ${
                      age <= 15
                        ? "within"
                        : "outside"
                    } 15 min policy`

                  : "No reading received"}

              </b>

            </div>


            <div className="fresh-bar">

              <i
                style={{
                  width:
                    age == null
                      ? "2%"
                      : `${Math.min(
                          100,
                          Math.max(
                            3,
                            (age /
                              60) *
                              100,
                          ),
                        )}%`,
                }}
              />

            </div>


            <div className="fresh-scale">

              <span>
                NOW
              </span>

              <span>
                15 min · FRESH LIMIT
              </span>

              <span>
                60 min
              </span>

            </div>

          </div>


          <button
            className="btn secondary"
            onClick={
              refresh
            }
          >

            <RefreshCw
              size={16}
            />

            Refresh sensor data

          </button>

        </div>


        <div className="card network">

          <span className="eyebrow">
            EDGE NETWORK
          </span>

          <h2>
            Acquisition health
          </h2>


          <NetworkRow
            name="ESP32 node"

            value={
              sensor?.online
                ? "CONNECTED"
                : sensor
                  ? "OFFLINE"
                  : "WAITING"
            }

            ok={
              !!sensor?.online
            }
          />


          <NetworkRow
            name="Sensor gateway"
            value="LOCAL"
            ok
          />


          <NetworkRow
            name="Local inference"
            value="READY"
            ok
          />


          <NetworkRow
            name="Cloud dependency"
            value="NONE"
            ok
          />

        </div>

      </div>

    </section>
  );
}


/* ============================================================
   SENSOR VALUE
============================================================ */

function SensorValue({
  icon: Icon,
  label,
  value,
  unit,
}) {

  return (
    <div>

      <Icon />

      <span>
        {label}
      </span>

      <b>

        {value}

        <small>
          {unit}
        </small>

      </b>

    </div>
  );
}


/* ============================================================
   NETWORK ROW
============================================================ */

function NetworkRow({
  name,
  value,
  ok,
}) {

  return (
    <div className="network-row">

      <span>

        <span
          className={`live-dot ${
            ok
              ? "on"
              : ""
          }`}
        />

        {name}

      </span>


      <b>
        {value}
      </b>

    </div>
  );
}


/* ============================================================
   HISTORY
============================================================ */

function HistoryPage({
  result,
}) {

  const risk =
    getRisk(
      result,
    );


  const evidence =
    getEvidence(
      result,
    );


  return (
    <section>

      <Header
        eyebrow="FIELD MEMORY"
        title="Observation history"
        sub="CRAI preserves evidence context so each new observation can be interpreted against what happened before."
      />


      <div className="history-grid">

        <div className="card trend-card">

          <div className="card-head">

            <div>

              <span className="eyebrow">
                RISK TREND
              </span>

              <h2>

                {risk

                  ? `${fmt(
                      risk.risk_score,
                      1,
                    )} · ${
                      risk.risk_level
                    }`

                  : "Awaiting observations"}

              </h2>

            </div>


            <HistoryIcon />

          </div>


          <div className="trend-visual">

            <div className="trend-line">

              <span />
              <span />
              <span />
              <span />
              <span />

            </div>


            <div className="trend-labels">

              <span>
                Earlier
              </span>

              <span>
                Latest
              </span>

            </div>

          </div>

        </div>


        <div className="card">

          <span className="eyebrow">
            FIELD MEMORY
          </span>

          <h2>
            Evidence timeline
          </h2>


          <div className="timeline">

            <TimelineItem
              title="Visual observation"

              text={
                getDisease(
                  result,
                )

                  ? diseaseName(
                      getDisease(
                        result,
                      ),
                    )

                  : "No observation yet"
              }
            />


            <TimelineItem
              title="Environmental evidence"

              text={
                evidence
                  ?.details
                  ?.environmental
                  ?.status ||
                "Waiting"
              }
            />


            <TimelineItem
              title="Deterministic decision"

              text={
                getDecision(
                  result,
                )?.action?.replaceAll(
                  "_",
                  " ",
                ) ||

                "Waiting"
              }
            />

          </div>

        </div>

      </div>

    </section>
  );
}


/* ============================================================
   TIMELINE ITEM
============================================================ */

function TimelineItem({
  title,
  text,
}) {

  return (
    <div className="timeline-item">

      <span className="timeline-dot" />


      <div>

        <b>
          {title}
        </b>

        <span>
          {text}
        </span>

      </div>

    </div>
  );
}


/* ============================================================
   REPORTS
============================================================ */

function Reports({
  result,
  language,
  setLanguage,
  changeLanguage,
}) {

  if (
    !result ||
    !getRisk(
      result,
    )
  ) {

    return (
      <section>

        <Header
          eyebrow="FIELD REPORT"
          title="Decision-ready report"
          sub="A report is created after CRAI completes an observation."

          action={

            <button
              className="btn secondary"
              onClick={() =>
                window.print()
              }
            >

              <Send
                size={16}
              />

              Print

            </button>
          }
        />


        <div className="card empty-report">

          <FileText
            size={30}
          />

          <h2>
            No completed assessment yet
          </h2>

          <p>
            Run an observation and
            complete the evidence loop
            before exporting a field
            report.
          </p>

        </div>

      </section>
    );
  }


  const risk =
    getRisk(
      result,
    );


  const disease =
    getDisease(
      result,
    );


  const decision =
    getDecision(
      result,
    );


  const evidence =
    getEvidence(
      result,
    );


  const advisory =
    getAdvisory(
      result,
    );


  return (
    <section>

      <Header
        eyebrow="FIELD REPORT"
        title="Decision-ready report"
        sub="A concise evidence trail for operators, agronomists and judges."

        action={

          <button
            className="btn primary"
            onClick={() =>
              window.print()
            }
          >

            <Send
              size={16}
            />

            Export / Print

          </button>
        }
      />


      <div className="report-shell">

        <div className="report-brand">

          <div className="brand-mark">

            <Leaf
              size={21}
            />

          </div>


          <div>

            <b>
              CRAI
            </b>

            <span>
              Adaptive Edge Agricultural Intelligence
            </span>

          </div>


          <span>
            FIELD REPORT · A1
          </span>

        </div>


        <div className="report-hero">

          <span className="eyebrow">
            FIELD HEALTH
          </span>


          <b>
            {fmt(
              risk.risk_score,
              1,
            )}
          </b>


          <strong>
            {risk.risk_level ||
              "PENDING"}
          </strong>


          <p>
            Tomato · Vegetative · Zone A1
          </p>

        </div>


        <div className="report-sections">

          <div>

            <span className="eyebrow">
              PRIMARY SIGNAL
            </span>

            <h3>
              {diseaseName(
                disease,
              )}
            </h3>

            <p>

              {disease?.confidence !=
              null

                ? `${fmt(
                    disease.confidence,
                    1,
                  )}% visual model confidence`

                : "Not available"}

            </p>

          </div>


          <div>

            <span className="eyebrow">
              EVIDENCE
            </span>

            <p>

              {evidence?.evidence_count ||
                0}

              {" / 4 sources available"}

            </p>

            <p>

              Quality ·{" "}

              {evidence?.evidence_quality ||
                "HIGH"}

            </p>

          </div>


          <div>

            <span className="eyebrow">
              DECISION
            </span>

            <h3>

              {String(
                decision?.action ||
                  "PENDING",
              ).replaceAll(
                "_",
                " ",
              )}

            </h3>

            <p>

              {decision?.message ||
                decision?.reason ||
                "No completed deterministic decision."}

            </p>

          </div>

        </div>


        {advisory?.advisory && (

          <div className="report-advisory">

            <div>

              <span className="eyebrow">
                LOCAL FARMER ADVISORY
              </span>

              <p>
                {advisory.advisory}
              </p>

            </div>


            <FarmerVoice

              advisory={
                advisory.advisory
              }

              language={
                language
              }

              onLanguageChange={
                changeLanguage
              }

              compact

            />

          </div>

        )}


        <div className="report-footer">

          Generated by deterministic
          CRAI evidence fusion ·
          Qwen3 advisory is explanatory
          only · Offline capable

        </div>

      </div>

    </section>
  );
}


/* ============================================================
   SETTINGS
============================================================ */

function SettingsPage({
  language,
  setLanguage,
  changeLanguage,
  aiOnline,
}) {

  return (
    <section>

      <Header
        eyebrow="SYSTEM CONFIGURATION"
        title="CRAI settings"
        sub="Inspect the edge stack, evidence policy and advisory preferences."
      />


      <div className="settings-grid">

        <div className="card settings-card">

          <span className="eyebrow">
            EDGE AI
          </span>

          <h2>
            Local inference stack
          </h2>


          <SettingRow
            n="Tomato Disease AI"
            v="READY"
          />


          <SettingRow
            n="Ollama / Qwen3"
            v={
              aiOnline
                ? "READY"
                : "OFFLINE"
            }
          />


          <SettingRow
            n="Offline mode"
            v="ACTIVE"
          />

        </div>


        <div className="card settings-card">

          <span className="eyebrow">
            EVIDENCE POLICY
          </span>

          <h2>
            Freshness rules
          </h2>


          <SettingRow
            n="Fresh environmental evidence"
            v="≤ 15 min"
          />


          <SettingRow
            n="Sensor validation"
            v="0–100 / −20–70°C"
          />


          <SettingRow
            n="Future timestamp tolerance"
            v="≤ 5 min"
          />

        </div>


        <div className="card settings-card">

          <span className="eyebrow">
            ADVISORY
          </span>

          <h2>
            Farmer language
          </h2>


          <label className="setting-select">

            Language

            <select
              value={
                language
              }

              onChange={(event) =>
                changeLanguage(
                  event.target.value,
                )
              }
            >

              {LANGUAGE_OPTIONS.map(
                (option) => (

                  <option
                    key={
                      option
                    }
                  >
                    {option}
                  </option>

                ),
              )}

            </select>

          </label>

        </div>

      </div>

    </section>
  );
}


/* ============================================================
   SETTING ROW
============================================================ */

function SettingRow({
  n,
  v,
}) {

  return (
    <div className="setting-row">

      <span>
        {n}
      </span>

      <b>
        {v}
      </b>

    </div>
  );
}
