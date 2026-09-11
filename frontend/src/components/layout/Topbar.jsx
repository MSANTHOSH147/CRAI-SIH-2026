import React from "react";
import "./Topbar.css";
import { Search, Bell, HelpCircle, ChevronDown } from "lucide-react";

const labels = {
  dashboard: "Dashboard",
  farms: "Farms",
  missions: "Live Mission",
  ai: "AI Analysis",
  risk: "Risk Map",
  sensors: "Devices",
  reports: "Reports",
  settings: "Settings",
};

export default function Topbar({ page }) {
  return (
    <header className="topbar">
      <div className="crumb">
        <span>CRAI</span>
        <i>/</i>
        <strong>{labels[page]}</strong>
      </div>

      <div className="topbar-actions">
        <div className="search">
          <Search size={14} />
          <span>Search farms, reports, devices...</span>
          <kbd>⌘ K</kbd>
        </div>
        <button className="icon-button"><Bell size={16} /><em /></button>
        <button className="icon-button"><HelpCircle size={16} /></button>
        <div className="profile">
          <div className="profile-avatar">S</div>
          <div className="profile-text">
            <b>Operator</b>
            <span>Admin</span>
          </div>
          <ChevronDown size={14} />
        </div>
      </div>
    </header>
  );
}
