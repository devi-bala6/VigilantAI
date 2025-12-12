// public/app.js (voice + behavior + text/url/image)
function $(id){ return document.getElementById(id); }

async function postJson(path, body) {
  const full = (path.startsWith("http") ? path : window.location.origin + path);
  try {
    const r = await fetch(full, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
    const txt = await r.text();
    try { return txt ? JSON.parse(txt) : {}; } catch (e) { throw new Error("Non-JSON response: " + txt); }
  } catch (err) { throw new Error("Network error (" + full + "): " + (err.message || err)); }
}

function escapeHtml(s){ return String(s||"").replace(/[&<>"'`]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c])); }

function renderResult(container, data) {
  if (!container) return;
  if (!data) { container.textContent = "No response"; return; }
  if (data.error) { container.innerHTML = `<div class="result-box"><strong>Error:</strong> ${escapeHtml(String(data.error))}</div>`; return; }
  const verdict = data.verdict || "";
  const status = data.status || "";
  const score = (typeof data.score !== "undefined") ? data.score : "";
  const small = (typeof data.smallScore !== "undefined") ? data.smallScore : "";
  const risk = data.riskLevel || "";
  const color = data.riskColor || "#888";
  const reasons = data.reasons || [];
  container.innerHTML = `
    <div class="result-box" style="border-left:6px solid ${color};padding:12px;">
      <div style="font-weight:800;font-size:18px;margin-bottom:6px;">${escapeHtml(verdict)}</div>
      <div style="font-weight:700;margin-bottom:8px;">Status: ${escapeHtml(status)}</div>
      <div style="color:#cfe7f2;margin-bottom:8px;"><strong>Score:</strong> ${score}/100 &nbsp; <strong>SmallScore:</strong> ${small} &nbsp; <strong>Risk:</strong> ${escapeHtml(risk)}</div>
      ${reasons && reasons.length ? `<div><strong>Reasons:</strong><ul>${reasons.map(r=>`<li>${escapeHtml(String(r))}</li>`).join("")}</ul></div>` : ""}
      ${data.preview ? `<div style="margin-top:8px;"><strong>Preview:</strong><div class="preview-text">${escapeHtml(data.preview)}</div></div>` : ""}
    </div>
  `;
}

/* tabbing */
document.querySelectorAll('.tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const t = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    document.getElementById(t).classList.add('active');
  });
});

/* TEXT */
$('analyze-text-btn').addEventListener('click', async ()=>{
  const txt = $('text-input').value.trim(); const out = $('text-result');
  if (!txt) { out.textContent = "Enter text"; return; }
  out.textContent = "Analyzing...";
  try { const j = await postJson('/api/analyze-text', { text: txt }); renderResult(out, j); } catch (e) { out.textContent = e.message; }
});

/* VOICE - browser SpeechRecognition -> send transcript to server */
let recognition = null;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-IN';
  recognition.onresult = (ev) => {
    let transcript = '';
    for (let i = ev.resultIndex; i < ev.results.length; ++i) transcript += ev.results[i][0].transcript;
    $('voice-transcript').value = transcript;
    $('voice-status').textContent = 'Captured transcript';
  };
  recognition.onerror = (e) => { $('voice-status').textContent = 'Speech error: ' + (e.error || e.message || JSON.stringify(e)); };
}
$('start-rec').addEventListener('click', ()=>{
  if (!recognition) { $('voice-status').textContent = 'SpeechRecognition not supported in this browser (use Chrome).'; return; }
  recognition.start(); $('start-rec').disabled = true; $('stop-rec').disabled = false; $('voice-status').textContent = 'Listening...';
});
$('stop-rec').addEventListener('click', ()=>{
  if (recognition) recognition.stop(); $('start-rec').disabled = false; $('stop-rec').disabled = true; $('voice-status').textContent = 'Stopped';
});
$('analyze-voice-btn').addEventListener('click', async ()=>{
  const t = $('voice-transcript').value.trim(); const out = $('voice-result');
  if (!t) { out.textContent = "No transcript to analyze"; return; }
  out.textContent = "Analyzing transcript...";
  try { const j = await postJson('/api/analyze-voice', { transcript: t }); renderResult(out, j); } catch (e) { out.textContent = e.message; }
});

/* IMAGE OCR (client-side Tesseract) */
$('analyze-image-btn').addEventListener('click', async ()=>{
  const f = $('image-file').files[0]; const out = $('image-result');
  if (!f) { out.textContent = "Select image"; return; }
  out.textContent = "Running OCR...";
  try {
    if (typeof Tesseract === 'undefined') { out.textContent = "Tesseract not loaded. Add tesseract.js to index.html."; return; }
    const worker = Tesseract.createWorker();
    await worker.load(); await worker.loadLanguage('eng'); await worker.initialize('eng');
    const { data:{ text } } = await worker.recognize(f);
    await worker.terminate();
    out.textContent = "OCR done. Sending to server...";
    const j = await postJson('/api/analyze-ocr-text', { ocrText: text });
    renderResult(out, j);
  } catch (e) { out.textContent = e.message; }
});

/* URL */
$('scan-url-btn').addEventListener('click', async ()=>{
  const u = $('url-input').value.trim(); const out = $('url-result');
  if (!u) { out.textContent = "Enter URL"; return; }
  out.textContent = "Scanning...";
  try { const j = await postJson('/api/scan-url', { url: u }); renderResult(out, j); } catch (e) { out.textContent = e.message; }
});

/* BEHAVIOR CSV */
$('analyze-behavior-btn').addEventListener('click', async ()=>{
  const f = $('csv-file').files[0]; const out = $('behavior-result');
  if (!f) { out.textContent = "Select CSV"; return; }
  out.textContent = "Uploading CSV...";
  try {
    const fd = new FormData(); fd.append('file', f);
    const resp = await fetch('/api/behavior', { method: 'POST', body: fd });
    const txt = await resp.text(); const j = txt ? JSON.parse(txt) : {};
    renderResult(out, j);
  } catch (e) { out.textContent = e.message; }
});
