// server.js — Strong heuristic + unified verdicts with Voice & Behavior endpoints
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cors = require("cors");
const bodyParser = require("body-parser");
const { parse } = require("csv-parse/sync");
const fetch = require("node-fetch");

const app = express();
const upload = multer({ dest: path.join(__dirname, "uploads/") });

app.use(cors());
app.use(bodyParser.json({ limit: "20mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

/* ------------------ Risk & Verdict helpers ------------------ */
function classifyRisk(score) {
  if (score >= 90) return { level: "Critical Scam", color: "#b00020" };
  if (score >= 70) return { level: "High Risk", color: "#ff4500" };
  if (score >= 45) return { level: "Moderate Risk", color: "#ff8c00" };
  if (score >= 20) return { level: "Low Risk", color: "#f2c94c" };
  return { level: "Clean / Safe", color: "#32a852" };
}
function smallScoreFrom(score){ return Math.round(Number(score)/10); }
function verdictStatusFrom(score){
  const s = Number(score)||0;
  if (s >= 80) return { verdict: "POTENTIAL FRAUD", status: "POTENTIAL FRAUD" };
  if (s >= 40) return { verdict: "UNSAFE", status: "UNSAFE" };
  return { verdict: "SAFE", status: "SAFE" };
}

/* ------------------ Analysis heuristic (text/ocr/voice) ------------------ */
function analyzeTextHeuristic(text) {
  text = String(text || "").trim();
  const lower = text.toLowerCase();

  let score = 0;
  const reasons = new Set();

  // lottery/prize
  const lotteryPatterns = [
    "you have won","won a lottery","winner","lucky draw","prize","reward",
    "congratulations you have won","claim your prize","won an amount","sudden lottery",
    "you are the winner","selected winner"
  ];
  for (const p of lotteryPatterns) if (lower.includes(p)) { score += 40; reasons.add("Lottery / prize language detected"); }

  // ask for financial details
  const detailPatterns = [
    "upi","bank details","account details","send your bank","provide your bank","share your bank",
    "give me your bank","send your upi","provide account details","transaction details","pay details","account number"
  ];
  for (const p of detailPatterns) if (lower.includes(p)) { score += 35; reasons.add("Asks for UPI / bank / account / transaction details"); }

  // advance fee
  const feePatterns = [
    "processing fee","claim fee","transfer to receive","exchange the money","fee to release","pay small fee","release the amount"
  ];
  for (const p of feePatterns) if (lower.includes(p)) { score += 20; reasons.add("Advance-fee / processing fee pattern detected"); }

  // large sums
  if (/\$\s*\d{3,}|\d{4,}\s*(?:usd|inr|rs|rupees|₹)?/i.test(lower)) { score += 20; reasons.add("Mentions a large sum of money"); }

  // promises/requests send money
  if (/send you the amount|send the amount|i will send you|i can send you|transfer to you|to receive the amount/i.test(lower)) { score += 20; reasons.add("Promises/requests money transfer"); }

  // OTP / numeric codes
  if (/\b\d{4,6}\b/.test(lower)) { score += 8; reasons.add("Contains short numeric code (possible OTP/PIN)"); }

  // common suspicious keywords
  const suspicious = ["urgent","immediately","verify","otp","click","password"];
  for (const p of suspicious) if (lower.includes(p)) { score += 6; reasons.add(`Contains suspicious keyword: ${p}`); }

  // punctuation & caps
  const ex = (text.match(/!/g) || []).length; if (ex >= 3) { score += 5; reasons.add("Multiple exclamation marks (urgency)"); }
  const caps = text.replace(/[^A-Z]/g,"").length; if (text.length>0 && (caps/text.length) > 0.25) { score += 5; reasons.add("High capitalization ratio"); }

  if (score > 100) score = 100;
  if (score < 0) score = 0;
  return { score: Math.round(score), reasons: Array.from(reasons) };
}

/* ------------------ Endpoints ------------------ */

// health
app.get("/ping", (req, res)=> res.json({ ok:true, now:new Date().toISOString() }));

// text
app.post("/api/analyze-text", (req, res)=>{
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });
  const result = analyzeTextHeuristic(text);
  const risk = classifyRisk(result.score);
  const small = smallScoreFrom(result.score);
  const vs = verdictStatusFrom(result.score);
  res.json({
    type: "text",
    score: result.score,
    smallScore: small,
    verdict: vs.verdict,
    status: vs.status,
    riskLevel: risk.level,
    riskColor: risk.color,
    reasons: result.reasons,
    preview: String(text).slice(0,500)
  });
});

// voice (client sends transcript text)
app.post("/api/analyze-voice", (req, res)=>{
  const { transcript } = req.body;
  if (!transcript) return res.status(400).json({ error: "transcript required" });
  const result = analyzeTextHeuristic(transcript);
  const risk = classifyRisk(result.score);
  const small = smallScoreFrom(result.score);
  const vs = verdictStatusFrom(result.score);
  res.json({
    type: "voice",
    score: result.score,
    smallScore: small,
    verdict: vs.verdict,
    status: vs.status,
    riskLevel: risk.level,
    riskColor: risk.color,
    reasons: result.reasons,
    preview: transcript.slice(0,500),
    transcript
  });
});

// ocr text
app.post("/api/analyze-ocr-text", (req, res)=>{
  const { ocrText } = req.body;
  if (!ocrText) return res.status(400).json({ error: "ocrText required" });
  const result = analyzeTextHeuristic(ocrText);
  const risk = classifyRisk(result.score);
  const small = smallScoreFrom(result.score);
  const vs = verdictStatusFrom(result.score);
  res.json({
    type: "ocr",
    score: result.score,
    smallScore: small,
    verdict: vs.verdict,
    status: vs.status,
    riskLevel: risk.level,
    riskColor: risk.color,
    reasons: result.reasons,
    preview: String(ocrText).slice(0,500)
  });
});

// url scan
app.post("/api/scan-url", async (req, res)=>{
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });
  let score = 0; const reasons = [];
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") { score += 30; reasons.push("Not using HTTPS"); }
    if (/\/(login|signin|verify|confirm|payment|checkout)/i.test(u.pathname)) { score += 15; reasons.push("Login/verify path"); }
    const host = u.hostname.toLowerCase();
    if (host.match(/\d+\.\d+\.\d+\.\d+/)) { score += 20; reasons.push("Raw IP address used as host"); }
    const suspiciousTLDs = [".xyz",".info",".top",".pw",".ga",".cf"];
    for (const t of suspiciousTLDs) if (host.endsWith(t)) { score += 20; reasons.push("Suspicious TLD"); }
  } catch (e) {
    score = 100; reasons.push("Invalid or malformed URL");
  }
  if (score > 100) score = 100;
  const risk = classifyRisk(score); const small = smallScoreFrom(score); const vs = verdictStatusFrom(score);
  res.json({ type:"url", url, score: Math.round(score), smallScore: small, verdict: vs.verdict, status: vs.status, riskLevel: risk.level, riskColor: risk.color, reasons });
});

