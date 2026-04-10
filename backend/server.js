require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { fetchAllSources } = require("./rssFetcher");
const { analyseText } = require("./sentimentEngine");

const https = require("https");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Translation Helper (Free Google Translate Interface) ─────────────────────
function translateText(text) {
  if (!text || !/[^\x00-\x7F]/.test(text)) return Promise.resolve(text);
  return new Promise((resolve) => {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve(json[0].map(item => item[0]).join(""));
        } catch { resolve(text); }
      });
    }).on("error", () => resolve(text));
  });
}

// ─── Synonym Expansion Logic ──────────────────────────────────────────────────
const SYNONYM_MAP = {
  "up": ["UP", "Uttar Pradesh", "यूपी", "उत्तर प्रदेश"],
  "sp": ["SP", "Samajwadi Party", "सपा", "समाजवादी पार्टी"],
  "bjp": ["BJP", "Bharatiya Janata Party", "भाजपा", "भारतीय जनता पार्टी"],
  "bsp": ["BSP", "Bahujan Samaj Party", "बसपा", "बहुजन समाज पार्टी"],
  "congress": ["Congress", "INC", "कांग्रेस"],
  "aap": ["AAP", "Aam Aadmi Party", "आप", "आम आदमी पार्टी"],
  "rld": ["RLD", "Rashtriya Lok Dal", "आरएलडी", "रालोद", "जयंत चौधरी"],
  "nda": ["NDA", "National Democratic Alliance", "एनडीए"]
};

function expandFuzzy(term) {
  const t = term.toLowerCase().trim().replace(/"/g, '');
  for (const [key, variants] of Object.entries(SYNONYM_MAP)) {
    if (t === key || variants.map(v => v.toLowerCase()).includes(t)) {
      return `(${variants.map(v => v.includes(" ") ? `"${v}"` : v).join(" OR ")})`;
    }
  }
  return term.includes(" ") ? `"${term}"` : term;
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST"],
}));
app.use("/api/", rateLimit({ windowMs: 2 * 60 * 1000, max: 30 }));

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", time: new Date() }));

// ─── Analyze endpoint ─────────────────────────────────────────────────────────
app.post("/api/analyze", async (req, res) => {
  const { sources, keywords, fromDate, toDate } = req.body;

  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return res.status(400).json({ error: "Provide at least one source." });
  }

  // Validate optional date params
  const from = fromDate ? new Date(fromDate) : null;
  const to = toDate ? new Date(toDate) : null;
  if (from && isNaN(from)) return res.status(400).json({ error: "Invalid fromDate." });
  if (to && isNaN(to)) return res.status(400).json({ error: "Invalid toDate." });
  // Make `to` inclusive by extending it to end-of-day
  if (to) to.setHours(23, 59, 59, 999);

  // Unified regional context
  const coreUP = '(UP OR "Uttar Pradesh" OR यूपी OR "उत्तर प्रदेश")';
  let rawArticles = [];

  // 1. Process and Translate Keywords
  let uniqueGroups = [];
  if (keywords?.trim()) {
    const translated = await translateText(keywords);
    const allInputSets = [...new Set([keywords, translated])];

    allInputSets.forEach(inputSet => {
      const orParts = inputSet.split(",").map(p => p.trim()).filter(p => p.length > 0);
      orParts.forEach(part => {
        const andParts = part.split("+").map(t => t.trim()).filter(t => t.length > 0);
        if (andParts.length > 0) {
          // Sort terms alphabetically so "A + B" and "B + A" are identical
          const sorted = andParts.sort();
          const formatted = sorted.map(t => expandFuzzy(t));
          uniqueGroups.push(formatted.length > 1 ? `(${formatted.join(" ")})` : formatted[0]);
        }
      });
    });
    uniqueGroups = [...new Set(uniqueGroups)];
  }

  // 2. Fetch parallel search tasks (Batching to prevent timeouts)
  try {
    if (uniqueGroups.length > 0) {
      // Limit total keyword groups to the first 10 for performance
      const activeGroups = uniqueGroups.slice(0, 10);

      // Process in batches of 2 to avoid overwhelming Google/Sites
      for (let i = 0; i < activeGroups.length; i += 2) {
        const batch = activeGroups.slice(i, i + 2);
        const searchTasks = batch.map(subQuery => {
          const finalQuery = subQuery.includes("Uttar Pradesh") ? subQuery : `${coreUP} ${subQuery}`;
          return fetchAllSources(sources, finalQuery, 8);
        });

        const taskResults = await Promise.all(searchTasks);
        rawArticles.push(...taskResults.flat());
      }
    } else {
      // Default: UP + generic politics context
      rawArticles = await fetchAllSources(sources, `${coreUP} (politics OR राजनीति)`, 15);
    }
  } catch (err) {
    console.error("Fetch batching failed:", err);
    // Continue with whatever we have fetched so far, don't crash the whole request
  }

  try {
    if (rawArticles.length === 0) {
      return res.json({ articles: [], count: 0 });
    }

    // 2. Run local sentiment analysis on each article
    let articles = rawArticles.map((art) => {
      const analysis = analyseText(art.rawText || art.title);
      return {
        title: art.title,
        source: art.source,
        date: art.date,
        url: art.url,
        summary: art.summary,
        sentiment: analysis.sentiment,
        sentiment_score: analysis.sentiment_score,
        politically_relevant: analysis.politically_relevant,
        topics: analysis.topics,
      };
    });

    // 3. Simple URL deduplication
    const uniqueMap = new Map();
    articles.forEach(a => { if (!uniqueMap.has(a.url)) uniqueMap.set(a.url, a); });
    articles = Array.from(uniqueMap.values());

    // 3. Apply optional date filter (if no dates given, skip — return everything)
    if (from || to) {
      articles = articles.filter((art) => {
        if (!art.date) return true;          // keep articles with no date
        const d = new Date(art.date);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
    }

    return res.json({ articles, count: articles.length });
  } catch (err) {
    console.error("Analyze error:", err);
    return res.status(500).json({ error: err.message || "Analysis failed." });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () =>
  console.log(`UP Tracker backend running on port ${PORT} – no API key needed!`)
);
