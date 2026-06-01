const CONFIG = window.ADMIN_CONFIG || {
  backendBaseUrl: "https://cat-backend-bdyo.onrender.com",
  pollIntervalMs: 4000,
};
const BACKEND_BASE_URL = String(CONFIG.backendBaseUrl || "").replace(/\/+$/, "");

const state = {
  files: [],
};

const elements = {
  fileInput: document.getElementById("file-input"),
  selectedFiles: document.getElementById("selected-files"),
  uploadButton: document.getElementById("upload-button"),
  refreshButton: document.getElementById("refresh-button"),
  uploadStatus: document.getElementById("upload-status"),
  backendPill: document.getElementById("backend-pill"),
  vectorPill: document.getElementById("vector-pill"),
  vectorText: document.getElementById("vector-text"),
  metricVectors: document.getElementById("metric-vectors"),
  metricUploads: document.getElementById("metric-uploads"),
  metricLogs: document.getElementById("metric-logs"),
  uploads: document.getElementById("uploads"),
  logs: document.getElementById("logs"),
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  }[char]));
}

function setPill(element, ok, text) {
  element.style.background = ok ? "rgba(67, 207, 142, 0.16)" : "rgba(248, 113, 113, 0.16)";
  element.style.color = ok ? "#dff8e7" : "#ffd4d4";
  element.textContent = text;
}

async function fetchJson(path, options) {
  const response = await fetch(`${BACKEND_BASE_URL}${path}`, options);
  const text = await response.text();
  let json;

  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    throw new Error(json.detail || json.error || `Request failed: ${response.status}`);
  }

  return json;
}

function renderSelectedFiles() {
  if (!state.files.length) {
    elements.selectedFiles.innerHTML = '<div class="empty">No files selected.</div>';
    return;
  }

  elements.selectedFiles.innerHTML = state.files
    .map((file) => {
      const sizeKb = Math.max(1, Math.round(file.size / 1024));
      return `<div class="selected-file">${esc(file.name)} · ${sizeKb} KB</div>`;
    })
    .join("");
}

function renderUploads(items) {
  elements.metricUploads.textContent = String(items.length);
  elements.metricLogs.textContent = `${items.length} tracked`;

  if (!items.length) {
    elements.uploads.innerHTML = '<div class="empty">No uploads tracked yet.</div>';
    return;
  }

  elements.uploads.innerHTML = items.map((item) => `
    <div class="upload-item">
      <div class="upload-item-head">
        <div class="upload-item-name">${esc(item.filename)}</div>
        <div class="badge ${esc(item.status)}">${esc(item.status)}</div>
      </div>
      <div class="upload-item-meta">
        <div>Queued: ${esc(item.queued_at)}</div>
        <div>Size: ${esc(item.size_bytes)} bytes</div>
        <div>Attempts: ${esc(item.attempts)}</div>
        <div>Vectors before: ${esc(item.vector_count_before)}</div>
        <div>Vectors after: ${esc(item.vector_count_after)}</div>
        <div>Upserted: ${esc(item.upserted_vectors)}</div>
        <div>Next retry: ${esc(item.next_retry_at)}</div>
      </div>
      ${(item.last_error || item.error) ? `<div class="error-text">${esc(item.last_error || item.error)}</div>` : ""}
    </div>
  `).join("");
}

function renderLogs(items) {
  if (!items.length) {
    elements.logs.innerHTML = '<div class="empty">No logs yet.</div>';
    return;
  }

  elements.logs.innerHTML = items.slice().reverse().map((item) => `
    <div class="log-item">
      <div class="log-meta">${esc(item.timestamp)}${item.upload_id ? ` · ${esc(item.upload_id)}` : ""}</div>
      <div class="log-message ${esc(item.level)}">${esc(item.message)}</div>
    </div>
  `).join("");
}

async function refreshBackendStatus() {
  try {
    await fetchJson("/");
    setPill(elements.backendPill, true, "BE");
  } catch (error) {
    setPill(elements.backendPill, false, "BE!");
  }
}

