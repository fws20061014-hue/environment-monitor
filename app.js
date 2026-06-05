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
  onDuty: index % 9 !== 0,
  heartRate: 74 + Math.round(Math.random() * 18),
  battery: 72 + Math.round(Math.random() * 26),
  batteryTrend: "stable",
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
const broadcastButtons = document.querySelectorAll(".broadcast-action");

const weatherEls = {
  board: document.querySelector("#weatherBoard"),
  visual: document.querySelector("#weatherVisual"),
  tempCard: document.querySelector("#weatherTempCard"),
  humidityCard: document.querySelector("#weatherHumidityCard"),
  windCard: document.querySelector("#weatherWindCard"),
  timeCard: document.querySelector("#weatherTimeCard"),
  text: document.querySelector("#weatherText"),
  tip: document.querySelector("#weatherTip"),
  temp: document.querySelector("#weatherTemp"),
  tempNote: document.querySelector("#weatherTempNote"),
  humidity: document.querySelector("#weatherHumidity"),
  humidityNote: document.querySelector("#weatherHumidityNote"),
  wind: document.querySelector("#weatherWind"),
  windNote: document.querySelector("#weatherWindNote"),
  time: document.querySelector("#weatherTime"),
  source: document.querySelector("#weatherSource"),
};

const siteEls = {
  tempCard: document.querySelector("#siteTempCard"),
  temp: document.querySelector("#siteTemp"),
  tempState: document.querySelector("#siteTempState"),
  dustCard: document.querySelector("#siteDustCard"),
  dust: document.querySelector("#siteDust"),
  dustState: document.querySelector("#siteDustState"),
  alertCard: document.querySelector("#siteAlertCard"),
  fallSummary: document.querySelector("#fallSummary"),
  alertState: document.querySelector("#siteAlertState"),
  priorityCount: document.querySelector("#priorityCount"),
  workerPageTime: document.querySelector("#workerPageTime"),
  safetyState: document.querySelector("#siteSafetyState"),
  onDutyCount: document.querySelector("#onDutyCount"),
  asideAbnormalCount: document.querySelector("#asideAbnormalCount"),
  lowBatteryCount: document.querySelector("#lowBatteryCount"),
  lastRemoteAction: document.querySelector("#lastRemoteAction"),
  safetyList: document.querySelector("#safetyList"),
  broadcastTarget: document.querySelector("#broadcastTarget"),
  broadcastStatus: document.querySelector("#broadcastStatus"),
};

let tick = 0;
let lastRemoteAction = "暂无";

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

broadcastButtons.forEach((button) => {
  button.addEventListener("click", () => handleBroadcast(button));
});

function saveNames() {
  const names = Object.fromEntries(workers.map((worker) => [worker.id, worker.name]));
  localStorage.setItem("helmetWorkerNames", JSON.stringify(names));
}

function handleBroadcast(button) {
  const type = button.dataset.broadcast;
  const onDutyWorkers = workers.filter((worker) => worker.onDuty);
  const abnormalCount = workers.filter((worker) => getWorkerRisk(worker).level !== "normal").length;
  const fallenCount = workers.filter((worker) => worker.fallen).length;
  const highTempCount = workers.filter((worker) => worker.temperature >= TEMP_LIMIT).length;
  const highDustCount = workers.filter((worker) => worker.dust >= DUST_LIMIT).length;
  const originalText = button.textContent;
  const label = type === "rest" ? "通知休息" : "告知异常";
  const detail = getBroadcastDetail(type, onDutyWorkers.length, fallenCount, highTempCount, highDustCount);

  lastRemoteAction = `全场${label} ${onDutyWorkers.length}人`;
  if (siteEls.broadcastStatus) siteEls.broadcastStatus.textContent = detail;
  button.textContent = "已发送";
  button.classList.add("is-sent");
  renderSafetyAside(abnormalCount, fallenCount);

  window.setTimeout(() => {
    button.textContent = originalText;
    button.classList.remove("is-sent");
  }, 900);
}

function getBroadcastDetail(type, onDutyCount, fallenCount, highTempCount, highDustCount) {
  if (!onDutyCount) return "暂无在岗工人";
  if (type === "rest") return `已通知 ${onDutyCount} 名在岗工人休息`;
  if (fallenCount) return `已广播摔倒异常，覆盖 ${onDutyCount} 名在岗工人`;
  if (highTempCount) return `已广播体温异常，覆盖 ${onDutyCount} 名在岗工人`;
  if (highDustCount) return `已广播粉尘异常，覆盖 ${onDutyCount} 名在岗工人`;
  return `已广播现场异常提醒，覆盖 ${onDutyCount} 名在岗工人`;
}

