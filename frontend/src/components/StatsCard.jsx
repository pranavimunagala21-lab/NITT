import React from "react";
import "./StatsCard.css";

export default function StatsCard({ icon, label, value, color, delta }) {
  return (
    <div className="stats-card" style={{ "--card-accent": color }}>
      <div className="stats-card-icon">{icon}</div>
      <div className="stats-card-body">
        <p className="stats-card-label">{label}</p>
        <h3 className="stats-card-value">{value.toLocaleString()}</h3>
        {delta !== undefined && (
          <span className={`stats-card-delta ${delta >= 0 ? "up" : "down"}`}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs last week
          </span>
        )}
      </div>
    </div>
  );
}
