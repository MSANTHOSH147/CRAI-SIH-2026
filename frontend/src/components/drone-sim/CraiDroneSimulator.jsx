import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BatteryMedium,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Cpu,
  Crosshair,
  Gauge,
  Home,
  MapPin,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Satellite,
  ScanLine,
  ThermometerSun,
  Wind,
} from "lucide-react";
import { useCrai } from "../../context/CraiContext";
import { analyzeMissionCell } from "../../services/missionApi";
import DigitalTwinScene, { ROUTE, regionToWorld } from "./DigitalTwinScene";
import "./CraiDroneSimulator.css";

const TOTAL_CELLS = ROUTE.length;
const START_REGION = "A1";
const START_POSITION = regionToWorld(START_REGION, 13);

const PHASES = [
  { key: "gps", label: "GPS LOCK", ms: 360 },
  { key: "rgb", label: "RGB CAPTURE", ms: 420 },
  { key: "thermal", label: "THERMAL CAPTURE", ms: 420 },
  { key: "disease", label: "DISEASE AI", ms: 650 },
  { key: "spatial", label: "SPATIAL CONTEXT", ms: 480 },
  { key: "risk", label: "RISK AI", ms: 650 },
  { key: "decision", label: "DECISION", ms: 360 },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function regionFromPosition(position) {
  let best = START_REGION;
  let bestDistance = Infinity;

  ROUTE.forEach((region) => {
    const point = regionToWorld(region, position[1]);
    const dx = point[0] - position[0];
    const dz = point[2] - position[2];
    const distance = dx * dx + dz * dz;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = region;
    }
  });

  return best;
}

function riskTone(level) {
  const normalized = String(level || "UNSCANNED").toUpperCase();
  if (normalized === "CRITICAL") return "critical";
  if (normalized === "HIGH") return "high";
  if (normalized === "MODERATE") return "moderate";
  if (normalized === "LOW") return "low";
  return "neutral";
}

function formatDisease(value) {
  return String(value || "Waiting")
    .replace(/^Tomato_/, "")
    .replace(/^Potato_/, "")
    .replaceAll("_", " ");
}

function fallbackRiskLevel(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "UNKNOWN";
  if (value < 30) return "LOW";
  if (value < 60) return "MODERATE";
  if (value < 80) return "HIGH";
  return "CRITICAL";
}

function decisionFor(level) {
  switch (String(level || "").toUpperCase()) {
    case "CRITICAL":
      return "Priority field inspection required";
    case "HIGH":
      return "Inspect this region and nearby plants";
    case "MODERATE":
      return "Monitor closely and schedule a follow-up scan";
    case "LOW":
      return "Continue routine monitoring";
    default:
      return "Awaiting CRAI risk assessment";
  }
}

