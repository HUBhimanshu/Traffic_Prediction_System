/* ===================================================
   AI Traffic Prediction System — script.js
   =================================================== */

// ── Clock ─────────────────────────────────────────
function updateClock() {
  const el = document.getElementById("currentTime");
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
updateClock();
setInterval(updateClock, 1000);

// ── Sidebar toggle (mobile) ───────────────────────
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.getElementById("sidebar");

if (sidebarToggle) {
  sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });
}

// Close sidebar when clicking outside on mobile
document.addEventListener("click", (e) => {
  if (
    window.innerWidth <= 640 &&
    sidebar &&
    sidebar.classList.contains("open") &&
    !sidebar.contains(e.target) &&
    !sidebarToggle.contains(e.target)
  ) {
    sidebar.classList.remove("open");
  }
});

// ── Helpers ───────────────────────────────────────
function showError(msg) {
  const toastEl = document.getElementById("errorToast");
  const toastBody = document.getElementById("errorToastBody");
  if (toastEl && toastBody) {
    toastBody.textContent = msg;
    const toast = new bootstrap.Toast(toastEl, { delay: 5000 });
    toast.show();
  } else {
    alert("Error: " + msg);
  }
}

function setLoading(isLoading) {
  const btn = document.getElementById("predictBtn");
  const textEl = btn.querySelector(".btn-text");
  const loaderEl = btn.querySelector(".btn-loader");

  if (isLoading) {
    btn.classList.add("loading");
    btn.disabled = true;
    textEl.classList.add("d-none");
    loaderEl.classList.remove("d-none");
  } else {
    btn.classList.remove("loading");
    btn.disabled = false;
    textEl.classList.remove("d-none");
    loaderEl.classList.add("d-none");
  }
}

function getInputValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

// ── Validation ────────────────────────────────────
function validateInputs(data) {
  const hour = parseInt(data.hour);
  if (isNaN(hour) || hour < 0 || hour > 23) return "Hour must be between 0 and 23.";
  if (data.temperature === "" || isNaN(parseFloat(data.temperature))) return "Please enter a valid temperature.";
  const humidity = parseFloat(data.humidity);
  if (isNaN(humidity) || humidity < 0 || humidity > 100) return "Humidity must be between 0 and 100.";
  const ws = parseFloat(data.wind_speed);
  if (isNaN(ws) || ws < 0) return "Wind speed must be a non-negative number.";
  const vis = parseFloat(data.visibility);
  if (isNaN(vis) || vis < 0) return "Visibility must be a non-negative number.";
  const spd = parseFloat(data.average_speed);
  if (isNaN(spd) || spd < 0) return "Average speed must be a non-negative number.";
  const vol = parseFloat(data.traffic_volume);
  if (isNaN(vol) || vol < 0) return "Traffic volume must be a non-negative number.";
  return null;
}

// ── Collect form data ─────────────────────────────
function collectFormData() {
  return {
    hour: getInputValue("hour"),
    day_of_week: getInputValue("day_of_week"),
    weather: getInputValue("weather"),
    road_type: getInputValue("road_type"),
    temperature: getInputValue("temperature"),
    humidity: getInputValue("humidity"),
    wind_speed: getInputValue("wind_speed"),
    visibility: getInputValue("visibility"),
    is_weekend: getInputValue("is_weekend"),
    average_speed: getInputValue("average_speed"),
    traffic_volume: getInputValue("traffic_volume"),
  };
}

