import React from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";
import "./Dashboard.css";

ChartJS.register(ArcElement, Tooltip);

export default function SentimentDonut({ pos, neg, neu, pol, total }) {
  const safe  = total || 1;
  const pPct  = Math.round((pos / safe) * 100);
  const nPct  = Math.round((neg / safe) * 100);
  const neuPct= Math.round((neu / safe) * 100);
  const polPct= Math.round((pol / safe) * 100);

  const data = {
    labels: ["Politically Relevant", "Positive", "Negative", "Neutral"],
    datasets: [{
      data: [pol, pos, neg, neu],
      backgroundColor: ["#f5a623", "#3b7d11", "#e74c3c", "#aaaaaa"],
      borderColor: "#fff",
      borderWidth: 2,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "58%",
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw}` } },
    },
  };

  const legend = [
    { color: "#f5a623", label: "Politically Relevant", pct: polPct },
    { color: "#3b7d11", label: "Positive",             pct: pPct   },
    { color: "#e74c3c", label: "Negative",             pct: nPct   },
    { color: "#aaaaaa", label: "Neutral",              pct: neuPct },
  ];

  return (
    <div className="chart-card">
      <div className="chart-title">Sentiment of Articles</div>
      <div className="chart-wrap donut-wrap">
        <Doughnut data={data} options={options} />
      </div>
      <div className="legend-container">
        {legend.map((l) => (
          <div key={l.label} className="legend-item">
            <span className="legend-color" style={{ background: l.color }} />
            <span className="legend-label">{l.label}</span>
            <span className="legend-pct">{l.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