export default function CraiDroneSimulator() {
  const {
    observations,
    addObservation,
    clearObservations,
    mission,
    updateMission,
  } = useCrai();

  const [mode, setMode] = useState("MANUAL");
  const [missionState, setMissionState] = useState("READY");
  const [paused, setPaused] = useState(false);
  const [sensorMode, setSensorMode] = useState("RGB");
  const [selectedCell, setSelectedCell] = useState(START_REGION);
  const [currentRegion, setCurrentRegion] = useState(START_REGION);
  const [dronePosition, setDronePosition] = useState(START_POSITION);
  const [heading, setHeading] = useState(0);
  const [altitude, setAltitude] = useState(13);
  const [battery, setBattery] = useState(96);
  const [speed, setSpeed] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState(-1);
  const [statusMessage, setStatusMessage] = useState("System armed · manual flight ready");
  const [timeline, setTimeline] = useState(() => [
    { time: new Date().toLocaleTimeString([], { hour12: false }), text: "System armed" },
  ]);
  const [error, setError] = useState("");
  const [autonomousIndex, setAutonomousIndex] = useState(0);
  const [demoRunning, setDemoRunning] = useState(false);

  const keysRef = useRef(new Set());
  const manualFrameRef = useRef(null);
  const navigationFrameRef = useRef(null);
  const automatedRef = useRef(false);
  const navigatingRef = useRef(false);
  const scanLockRef = useRef(false);
  const demoLockRef = useRef(false);
  const aliveRef = useRef(true);
  const pausedRef = useRef(false);
  const scanningRef = useRef(false);
  const modeRef = useRef(mode);
  const currentRegionRef = useRef(currentRegion);
  const observationsRef = useRef(observations);
  const missionStateRef = useRef(missionState);
  const altitudeRef = useRef(altitude);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    scanningRef.current = scanning;
  }, [scanning]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    currentRegionRef.current = currentRegion;
  }, [currentRegion]);

  useEffect(() => {
    missionStateRef.current = missionState;
  }, [missionState]);

  useEffect(() => {
    altitudeRef.current = altitude;
  }, [altitude]);

  useEffect(() => {
    observationsRef.current = observations;
  }, [observations]);

  useEffect(() => () => {
    aliveRef.current = false;
    if (manualFrameRef.current) cancelAnimationFrame(manualFrameRef.current);
    if (navigationFrameRef.current) cancelAnimationFrame(navigationFrameRef.current);
  }, []);

  const observationMap = useMemo(
    () => new Map(observations.map((item) => [item.region, item])),
    [observations]
  );

  // addEvent must be initialized before callbacks that reference it.
  const addEvent = useCallback((text) => {
    setTimeline((previous) => {
      const next = [
        ...previous,
        {
          time: new Date().toLocaleTimeString([], { hour12: false }),
          text,
        },
      ];
      return next.slice(-8);
    });
  }, []);

  const handleSelectCell = useCallback((region) => {
    if (!ROUTE.includes(region)) return;
    setSelectedCell(region);
    setStatusMessage(`TARGET SELECTED · ${region}`);
    addEvent(`Target selected · ${region}`);
  }, [addEvent]);

  const currentObservation = observationMap.get(currentRegion) || null;
  const selectedObservation = observationMap.get(selectedCell) || null;
  const displayObservation = selectedObservation || currentObservation;

  const coverage = Math.round((observations.length / TOTAL_CELLS) * 100);

  const syncMissionState = useCallback((state) => {
    setMissionState(state);
    updateMission({ status: state });
  }, [updateMission]);

  const normalizeObservation = useCallback((result, region, position) => ({
    id: `${mission?.id || "CRAI-M001"}-${region}-${Date.now()}`,
    missionId: mission?.id || "CRAI-M001",
    region,
    position,
    timestamp: new Date().toISOString(),
    sourceImage: result?.source_image ?? null,
    sourceDatasetClass: result?.source_dataset_class ?? null,
    gps: {
      latitude: 13.0827 + position * 0.00012,
      longitude: 80.2707 + position * 0.00009,
    },
    environment: result?.environment ?? null,
    diseaseAI: result?.disease_ai ?? null,
    riskAI: result?.risk_ai ?? null,
    summary: result?.summary ?? null,
    spatial: result?.spatial ?? null,
    pipeline: result?.pipeline ?? null,
  }), [mission?.id]);

  const moveTo = useCallback((target, duration = 1200) => new Promise((resolve) => {
    if (!aliveRef.current) {
      resolve(false);
      return;
    }

    if (navigationFrameRef.current) {
      cancelAnimationFrame(navigationFrameRef.current);
      navigationFrameRef.current = null;
    }

    navigatingRef.current = true;

    const start = [...dronePosition];
    const startTime = performance.now();
    const dx = target[0] - start[0];
    const dz = target[2] - start[2];
    const distance = Math.hypot(dx, dz);

    if (distance < 0.05) {
      navigatingRef.current = false;
      setSpeed(0);
      resolve(true);
      return;
    }

    setHeading(Math.atan2(dx, dz));
    setStatusMessage("DRONE EN ROUTE");
    syncMissionState("FLYING");

    const tick = (time) => {
      if (!aliveRef.current) {
        navigatingRef.current = false;
        navigationFrameRef.current = null;
        resolve(false);
        return;
      }

      if (!navigatingRef.current) {
        navigationFrameRef.current = null;
        setSpeed(0);
        resolve(false);
        return;
      }

      if (pausedRef.current) {
        navigationFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      const raw = clamp((time - startTime) / duration, 0, 1);
      const eased = raw < 0.5
        ? 4 * raw * raw * raw
        : 1 - Math.pow(-2 * raw + 2, 3) / 2;

      const next = [
        start[0] + dx * eased,
        altitudeRef.current,
        start[2] + dz * eased,
      ];

      setDronePosition(next);
      setCurrentRegion(regionFromPosition(next));
      setSpeed(raw < 1 ? Math.max(1.2, distance / Math.max(duration / 1000, 0.1)) : 0);

      if (raw >= 1) {
        navigatingRef.current = false;
        navigationFrameRef.current = null;
        const finalPosition = [target[0], altitudeRef.current, target[2]];
        setDronePosition(finalPosition);
        setCurrentRegion(regionFromPosition(finalPosition));
        setSpeed(0);
        setStatusMessage("POSITION LOCKED");
        resolve(true);
        return;
      }

      navigationFrameRef.current = requestAnimationFrame(tick);
    };

    navigationFrameRef.current = requestAnimationFrame(tick);
  }), [dronePosition, syncMissionState]);

  const moveToRegion = useCallback(async (region, duration = 1200) => {
    setSelectedCell(region);
    const target = regionToWorld(region, altitude);
    const arrived = await moveTo(target, duration);
    if (arrived) {
      setCurrentRegion(region);
      currentRegionRef.current = region;
      addEvent(`Arrived at ${region}`);
    }
    return arrived;
  }, [addEvent, altitude, moveTo]);

  const runScan = useCallback(async (region = currentRegionRef.current) => {
    if (!aliveRef.current) return null;
    if (scanLockRef.current) return null;
    if (!ROUTE.includes(region)) return null;
    if (missionStateRef.current === "LANDED" || missionStateRef.current === "COMPLETED") return null;

    scanLockRef.current = true;
    setError("");
    setScanning(true);
    setScanPhase(0);
    setStatusMessage(`SCANNING ${region}`);
    syncMissionState("SCANNING");
    addEvent(`${region} scan started`);

    const position = ROUTE.indexOf(region);

    try {
      // Start the real backend analysis immediately so the UI animation
      // never blocks the API call.
      const backendPromise = Promise.race([
        analyzeMissionCell({
          region,
          position,
          previousObservations: observationsRef.current,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Mission AI request timed out after 15 seconds.")), 15000)
        ),
      ]);

      // Play the 7-phase inspection sequence while the backend works.
      for (let index = 0; index < PHASES.length; index += 1) {
        if (!aliveRef.current) return null;
        setScanPhase(index);
        await sleep(PHASES[index].ms);
      }

      const result = await backendPromise;

      if (!result || typeof result !== "object") {
        throw new Error("Mission AI returned an empty response.");
      }

      const observation = normalizeObservation(result, region, position);

      // Update both React context and the local ref immediately.
      observationsRef.current = [
        ...observationsRef.current.filter((item) => item.region !== region),
        observation,
      ];
      addObservation(observation);

      const score = observation?.riskAI?.risk_score;
      const level = String(
        observation?.riskAI?.risk_level || fallbackRiskLevel(score)
      ).toUpperCase();

      setSelectedCell(region);
      setCurrentRegion(region);
      setStatusMessage(`${region} · ${level} · ${Number(score ?? 0).toFixed(1)}`);
      addEvent(`${region} analyzed · ${level} risk`);

      if (level === "CRITICAL") {
        addEvent(`CRAI PRIORITY ZONE · ${region}`);
      }

      return observation;
    } catch (scanError) {
      console.error("CRAI simulator scan failed:", scanError);
      setError(scanError?.message || "Mission scan failed.");
      setStatusMessage("SCAN FAILED");
      addEvent(`${region} scan failed`);
      return null;
    } finally {
      scanLockRef.current = false;
      setScanning(false);
      setScanPhase(-1);

      if (
        aliveRef.current &&
        !pausedRef.current &&
        missionStateRef.current !== "COMPLETED" &&
        !automatedRef.current
      ) {
        syncMissionState("READY");
      }
    }
  }, [addEvent, addObservation, normalizeObservation, syncMissionState]);

  const runAutonomous = useCallback(async (startIndex = autonomousIndex) => {
    if (!aliveRef.current || automatedRef.current || scanLockRef.current) return;

    automatedRef.current = true;
    setMode("AUTONOMOUS");
    modeRef.current = "AUTONOMOUS";
    setPaused(false);
    pausedRef.current = false;
    setStatusMessage("AUTONOMOUS MISSION ACTIVE");
    syncMissionState("FLYING");
    addEvent("Autonomous mission started · drone taking off");

    try {
      for (let index = startIndex; index < ROUTE.length; index += 1) {
        if (!automatedRef.current || !aliveRef.current) break;

        while (pausedRef.current && automatedRef.current && aliveRef.current) {
          await sleep(150);
        }

        if (!automatedRef.current || !aliveRef.current) break;

        const region = ROUTE[index];
        setAutonomousIndex(index);

        const arrived = await moveToRegion(region, index === startIndex ? 650 : 950);
        if (!arrived || !automatedRef.current) break;

        if (!observationsRef.current.some((item) => item.region === region)) {
          const observation = await runScan(region);
          if (!observation) {
            automatedRef.current = false;
            return;
          }
        }

        setBattery((value) => Math.max(18, value - 1.35));
        await sleep(260);
      }

      if (automatedRef.current && aliveRef.current) {
        setAutonomousIndex(ROUTE.length);
        syncMissionState("COMPLETED");
        setStatusMessage("MISSION COMPLETE · 20 / 20");
        addEvent("Mission completed");
      }
    } finally {
      automatedRef.current = false;
    }
  }, [addEvent, autonomousIndex, moveToRegion, runScan, syncMissionState]);

  const returnHome = useCallback(async () => {
    automatedRef.current = false;
    if (navigationFrameRef.current) cancelAnimationFrame(navigationFrameRef.current);
    navigatingRef.current = false;
    setPaused(false);
    pausedRef.current = false;
    setStatusMessage("RETURNING HOME");
    addEvent("Return-to-home initiated");
    syncMissionState("RETURNING");
    await moveTo(regionToWorld(START_REGION, altitude), 1500);
    setCurrentRegion(START_REGION);
    setSelectedCell(START_REGION);
    setDronePosition(regionToWorld(START_REGION, 1.2));
    syncMissionState("LANDED");
    setStatusMessage("LANDED · HOME POSITION");
    addEvent("Drone landed at home");
  }, [addEvent, altitude, moveTo, syncMissionState]);

  const resetMission = useCallback(() => {
    automatedRef.current = false;
    demoLockRef.current = false;
    scanLockRef.current = false;
    navigatingRef.current = false;
    keysRef.current.clear();
    if (navigationFrameRef.current) cancelAnimationFrame(navigationFrameRef.current);
    if (manualFrameRef.current) cancelAnimationFrame(manualFrameRef.current);
    setMode("MANUAL");
    setPaused(false);
    pausedRef.current = false;
    setScanning(false);
    setScanPhase(-1);
    setAutonomousIndex(0);
    setSelectedCell(START_REGION);
    setCurrentRegion(START_REGION);
    setAltitude(13);
    setDronePosition(START_POSITION);
    setBattery(96);
    setSpeed(0);
    setError("");
    setStatusMessage("System armed · manual flight ready");
    setTimeline([{ time: new Date().toLocaleTimeString([], { hour12: false }), text: "Mission reset" }]);
    clearObservations();
    observationsRef.current = [];
    syncMissionState("READY");
  }, [clearObservations, syncMissionState]);

  const runDemo = useCallback(async () => {
    if (!aliveRef.current || demoLockRef.current || automatedRef.current || scanLockRef.current) return;

    demoLockRef.current = true;
    automatedRef.current = true;
    setDemoRunning(true);
    setMode("AUTONOMOUS");
    modeRef.current = "AUTONOMOUS";
    setPaused(false);
    pausedRef.current = false;
    setStatusMessage("SIH DEMO MODE");
    addEvent("Demo mode started");

    const demoCells = ["A1", "A3", "B3", "C4"];

    try {
      for (const region of demoCells) {
        if (!automatedRef.current || !aliveRef.current) break;

        const arrived = await moveToRegion(region, 850);
        if (!arrived || !automatedRef.current) break;

        if (!observationsRef.current.some((item) => item.region === region)) {
          const observation = await runScan(region);
          if (!observation) break;
        }

        await sleep(400);
      }

      if (aliveRef.current) {
        setStatusMessage("DEMO COMPLETE · INSPECT PRIORITY REGIONS");
        addEvent("Demo mode complete");
      }
    } finally {
      automatedRef.current = false;
      demoLockRef.current = false;
      setDemoRunning(false);
    }
  }, [addEvent, moveToRegion, runScan]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key = event.key.toLowerCase();
      const supported = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"];

      if (supported.includes(key)) {
        event.preventDefault();
        keysRef.current.add(key);
      }

      if (event.code === "Space") {
        event.preventDefault();
        if (!scanLockRef.current) runScan(currentRegionRef.current);
      }

      if (key === "p") {
        setPaused((value) => !value);
      }

      if (key === "h") {
        returnHome();
      }
    };

    const onKeyUp = (event) => {
      keysRef.current.delete(event.key.toLowerCase());
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [returnHome, runScan]);

  useEffect(() => {
    let previous = performance.now();
    let frame = null;

    const tick = (now) => {
      if (!aliveRef.current) return;

      const delta = Math.min(0.04, (now - previous) / 1000);
      previous = now;

      const manualActive =
        modeRef.current === "MANUAL" &&
        !pausedRef.current &&
        !scanningRef.current &&
        !navigatingRef.current &&
        !automatedRef.current &&
        missionStateRef.current !== "LANDED";

      if (manualActive) {
        const keys = keysRef.current;

        let xDirection = 0;
        let zDirection = 0;

        if (keys.has("a") || keys.has("arrowleft")) xDirection -= 1;
        if (keys.has("d") || keys.has("arrowright")) xDirection += 1;
        if (keys.has("w") || keys.has("arrowup")) zDirection -= 1;
        if (keys.has("s") || keys.has("arrowdown")) zDirection += 1;

        const magnitude = Math.hypot(xDirection, zDirection);

        if (magnitude > 0) {
          const normalizedX = xDirection / magnitude;
          const normalizedZ = zDirection / magnitude;
          const metresPerSecond = 19;

          setDronePosition((previousPosition) => {
            const next = [
              clamp(previousPosition[0] + normalizedX * metresPerSecond * delta, -40, 40),
              altitudeRef.current,
              clamp(previousPosition[2] + normalizedZ * metresPerSecond * delta, -31, 31),
            ];
            const region = regionFromPosition(next);
            currentRegionRef.current = region;
            setCurrentRegion(region);
            return next;
          });

          setHeading(Math.atan2(normalizedX, normalizedZ));
          setSpeed(metresPerSecond);
          setBattery((value) => Math.max(18, value - delta * 0.08));

          if (missionStateRef.current === "READY") {
            syncMissionState("FLYING");
          }
        } else {
          setSpeed((value) => (value > 0.05 ? value * 0.82 : 0));
        }
      } else if (!navigatingRef.current) {
        setSpeed((value) => (value > 0.05 ? value * 0.82 : 0));
      }

      frame = requestAnimationFrame(tick);
      manualFrameRef.current = frame;
    };

    frame = requestAnimationFrame(tick);
    manualFrameRef.current = frame;

    return () => {
      if (frame) cancelAnimationFrame(frame);
      manualFrameRef.current = null;
    };
  }, [syncMissionState]);

  useEffect(() => {
    setDronePosition((position) => [position[0], altitude, position[2]]);
  }, [altitude]);

  const moveNudge = (dx, dz) => {
    if (mode !== "MANUAL" || scanning || paused || navigatingRef.current || automatedRef.current) return;
    setDronePosition((position) => {
      const next = [
        clamp(position[0] + dx, -40, 40),
        altitude,
        clamp(position[2] + dz, -31, 31),
      ];
      setHeading(Math.atan2(dx, dz));
      setCurrentRegion(regionFromPosition(next));
      return next;
    });
  };

  const riskLevel = String(displayObservation?.riskAI?.risk_level || "UNSCANNED").toUpperCase();
  const riskScore = displayObservation?.riskAI?.risk_score;
  const disease = displayObservation?.diseaseAI?.disease || displayObservation?.diseaseAI?.prediction;
  const confidence = Number(displayObservation?.diseaseAI?.confidence ?? 0);
  const env = displayObservation?.environment || {};
  const spatial = displayObservation?.spatial || {};

  const selectedTarget = regionToWorld(selectedCell, altitude);
  const targetDistance = Math.hypot(selectedTarget[0] - dronePosition[0], selectedTarget[2] - dronePosition[2]);

  const latitude = 13.0827 + ROUTE.indexOf(currentRegion) * 0.00012;
  const longitude = 80.2707 + ROUTE.indexOf(currentRegion) * 0.00009;

  return (
    <div className="crai-field-command">
      <section className="field-command-hero">
        <div>
          <div className="field-command-kicker">CRAI FIELD COMMAND · DIGITAL TWIN</div>
          <h1>Live Mission</h1>
          <p>
            Operator-controlled and autonomous crop inspection with RGB observation,
            simulated sensor telemetry, Disease AI V2 and Risk AI V1.
          </p>
        </div>

        <div className="field-command-hero-meta">
          <span className={`field-command-state state-${missionState.toLowerCase()}`}>
            <i /> {missionState}
          </span>
          <strong>{mission?.id || "CRAI-M001"}</strong>
          <small>Farm {mission?.farmId || "A-104"} · {mission?.crop || "Tomato"} · {mission?.area || 12.4} acres</small>
        </div>
      </section>

      <section className="field-command-topbar">
        <div className="field-command-mode">
          <button
            type="button"
            className={mode === "MANUAL" ? "active" : ""}
            onClick={() => {
              automatedRef.current = false;
              navigatingRef.current = false;
              if (navigationFrameRef.current) {
                cancelAnimationFrame(navigationFrameRef.current);
                navigationFrameRef.current = null;
              }
              keysRef.current.clear();
              setMode("MANUAL");
              modeRef.current = "MANUAL";
              setStatusMessage("Manual flight enabled");
              addEvent("Manual flight enabled");
            }}
          >
            <CircleDot size={14} /> Manual
          </button>
          <button
            type="button"
            className={mode === "AUTONOMOUS" ? "active" : ""}
            onClick={() => runAutonomous(autonomousIndex)}
            disabled={scanning || missionState === "COMPLETED"}
          >
            <Play size={14} /> Autonomous
          </button>
        </div>

        <div className="field-command-view-switch">
          {["RGB", "THERMAL", "RISK"].map((view) => (
            <button
              type="button"
              key={view}
              className={sensorMode === view ? "active" : ""}
              onClick={() => setSensorMode(view)}
            >
              {view}
            </button>
          ))}
        </div>

        <div className="field-command-quick-actions">
          <button
            type="button"
            onClick={() => setPaused((value) => {
              const next = !value;
              pausedRef.current = next;
              return next;
            })}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button type="button" onClick={returnHome} disabled={scanning}>
            <Home size={14} /> Home
          </button>
          <button type="button" onClick={resetMission} className="danger-quiet">
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </section>

      <div className="field-command-layout">
        <section className="digital-twin-card">
          <div className="digital-twin-stage">
            <DigitalTwinScene
              observations={observations}
              dronePosition={dronePosition}
              heading={heading}
              scanning={scanning}
              selectedCell={selectedCell}
              currentRegion={currentRegion}
              sensorMode={sensorMode}
              onSelectCell={handleSelectCell}
              missionState={missionState}
            />

            <div className="twin-overlay twin-overlay-top-left">
              <span>FIELD A-104</span>
              <strong>{sensorMode} VIEW</strong>
              <small>{sensorMode === "THERMAL" ? "SIMULATED THERMAL TELEMETRY" : "LIVE DIGITAL TWIN"}</small>
            </div>

            <div className="twin-overlay twin-overlay-top-right">
              <Radio size={13} />
              <span>{statusMessage}</span>
            </div>

            <div className="twin-overlay twin-overlay-bottom-left">
              <span>COVERAGE</span>
              <strong>{observations.length} / {TOTAL_CELLS}</strong>
              <div className="twin-mini-progress"><i style={{ width: `${coverage}%` }} /></div>
            </div>

            {scanning && (
              <div className="scan-live-banner">
                <ScanLine size={16} />
                <div>
                  <span>SCANNING {currentRegion}</span>
                  <strong>{PHASES[scanPhase]?.label || "PROCESSING"}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="digital-twin-footer">
            <div>
              <MapPin size={14} />
              <span>Drone position</span>
              <strong>{currentRegion}</strong>
            </div>
            <div>
              <Crosshair size={14} />
              <span>Selected zone</span>
              <strong>{selectedCell} · {targetDistance.toFixed(0)} m</strong>
            </div>
            <div>
              <Satellite size={14} />
              <span>GPS</span>
              <strong>{latitude.toFixed(5)}, {longitude.toFixed(5)}</strong>
            </div>
            <button type="button" onClick={() => moveToRegion(selectedCell, 950)} disabled={scanning || selectedCell === currentRegion}>
              Navigate to {selectedCell}
            </button>
          </div>
        </section>

        <aside className="field-command-side">
          <section className="mission-console-card primary-console">
            <div className="console-heading">
              <div>
                <span>MISSION CONTROL</span>
                <h2>{mode === "MANUAL" ? "Manual flight" : "Autonomous scan"}</h2>
              </div>
              <span className="keyboard-live">WASD · SPACE</span>
            </div>

            <div className="drone-pad">
              <button type="button" aria-label="Move north" onClick={() => moveNudge(0, -7)}><ChevronUp /></button>
              <button type="button" aria-label="Move west" onClick={() => moveNudge(-7, 0)}><ChevronLeft /></button>
              <button type="button" className="pad-center" onClick={() => runScan(currentRegion)} disabled={scanning}>
                <ScanLine size={20} />
                <span>{scanning ? "SCAN" : currentRegion}</span>
              </button>
              <button type="button" aria-label="Move east" onClick={() => moveNudge(7, 0)}><ChevronRight /></button>
              <button type="button" aria-label="Move south" onClick={() => moveNudge(0, 7)}><ChevronDown /></button>
            </div>

            <button type="button" className="scan-primary-button" onClick={() => runScan(currentRegion)} disabled={scanning}>
              <ScanLine size={16} />
              {scanning ? `Analyzing ${currentRegion}...` : `Scan current cell · ${currentRegion}`}
            </button>

            <button type="button" className="demo-button" onClick={runDemo} disabled={demoRunning || scanning}>
              <Activity size={15} /> {demoRunning ? "Demo running" : "SIH demo mode"}
            </button>
          </section>

          <section className="mission-console-card telemetry-console">
            <div className="console-heading compact">
              <div>
                <span>DRONE TELEMETRY</span>
                <h2>Flight data</h2>
              </div>
              <span className="connected-pill"><i /> Connected</span>
            </div>

            <div className="telemetry-grid-v4">
              <div><Gauge size={14} /><span>ALTITUDE</span><strong>{altitude.toFixed(0)} m</strong><small>AGL</small></div>
              <div><Wind size={14} /><span>SPEED</span><strong>{speed.toFixed(1)} m/s</strong><small>{speed > 0.6 ? "FLYING" : "HOVER"}</small></div>
              <div><BatteryMedium size={14} /><span>BATTERY</span><strong>{battery.toFixed(0)}%</strong><small>SIMULATED</small></div>
              <div><Satellite size={14} /><span>GPS</span><strong>12 SAT</strong><small>FIXED</small></div>
            </div>

            <label className="altitude-control">
              <span>FLIGHT ALTITUDE <strong>{altitude.toFixed(0)} m</strong></span>
              <input type="range" min="8" max="32" step="1" value={altitude} onChange={(event) => setAltitude(Number(event.target.value))} />
            </label>
          </section>

          <section className="mission-console-card fusion-console">
            <div className="console-heading compact">
              <div>
                <span>CRAI SENSOR FUSION</span>
                <h2>Inspection pipeline</h2>
              </div>
            </div>

            <div className="fusion-list">
              {[
                ["GPS", Satellite, 0],
                ["RGB", Camera, 1],
                ["THERMAL", ThermometerSun, 2],
                ["DISEASE AI", Cpu, 3],
                ["SPATIAL", MapPin, 4],
                ["RISK AI", Activity, 5],
              ].map(([label, Icon, phase]) => {
                const done = scanning ? scanPhase > phase : Boolean(displayObservation);
                const active = scanning && scanPhase === phase;
                return (
                  <div key={label} className={`${done ? "done" : ""} ${active ? "active" : ""}`}>
                    <Icon size={14} />
                    <span>{label}</span>
                    <strong>{active ? "PROCESSING" : done ? "COMPLETE" : "READY"}</strong>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>

      <div className="field-command-bottom-grid">
        <section className="mission-intelligence-v4">
          <div className="console-heading">
            <div>
              <span>CELL INTELLIGENCE</span>
              <h2>{selectedCell} · {riskLevel}</h2>
            </div>
            <span className={`risk-chip ${riskTone(riskLevel)}`}>{riskScore != null ? Number(riskScore).toFixed(1) : "UNSCANNED"}</span>
          </div>

          {displayObservation ? (
            <>
              <div className="intel-hero-grid">
                <div>
                  <span>DISEASE</span>
                  <strong>{formatDisease(disease)}</strong>
                  <small>{confidence ? `${confidence.toFixed(1)}% confidence` : "Confidence unavailable"}</small>
                </div>
                <div>
                  <span>RISK AI</span>
                  <strong>{riskLevel}</strong>
                  <small>{riskScore != null ? `${Number(riskScore).toFixed(1)} / 100` : "Score unavailable"}</small>
                </div>
                <div>
                  <span>DECISION</span>
                  <strong>{decisionFor(riskLevel)}</strong>
                  <small>Operator recommendation</small>
                </div>
              </div>

              <div className="why-risk-grid">
                <div><span>Temperature</span><strong>{env.temperature != null ? `${Number(env.temperature).toFixed(1)}°C` : "Not available"}</strong></div>
                <div><span>Humidity</span><strong>{env.humidity != null ? `${Number(env.humidity).toFixed(0)}%` : "Not available"}</strong></div>
                <div><span>Thermal anomaly</span><strong>{env.thermal_anomaly != null ? `+${Number(env.thermal_anomaly).toFixed(1)}°C` : "Not available"}</strong></div>
                <div><span>Infected neighbours</span><strong>{spatial.infected_neighbor_count ?? spatial.infected_neighbours ?? "Not available"}</strong></div>
              </div>
            </>
          ) : (
            <div className="intel-empty-state">
              <ScanLine size={22} />
              <div>
                <strong>Region not analyzed</strong>
                <p>Navigate to {selectedCell} and scan it to run Disease AI V2 and Risk AI V1.</p>
              </div>
            </div>
          )}
        </section>

        <section className="mission-timeline-v4">
          <div className="console-heading compact">
            <div>
              <span>MISSION TIMELINE</span>
              <h2>Live operations log</h2>
            </div>
          </div>
          <div className="timeline-v4-list">
            {[...timeline].reverse().map((event, index) => (
              <div key={`${event.time}-${index}`} className={index === 0 ? "latest" : ""}>
                <time>{event.time}</time>
                <i />
                <span>{event.text}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {error && (
        <div className="field-command-error">
          <AlertTriangle size={16} />
          <div><strong>Mission AI unavailable</strong><span>{error}</span></div>
        </div>
      )}

      {riskLevel === "CRITICAL" && displayObservation && (
        <div className="critical-wow-banner">
          <div className="critical-wow-icon"><AlertTriangle size={19} /></div>
          <div>
            <span>CRAI PRIORITY ZONE</span>
            <strong>Critical region detected · {selectedCell}</strong>
            <p>{formatDisease(disease)} · Risk {Number(riskScore ?? 0).toFixed(1)} · {decisionFor(riskLevel)}</p>
          </div>
          <CheckCircle2 size={18} />
        </div>
      )}
    </div>
  );
}
