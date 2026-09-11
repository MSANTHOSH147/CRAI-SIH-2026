import React, { useMemo, useState } from "react";
import {
  Plus,
  MapPin,
  ArrowUpRight,
  Leaf,
  Activity,
  X,
  Check,
} from "lucide-react";

import { useCrai } from "../context/CraiContext";
import "./Farms.css";

const INITIAL_FARMS = [
  {
    id: "A-104",
    name: "North Tomato Field",
    crop: "Tomato",
    acres: 12.4,
    location: "Tamil Nadu",
    status: "High risk",
    health: 82,
    color: "high",
  },
  {
    id: "B-207",
    name: "East Vegetable Block",
    crop: "Potato",
    acres: 8.7,
    location: "Tamil Nadu",
    status: "Low risk",
    health: 94,
    color: "low",
  },
  {
    id: "C-311",
    name: "Research Plot",
    crop: "Tomato",
    acres: 5.2,
    location: "Tamil Nadu",
    status: "Medium risk",
    health: 76,
    color: "medium",
  },
];

function getRiskFromHealth(health) {
  if (health >= 90) return "Low risk";
  if (health >= 80) return "Medium risk";
  return "High risk";
}

export default function Farms() {
  
  const { observations, mission } = useCrai();

  const [farms, setFarms] = useState(INITIAL_FARMS);
  const [showAddFarm, setShowAddFarm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    crop: "Tomato",
    acres: "",
    location: "Tamil Nadu",
  });

  /*
   * Keep the primary CRAI farm connected to
   * the actual mission observations.
   */
  const craiFarmHealth = useMemo(() => {
    const riskScores = observations
      .map((item) => Number(item?.riskAI?.risk_score))
      .filter((value) => Number.isFinite(value));

    if (!riskScores.length) return 82;

    const averageRisk =
      riskScores.reduce((sum, value) => sum + value, 0) /
      riskScores.length;

    return Math.max(0, Math.min(100, Math.round(100 - averageRisk)));
  }, [observations]);

  const primaryStatus = getRiskFromHealth(craiFarmHealth);

  const displayedFarms = farms.map((farm, index) => {
    if (index !== 0) return farm;

    return {
      ...farm,
      health: craiFarmHealth,
      status: primaryStatus,
      color:
        craiFarmHealth >= 90
          ? "low"
          : craiFarmHealth >= 80
          ? "medium"
          : "high",
    };
  });

  function openField() {
  const riskMapButton = Array.from(
    document.querySelectorAll("button")
  ).find((button) =>
    button.textContent?.trim().toLowerCase().includes("risk map")
  );

  if (riskMapButton) {
    riskMapButton.click();
    return;
  }

  console.warn("Risk Map navigation button was not found.");
}

  function handleAddFarm(event) {
    event.preventDefault();

    if (!form.name.trim() || !form.acres) return;

    const health = 100;

    const newFarm = {
      id: `F-${String(farms.length + 1).padStart(3, "0")}`,
      name: form.name.trim(),
      crop: form.crop,
      acres: Number(form.acres),
      location: form.location.trim() || "Tamil Nadu",
      status: "Low risk",
      health,
      color: "low",
    };

    setFarms((current) => [...current, newFarm]);

    setForm({
      name: "",
      crop: "Tomato",
      acres: "",
      location: "Tamil Nadu",
    });

    setShowAddFarm(false);
  }

  return (
    <main className="farms-page">
      {/* PAGE HEADER */}
      <header className="farms-header">
        <div>
          <div className="crai-eyebrow">FIELD MANAGEMENT</div>

          <h1>Farms</h1>

          <p>
            Manage monitored agricultural fields and their operational status.
          </p>
        </div>

        <button
          className="farms-add-button"
          type="button"
          onClick={() => setShowAddFarm(true)}
        >
          <Plus size={17} strokeWidth={2} />
          <span>Add Farm</span>
        </button>
      </header>

      {/* FIELD SUMMARY */}
      <section className="farms-summary">
        <div className="farms-summary-card">
          <div className="farms-summary-icon">
            <Leaf size={17} />
          </div>

          <div>
            <span>MONITORED FIELDS</span>
            <strong>{farms.length}</strong>
          </div>
        </div>

        <div className="farms-summary-card">
          <div className="farms-summary-icon">
            <MapPin size={17} />
          </div>

          <div>
            <span>TOTAL AREA</span>
            <strong>
              {farms
                .reduce((sum, farm) => sum + Number(farm.acres || 0), 0)
                .toFixed(1)}{" "}
              acres
            </strong>
          </div>
        </div>

        <div className="farms-summary-card">
          <div className="farms-summary-icon">
            <Activity size={17} />
          </div>

          <div>
            <span>ACTIVE MISSION</span>
            <strong>{mission?.id || "CRAI-M001"}</strong>
          </div>
        </div>
      </section>

      {/* FARM LIST */}
      <section className="farms-section">
        <div className="farms-section-heading">
          <div>
            <div className="crai-eyebrow">MONITORED FIELDS</div>
            <h2>Your agricultural fields</h2>
          </div>

          <span className="farms-count">
            {farms.length} {farms.length === 1 ? "field" : "fields"}
          </span>
        </div>

        <div className="farms-list">
          {displayedFarms.map((farm) => (
            <article className="farm-card" key={farm.id}>
              {/* CARD TOP */}
              <div className="farm-card-top">
                <div className="farm-identity">
                  <div className="farm-icon">
                    <Leaf size={18} />
                  </div>

                  <div>
                    <div className="farm-id-row">
                      <span className="farm-id">{farm.id}</span>

                      <span
                        className={`farm-risk farm-risk--${farm.color}`}
                      >
                        <span />
                        {farm.status}
                      </span>
                    </div>

                    <h3>{farm.name}</h3>
                  </div>
                </div>

                <button
                  className="farm-open-button"
                  type="button"
                  onClick={() => openField(farm)}
                >
                  Open field
                  <ArrowUpRight size={15} />
                </button>
              </div>

              {/* META */}
              <div className="farm-meta">
                <div className="farm-meta-item">
                  <MapPin size={15} />
                  <span>{farm.location}</span>
                </div>

                <div className="farm-meta-divider" />

                <div className="farm-meta-item">
                  <Leaf size={15} />
                  <span>{farm.crop}</span>
                </div>

                <div className="farm-meta-divider" />

                <div className="farm-meta-item">
                  <span>{farm.acres} acres</span>
                </div>
              </div>

              {/* HEALTH */}
              <div className="farm-health">
                <div className="farm-health-heading">
                  <span>FIELD HEALTH INDEX</span>

                  <strong>{farm.health}%</strong>
                </div>

                <div className="farm-health-track">
                  <div
                    className={`farm-health-fill farm-health-fill--${farm.color}`}
                    style={{
                      width: `${farm.health}%`,
                    }}
                  />
                </div>

                <div className="farm-health-footer">
                  <span>
                    {farm.id === "A-104" && observations.length > 0
                      ? `${observations.length} mission observations`
                      : "Field monitoring profile"}
                  </span>

                  <span>
                    {farm.color === "high"
                      ? "Attention required"
                      : farm.color === "medium"
                      ? "Monitor closely"
                      : "Operating normally"}
                  </span>
                </div>
              </div>

              {/* FOOTER */}
              <div className="farm-card-footer">
                <span className="farm-monitoring-status">
                  <span className="farm-status-dot" />
                  Monitoring enabled
                </span>

                <button
                  type="button"
                  className="farm-view-link"
                  onClick={() => openField(farm)}
                >
                  View intelligence
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ADD FARM MODAL */}
      {showAddFarm && (
        <div
          className="farm-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowAddFarm(false);
            }
          }}
        >
          <div className="farm-modal">
            <div className="farm-modal-header">
              <div>
                <div className="crai-eyebrow">FIELD MANAGEMENT</div>
                <h2>Add a monitored field</h2>
                <p>
                  Create a field profile for future CRAI monitoring missions.
                </p>
              </div>

              <button
                type="button"
                className="farm-modal-close"
                onClick={() => setShowAddFarm(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddFarm}>
              <div className="farm-form-grid">
                <label className="farm-form-field farm-form-field--full">
                  <span>FIELD NAME</span>
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Example: South Tomato Field"
                    autoFocus
                  />
                </label>

                <label className="farm-form-field">
                  <span>CROP</span>

                  <select
                    value={form.crop}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        crop: event.target.value,
                      }))
                    }
                  >
                    <option>Tomato</option>
                    <option>Potato</option>
                  </select>
                </label>

                <label className="farm-form-field">
                  <span>AREA · ACRES</span>

                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={form.acres}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        acres: event.target.value,
                      }))
                    }
                    placeholder="10.5"
                  />
                </label>

                <label className="farm-form-field farm-form-field--full">
                  <span>LOCATION</span>

                  <input
                    value={form.location}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        location: event.target.value,
                      }))
                    }
                    placeholder="Tamil Nadu"
                  />
                </label>
              </div>

              <div className="farm-modal-footer">
                <button
                  type="button"
                  className="farm-cancel-button"
                  onClick={() => setShowAddFarm(false)}
                >
                  Cancel
                </button>

                <button type="submit" className="farm-save-button">
                  <Check size={15} />
                  Add field
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}