async function refreshVectorStatus() {
  try {
    const data = await fetchJson("/admin/api/vector-status");
    if (data.status === "ok") {
      setPill(elements.vectorPill, true, "DB");
      elements.vectorText.textContent = `Total vectors: ${data.total_vectors ?? "unknown"}`;
      elements.metricVectors.textContent = String(data.total_vectors ?? 0);
    } else {
      setPill(elements.vectorPill, false, "DB!");
      elements.vectorText.textContent = data.error || "Unknown Pinecone error";
      elements.metricVectors.textContent = "-";
    }
  } catch (error) {
    setPill(elements.vectorPill, false, "DB!");
    elements.vectorText.textContent = error.message;
    elements.metricVectors.textContent = "-";
  }
}

async function refreshUploads() {
  try {
    const items = await fetchJson("/admin/api/uploads");
    renderUploads(items);
  } catch (error) {
    elements.uploads.innerHTML = `<div class="error-text">${esc(error.message)}</div>`;
  }
}

async function refreshLogs() {
  try {
    const items = await fetchJson("/admin/api/logs");
    renderLogs(items);
  } catch (error) {
    elements.logs.innerHTML = `<div class="error-text">${esc(error.message)}</div>`;
  }
}

async function refreshAll() {
  await Promise.all([
    refreshBackendStatus(),
    refreshVectorStatus(),
    refreshUploads(),
    refreshLogs(),
  ]);
}

async function uploadFiles(event) {
  event.preventDefault();
  if (!state.files.length) {
    elements.uploadStatus.textContent = "Choose at least one PDF.";
    return;
  }

  const form = new FormData();
  for (const file of state.files) {
    form.append("files", file);
  }

  const sectionSelect = document.getElementById("doc-section");
  if (sectionSelect) {
    form.append("section", sectionSelect.value);
  }

  elements.uploadButton.disabled = true;
  elements.uploadStatus.textContent = "Uploading and queueing background jobs…";

  try {
    const result = await fetchJson("/upload-pdfs/", {
      method: "POST",
      body: form,
    });
    elements.uploadStatus.textContent = `${result.count} file(s) queued: ${result.files.join(", ")}`;
    state.files = [];
    elements.fileInput.value = "";
    renderSelectedFiles();
    await refreshAll();
  } catch (error) {
    elements.uploadStatus.textContent = error.message;
  } finally {
    elements.uploadButton.disabled = false;
  }
}

elements.fileInput.addEventListener("change", (event) => {
  state.files = Array.from(event.target.files || []);
  renderSelectedFiles();
});

document.getElementById("upload-form").addEventListener("submit", uploadFiles);
elements.refreshButton.addEventListener("click", refreshAll);

renderSelectedFiles();
refreshAll();
setInterval(refreshAll, CONFIG.pollIntervalMs || 4000);

// Render Active Keep-Alive Engine
const keepAliveLogs = [];
const keepAliveElement = document.getElementById("keepalive-pings");

async function pingKeepAlive() {
  const startTime = Date.now();
  const timeStr = new Date().toTimeString().split(' ')[0];
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/healthz`);
    const duration = Date.now() - startTime;
    if (res.ok) {
      keepAliveLogs.unshift(`<div style="color: var(--green);">${timeStr} - Ping OK (${duration}ms)</div>`);
    } else {
      keepAliveLogs.unshift(`<div style="color: var(--yellow);">${timeStr} - Ping Error ${res.status}</div>`);
    }
  } catch (err) {
    keepAliveLogs.unshift(`<div style="color: var(--red);">${timeStr} - Connection failed</div>`);
  }
  
  if (keepAliveLogs.length > 5) {
    keepAliveLogs.pop();
  }
  
  if (keepAliveElement) {
    keepAliveElement.innerHTML = keepAliveLogs.join("");
  }
}

// Start keep-alive pings every 5 seconds
pingKeepAlive();
setInterval(pingKeepAlive, 5000);

