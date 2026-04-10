import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip,
} from "chart.js";
import "./Dashboard.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export default function SentimentByDate({ dateMap }) {
  const dates = Object.keys(dateMap).sort();

  const fmt = (d) => {
    const [y, m, day] = d.split("-");
    return `${parseInt(day).toString().padStart(2,"0")}/${m}/${y.slice(2)}`;
  };

  const data = {
    labels: dates.map(fmt),
    datasets: [
      { label: "Positive", data: dates.map((d) => dateMap[d].pos), backgroundColor: "#3b7d11", barPercentage: 0.65 },
      { label: "Negative", data: dates.map((d) => dateMap[d].neg), backgroundColor: "#e74c3c", barPercentage: 0.65 },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { ticks: { font: { size: 9 }, maxRotation: 45, autoSkip: false }, grid: { display: false } },
      y: { ticks: { stepSize: 1, font: { size: 10 } }, grid: { color: "rgba(0,0,0,0.06)" } },
    },
    plugins: { legend: { display: false } },
  };

  return (
    <div className="chart-card">
      <div className="chart-title">Sentiment by Date</div>
      <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 8 }}>
        {[{ color: "#3b7d11", label: "Positive" }, { color: "#e74c3c", label: "Negative" }].map((l) => (
          <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
      <div className="chart-wrap date-wrap">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}
