import React, { useState, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import SourceTable    from "./SourceTable";
import SentimentDonut from "./SentimentDonut";
import SentimentByDate from "./SentimentByDate";
import TrendingTopics  from "./TrendingTopics";
import ArticlesModal   from "./ArticlesModal";
import ArticlesTable   from "./ArticlesTable";
import "./Dashboard.css";

export default function Dashboard({ articles }) {
  const [modalSrc, setModalSrc] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const dashRef = useRef(null);

  const srcMap = {};
  articles.forEach((a) => {
    if (!srcMap[a.source]) srcMap[a.source] = { pos: 0, neg: 0, neu: 0, pol: 0, articles: [] };
    if (a.sentiment === "positive") srcMap[a.source].pos++;
    else if (a.sentiment === "negative") srcMap[a.source].neg++;
    else srcMap[a.source].neu++;
    if (a.politically_relevant) srcMap[a.source].pol++;
    srcMap[a.source].articles.push(a);
  });

  const totPos = articles.filter((a) => a.sentiment === "positive").length;
  const totNeg = articles.filter((a) => a.sentiment === "negative").length;
  const totNeu = articles.filter((a) => a.sentiment === "neutral").length;
  const totPol = articles.filter((a) => a.politically_relevant).length;

  const dateMap = {};
  articles.forEach((a) => {
    if (!a.date) return;
    const d = a.date.slice(0, 10);
    if (!dateMap[d]) dateMap[d] = { pos: 0, neg: 0 };
    if (a.sentiment === "positive") dateMap[d].pos++;
    else if (a.sentiment === "negative") dateMap[d].neg++;
  });

  const topicCount = {};
  articles.forEach((a) => (a.topics || []).forEach((t) => { topicCount[t] = (topicCount[t] || 0) + 1; }));
  const sortedTopics = Object.entries(topicCount).sort((a, b) => b[1] - a[1]).slice(0, 16);

  const sourceCount = Object.keys(srcMap).length;
  // Threshold: if > 12 sources, treat as "large" to tuck topics under charts
  const gridClass = sourceCount > 12 ? "is-large" : "is-compact";

  async function handleDownloadPDF() {
    if (!dashRef.current) return;
    setIsExporting(true);
    try {
      // Small delay to let React update classes and charts to redraw if needed
      await new Promise(r => setTimeout(r, 300));

      const canvas = await html2canvas(dashRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#f4f4f4",
      });
      const imgData = canvas.toDataURL("image/png");
      
      // Calculate landscape dimensions
      const pdfWidth = 297; // A4 Landscape Width in mm
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      const pdf = new jsPDF("l", "mm", [pdfWidth, pdfHeight]);
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`UP-Media-Tracker-Snapshot-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) {
      console.error("PDF Export failed:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className={`dash ${isExporting ? "is-exporting" : ""}`} ref={dashRef}>
      <div className="dash-header notranslate">
        <h2 className="dash-title">Media Analytics Report</h2>
        <button 
          className="dash-download-btn" 
          onClick={handleDownloadPDF}
          disabled={isExporting}
        >
          {isExporting ? <span className="btn-spin" /> : "📄"} 
          {isExporting ? "Generating PDF..." : "Download Report (PDF)"}
        </button>
      </div>

      {/* Summary strip */}
      <div className="dash-summary">
        {[
          { label: "Total Articles",       val: articles.length, cls: "" },
          { label: "Positive",             val: totPos,           cls: "pos" },
          { label: "Negative",             val: totNeg,           cls: "neg" },
          { label: "Neutral",              val: totNeu,           cls: "neu" },
          { label: "Politically Relevant", val: totPol,           cls: "pol" },
        ].map((s) => (
          <div key={s.label} className="sum-card">
            <span className={`sum-num ${s.cls}`}>{s.val}</span>
            <span className="sum-label notranslate">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Main Grid: Dynamically switches layout based on source count */}
      <div className={`dash-grid ${gridClass}`}>
        <div className="dash-cell-source">
          <SourceTable srcMap={srcMap} totals={{ pos: totPos, neg: totNeg, neu: totNeu, pol: totPol }} onSourceClick={setModalSrc} />
        </div>
        <div className="dash-cell-donut">
          <SentimentDonut pos={totPos} neg={totNeg} neu={totNeu} pol={totPol} total={articles.length} />
        </div>
        <div className="dash-cell-date">
          <SentimentByDate dateMap={dateMap} />
        </div>
        <div className="dash-cell-topics">
          <TrendingTopics topics={sortedTopics} />
        </div>
      </div>

      {/* Articles table */}
      <ArticlesTable articles={articles} />

      {modalSrc && (
        <ArticlesModal
          source={modalSrc}
          articles={srcMap[modalSrc]?.articles || []}
          onClose={() => setModalSrc(null)}
        />
      )}
    </div>
  );
}