function updateSimulation() {
  tick += 1;
  const now = new Date();

  workers.forEach((worker, index) => {
    const wave = Math.sin((tick + index * 1.7) / 5);
    const dustWave = Math.cos((tick + index * 1.2) / 4);
    const previousBattery = worker.battery;
    worker.temperature = clamp(worker.temperature + wave * 0.08 + randomBetween(-0.12, 0.14), 35.6, 39.4);
    worker.dust = clamp(worker.dust + dustWave * 3.2 + randomBetween(-7, 9), 24, 185);
    worker.heartRate = Math.round(clamp(worker.heartRate + randomBetween(-2.8, 3.2), 58, 128));
    worker.battery = Math.round(clamp(worker.battery - Math.random() * 0.18 + (worker.onDuty ? 0 : 0.04), 18, 100));
    worker.batteryTrend = worker.battery < previousBattery ? "down" : worker.battery > previousBattery ? "up" : "stable";

    if (tick % 9 === 0 && Math.random() < 0.18) worker.fallen = !worker.fallen;
    if (worker.fallen && Math.random() < 0.08) worker.fallen = false;
    if (tick % 16 === 0 && Math.random() < 0.12) worker.onDuty = !worker.onDuty;
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
  siteEls.workerPageTime.textContent = `更新时间：${now.toLocaleString("zh-CN")}`;

  renderWeather(now);
  renderSiteEnvironment(abnormalCount, fallenCount);
  renderSafetyAside(abnormalCount, fallenCount);
  renderWorkerGrid(priorityWorkerGrid, priorityWorkers, true);
  renderWorkerGrid(allWorkerGrid, ranked, false);
}

function renderWeather(now) {
  const outdoorTemp = 24 + Math.sin(tick / 8) * 4 + randomBetween(-0.4, 0.4);
  const humidity = 48 + Math.cos(tick / 7) * 9 + randomBetween(-1, 1);
  const wind = 2.4 + Math.sin(tick / 6) * 0.8;
  const avgDust = average(workers.map((worker) => worker.dust));
  const weather = getWeatherState(outdoorTemp, humidity, wind, avgDust);
  const fogOpacity = getFogOpacity(humidity);
  const tempFrame = getTempFrameStyle(outdoorTemp);
  const windDuration = Math.max(0.75, 2.2 - wind * 0.38).toFixed(2);

  weatherEls.board.className = `weather-board weather-dynamic weather-${weather.className}`;
  weatherEls.text.textContent = weather.label;
  weatherEls.tip.textContent = weather.tip;
  weatherEls.temp.textContent = `${outdoorTemp.toFixed(1)} °C`;
  weatherEls.humidity.textContent = `${humidity.toFixed(0)}%`;
  weatherEls.wind.textContent = `${wind.toFixed(1)} m/s`;
  weatherEls.tempNote.textContent = getTempNote(outdoorTemp);
  weatherEls.humidityNote.textContent = humidity >= 57.5 ? "湿度偏高" : "湿度平稳";
  weatherEls.windNote.textContent = wind >= 3 ? "风速偏高" : "风速平稳";
  weatherEls.time.textContent = now.toLocaleTimeString("zh-CN");
  weatherEls.source.textContent = `动态模拟 · ${getTimePeriodLabel(now)}`;

  weatherEls.tempCard.className = `weather-card weather-data-card ${getTempCardClass(outdoorTemp)}`;
  weatherEls.tempCard.style.setProperty("--weather-frame-speed", tempFrame.speed);
  weatherEls.tempCard.style.setProperty("--weather-frame-opacity", tempFrame.opacity);
  weatherEls.humidityCard.className = `weather-card weather-data-card ${getHumidityCardClass(humidity)}`;
  weatherEls.humidityCard.style.setProperty("--fog-opacity", fogOpacity.toFixed(2));
  weatherEls.humidityCard.style.setProperty("--fog-duration", `${Math.max(1.2, 3.4 - fogOpacity * 2).toFixed(1)}s`);
  weatherEls.humidityCard.style.setProperty("--weather-frame-opacity", clamp(fogOpacity + 0.24, 0.45, 0.95).toFixed(2));
  weatherEls.humidityCard.style.setProperty("--weather-frame-speed", `${Math.max(1.5, 3.7 - fogOpacity * 1.45).toFixed(1)}s`);
  weatherEls.windCard.className = `weather-card weather-data-card ${getWindCardClass(wind)}`;
  weatherEls.windCard.style.setProperty("--wind-duration", `${windDuration}s`);
  weatherEls.windCard.style.setProperty("--weather-frame-speed", `${windDuration}s`);
  weatherEls.windCard.style.setProperty("--weather-frame-opacity", wind >= 3 ? "0.88" : "0.58");
  weatherEls.timeCard.className = `weather-card weather-data-card time-active ${getTimeCardClass(now)}`;
}

function getWeatherState(temp, humidity, wind, dust) {
  if (dust >= 118 || wind >= 3.1) {
    return {
      className: "dusty",
      label: "扬尘",
      tip: "风速或粉尘偏高，建议开启降尘措施",
    };
  }
  if (humidity >= 57.5) {
    return {
      className: "humid",
      label: "湿热",
      tip: "湿度偏高，注意防滑和通风",
    };
  }
  if (temp >= 27.5) {
    return {
      className: "hot",
      label: "晴热",
      tip: "气温偏高，建议缩短连续作业时间",
    };
  }
  if (humidity >= 53 || temp <= 23.5) {
    return {
      className: "cloudy",
      label: "多云",
      tip: "天气平稳，注意持续观察风速变化",
    };
  }
  return {
    className: "sunny",
    label: "晴",
    tip: "适合室外作业，注意补水",
  };
}

function getTempCardClass(temp) {
  if (temp <= 22.5) return "temp-cold";
  if (temp >= 27.5) return "temp-hot";
  return "temp-mild";
}

function getTempNote(temp) {
  if (temp <= 22.5) return "低温提示";
  if (temp >= 27.5) return "高温关注";
  return "适宜作业";
}

function getTempFrameStyle(temp) {
  if (temp >= 27.5) {
    return {
      speed: `${Math.max(1.45, 2.2 - (temp - 27.5) * 0.16).toFixed(2)}s`,
      opacity: "0.84",
    };
  }
  if (temp <= 22.5) {
    return {
      speed: `${Math.max(2.6, 3.9 - (22.5 - temp) * 0.18).toFixed(2)}s`,
      opacity: "0.68",
    };
  }
  return {
    speed: "3.1s",
    opacity: "0.58",
  };
}

function getHumidityCardClass(humidity) {
  if (humidity >= 57.5) return "humidity-wet";
  if (humidity <= 38) return "humidity-dry";
  return "humidity-normal";
}

function getFogOpacity(humidity) {
  return clamp((humidity - 36) / 26, 0.05, 0.9);
}

function getWindCardClass(wind) {
  return wind >= 3 ? "wind-strong" : "wind-normal";
}

function getTimeCardClass(date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 8) return "time-dawn";
  if (hour >= 8 && hour < 17) return "time-day";
  if (hour >= 17 && hour < 20) return "time-dusk";
  return "time-night";
}

function getTimePeriodLabel(date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 8) return "朝阳时段";
  if (hour >= 8 && hour < 17) return "白天时段";
  if (hour >= 17 && hour < 20) return "晚霞时段";
  return "夜间时段";
}

