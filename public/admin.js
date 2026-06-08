const linkForm = document.querySelector("#linkForm");
const labelInput = document.querySelector("#labelInput");
const newLinkBox = document.querySelector("#newLinkBox");
const newLinkText = document.querySelector("#newLinkText");
const copyBtn = document.querySelector("#copyBtn");
const linksList = document.querySelector("#linksList");
const checkInsList = document.querySelector("#checkInsList");
const refreshBtn = document.querySelector("#refreshBtn");
const ADMIN_TOKEN_KEY = "locationFinderAdminToken";

function shareUrl(id) {
  return `${window.location.origin}/share.html?id=${encodeURIComponent(id)}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function mapsLink(latitude, longitude) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

async function request(path, options) {
  const headers = { "content-type": "application/json" };
  const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (adminToken) headers["x-admin-token"] = adminToken;

  const response = await fetch(path, {
    headers,
    ...options
  });
  if (response.status === 401) {
    const password = window.prompt("Enter admin password");
    if (!password) throw new Error("Admin password required.");
    localStorage.setItem(ADMIN_TOKEN_KEY, password);
    return request(path, options);
  }
  if (!response.ok) throw new Error("The request did not complete.");
  return response.json();
}

async function loadLinks() {
  const { links } = await request("/api/links");
  linksList.classList.toggle("empty", links.length === 0);
  linksList.innerHTML = links.length
    ? links.map(link => `
      <div class="item">
        <div>
          <strong>${escapeHtml(link.label)}</strong>
          <span>${formatDate(link.createdAt)}</span>
        </div>
        <a href="${shareUrl(link.id)}" target="_blank" rel="noreferrer">Open</a>
      </div>
    `).join("")
    : "No links yet.";
}

async function loadCheckIns() {
  const { checkIns } = await request("/api/checkins");
  checkInsList.classList.toggle("empty", checkIns.length === 0);
  checkInsList.innerHTML = checkIns.length
    ? checkIns.map(checkIn => `
      <div class="item locationItem">
        <div>
          <strong>${escapeHtml(checkIn.linkLabel)}</strong>
          <span>${formatDate(checkIn.createdAt)}</span>
          <code>${checkIn.latitude.toFixed(6)}, ${checkIn.longitude.toFixed(6)}</code>
          <small>Accuracy: ${checkIn.accuracy ? `${Math.round(checkIn.accuracy)} m` : "unknown"} | IP: ${escapeHtml(checkIn.ip || "unknown")}</small>
        </div>
        <a href="${mapsLink(checkIn.latitude, checkIn.longitude)}" target="_blank" rel="noreferrer">Map</a>
      </div>
    `).join("")
    : "No locations shared yet.";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[character]));
}

async function refresh() {
  await loadLinks();
  await loadCheckIns();
}

linkForm.addEventListener("submit", async event => {
  event.preventDefault();
  const { link } = await request("/api/links", {
    method: "POST",
    body: JSON.stringify({ label: labelInput.value.trim() || "Location link" })
  });
  const url = shareUrl(link.id);
  newLinkText.textContent = url;
  newLinkBox.hidden = false;
  labelInput.value = "";
  await refresh();
});

copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(newLinkText.textContent);
  copyBtn.textContent = "Copied";
  setTimeout(() => {
    copyBtn.textContent = "Copy";
  }, 1400);
});

refreshBtn.addEventListener("click", refresh);
setInterval(loadCheckIns, 6000);
refresh();
