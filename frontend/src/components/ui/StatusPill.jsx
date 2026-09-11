import React from "react";

export default function StatusPill({ children, tone = "green" }) {
  return <span className={`status-pill ${tone}`}><i />{children}</span>;
}