function renderSiteEnvironment(abnormalCount, fallenCount) {
  const avgTemp = average(workers.map((worker) => worker.temperature)) - 9.6;
  const avgDust = average(workers.map((worker) => worker.dust));
  const dustIntensity = getSiteDustIntensity(avgDust);
  siteEls.temp.textContent = `${avgTemp.toFixed(1)} °C`;
  siteEls.dust.textContent = `${avgDust.toFixed(0)} µg/m³`;
  siteEls.fallSummary.textContent = `${abnormalCount} 次`;
  siteEls.tempState.textContent = getSiteTempState(avgTemp);
  siteEls.dustState.textContent = getSiteDustState(avgDust);
  siteEls.alertState.textContent = getSiteAlertState(abnormalCount, fallenCount);
  siteEls.tempCard.className = `site-data-card site-temp-card ${getSiteTempClass(avgTemp)}`;
  siteEls.dustCard.className = `site-data-card site-dust-card ${getSiteDustClass(avgDust)}`;
  siteEls.dustCard.style.setProperty("--site-dust-opacity", dustIntensity.opacity.toFixed(2));
  siteEls.dustCard.style.setProperty("--site-dust-speed", `${dustIntensity.speed}s`);
  siteEls.alertCard.className = `site-data-card site-alert-card ${getSiteAlertClass(abnormalCount)}`;
  siteEls.tempState.style.color = avgTemp >= 29 ? "var(--red)" : avgTemp <= 22 ? "var(--blue)" : "var(--muted)";
  siteEls.dustState.style.color = avgDust >= DUST_LIMIT ? "var(--red)" : avgDust >= 95 ? "#8a5b08" : "var(--muted)";
  siteEls.alertState.style.color = abnormalCount >= 9 ? "var(--red)" : abnormalCount >= 4 ? "#8a5b08" : "var(--green)";
}

