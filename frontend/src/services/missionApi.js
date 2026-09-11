const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";

export async function analyzeMissionCell({
  region,
  position,
  previousObservations = [],
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/missions/analyze-cell`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        region,
        position,
        previous_observations: previousObservations,
      }),
    }
  );

  if (!response.ok) {
    let message = "Mission AI analysis failed.";

    try {
      const error = await response.json();
      message = error.detail || message;
    } catch {
      // Ignore invalid error response.
    }

    throw new Error(message);
  }

  return response.json();
}