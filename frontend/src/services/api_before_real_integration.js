const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";


async function readResponse(response) {
  const contentType =
    response.headers.get("content-type") || "";

  let body;

  if (contentType.includes("application/json")) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  if (!response.ok) {
    const message =
      typeof body === "string"
        ? body
        : body?.detail
          ? JSON.stringify(body.detail)
          : body?.message ||
            `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return body;
}


/* =========================================================
   AI STATUS
========================================================= */

export async function getAIStatus() {
  const response = await fetch(
    `${API_BASE_URL}/api/ai/status`
  );

  return readResponse(response);
}


/* =========================================================
   DISEASE PREDICTION
========================================================= */

export async function predictDisease(file) {
  const formData = new FormData();

  formData.append("file", file);

  const response = await fetch(
    `${API_BASE_URL}/api/ai/predict`,
    {
      method: "POST",
      body: formData,
    }
  );

  return readResponse(response);
}


/* =========================================================
   CRAI END-TO-END FIELD ANALYSIS

   IMPORTANT:
   FastAPI expects zone_id, crop and growth_stage
   as QUERY PARAMETERS.

   Only the image belongs in multipart/form-data.
========================================================= */

export async function analyzeFieldImage(
  file,
  {
    zoneId = null,
    crop = "Tomato",
    growthStage = "Vegetative",
  } = {}
) {
  if (!file) {
    throw new Error(
      "A crop image is required for CRAI analysis."
    );
  }

  const params = new URLSearchParams();

  if (zoneId) {
    params.set("zone_id", zoneId);
  }

  params.set("crop", crop);
  params.set(
    "growth_stage",
    growthStage
  );

  const formData = new FormData();

  /*
   * ONLY FILE GOES IN FORM DATA.
   */
  formData.append("file", file);

  const url =
    `${API_BASE_URL}/api/analysis/image?${params.toString()}`;

  console.log(
    "CRAI analysis request:",
    url
  );

  const response = await fetch(
    url,
    {
      method: "POST",
      body: formData,
    }
  );

  return readResponse(response);
}


/* =========================================================
   FIELD SENSOR
========================================================= */

export async function createFieldSensorReading({
  deviceId = "CRAI-ESP32-01",
  farmId = 1,
  zoneId,
  source = "SIMULATED",
  soilMoisture,
  temperature,
  humidity,
}) {
  if (!zoneId) {
    throw new Error(
      "Zone is required for sensor evidence."
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/api/field-sensors/readings`,
    {
      method: "POST",

      headers: {
        Accept: "application/json",
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        device_id: deviceId,
        farm_id: farmId,
        zone_id: zoneId,
        source,

        soil_moisture:
          Number(soilMoisture),

        temperature:
          Number(temperature),

        humidity:
          Number(humidity),

        /*
         * Actual collection time.
         */
        timestamp:
          new Date().toISOString(),
      }),
    }
  );

  return readResponse(response);
}