// behavioral CSV analysis
app.post("/api/behavior", upload.single("file"), (req, res)=>{
  if (!req.file) return res.status(400).json({ error: "file required (csv)" });
  try {
    const csvText = fs.readFileSync(req.file.path, "utf8");
    const records = parse(csvText, { columns: true, skip_empty_lines: true });
    try { fs.unlinkSync(req.file.path); } catch(e) {}
    const byFrom = {};
    for (const r of records) {
      const from = r.fromAccount || r.From || r.from || "unknown";
      const to = r.toAccount || r.To || r.to || "unknown";
      const amountRaw = r.amount ?? r.Amount ?? r.Amt ?? r.Value ?? Object.values(r).find(v => /^\d+(\.\d+)?$/.test(String(v)));
      const amount = Number(String(amountRaw||"0").replace(/[^\d.-]/g,""))||0;
      if (!byFrom[from]) byFrom[from] = { amounts: [], receivers: new Set(), tx: 0 };
      byFrom[from].amounts.push(amount);
      byFrom[from].tx++;
      byFrom[from].receivers.add(to);
    }
    const alerts = []; let behaviorScore = 0;
    for (const [from, s] of Object.entries(byFrom)) {
      const avg = s.amounts.reduce((a,b)=>a+b,0) / Math.max(1,s.amounts.length);
      const mx = Math.max(...s.amounts, 0);
      if (s.tx >= 5 && avg > 50000) { alerts.push({ from, reason: "High average transfer amount across many transactions", avg: Math.round(avg), tx: s.tx }); behaviorScore = Math.max(behaviorScore, 75); }
      if (s.receivers.size >= 4 && mx > 100000) { alerts.push({ from, reason: "Many unique receivers + very large transfer", receivers: s.receivers.size, max: mx }); behaviorScore = Math.max(behaviorScore, 80); }
      if (mx > avg * 10 && mx > 50000) { alerts.push({ from, reason: "Large outlier transfer", max: mx, avg: Math.round(avg) }); behaviorScore = Math.max(behaviorScore, 70); }
      if (mx > 2000 && mx <= 50000) behaviorScore = Math.max(behaviorScore, Math.max(behaviorScore, 35));
    }
    if (records.length > 200) behaviorScore = Math.max(behaviorScore, 30);
    if (behaviorScore > 100) behaviorScore = 100;
    const risk = classifyRisk(behaviorScore); const small = smallScoreFrom(behaviorScore); const vs = verdictStatusFrom(behaviorScore);
    return res.json({ type: "behavior", rows: records.length, score: Math.round(behaviorScore), smallScore: small, verdict: vs.verdict, status: vs.status, riskLevel: risk.level, riskColor: risk.color, alerts });
  } catch (err) {
    try { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch(e){}
    return res.status(500).json({ error: "CSV parse failed", detail: String(err) });
  }
});

// fallback
app.get("*", (req, res)=> res.sendFile(path.join(__dirname, "public", "index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`Server listening on http://localhost:${PORT}`));