function getSiteTempClass(temp) {
  if (temp >= 29) return "site-temp-hot";
  if (temp <= 22) return "site-temp-cold";
  return "site-temp-mild";
}

function getSiteTempState(temp) {
  if (temp >= 29) return "偏高，太阳直射";
  if (temp <= 22) return "偏低，注意保暖";
  return "适中，清风拂过";
}

function getSiteDustClass(dust) {
  if (dust >= DUST_LIMIT) return "site-dust-severe";
  if (dust >= 95) return "site-dust-high";
  if (dust >= 65) return "site-dust-mid";
  return "site-dust-low";
}

function getSiteDustState(dust) {
  if (dust >= DUST_LIMIT) return "浓度偏高";
  if (dust >= 95) return "浓度需关注";
  if (dust >= 65) return "浓度中等";
  return "浓度较低";
}

function getSiteDustIntensity(dust) {
  const opacity = clamp((dust - 35) / 110, 0.28, 1);
  const speed = Math.max(1.25, 3 - opacity * 1.25).toFixed(2);
  return { opacity, speed };
}

function getSiteAlertClass(count) {
  if (count >= 9) return "site-alert-high";
  if (count >= 4) return "site-alert-mid";
  return "site-alert-low";
}

function getSiteAlertState(count, fallenCount) {
  if (count >= 9) return fallenCount ? `红色高频，${fallenCount} 起摔倒` : "红色高频";
  if (count >= 4) return fallenCount ? `橙色关注，${fallenCount} 起摔倒` : "橙色关注";
  return fallenCount ? `绿色低频，${fallenCount} 起摔倒` : "绿色低频";
}

function renderSafetyAside(abnormalCount, fallenCount) {
  const onDutyCount = workers.filter((worker) => worker.onDuty).length;
  const lowBatteryCount = workers.filter((worker) => worker.battery <= 25).length;
  const highDustCount = workers.filter((worker) => worker.dust >= DUST_LIMIT).length;
  const highTempCount = workers.filter((worker) => worker.temperature >= TEMP_LIMIT).length;
  const safetyLevel = fallenCount > 0 || highTempCount > 2 || highDustCount > 2 ? "危险" : abnormalCount > 0 ? "需关注" : "平稳";

  siteEls.safetyState.textContent = safetyLevel === "危险" ? "当前存在高优先级安全风险" : safetyLevel === "需关注" ? "现场需要持续关注" : "现场安全情况平稳";
  siteEls.safetyState.className = `safety-state state-${safetyLevel === "危险" ? "danger" : safetyLevel === "需关注" ? "warning" : "normal"}`;
  siteEls.onDutyCount.textContent = `${onDutyCount}/${WORKER_COUNT}`;
  siteEls.asideAbnormalCount.textContent = abnormalCount;
  siteEls.lowBatteryCount.textContent = lowBatteryCount;
  siteEls.lastRemoteAction.textContent = lastRemoteAction;
  if (siteEls.broadcastTarget) siteEls.broadcastTarget.textContent = `在岗 ${onDutyCount} 人`;

  const tips = [];
  if (fallenCount) tips.push(`${fallenCount} 名工人触发摔倒警告，建议立即联系现场负责人。`);
  if (highTempCount) tips.push(`${highTempCount} 名工人体温偏高，建议安排休息和复测。`);
  if (highDustCount) tips.push(`${highDustCount} 个头盔检测到高粉尘，建议检查降尘措施。`);
  if (lowBatteryCount) tips.push(`${lowBatteryCount} 个头盔电量偏低，建议及时充电或更换。`);
  if (!tips.length) tips.push("暂无高风险事件，保持常规巡检。");
  siteEls.safetyList.innerHTML = tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("");
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
      if (event.target.matches("input, button")) return;
      showWorkerDetail(Number(card.dataset.id));
    });
  });
  container.querySelectorAll(".remote-action").forEach((button) => {
    button.addEventListener("click", () => {
      const worker = workers.find((item) => item.id === Number(button.dataset.id));
      const actionText = button.dataset.action === "talk" ? "已请求对话" : "已发送提醒";
      lastRemoteAction = `${worker.name} ${actionText}`;
      button.textContent = actionText;
      renderSafetyAside(workers.filter((item) => getWorkerRisk(item).level !== "normal").length, workers.filter((item) => item.fallen).length);
      window.setTimeout(render, 900);
    });
  });
}

