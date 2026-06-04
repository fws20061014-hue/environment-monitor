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
  onDuty: index % 8 !== 0,
  heartRate: 72 + Math.round(Math.random() * 22),
  battery: 76 + Math.round(Math.random() * 20),
  batteryTrend: "stable",
}));

let tick = 0;

const grid = document.querySelector("#workerGrid");
const abnormalCount = document.querySelector("#abnormalCount");
const fallCount = document.querySelector("#fallCount");
const updateTime = document.querySelector("#updateTime");

function update() {
  tick += 1;
  workers.forEach((worker, index) => {
    const previousBattery = worker.battery;
    worker.temperature = clamp(worker.temperature + Math.sin((tick + index) / 5) * 0.08 + random(-0.12, 0.14), 35.6, 39.3);
    worker.dust = clamp(worker.dust + Math.cos((tick + index) / 4) * 3.4 + random(-6, 9), 24, 188);
    worker.battery = Math.round(clamp(worker.battery - Math.random() * 0.18 + (worker.onDuty ? 0 : 0.04), 18, 100));
    worker.batteryTrend = worker.battery < previousBattery ? "down" : worker.battery > previousBattery ? "up" : "stable";
    if (tick % 9 === 0 && Math.random() < 0.16) worker.fallen = !worker.fallen;
    if (tick % 16 === 0 && Math.random() < 0.12) worker.onDuty = !worker.onDuty;
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
  const tempLight = metricLight("temperature", worker);
  const dustLight = metricLight("dust", worker);
  const battery = batteryState(worker);
  const tempBang = worker.temperature >= TEMP_LIMIT ? '<span class="bang">!</span>' : "";
  const dustBang = worker.dust >= DUST_LIMIT ? '<span class="bang">!</span>' : "";
  const fallIcon = worker.fallen ? '<span class="triangle"></span>' : "";
  return `<article class="worker-card ${state.level} ${worker.onDuty ? "on-duty" : "off-duty"}">
    <div class="card-head">
      <input class="name-input" data-id="${worker.id}" value="${escapeHtml(worker.name)}" />
      <div class="status-stack">
        <span class="duty-badge">${worker.onDuty ? "在岗" : "离岗"}</span>
        <span class="badge">${state.label}</span>
      </div>
    </div>
    <div class="card-body">
      <div class="worker-icon"><span></span></div>
      <div class="metrics">
        <div class="metric"><span><i class="signal-light ${tempLight.className}" title="${tempLight.label}"></i>体温</span><strong>${worker.temperature.toFixed(1)} °C ${tempBang}</strong></div>
        <div class="metric"><span><i class="signal-light ${dustLight.className}" title="${dustLight.label}"></i>附近粉尘</span><strong>${worker.dust.toFixed(0)} µg/m³ ${dustBang}</strong></div>
      </div>
    </div>
    <div class="battery-line">
      <span class="battery-icon ${battery.className}"><i style="width: ${worker.battery}%"></i></span>
      <strong>${worker.battery}%</strong>
      <em>${battery.label}</em>
    </div>
    <div class="fall ${worker.fallen ? "bad" : ""}">${fallIcon}<span>${worker.fallen ? "摔倒警告" : "未摔倒"}</span></div>
    <div class="actions">
      <button type="button">远程提醒</button>
      <button class="talk" type="button">对话</button>
    </div>
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

function metricLight(type, worker) {
  if (!worker.onDuty) return { className: "light-empty", label: "白灯：离岗或暂无有效数据" };
  if (type === "temperature") {
    if (worker.temperature >= TEMP_LIMIT) return { className: "light-red", label: "红灯：体温过高" };
    if (worker.temperature >= 37.1) return { className: "light-orange", label: "橙灯：体温需关注" };
    return { className: "light-green", label: "绿灯：体温正常" };
  }
  if (worker.dust >= DUST_LIMIT) return { className: "light-red", label: "红灯：粉尘过高" };
  if (worker.dust >= 100) return { className: "light-orange", label: "橙灯：粉尘需关注" };
  return { className: "light-green", label: "绿灯：粉尘正常" };
}

function batteryState(worker) {
  if (worker.battery <= 25) return { className: "battery-low", label: "电量低" };
  if (worker.battery <= 55) return { className: "battery-mid", label: worker.batteryTrend === "down" ? "电量下降" : "电量中等" };
  return { className: "battery-good", label: worker.batteryTrend === "down" ? "电量稳定下降" : "电量充足" };
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
