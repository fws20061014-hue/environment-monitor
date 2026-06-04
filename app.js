const WORKER_COUNT = 20;
const TEMP_LIMIT = 37.5;
const DUST_LIMIT = 120;
const PRIORITY_SIZE = 10;

const savedNames = JSON.parse(localStorage.getItem("helmetWorkerNames") || "{}");
const workers = Array.from({ length: WORKER_COUNT }, (_, index) => ({
  id: index + 1,
  name: savedNames[index + 1] || `工人 ${String(index + 1).padStart(2, "0")}`,
  temperature: 36.2 + Math.random() * 1.2,
  dust: 45 + Math.random() * 78,
  fallen: false,
  heartRate: 74 + Math.round(Math.random() * 18),
  battery: 72 + Math.round(Math.random() * 26),
  lastUpdate: new Date(),
}));

const dashboardPage = document.querySelector("#dashboardPage");
const workersPage = document.querySelector("#workersPage");
const toWorkersPage = document.querySelector("#toWorkersPage");
const backDashboard = document.querySelector("#backDashboard");
const priorityWorkerGrid = document.querySelector("#priorityWorkerGrid");
const allWorkerGrid = document.querySelector("#allWorkerGrid");
const workerDialog = document.querySelector("#workerDialog");
const workerDetail = document.querySelector("#workerDetail");

const weatherEls = {
  text: document.querySelector("#weatherText"),
  tip: document.querySelector("#weatherTip"),
  temp: document.querySelector("#weatherTemp"),
  humidity: document.querySelector("#weatherHumidity"),
  wind: document.querySelector("#weatherWind"),
  time: document.querySelector("#weatherTime"),
};

const siteEls = {
  temp: document.querySelector("#siteTemp"),
  tempState: document.querySelector("#siteTempState"),
  dust: document.querySelector("#siteDust"),
  dustState: document.querySelector("#siteDustState"),
  fallSummary: document.querySelector("#fallSummary"),
  priorityCount: document.querySelector("#priorityCount"),
  workerPageTime: document.querySelector("#workerPageTime"),
};

let tick = 0;