function renderWorkerCard(worker, compact) {
  const risk = getWorkerRisk(worker);
  const tempLight = getMetricLight("temperature", worker);
  const dustLight = getMetricLight("dust", worker);
  const tempAlert = worker.temperature >= TEMP_LIMIT ? `<span class="metric-alert">!</span>` : "";
  const dustAlert = worker.dust >= DUST_LIMIT ? `<span class="metric-alert">!</span>` : "";
  const fallText = worker.fallen ? "摔倒警告" : "姿态正常";
  const fallIcon = worker.fallen ? `<span class="triangle-alert" aria-label="摔倒警告"></span>` : "";
  const battery = getBatteryState(worker);
  const dutyClass = worker.onDuty ? "on-duty" : "off-duty";

  return `<article class="worker-card detail-open ${risk.level}${worker.fallen ? " fallen" : ""} ${dutyClass}" data-id="${worker.id}">
    <div class="worker-head">
      <div class="name-field">
        <label for="worker-${worker.id}-${compact ? "p" : "a"}">工人姓名</label>
        <input id="worker-${worker.id}-${compact ? "p" : "a"}" class="worker-name-input" data-id="${worker.id}" value="${escapeHtml(worker.name)}" />
      </div>
      <div class="status-stack">
        <span class="duty-badge">${worker.onDuty ? "在岗" : "离岗"}</span>
        <span class="risk-badge">${risk.label}</span>
      </div>
    </div>
    <div class="worker-body">
      <div class="worker-icon"><span class="vest"></span></div>
      <div class="worker-metrics">
        <div class="worker-metric"><span><i class="signal-light ${tempLight.className}" title="${tempLight.label}"></i>体温</span><strong>${worker.temperature.toFixed(1)} °C${tempAlert}</strong></div>
        <div class="worker-metric"><span><i class="signal-light ${dustLight.className}" title="${dustLight.label}"></i>附近粉尘</span><strong>${worker.dust.toFixed(0)} µg/m³${dustAlert}</strong></div>
      </div>
    </div>
    <div class="battery-line">
      <span class="battery-icon ${battery.className}"><i style="width: ${worker.battery}%"></i></span>
      <strong>${worker.battery}%</strong>
      <em>${battery.label}</em>
    </div>
    <div class="fall-line ${worker.fallen ? "is-fallen" : ""}">${fallIcon}<span>${fallText}</span></div>
    <div class="worker-actions">
      <button class="remote-action" data-action="alert" data-id="${worker.id}" type="button">远程提醒</button>
      <button class="remote-action talk" data-action="talk" data-id="${worker.id}" type="button">对话</button>
    </div>
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
      <div class="detail-row"><span>是否在岗</span><strong>${worker.onDuty ? "在岗" : "离岗"}</strong></div>
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
  const tempScore = Math.max(0, worker.temperature - 36.8) * 100;
  const dustScore = Math.max(0, worker.dust - 80) * 1.5;

  if (worker.fallen) {
    return { level: "danger", label: "摔倒警告", score: 4000 + tempScore + dustScore };
  }
  if (worker.temperature >= TEMP_LIMIT) {
    return { level: "danger", label: "体温异常", score: 3000 + tempScore };
  }
  if (worker.temperature >= 37.1) {
    return { level: "warning", label: "体温关注", score: 2500 + tempScore };
  }
  if (worker.dust >= DUST_LIMIT) {
    return { level: "danger", label: "粉尘异常", score: 1500 + dustScore };
  }
  if (worker.dust >= 100) {
    return { level: "warning", label: "粉尘关注", score: 1000 + dustScore };
  }
  return { level: "normal", label: "正常", score: 0 };
}

function getMetricLight(type, worker) {
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

function getBatteryState(worker) {
  if (worker.battery <= 25) return { className: "battery-low", label: "电量低" };
  if (worker.battery <= 55) return { className: "battery-mid", label: worker.batteryTrend === "down" ? "电量下降" : "电量中等" };
  return { className: "battery-good", label: worker.batteryTrend === "down" ? "电量稳定下降" : "电量充足" };
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
