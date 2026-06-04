const COUNT = 20;
const TEMP_LIMIT = 37.5;
const DUST_LIMIT = 120;

const savedNames = JSON.parse(localStorage.getItem("helmetDesktopWorkerNames") || "{}");
const workers = Array.from({ length: COUNT }, (_, index) => ({
  id: index + 1,
  name: savedNames[index + 1] || `工人 ${String(index + 1).padStart(2, "0")}`,
  temperature: 36.1 + Math.random() * 1.3,
  dust: 42 + Math.random() * 88,
  fallen: index === 3,
  heartRate: 72 + Math.round(Math.random() * 22),
  battery: 76 + Math.round(Math.random() * 20),
}));

let tick = 0;

const grid = document.querySelector("#workerGrid");
const abnormalCount = document.querySelector("#abnormalCount");
const fallCount = document.querySelector("#fallCount");
const updateTime = document.querySelector("#updateTime");

function update() {
  tick += 1;
  workers.forEach((worker, index) => {
    worker.temperature = clamp(worker.temperature + Math.sin((tick + index) / 5) * 0.08 + random(-0.12, 0.14), 35.6, 39.3);
    worker.dust = clamp(worker.dust + Math.cos((tick + index) / 4) * 3.4 + random(-6, 9), 24, 188);
    if (tick % 9 === 0 && Math.random() < 0.16) worker.fallen = !worker.fallen;
    if (index === 5 && tick % 12 < 7) worker.dust = Math.max(worker.dust, 134);
    if (index === 11 && tick % 15 < 6) worker.temperature = Math.max(worker.temperature, 37.9);
  });
  render();
}

function render() {
  const ranked = [...workers].sort((a, b) => risk(b).score - risk(a).score || a.id - b.id);
  abnormalCount.textContent = workers.filter((worker) => risk(worker).level !== "normal").length;
  fallCount.textContent = workers.filter((worker) => worker.fallen).length;
  updateTime.textContent = new Date().toLocaleTimeString("zh-CN");
  grid.innerHTML = ranked.map(cardHtml).join("");
  grid.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      const worker = workers.find((item) => item.id === Number(input.dataset.id));
      worker.name = input.value.trim() || `工人 ${String(worker.id).padStart(2, "0")}`;
      localStorage.setItem("helmetDesktopWorkerNames", JSON.stringify(Object.fromEntries(workers.map((item) => [item.id, item.name]))));
      render();
    });
  });
}

function cardHtml(worker) {
  const state = risk(worker);
  const tempBang = worker.temperature >= TEMP_LIMIT ? '<span class="bang">!</span>' : "";
  const dustBang = worker.dust >= DUST_LIMIT ? '<span class="bang">!</span>' : "";
  const fallIcon = worker.fallen ? '<span class="triangle"></span>' : "";
  return `<article class="worker-card ${state.level}">
    <div class="card-head">
      <input class="name-input" data-id="${worker.id}" value="${escapeHtml(worker.name)}" />
      <span class="badge">${state.label}</span>
    </div>
    <div class="card-body">
      <div class="worker-icon"><span></span></div>
      <div class="metrics">
        <div class="metric"><span>体温</span><strong>${worker.temperature.toFixed(1)} °C ${tempBang}</strong></div>
        <div class="metric"><span>附近粉尘</span><strong>${worker.dust.toFixed(0)} µg/m³ ${dustBang}</strong></div>
      </div>
    </div>
    <div class="fall ${worker.fallen ? "bad" : ""}">${fallIcon}<span>${worker.fallen ? "摔倒警告" : "未摔倒"}</span></div>
  </article>`;
}

function risk(worker) {
  let score = 0;
  if (worker.temperature >= TEMP_LIMIT) score += 36 + (worker.temperature - TEMP_LIMIT) * 12;
  if (worker.dust >= DUST_LIMIT) score += 28 + (worker.dust - DUST_LIMIT) * 0.7;
  if (worker.fallen) score += 80;
  if (worker.fallen) return { level: "danger", label: "摔倒警告", score };
  if (worker.temperature >= TEMP_LIMIT || worker.dust >= DUST_LIMIT) return { level: "danger", label: "危险", score };
  if (worker.temperature >= 37.1 || worker.dust >= 100) return { level: "warning", label: "关注", score: score + 12 };
  return { level: "normal", label: "正常", score };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

update();
window.setInterval(update, 2800);
