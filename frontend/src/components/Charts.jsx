import React from "react";
import {
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import "./Charts.css";

function ChartCard({ title, children }) {
  return (
    <div className="chart-card">
      <h3 className="chart-title">{title}</h3>
      {children}
    </div>
  );
}

export function UsersLineChart({ data }) {
  return (
    <ChartCard title="👤 User Growth">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="users" stroke="#4a6cf7" strokeWidth={2.5}
            dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function WebsitesBarChart({ data }) {
  return (
    <ChartCard title="🌐 Websites Created Per Day">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#6366f1" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function AiAreaChart({ data }) {
  return (
    <ChartCard title="🤖 AI Requests Trend">
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f97316" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Area type="monotone" dataKey="requests" stroke="#f97316"
            strokeWidth={2.5} fill="url(#aiGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

const COLORS = ["#4a6cf7", "#6366f1", "#f97316", "#16a34a", "#a855f7", "#ec4899", "#06b6d4"];

export function AiPieChart({ data }) {
  const hasData = data && data.length > 0 && data.some((d) => d.value > 0);

  return (
    <ChartCard title="🧠 AI Usage Distribution">
      <ResponsiveContainer width="100%" height={200}>
        {hasData ? (
          <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              labelLine={false}
              label={({ name, percent }) => `${name.split(" ")[0]} (${(percent * 100).toFixed(0)}%)`}
              outerRadius={60}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${value} requests`, "Usage"]} />
          </PieChart>
        ) : (
          <div className="no-data-chart">
            <span style={{ fontSize: "24px" }}>🤖</span>
            <p>No AI Requests logged yet</p>
          </div>
        )}
      </ResponsiveContainer>
    </ChartCard>
  );
}

