import React, { useState } from "react";
import "./UsersTable.css";

const PAGE_SIZE = 5;
const LANG_LABEL = { en: "English", te: "Telugu", ta: "Tamil" };

export default function UsersTable({ users, onDeleteUser, deletingUserId }) {
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState("");

  // Safe — never crash on bad data
  const safeStr = (v) => (v == null ? "" : String(v));

  const filtered = (users || []).filter((u) =>
    safeStr(u.name).toLowerCase().includes(search.toLowerCase()) ||
    safeStr(u.email).toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const slice      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="users-table-card">
      <div className="users-table-header">
        <h3 className="users-table-title">👥 Users ({filtered.length})</h3>
        <input
          className="users-search"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Language</th>
              <th>Role</th>
              <th>Websites</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr><td colSpan={8} className="no-results">No users found.</td></tr>
            ) : (
              slice.map((u, idx) => (
                <tr key={safeStr(u.id) || idx}>
                  <td className="td-id">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                  <td className="td-name">
                    <span className="user-avatar">
                      {safeStr(u.name)[0]?.toUpperCase() || "?"}
                    </span>
                    {safeStr(u.name) || "—"}
                  </td>
                  <td className="td-email">{safeStr(u.email) || "—"}</td>
                  <td>
                    <span className="lang-badge">
                      {LANG_LABEL[u.language] || safeStr(u.language) || "en"}
                    </span>
                  </td>
                  <td>
                    <span className={`role-badge role-${u.role || "user"}`}>
                      {u.role || "user"}
                    </span>
                  </td>
                  <td className="td-center">{u.websites ?? u.project_count ?? 0}</td>
                  {/* registeredAt is always a safe "YYYY-MM-DD" string from adminApi */}
                  <td className="td-muted">{safeStr(u.registeredAt) || "—"}</td>
                  <td className="td-center">
                    <button
                      type="button"
                      onClick={() => onDeleteUser?.(u)}
                      disabled={deletingUserId === u.id}
                      className="delete-user-btn"
                    >
                      {deletingUserId === u.id ? "Deleting…" : "🗑 Delete"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹ Prev</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => setPage(n)}
              className={n === page ? "page-active" : ""}>{n}</button>
          ))}
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next ›</button>
        </div>
      )}
    </div>
  );
}
