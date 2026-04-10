import React from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from "chart.js";
import "./Dashboard.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export default function TrendingTopics({ topics }) {
  const data = {
    labels: topics.map(([t]) => t),
    datasets: [{
      data: topics.map(([, c]) => c),
      backgroundColor: "#f5a623",
      borderRadius: 2,
      barPercentage: 0.72,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { ticks: { font: { size: 10 }, maxRotation: 30, autoSkip: false }, grid: { display: false } },
      y: { ticks: { stepSize: 1, font: { size: 10 } }, grid: { color: "rgba(0,0,0,0.06)" } },
    },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw} articles` } },
    },
  };

  return (
    <div className="chart-card">
      <div className="chart-title">Trending Topics</div>
      <div className="chart-wrap topics-wrap">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}
