import React from "react";
import "./FeedbackList.css";

function Stars({ rating }) {
  return (
    <span className="stars">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rating ? "star filled" : "star"}>★</span>
      ))}
    </span>
  );
}

export default function FeedbackList({ feedback }) {
  const hasFeedback = feedback && feedback.length > 0;

  return (
    <div className="feedback-card">
      <h3 className="feedback-title">💬 User Feedback</h3>
      {hasFeedback ? (
        <div className="feedback-grid">
          {feedback.map((f, idx) => {
            const displayName = f.name || f.user || "Anonymous User";
            const initial = displayName.trim() ? displayName.trim()[0].toUpperCase() : "?";
            return (
              <div key={f.id || idx} className="feedback-item">
                <div className="feedback-top">
                  <span className="feedback-avatar">{initial}</span>
                  <div>
                    <p className="feedback-user">{displayName}</p>
                    <Stars rating={f.rating} />
                  </div>
                </div>
                <p className="feedback-comment">"{f.comment}"</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="no-feedback-state" style={{ padding: "20px 10px", textAlign: "center", color: "#647084" }}>
          <p style={{ margin: 0, fontSize: "14px", fontStyle: "italic" }}>No feedback yet</p>
        </div>
      )}
    </div>
  );
}

