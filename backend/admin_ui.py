def render_admin_html() -> str:
    return """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CAT Admin</title>
    <style>
      :root {
        --bg: #0d1117;
        --panel: #161b22;
        --panel-2: #1f2733;
        --text: #e6edf3;
        --muted: #8b949e;
        --accent: #58a6ff;
        --good: #3fb950;
        --warn: #d29922;
        --bad: #f85149;
        --border: #30363d;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: radial-gradient(circle at top, #1b2430, var(--bg) 45%);
        color: var(--text);
      }
      .wrap {
        max-width: 1180px;
        margin: 0 auto;
        padding: 32px 20px 48px;
      }
      h1 { margin: 0 0 8px; font-size: 32px; }
      p { color: var(--muted); margin: 0 0 24px; }
      .grid {
        display: grid;
        grid-template-columns: 360px 1fr;
        gap: 20px;
      }
      .card {
        background: rgba(22, 27, 34, 0.92);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 18px;
        backdrop-filter: blur(8px);
      }
      .card h2 {
        margin: 0 0 14px;
        font-size: 18px;
      }
      .stack { display: grid; gap: 14px; }
      .drop {
        border: 1px dashed #4b5563;
        border-radius: 14px;
        padding: 18px;
        background: rgba(88, 166, 255, 0.05);
      }
      .drop input { width: 100%; }
      .button {
        appearance: none;
        border: 0;
        border-radius: 12px;
        background: linear-gradient(135deg, #2388ff, #6ab0ff);
        color: white;
        padding: 12px 16px;
        font-weight: 700;
        cursor: pointer;
      }
      .button:disabled { opacity: 0.5; cursor: default; }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 8px 12px;
        background: var(--panel-2);
        border: 1px solid var(--border);
        font-size: 14px;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--muted);
      }
      .ok .dot { background: var(--good); }
      .err .dot { background: var(--bad); }
      .muted { color: var(--muted); }
      .uploads, .logs {
        max-height: 560px;
        overflow: auto;
      }
      .upload {
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px;
        background: rgba(255,255,255,0.02);
        margin-bottom: 10px;
      }
      .upload .title {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-weight: 700;
      }
      .status {
        text-transform: capitalize;
        font-size: 12px;
        border-radius: 999px;
        padding: 4px 8px;
        border: 1px solid var(--border);
      }
      .queued { color: var(--warn); }
      .processing { color: var(--accent); }
      .succeeded { color: var(--good); }
      .failed { color: var(--bad); }
      .log {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
        line-height: 1.5;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .log .meta { color: var(--muted); margin-bottom: 4px; }
      .error { color: #ffb4ab; }
      .success { color: #8ce99a; }
      @media (max-width: 920px) {
        .grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>CAT Ingestion Admin</h1>
      <p>Upload one or more PDFs, watch ingest logs, and verify Pinecone vector totals in real time.</p>
      <div class="grid">
        <div class="stack">
          <section class="card">
            <h2>Upload PDFs</h2>
            <form id="upload-form" class="stack">
              <!-- Ingestion Target Selector -->
              <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
                <label for="doc-type" style="font-size: 11px; font-weight: 800; color: var(--muted); letter-spacing: 0.5px; text-transform: uppercase;">Ingestion Target:</label>
                <select id="doc-type" style="width: 100%; background: var(--panel-2); border: 1px solid var(--border); color: var(--text); padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; outline: none; transition: border-color 0.2s;">
                  <option value="formula">📚 Formula Sheets & Concept Guides (Custom Flashcards)</option>
                  <option value="paper">📝 Real CAT Exam Papers (Arena & Mock Clones)</option>
                </select>
              </div>

              <!-- Section Selector -->
              <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
                <label for="doc-section" style="font-size: 11px; font-weight: 800; color: var(--muted); letter-spacing: 0.5px; text-transform: uppercase;">Target Section:</label>
                <select id="doc-section" style="width: 100%; background: var(--panel-2); border: 1px solid var(--border); color: var(--text); padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; outline: none; transition: border-color 0.2s;">
                  <option value="Quant">📐 Quantitative Aptitude (Quant)</option>
                  <option value="DILR">🧩 Data Interpretation & Logical Reasoning (DILR)</option>
                  <option value="VARC">📖 Verbal Ability & Reading Comprehension (VARC)</option>
                </select>
              </div>

              <div class="drop">
                <input id="file-input" name="files" type="file" accept="application/pdf" multiple />
              </div>
              <button id="upload-button" class="button" type="submit">Upload and Process</button>
              <div id="upload-result" class="muted"></div>
            </form>
          </section>
          <section class="card">
            <h2>Vector Database</h2>
            <div id="vector-pill" class="pill">
              <span class="dot"></span>
              <span id="vector-text">Checking Pinecone…</span>
            </div>
          </section>
        </div>
        <div class="stack">
          <section class="card">
            <h2>Recent Uploads</h2>
            <div id="uploads" class="uploads"></div>
          </section>
          <section class="card">
            <h2>Live Logs</h2>
            <div id="logs" class="logs"></div>
          </section>
        </div>
      </div>
    </div>
    <script>
      const uploadsEl = document.getElementById("uploads");
      const logsEl = document.getElementById("logs");
      const vectorPillEl = document.getElementById("vector-pill");
      const vectorTextEl = document.getElementById("vector-text");
      const uploadResultEl = document.getElementById("upload-result");
      const uploadButtonEl = document.getElementById("upload-button");

      function esc(value) {
        return String(value ?? "").replace(/[&<>"]/g, c => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;"
        }[c]));
      }

      async function refreshVectorStatus() {
        const res = await fetch("/admin/api/vector-status");
        const data = await res.json();
        vectorPillEl.className = "pill " + (data.status === "ok" ? "ok" : "err");
        if (data.status === "ok") {
          vectorTextEl.textContent = `Pinecone ready. Total vectors: ${data.total_vectors ?? "unknown"}`;
        } else {
          vectorTextEl.textContent = `Pinecone error: ${data.error}`;
        }
      }

      async function refreshUploads() {
        const res = await fetch("/admin/api/uploads");
        const items = await res.json();
        uploadsEl.innerHTML = items.length ? items.map(item => `
          <div class="upload">
            <div class="title">
              <span>${esc(item.filename)}</span>
              <span class="status ${esc(item.status)}">${esc(item.status)}</span>
            </div>
            <div class="muted">Queued: ${esc(item.queued_at)}</div>
            <div class="muted">Size: ${esc(item.size_bytes)} bytes</div>
            <div class="muted">Vectors before: ${esc(item.vector_count_before)}</div>
            <div class="muted">Vectors after: ${esc(item.vector_count_after)}</div>
            <div class="muted">Upserted vectors: ${esc(item.upserted_vectors)}</div>
            ${item.error ? `<div class="error">Error: ${esc(item.error)}</div>` : ""}
          </div>
        `).join("") : '<div class="muted">No uploads yet.</div>';
      }

      async function refreshLogs() {
        const res = await fetch("/admin/api/logs");
        const items = await res.json();
        logsEl.innerHTML = items.length ? items.map(item => `
          <div class="log">
            <div class="meta">${esc(item.timestamp)}${item.upload_id ? ` · ${esc(item.upload_id)}` : ""}</div>
            <div class="${esc(item.level)}">${esc(item.message)}</div>
          </div>
        `).join("") : '<div class="muted">No logs yet.</div>';
        logsEl.scrollTop = 0;
      }

      async function refreshAll() {
        try {
          await Promise.all([refreshVectorStatus(), refreshUploads(), refreshLogs()]);
        } catch (err) {
          console.error(err);
        }
      }

      document.getElementById("upload-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const input = document.getElementById("file-input");
        if (!input.files.length) {
          uploadResultEl.textContent = "Choose at least one PDF.";
          return;
        }

        uploadButtonEl.disabled = true;
        uploadResultEl.textContent = "Uploading…";

        const form = new FormData();
        for (const file of input.files) {
          form.append("files", file);
        }

        const sectionSelect = document.getElementById("doc-section");
        if (sectionSelect) {
          form.append("section", sectionSelect.value);
        }

        try {
          const res = await fetch("/upload-pdfs/", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) {
            uploadResultEl.textContent = data.detail || "Upload failed.";
          } else {
            uploadResultEl.textContent = `${data.count} file(s) queued: ${data.files.join(", ")}`;
            input.value = "";
            await refreshAll();
          }
        } catch (err) {
          uploadResultEl.textContent = "Network error while uploading.";
        } finally {
          uploadButtonEl.disabled = false;
        }
      });

      refreshAll();
      setInterval(refreshAll, 4000);
    </script>
  </body>
</html>
"""
