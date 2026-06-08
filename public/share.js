const linkTitle = document.querySelector("#linkTitle");
const shareBtn = document.querySelector("#shareBtn");
const statusText = document.querySelector("#statusText");
const params = new URLSearchParams(window.location.search);
const linkId = params.get("id");

function setStatus(message, tone = "") {
  statusText.textContent = message;
  statusText.dataset.tone = tone;
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser does not support location sharing."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });
  });
}

async function loadLink() {
  if (!linkId) {
    throw new Error("This location link is missing its ID.");
  }
  const response = await fetch(`/api/links/${encodeURIComponent(linkId)}`);
  if (!response.ok) {
    throw new Error("This location link could not be found.");
  }
  const { link } = await response.json();
  linkTitle.textContent = link.label;
}

shareBtn.addEventListener("click", async () => {
  shareBtn.disabled = true;
  setStatus("Waiting for your browser permission...");
  try {
    const position = await getPosition();
    setStatus("Sending your coordinates...");
    const response = await fetch(`/api/links/${encodeURIComponent(linkId)}/checkins`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      })
    });
    if (!response.ok) {
      throw new Error("Your location could not be sent.");
    }
    document.body.className = "blankPage";
    document.body.innerHTML = "";
  } catch (error) {
    setStatus(error.message || "Location sharing was cancelled.", "error");
    shareBtn.disabled = false;
  }
});

loadLink().catch(error => {
  shareBtn.disabled = true;
  setStatus(error.message, "error");
});
