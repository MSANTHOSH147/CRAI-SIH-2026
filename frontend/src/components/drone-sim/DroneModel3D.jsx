import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

function Rotor({ position, rotationY = 0 }) {
  const rotor = useRef();

  useFrame((_, delta) => {
    if (rotor.current) {
      rotor.current.rotation.y += delta * 28;
    }
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.18, 24]} />
        <meshStandardMaterial color="#24342a" roughness={0.42} metalness={0.28} />
      </mesh>

      <group ref={rotor} position={[0, 0.15, 0]}>
        <mesh>
          <boxGeometry args={[2.2, 0.035, 0.12]} />
          <meshStandardMaterial color="#536359" roughness={0.36} metalness={0.2} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[2.2, 0.035, 0.12]} />
          <meshStandardMaterial color="#536359" roughness={0.36} metalness={0.2} />
        </mesh>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <circleGeometry args={[1.15, 32]} />
          <meshBasicMaterial color="#9dad9f" transparent opacity={0.08} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

export default function DroneModel3D({
  targetPosition = [0, 12, 0],
  heading = 0,
  scanning = false,
  missionState = "READY",
}) {
  const root = useRef();
  const body = useRef();
  const desired = useMemo(() => new THREE.Vector3(...targetPosition), [targetPosition]);

  useFrame(({ clock }, delta) => {
    if (!root.current) return;

    const smoothing = 1 - Math.pow(0.0008, delta);
    root.current.position.lerp(desired, smoothing);
    root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, heading, smoothing * 0.7);

    if (body.current) {
      body.current.position.y = Math.sin(clock.elapsedTime * 2.2) * 0.08;
      body.current.rotation.z = Math.sin(clock.elapsedTime * 1.3) * 0.015;
    }
  });

  return (
    <group ref={root} position={targetPosition}>
      <group ref={body} scale={1.05}>
        <mesh castShadow>
          <sphereGeometry args={[1.3, 28, 20]} />
          <meshStandardMaterial color="#1d2f24" roughness={0.35} metalness={0.32} />
        </mesh>

        <mesh position={[0, 0.15, 0.95]} castShadow>
          <boxGeometry args={[1.8, 0.7, 0.85]} />
          <meshStandardMaterial color="#34473a" roughness={0.4} metalness={0.22} />
        </mesh>

        {[45, 135, 225, 315].map((deg, idx) => {
          const rad = (deg * Math.PI) / 180;
          const x = Math.cos(rad) * 2.35;
          const z = Math.sin(rad) * 2.35;
          return (
            <group key={deg}>
              <mesh rotation={[0, -rad, 0]} position={[x / 2, 0.05, z / 2]} castShadow>
                <boxGeometry args={[2.7, 0.14, 0.18]} />
                <meshStandardMaterial color="#2c3f32" roughness={0.48} />
              </mesh>
              <Rotor position={[x, 0.02, z]} rotationY={rad} />
            </group>
          );
        })}

        <mesh position={[0, 0.95, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.42, 12]} />
          <meshStandardMaterial color="#607268" roughness={0.4} metalness={0.25} />
        </mesh>
        <mesh position={[0, 1.17, 0]}>
          <sphereGeometry args={[0.11, 14, 10]} />
          <meshStandardMaterial
            color={missionState === "SCANNING" ? "#c9ef58" : "#8caf7d"}
            emissive={missionState === "SCANNING" ? "#799b26" : "#000000"}
            emissiveIntensity={missionState === "SCANNING" ? 0.7 : 0.1}
          />
        </mesh>

        <group position={[0, -1.2, 0.55]}>
          <mesh castShadow>
            <sphereGeometry args={[0.48, 20, 16]} />
            <meshStandardMaterial color="#17211b" roughness={0.28} metalness={0.42} />
          </mesh>

          <mesh position={[-0.18, -0.05, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.16, 18]} />
            <meshStandardMaterial color="#090c0a" roughness={0.18} metalness={0.55} />
          </mesh>

          <mesh position={[0.2, -0.05, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.14, 18]} />
            <meshStandardMaterial
              color={scanning ? "#e38b49" : "#5d4432"}
              emissive={scanning ? "#b85e27" : "#000000"}
              emissiveIntensity={scanning ? 0.65 : 0}
            />
          </mesh>
        </group>

        <mesh position={[-0.62, 0.72, -0.45]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color="#b4443b" emissive="#7d211c" emissiveIntensity={0.7} />
        </mesh>

        <mesh position={[0.62, 0.72, -0.45]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color="#8bc173" emissive="#4e7c41" emissiveIntensity={0.7} />
        </mesh>

        <mesh position={[0, -1.7, 0]} castShadow>
          <boxGeometry args={[2.4, 0.12, 1.35]} />
          <meshStandardMaterial color="#536159" roughness={0.62} />
        </mesh>

        <mesh position={[-0.86, -1.48, 0]} castShadow>
          <boxGeometry args={[0.14, 0.85, 0.14]} />
          <meshStandardMaterial color="#536159" roughness={0.62} />
        </mesh>
        <mesh position={[0.86, -1.48, 0]} castShadow>
          <boxGeometry args={[0.14, 0.85, 0.14]} />
          <meshStandardMaterial color="#536159" roughness={0.62} />
        </mesh>
      </group>

      {missionState !== "LANDED" && (
        <mesh position={[0, -targetPosition[1] + 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2.5, 32]} />
          <meshBasicMaterial color="#1b2c20" transparent opacity={0.16} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
