import React, { useState } from "react";
import * as XLSX from "xlsx";
import "./ArticlesTable.css";

const FILTERS = [
  { key: "all",      label: "All" },
  { key: "pol",      label: "Politically Relevant" },
  { key: "positive", label: "Positive" },
  { key: "negative", label: "Negative" },
  { key: "neutral",  label: "Neutral" },
];

function applyFilter(articles, filter) {
  if (filter === "all")      return articles;
  if (filter === "pol")      return articles.filter((a) => a.politically_relevant);
  return articles.filter((a) => a.sentiment === filter);
}

export default function ArticlesTable({ articles }) {
  const [active, setActive] = useState(() => {
    return sessionStorage.getItem("up_tracker_table_filter") || "all";
  });
  const [isEnglish, setIsEnglish] = useState(() => {
    return document.cookie.includes("googtrans=/auto/en") || document.cookie.includes("googtrans=/en/en");
  });

  // Persist filter to session storage
  React.useEffect(() => {
    sessionStorage.setItem("up_tracker_table_filter", active);
  }, [active]);

  const toggleTranslation = () => {
    const newVal = !isEnglish;
    setIsEnglish(newVal);
    
    if (newVal) {
      // ─── TRANSLATE TO ENGLISH ───
      document.cookie = "googtrans=/auto/en; path=/";
      document.cookie = "googtrans=/auto/en; domain=" + window.location.hostname + "; path=/";
      
      const googleCombo = document.querySelector('select.goog-te-combo');
      if (googleCombo) {
        googleCombo.value = 'en';
        googleCombo.dispatchEvent(new Event('change'));
      } else {
        window.location.reload();
      }
    } else {
      // ─── SWITCH BACK TO HINDI (ORIGINAL) ───
      // 1. Clear cookies
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=" + window.location.hostname + "; path=/;";
      
      // 2. Try programmatic revert via the 'hidden' Google widget
      const googleCombo = document.querySelector('select.goog-te-combo');
      if (googleCombo) {
        googleCombo.value = ''; // Reset combo
        googleCombo.dispatchEvent(new Event('change'));
      }

      // 3. Try to click the hidden 'Show Original' link in the Google banner
      try {
        const iframe = document.querySelector('.goog-te-banner-frame');
        if (iframe) {
          const innerDoc = iframe.contentDocument || iframe.contentWindow.document;
          const restoreBtn = innerDoc.querySelector('button') || innerDoc.getElementById(':1.restore') || innerDoc.querySelector('.goog-te-button');
          if (restoreBtn) {
            restoreBtn.click();
            return; // Success!
          }
        }
      } catch (e) { console.warn(e); }

      // 4. If programmatic revert didn't work, we MUST reload to restore the Hindi text
      // This only happens on the 'Switch Back' which is more reliable
      window.location.reload();
    }
  };

  const handleExcelDownload = () => {
    const data = filtered.map((a, i) => ({
      "S.No": i + 1,
      "Title": a.title,
      "Source": a.source,
      "Date": a.date || "N/A",
      "Sentiment": a.sentiment,
      "Political Relevance": a.politically_relevant ? "Yes" : "No",
      "URL": a.url
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Articles");
    XLSX.writeFile(wb, `UP-Media-Articles-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const filtered = applyFilter(articles, active);

  return (
    <div className="at-wrap">
      {/* ── Header ── */}
      <div className="at-header">
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <span className="at-title">📰 All Scraped Articles</span>
          <span className="at-count">{filtered.length} / {articles.length} shown</span>
          <button className="at-excel-btn" onClick={handleExcelDownload} title="Download as Excel">
            📊 Download Excel
          </button>
        </div>

        <div className="at-header-right notranslate">
          <div className="trans-toggle-wrap">
            <span className={`trans-label ${!isEnglish ? 'active' : ''}`}>Hindi (Org)</span>
            <label className="trans-switch">
              <input type="checkbox" checked={isEnglish} onChange={toggleTranslation} />
              <span className="trans-slider"></span>
            </label>
            <span className={`trans-label ${isEnglish ? 'active' : ''}`}>English</span>
          </div>

          <div className="at-filters">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`at-filter-btn${active === f.key ? ` active-${f.key}` : ""}`}
                onClick={() => setActive(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className="at-empty">No articles match this filter.</div>
      ) : (
        <div className="at-table-wrap">
          <table className="at-table">
            <thead>
              <tr className="notranslate">
                <th>#</th>
                <th>Title / Link</th>
                <th>Source</th>
                <th>Date</th>
                <th>Sentiment</th>
                <th>Political</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const sClass =
                  a.sentiment === "positive" ? "pos"
                  : a.sentiment === "negative" ? "neg"
                  : "neu";
                return (
                  <tr key={i}>
                    <td style={{ color: "#aaa", width: 32 }}>{i + 1}</td>
                    <td>
                      {a.url ? (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="at-link"
                        >
                          {a.title}
                        </a>
                      ) : (
                        <span>{a.title}</span>
                      )}
                    </td>
                    <td><span className="at-source">{a.source}</span></td>
                    <td><span className="at-date">{a.date || "—"}</span></td>
                    <td>
                      <span className={`at-badge ${sClass}`}>
                        {a.sentiment ? a.sentiment.charAt(0).toUpperCase() + a.sentiment.slice(1) : "—"}
                      </span>
                    </td>
                    <td>
                      {a.politically_relevant
                        ? <span className="at-pol">Yes</span>
                        : <span style={{ color: "#ccc", fontSize: 12 }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
