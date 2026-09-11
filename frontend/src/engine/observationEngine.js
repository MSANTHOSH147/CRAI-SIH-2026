/**
 * CRAI Observation Engine
 *
 * Converts a simulated drone scan into a structured
 * observation that can later be sent to the backend.
 *
 * IMPORTANT:
 * This file contains NO React/UI code.
 */

const GRID_COLUMNS = 5;
const GRID_ROWS = 4;

const FIELD_ORIGIN = {
  latitude: 13.08270,
  longitude: 80.27070,
};

const CELL_STEP = {
  latitude: 0.00018,
  longitude: 0.00018,
};

/**
 * Convert a grid cell such as C3 into a spatial observation.
 */
export function getCellLocation(region) {
  const row = region.charCodeAt(0) - "A".charCodeAt(0);
  const column = Number(region.slice(1)) - 1;

  return {
    latitude:
      FIELD_ORIGIN.latitude +
      row * CELL_STEP.latitude,

    longitude:
      FIELD_ORIGIN.longitude +
      column * CELL_STEP.longitude,
  };
}

/**
 * Generate environmental readings for a scan.
 *
 * These are currently simulated.
 * Later they can be replaced by real sensor data.
 */
export function generateEnvironment(region) {
  const riskCells = ["C3", "B4", "D3"];

  const isStressRegion = riskCells.includes(region);

  return {
    temperature: Number(
      (
        isStressRegion
          ? 34 + Math.random() * 2
          : 28 + Math.random() * 4
      ).toFixed(1)
    ),

    humidity: Math.round(
      isStressRegion
        ? 76 + Math.random() * 10
        : 60 + Math.random() * 12
    ),

    soilMoisture: Math.round(
      isStressRegion
        ? 38 + Math.random() * 12
        : 55 + Math.random() * 15
    ),
  };
}

/**
 * Create a complete CRAI observation.
 */
export function createObservation({
  region,
  image = null,
  missionId = "CRAI-M001",
}) {
  if (!region) {
    throw new Error("Observation requires a region.");
  }

  const gps = getCellLocation(region);
  const environment = generateEnvironment(region);

  return {
    id: `${missionId}-${region}-${Date.now()}`,

    missionId,

    region,

    timestamp: new Date().toISOString(),

    gps,

    environment,

    image: {
      type: "RGB",
      source: image,
      status: image ? "captured" : "simulated",
    },

    diseaseAI: {
      status: "pending",
      disease: null,
      confidence: null,
    },

    riskAI: {
      status: "pending",
      score: null,
      level: null,
      factors: [],
    },

    pipeline: {
      gps: "ready",
      environment: "ready",
      image: image ? "ready" : "simulated",
      diseaseAI: "pending",
      riskAI: "pending",
    },
  };
}

/**
 * Create observations for multiple scanned regions.
 */
export function createMissionObservations(
  regions,
  missionId = "CRAI-M001"
) {
  return regions.map((region) =>
    createObservation({
      region,
      missionId,
    })
  );
}
