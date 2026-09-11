import React from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Square,
} from "lucide-react";

export default function MissionControls({
  status,
  onStart,
  onPause,
  onResume,
  onReset,
  onEnd,
}) {
  const scanning = status === "SCANNING";
  const paused = status === "PAUSED";
  const completed = status === "COMPLETED";

  return (
    <div className="mission-controls">
      {!scanning && !paused && !completed && (
        <button
          className="primary-small mission-start"
          onClick={onStart}
        >
          <Play size={14} />
          Start Mission
        </button>
      )}

      {scanning && (
        <button
          className="outline-button"
          onClick={onPause}
        >
          <Pause size={14} />
          Pause Scan
        </button>
      )}

      {paused && (
        <button
          className="primary-small"
          onClick={onResume}
        >
          <Play size={14} />
          Resume Scan
        </button>
      )}

      {scanning && (
        <button
          className="danger-outline-button"
          onClick={onEnd}
        >
          <Square size={13} />
          End Mission
        </button>
      )}

      {(paused || completed) && (
        <button
          className="outline-button"
          onClick={onReset}
        >
          <RotateCcw size={13} />
          Reset
        </button>
      )}
    </div>
  );
}