// ── Gauge drawing ─────────────────────────────────
function drawGauge(canvasId, value, maxVal) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2;
  const cy = H - 8;
  const r = Math.min(cx - 8, cy - 8);
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const fillAngle = startAngle + ((value / maxVal) * Math.PI);

  // Track
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.stroke();

  // Fill gradient
  if (value > 0) {
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "#00e5ff");
    grad.addColorStop(0.5, "#aa00ff");
    grad.addColorStop(1, "#ff6b35");

    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, fillAngle);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // Centre text
  ctx.fillStyle = "#f0f4ff";
  ctx.font = `bold 18px 'Syne', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(value.toLocaleString(), cx, cy - 4);
}

// ── Feature summary chips ─────────────────────────
function renderFeatureSummary(data) {
  const hour = parseInt(data.hour);
  const humidity = parseFloat(data.humidity);
  const temperature = parseFloat(data.temperature);
  const wind_speed = parseFloat(data.wind_speed);
  const visibility = parseFloat(data.visibility);
  const average_speed = parseFloat(data.average_speed);
  const traffic_volume = parseFloat(data.traffic_volume);
  const is_weekend = data.is_weekend.toLowerCase() === "yes" ? 1 : 0;
  const is_rush_hour = (hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 20) ? 1 : 0;
  const is_night = hour <= 5 || hour >= 22 ? 1 : 0;
  const hour_sin = Math.sin(2 * Math.PI * hour / 24).toFixed(3);
  const hour_cos = Math.cos(2 * Math.PI * hour / 24).toFixed(3);
  const temp_humidity = (temperature * humidity / 100).toFixed(2);
  const wind_vis_risk = (wind_speed / (visibility + 0.1)).toFixed(3);
  const speed_bucket = average_speed <= 35 ? 0 : average_speed <= 55 ? 1 : 2;
  const volume_bucket = traffic_volume <= 1500 ? 0 : traffic_volume <= 3500 ? 1 : 2;

  const weatherSeverityMap = { Clear: 0, Cloudy: 1, Foggy: 2, Rainy: 3, Snowy: 4 };
  const weather_severity = weatherSeverityMap[data.weather] ?? 0;

  const features = [
    { name: "Hour", val: hour },
    { name: "Is Weekend", val: is_weekend },
    { name: "Rush Hour", val: is_rush_hour },
    { name: "Night", val: is_night },
    { name: "Hour sin", val: hour_sin },
    { name: "Hour cos", val: hour_cos },
    { name: "Weather", val: data.weather },
    { name: "W. Severity", val: weather_severity },
    { name: "Road Type", val: data.road_type },
    { name: "Temperature", val: `${temperature}°C` },
    { name: "Humidity", val: `${humidity}%` },
    { name: "Wind Speed", val: `${wind_speed} km/h` },
    { name: "Visibility", val: `${visibility} km` },
    { name: "Temp×Humidity", val: temp_humidity },
    { name: "Wind/Vis Risk", val: wind_vis_risk },
    { name: "Avg Speed", val: `${average_speed} km/h` },
    { name: "Traffic Vol.", val: traffic_volume.toLocaleString() },
    { name: "Speed Bucket", val: speed_bucket },
    { name: "Volume Bucket", val: volume_bucket },
    { name: "Day", val: data.day_of_week },
  ];

  const container = document.getElementById("featureSummary");
  container.innerHTML = features
    .map(
      (f) =>
        `<div class="feature-chip">
          <div class="fc-name">${f.name}</div>
          <div class="fc-val">${f.val}</div>
        </div>`
    )
    .join("");
}

// ── Render results ────────────────────────────────
function renderResults(result, formData) {
  // Show cards
  document.getElementById("resultsPlaceholder").classList.add("d-none");
  const cards = document.getElementById("resultCards");
  cards.classList.remove("d-none");

  // ── Congestion Card ──
  const level = result.congestion_level.toLowerCase();
  const congestionValue = document.getElementById("congestionValue");
  const congestionBar = document.getElementById("congestionBar");
  const congestionSub = document.getElementById("congestionSub");

  congestionValue.textContent = result.congestion_level;

  let barWidth, barColor, congestionDesc;
  if (level.includes("high")) {
    barWidth = "90%";
    barColor = "linear-gradient(90deg, #ff6b35, #ff1744)";
    congestionValue.style.color = "#ff4d6a";
    congestionDesc = "⚠️ Severe delays expected";
  } else if (level.includes("medium") || level.includes("moderate") || level.includes("mid")) {
    barWidth = "55%";
    barColor = "linear-gradient(90deg, #ffd600, #ff6b35)";
    congestionValue.style.color = "#ffd600";
    congestionDesc = "🟡 Moderate slowdown";
  } else {
    barWidth = "20%";
    barColor = "linear-gradient(90deg, #00e676, #00e5ff)";
    congestionValue.style.color = "#00e676";
    congestionDesc = "✅ Traffic flowing well";
  }

  congestionBar.style.width = barWidth;
  congestionBar.style.background = barColor;
  congestionSub.textContent = congestionDesc;

  // ── Volume Card ──
  const volumeValue = document.getElementById("volumeValue");
  volumeValue.textContent = result.predicted_volume.toLocaleString();
  volumeValue.style.color = "#00e5ff";

  const maxVolume = 6000;
  requestAnimationFrame(() => {
    drawGauge("volumeGauge", result.predicted_volume, maxVolume);
  });

  const gaugeLabel = document.getElementById("gaugeLabel");
  const volPct = Math.round((result.predicted_volume / maxVolume) * 100);
  gaugeLabel.textContent = `${volPct}% capacity`;

  // ── Accident Risk Card ──
  const accidentValue = document.getElementById("accidentValue");
  const riskBarFill = document.getElementById("riskBarFill");
  const riskLabel = document.getElementById("riskLabel");
  const risk = Math.min(100, Math.max(0, result.accident_risk));

  accidentValue.textContent = `${risk}%`;

  if (risk >= 60) {
    accidentValue.style.color = "#ff1744";
    riskLabel.textContent = "🔴 High risk — drive carefully";
    riskBarFill.style.backgroundPosition = "100% 0";
  } else if (risk >= 30) {
    accidentValue.style.color = "#ffd600";
    riskLabel.textContent = "🟡 Moderate risk";
    riskBarFill.style.backgroundPosition = "50% 0";
  } else {
    accidentValue.style.color = "#00e676";
    riskLabel.textContent = "🟢 Low risk";
    riskBarFill.style.backgroundPosition = "0% 0";
  }

  riskBarFill.style.width = `${risk}%`;

  // ── Recommendation ──
  const recBox = document.getElementById("recommendationBox");
  const recIcon = document.getElementById("recIcon");
  const recText = document.getElementById("recText");

  recBox.className = `recommendation-box ${result.rec_type}`;

  const iconMap = {
    danger: '<i class="bi bi-exclamation-octagon-fill"></i>',
    warning: '<i class="bi bi-exclamation-triangle-fill"></i>',
    success: '<i class="bi bi-check-circle-fill"></i>',
  };

  recIcon.innerHTML = iconMap[result.rec_type] || iconMap.success;
  recText.textContent = result.recommendation;

  // ── Feature summary ──
  renderFeatureSummary(formData);

  // Scroll to results
  cards.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Main prediction function ──────────────────────
async function runPrediction() {
  const formData = collectFormData();

  const validationError = validateInputs(formData);
  if (validationError) {
    showError(validationError);
    return;
  }

  setLoading(true);

  try {
    const response = await fetch("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const result = await response.json();

    if (!result.success) {
      showError(result.error || "Prediction failed. Check server logs.");
      return;
    }

    renderResults(result, formData);
  } catch (err) {
    showError("Network error: " + err.message);
  } finally {
    setLoading(false);
  }
}

// ── Allow Enter key to trigger prediction ─────────
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && document.activeElement.classList.contains("field-input")) {
    runPrediction();
  }
});

// ── Auto-set weekend toggle based on day selection ─
document.getElementById("day_of_week").addEventListener("change", function () {
  const weekends = ["Saturday", "Sunday"];
  const isWeekendSelect = document.getElementById("is_weekend");
  if (isWeekendSelect) {
    isWeekendSelect.value = weekends.includes(this.value) ? "Yes" : "No";
  }
});
