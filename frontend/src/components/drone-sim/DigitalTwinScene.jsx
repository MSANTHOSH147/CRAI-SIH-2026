import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Html,
  Line,
  OrbitControls,
} from "@react-three/drei";
import * as THREE from "three";
import DroneModel3D from "./DroneModel3D";

export const ROUTE = [
  "A1", "A2", "A3", "A4", "A5",
  "B5", "B4", "B3", "B2", "B1",
  "C1", "C2", "C3", "C4", "C5",
  "D5", "D4", "D3", "D2", "D1",
];

export function regionToWorld(region, altitude = 13) {
  const row = region.charCodeAt(0) - 65;
  const col = Number(region[1]) - 1;
  const x = (col - 2) * 18;
  const z = (row - 1.5) * 18;
  return [x, altitude, z];
}

function riskColor(level) {
  const normalized = String(level || "UNSCANNED").toUpperCase();
  if (normalized === "CRITICAL") return "#b95148";
  if (normalized === "HIGH") return "#cf7b4c";
  if (normalized === "MODERATE") return "#c6a151";
  if (normalized === "LOW") return "#5f9a67";
  return "#dfe5dc";
}

function thermalColor(observation) {
  const anomaly = Number(observation?.environment?.thermal_anomaly ?? 0);
  if (!observation) return "#e5e8e2";
  if (anomaly >= 4) return "#b94d45";
  if (anomaly >= 2.5) return "#d9854a";
  if (anomaly >= 1) return "#d4b150";
  return "#6f9c78";
}

