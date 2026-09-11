import React, {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

const CraiContext = createContext(null);

export function CraiProvider({ children }) {
  const [observations, setObservations] =
    useState([]);

  const [mission, setMission] =
    useState({
      id: "CRAI-M001",
      status: "READY",
      farmId: "A-104",
      crop: "Tomato",
      area: 12.4,
    });

  const addObservation = (observation) => {
    setObservations((previous) => {
      const exists = previous.some(
        (item) =>
          item.region === observation.region
      );

      if (exists) {
        return previous.map((item) =>
          item.region === observation.region
            ? observation
            : item
        );
      }

      return [
        ...previous,
        observation,
      ];
    });
  };

  const clearObservations = () => {
    setObservations([]);
  };

  const updateMission = (updates) => {
    setMission((previous) => ({
      ...previous,
      ...updates,
    }));
  };

  const riskSummary = useMemo(() => {
    const summary = {
      total: observations.length,
      low: 0,
      moderate: 0,
      high: 0,
      critical: 0,
    };

    observations.forEach(
      (observation) => {
        const level =
          observation.riskAI
            ?.risk_level
            ?.toLowerCase();

        if (level === "low") {
          summary.low += 1;
        } else if (
          level === "moderate"
        ) {
          summary.moderate += 1;
        } else if (
          level === "high"
        ) {
          summary.high += 1;
        } else if (
          level === "critical"
        ) {
          summary.critical += 1;
        }
      }
    );

    return summary;
  }, [observations]);

  const diseaseSummary = useMemo(() => {
    const diseases = {};

    observations.forEach(
      (observation) => {
        const disease =
          observation.diseaseAI
            ?.disease ||
          observation.diseaseAI
            ?.prediction;

        if (!disease) {
          return;
        }

        diseases[disease] =
          (diseases[disease] || 0) + 1;
      }
    );

    return diseases;
  }, [observations]);

  const value = {
    observations,
    setObservations,

    addObservation,
    clearObservations,

    mission,
    updateMission,

    riskSummary,
    diseaseSummary,
  };

  return (
    <CraiContext.Provider
      value={value}
    >
      {children}
    </CraiContext.Provider>
  );
}

export function useCrai() {
  const context =
    useContext(CraiContext);

  if (!context) {
    throw new Error(
      "useCrai must be used inside CraiProvider"
    );
  }

  return context;
}