toWorkersPage.addEventListener("click", () => {
  dashboardPage.classList.add("is-hidden");
  workersPage.classList.remove("is-hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

backDashboard.addEventListener("click", () => {
  workersPage.classList.add("is-hidden");
  dashboardPage.classList.remove("is-hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

function saveNames() {
  const names = Object.fromEntries(workers.map((worker) => [worker.id, worker.name]));
  localStorage.setItem("helmetWorkerNames", JSON.stringify(names));
}

function updateSimulation() {
  tick += 1;
  const now = new Date();

  workers.forEach((worker, index) => {
    const wave = Math.sin((tick + index * 1.7) / 5);
    const dustWave = Math.cos((tick + index * 1.2) / 4);
    worker.temperature = clamp(worker.temperature + wave * 0.08 + randomBetween(-0.12, 0.14), 35.6, 39.4);
    worker.dust = clamp(worker.dust + dustWave * 3.2 + randomBetween(-7, 9), 24, 185);
    worker.heartRate = Math.round(clamp(worker.heartRate + randomBetween(-2.8, 3.2), 58, 128));
    worker.battery = Math.round(clamp(worker.battery - Math.random() * 0.18, 18, 100));

    if (tick % 9 === 0 && Math.random() < 0.18) worker.fallen = !worker.fallen;
    if (worker.fallen && Math.random() < 0.08) worker.fallen = false;
    if (index === 2 && tick < 8) worker.fallen = true;
    if (index === 6 && tick % 12 < 6) worker.dust = Math.max(worker.dust, 132);
    if (index === 10 && tick % 14 < 5) worker.temperature = Math.max(worker.temperature, 37.8);

    worker.lastUpdate = now;
  });

  render();
}

function render() {
  const ranked = getRankedWorkers();
  const priorityWorkers = ranked.slice(0, PRIORITY_SIZE);
  const abnormalCount = workers.filter((worker) => getWorkerRisk(worker).level !== "normal").length;
  const fallenCount = workers.filter((worker) => worker.fallen).length;
  const now = new Date();

  siteEls.priorityCount.textContent = `${abnormalCount} 人异常`;
  siteEls.fallSummary.textContent = `${fallenCount} 起`;
  siteEls.workerPageTime.textContent = `更新时间：${now.toLocaleString("zh-CN")}`;

  renderWeather(now);
  renderSiteEnvironment();
  renderWorkerGrid(priorityWorkerGrid, priorityWorkers, true);
  renderWorkerGrid(allWorkerGrid, ranked, false);
}

function renderWeather(now) {
  const outdoorTemp = 24 + Math.sin(tick / 8) * 4 + randomBetween(-0.4, 0.4);
  const humidity = 48 + Math.cos(tick / 7) * 9 + randomBetween(-1, 1);
  const wind = 2.4 + Math.sin(tick / 6) * 0.8;
  const isHot = outdoorTemp >= 29;

  weatherEls.text.textContent = isHot ? "晴热" : "晴";
  weatherEls.tip.textContent = isHot ? "气温偏高，建议缩短连续作业时间" : "适合室外作业，注意补水";
  weatherEls.temp.textContent = `${outdoorTemp.toFixed(1)} °C`;
  weatherEls.humidity.textContent = `${humidity.toFixed(0)}%`;
  weatherEls.wind.textContent = `${wind.toFixed(1)} m/s`;
  weatherEls.time.textContent = now.toLocaleTimeString("zh-CN");
}

function renderSiteEnvironment() {
  const avgTemp = average(workers.map((worker) => worker.temperature)) - 9.6;
  const avgDust = average(workers.map((worker) => worker.dust));
  siteEls.temp.textContent = `${avgTemp.toFixed(1)} °C`;
  siteEls.dust.textContent = `${avgDust.toFixed(0)} µg/m³`;
  siteEls.tempState.textContent = avgTemp >= 30 ? "偏高" : "正常";
  siteEls.dustState.textContent = avgDust >= DUST_LIMIT ? "偏高" : "正常";
  siteEls.tempState.style.color = avgTemp >= 30 ? "var(--red)" : "var(--muted)";
  siteEls.dustState.style.color = avgDust >= DUST_LIMIT ? "var(--red)" : "var(--muted)";
}

function renderWorkerGrid(container, list, compact) {
  container.innerHTML = list.map((worker) => renderWorkerCard(worker, compact)).join("");
  container.querySelectorAll(".worker-name-input").forEach((input) => {
    input.addEventListener("change", () => {
      const worker = workers.find((item) => item.id === Number(input.dataset.id));
      worker.name = input.value.trim() || `工人 ${String(worker.id).padStart(2, "0")}`;
      saveNames();
      render();
    });
  });
  container.querySelectorAll(".worker-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.matches("input")) return;
      showWorkerDetail(Number(card.dataset.id));
    });
  });
}

function renderWorkerCard(worker, compact) {
  const risk = getWorkerRisk(worker);
  const tempAlert = worker.temperature >= TEMP_LIMIT ? `<span class="metric-alert">!</span>` : "";
  const dustAlert = worker.dust >= DUST_LIMIT ? `<span class="metric-alert">!</span>` : "";
  const fallText = worker.fallen ? "摔倒警告" : "姿态正常";
  const fallIcon = worker.fallen ? `<span class="triangle-alert" aria-label="摔倒警告"></span>` : "";

  return `<article class="worker-card detail-open ${risk.level}${worker.fallen ? " fallen" : ""}" data-id="${worker.id}">
    <div class="worker-head">
      <div class="name-field">
        <label for="worker-${worker.id}-${compact ? "p" : "a"}">工人姓名</label>
        <input id="worker-${worker.id}-${compact ? "p" : "a"}" class="worker-name-input" data-id="${worker.id}" value="${escapeHtml(worker.name)}" />
      </div>
      <span class="risk-badge">${risk.label}</span>
    </div>
    <div class="worker-body">
      <div class="worker-icon"><span class="vest"></span></div>
      <div class="worker-metrics">
        <div class="worker-metric"><span>体温</span><strong>${worker.temperature.toFixed(1)} °C${tempAlert}</strong></div>
        <div class="worker-metric"><span>附近粉尘</span><strong>${worker.dust.toFixed(0)} µg/m³${dustAlert}</strong></div>
      </div>
    </div>
    <div class="fall-line ${worker.fallen ? "is-fallen" : ""}">${fallIcon}<span>${fallText}</span></div>
  </article>`;
}

function showWorkerDetail(workerId) {
  const worker = workers.find((item) => item.id === workerId);
  const risk = getWorkerRisk(worker);
  workerDetail.innerHTML = `<section class="detail-card">
    <p class="eyebrow">Worker Detail</p>
    <h3>${escapeHtml(worker.name)}</h3>
    <div class="detail-grid">
      <div class="detail-row"><span>综合状态</span><strong>${risk.label}</strong></div>
      <div class="detail-row"><span>体温</span><strong>${worker.temperature.toFixed(1)} °C</strong></div>
      <div class="detail-row"><span>附近粉尘浓度</span><strong>${worker.dust.toFixed(0)} µg/m³</strong></div>
      <div class="detail-row"><span>是否摔倒</span><strong>${worker.fallen ? "是" : "否"}</strong></div>
      <div class="detail-row"><span>心率</span><strong>${worker.heartRate} bpm</strong></div>
      <div class="detail-row"><span>安全帽电量</span><strong>${worker.battery}%</strong></div>
    </div>
    <p class="detail-note">异常规则：体温达到 ${TEMP_LIMIT} °C、粉尘浓度达到 ${DUST_LIMIT} µg/m³ 或检测到摔倒时，会被自动排到列表前方。</p>
  </section>`;
  workerDialog.showModal();
}

function getRankedWorkers() {
  return [...workers].sort((a, b) => getWorkerRisk(b).score - getWorkerRisk(a).score || a.id - b.id);
}

function getWorkerRisk(worker) {
  let score = 0;
  if (worker.temperature >= TEMP_LIMIT) score += 36 + (worker.temperature - TEMP_LIMIT) * 12;
  if (worker.dust >= DUST_LIMIT) score += 28 + (worker.dust - DUST_LIMIT) * 0.7;
  if (worker.fallen) score += 80;

  if (worker.fallen) return { level: "danger", label: "摔倒警告", score };
  if (worker.temperature >= TEMP_LIMIT || worker.dust >= DUST_LIMIT) return { level: "danger", label: "危险" , score };
  if (worker.temperature >= 37.1 || worker.dust >= 100) return { level: "warning", label: "关注", score: score + 12 };
  return { level: "normal", label: "正常", score };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
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

updateSimulation();
window.setInterval(updateSimulation, 2800);