function FieldCell({
  region,
  observation,
  selected,
  current,
  sensorMode,
  onSelect,
}) {
  const [x, , z] = regionToWorld(region, 0);
  const level = observation?.riskAI?.risk_level;
  const baseColor = sensorMode === "RISK"
    ? riskColor(level)
    : sensorMode === "THERMAL"
      ? thermalColor(observation)
      : observation
        ? "#7da46f"
        : "#98aa83";

  const plantColor = sensorMode === "THERMAL"
    ? baseColor
    : level === "CRITICAL"
      ? "#73865f"
      : "#5f8a54";

  return (
    <group position={[x, 0, z]}>
      <mesh
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          onSelect(region);
        }}
      >
        <boxGeometry args={[16.2, 0.48, 16.2]} />
        <meshStandardMaterial
          color={baseColor}
          roughness={0.92}
          transparent
          opacity={sensorMode === "RGB" ? 0.74 : 0.92}
        />
      </mesh>

      {[...Array(5)].map((_, rowIndex) => (
        <group key={rowIndex} position={[-5.6 + rowIndex * 2.8, 0.65, 0]}>
          {[...Array(5)].map((__, plantIndex) => (
            <group key={plantIndex} position={[0, 0, -5.2 + plantIndex * 2.6]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.1, 0.13, 0.8, 8]} />
                <meshStandardMaterial color="#6a573e" roughness={0.96} />
              </mesh>
              <mesh position={[0, 0.65, 0]} castShadow>
                <sphereGeometry args={[0.55, 10, 8]} />
                <meshStandardMaterial color={plantColor} roughness={0.82} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      <mesh position={[0, 0.31, 0]}>
        <boxGeometry args={[16.65, 0.04, 16.65]} />
        <meshBasicMaterial
          color={selected ? "#1f5130" : current ? "#7fa141" : "#f4f6f1"}
          transparent
          opacity={selected || current ? 0.95 : 0.34}
          wireframe
        />
      </mesh>

      <Html position={[-6.8, 0.8, -6.8]} center={false} distanceFactor={18} style={{ pointerEvents: "none" }}>
        <div className={`dt-cell-label ${selected ? "selected" : ""} ${current ? "current" : ""}`}>
          <span>{region}</span>
          {observation && (
            <strong>{String(observation.riskAI?.risk_level || "SCANNED").toUpperCase()}</strong>
          )}
        </div>
      </Html>
    </group>
  );
}

function ScanBeam({ position, active }) {
  const beam = useRef();

  useFrame(({ clock }) => {
    if (!beam.current || !active) return;
    beam.current.material.opacity = 0.1 + Math.sin(clock.elapsedTime * 7) * 0.04;
  });

  if (!active) return null;

  const altitude = Math.max(position[1], 6);
  return (
    <group>
      <mesh ref={beam} position={[position[0], altitude / 2, position[2]]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[5.2, altitude, 32, 1, true]} />
        <meshBasicMaterial color="#b2d94b" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[position[0], 0.48, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.4, 5.4, 48]} />
        <meshBasicMaterial color="#97bd3e" transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}


function FieldBoundary() {
  return (
    <group position={[0, 0.04, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[51.5, 52.2, 4]} />
        <meshBasicMaterial color="#72806f" transparent opacity={0.42} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[91.5, 0.08, 73.5]} />
        <meshBasicMaterial color="#8a9b84" transparent opacity={0.26} wireframe />
      </mesh>
    </group>
  );
}

function FieldPaths() {
  const paths = useMemo(() => {
    const rows = [-27, -9, 9, 27];
    return rows;
  }, []);
  return (
    <group>
      {paths.map((z) => (
        <mesh key={z} position={[0, 0.025, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[87, 1.15]} />
          <meshBasicMaterial color="#b3a27c" transparent opacity={0.36} />
        </mesh>
      ))}
      <mesh position={[0, 0.026, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.15, 70]} />
        <meshBasicMaterial color="#b3a27c" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

function Scene({
  observations,
  dronePosition,
  heading,
  scanning,
  selectedCell,
  currentRegion,
  sensorMode,
  onSelectCell,
  missionState,
}) {
  const routePoints = useMemo(() => ROUTE.map((region) => regionToWorld(region, 0.7)), []);
  const observationMap = useMemo(
    () => new Map(observations.map((item) => [item.region, item])),
    [observations]
  );

  return (
    <>
      <color attach="background" args={[sensorMode === "THERMAL" ? "#f1eee7" : "#eef2ea"]} />
      <fog attach="fog" args={[sensorMode === "THERMAL" ? "#f1eee7" : "#eef2ea", 95, 190]} />

      <ambientLight intensity={1.1} />
      <hemisphereLight args={["#f7fbf3", "#8d7858", 1.4]} />
      <directionalLight
        position={[42, 58, 24]}
        intensity={2.25}
        color="#fffbea"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <mesh receiveShadow position={[0, -0.72, 0]}>
        <boxGeometry args={[92, 1.3, 76]} />
        <meshStandardMaterial color="#b8a574" roughness={0.98} />
      </mesh>

      <mesh receiveShadow position={[0, -0.01, 0]}>
        <planeGeometry args={[112, 94]} />
        <meshStandardMaterial color="#d6d7c5" roughness={1} />
      </mesh>

      <FieldBoundary />
      <FieldPaths />

      {ROUTE.map((region) => (
        <FieldCell
          key={region}
          region={region}
          observation={observationMap.get(region)}
          selected={selectedCell === region}
          current={currentRegion === region}
          sensorMode={sensorMode}
          onSelect={onSelectCell}
        />
      ))}

      <Line
        points={routePoints}
        color="#3f724d"
        lineWidth={1.2}
        transparent
        opacity={0.34}
        dashed
        dashSize={1.3}
        gapSize={0.9}
      />

      <DroneModel3D
        targetPosition={dronePosition}
        heading={heading}
        scanning={scanning}
        missionState={missionState}
      />

      <ScanBeam position={dronePosition} active={scanning} />

      <ContactShadows
        position={[0, 0.05, 0]}
        opacity={0.2}
        scale={100}
        blur={2.2}
        far={35}
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={55}
        maxDistance={135}
        minPolarAngle={0.55}
        maxPolarAngle={1.22}
        target={[0, 0, 0]}
      />
    </>
  );
}

export default function DigitalTwinScene(props) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.65]}
      camera={{ position: [62, 58, 72], fov: 42, near: 0.1, far: 400 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
