import React from "react";
import "./ActivityFeed.css";

export default function ActivityFeed({ activity }) {
  return (
    <div className="activity-card">
      <h3 className="activity-title">⚡ Live Activity</h3>
      <ul className="activity-list">
        {activity.map((item) => (
          <li key={item.id} className="activity-item">
            <span className="activity-icon">{item.icon}</span>
            <div className="activity-body">
              <p className="activity-text">{item.text}</p>
              <span className="activity-time">{item.time}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
