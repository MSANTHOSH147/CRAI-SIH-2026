import React from "react";
import "./Sidebar.css";
import {
  LayoutDashboard,
  Sprout,
  Plane,
  BrainCircuit,
  Map,
  Radio,
  BarChart3,
  Settings,
  Bell,
} from "lucide-react";

const operations = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["farms", "Farms", Sprout],
  ["missions", "Live Mission", Plane],
  ["ai", "AI Analysis", BrainCircuit],
  ["risk", "Risk Map", Map],
  ["sensors", "Devices", Radio],
];

const insights = [
  ["reports", "Reports", BarChart3],
  ["settings", "Settings", Settings],
];

export default function Sidebar({ page, onNavigate }) {
  const nav = (items) => items.map(([id, label, Icon]) => (
    <button
      key={id}
      className={`side-nav-item ${page === id ? "active" : ""}`}
      onClick={() => onNavigate(id)}
    >
      <Icon size={15} strokeWidth={1.8} />
      <span>{label}</span>
    </button>
  ));

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Sprout size={17} /></div>
        <div>
          <div className="brand-name">CRAI</div>
          <div className="brand-sub">Crop Assisted AI</div>
        </div>
      </div>

      <div className="side-section-label">OPERATIONS</div>
      <nav>{nav(operations)}</nav>

      <div className="side-section-label insight-label">INSIGHTS</div>
      <nav>{nav(insights)}</nav>

      <div className="sidebar-spacer" />

      <div className="system-card">
        <div className="system-heading">
          <span className="online-dot" /> System Online
        </div>
        <p>All core services are operational.</p>
        <div className="system-row">
          <span>API</span><b>Connected</b>
        </div>
        <div className="system-row">
          <span>AI Engine</span><b>Ready</b>
        </div>
      </div>

      <div className="operator">
        <div className="operator-avatar">S</div>
        <div>
          <strong>CRAI Operator</strong>
          <span>Field Operations</span>
        </div>
        <Bell size={15} />
      </div>
    </aside>
  );
}
