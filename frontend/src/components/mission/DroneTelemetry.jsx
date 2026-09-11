import React from "react";
import {
  Navigation,
  Gauge,
  BatteryMedium,
  Satellite,
  Thermometer,
  Droplets,
} from "lucide-react";

function TelemetryItem({ icon: Icon, label, value, unit, note }) {
  return (
    <div className="telemetry-item">
      <div className="telemetry-icon">
        <Icon size={15} />
      </div>

      <div className="telemetry-content">
        <span>{label}</span>

        <strong>
          {value}
          {unit && <small>{unit}</small>}
        </strong>

        {note && <em>{note}</em>}
      </div>
    </div>
  );
}

export default function DroneTelemetry({
  altitude = 30,
  speed = 0,
  battery = 96,
  satellites = 12,
  temperature = "27.8",
  humidity = "82",
  latitude = 13.08270,
  longitude = 80.27070,
}) {
  return (
    <section className="panel telemetry-panel">
      <div className="mission-section-title">
        <div>
          <span className="eyebrow">FLIGHT DATA</span>
          <h3>Drone Telemetry</h3>
        </div>

        <span className="connected-pill">
          <span />
          Connected
        </span>
      </div>

      <div className="telemetry-grid">
        <TelemetryItem
          icon={Navigation}
          label="ALTITUDE"
          value={altitude}
          unit="m"
          note="AGL"
        />

        <TelemetryItem
          icon={Gauge}
          label="SPEED"
          value={speed}
          unit="m/s"
          note={speed > 0 ? "CRUISING" : "STANDBY"}
        />

        <TelemetryItem
          icon={BatteryMedium}
          label="BATTERY"
          value={battery}
          unit="%"
          note={`${Math.max(1, Math.round(battery / 6))} min remaining`}
        />

        <TelemetryItem
          icon={Satellite}
          label="GPS"
          value={satellites}
          note="SATELLITES"
        />

        <TelemetryItem
          icon={Thermometer}
          label="TEMPERATURE"
          value={temperature}
          unit="°C"
          note="FIELD SENSOR"
        />

        <TelemetryItem
          icon={Droplets}
          label="HUMIDITY"
          value={humidity}
          unit="%"
          note="FIELD SENSOR"
        />
      </div>

      <div className="gps-strip">
        <Navigation size={13} />

        <span>GPS POSITION</span>

        <strong>
          {Number(latitude).toFixed(5)},{" "}
          {Number(longitude).toFixed(5)}
        </strong>

        <span className="gps-fixed">
          FIXED
        </span>
      </div>
    </section>
  );
}