const metrics = {
  temperature: {
    label: "温度",
    unit: "°C",
    min: 18,
    max: 34,
    watchHigh: 30,
    alertHigh: 33,
    watchLow: 20,
    alertLow: 16,
    color: "#e25a49",
    valueEl: document.querySelector("#temperatureValue"),
    hintEl: document.querySelector("#temperatureHint"),
    data: [],
  },
  humidity: {
    label: "湿度",
    unit: "%RH",
    min: 35,
    max: 85,
    watchHigh: 70,
    alertHigh: 82,
    watchLow: 40,
    alertLow: 30,
    color: "#317acb",
    valueEl: document.querySelector("#humidityValue"),
    hintEl: document.querySelector("#humidityHint"),
    data: [],
  },
  noise: {
    label: "噪声",
    unit: "dB",
    min: 30,
    max: 82,
    watchHigh: 65,
    alertHigh: 78,
    color: "#f3b33d",
    valueEl: document.querySelector("#noiseValue"),
    hintEl: document.querySelector("#noiseHint"),
    data: [],
  },
  dust: {
    label: "粉尘浓度",
    unit: "µg/m³",
    min: 8,
    max: 120,
    watchHigh: 75,
    alertHigh: 100,
    color: "#2f9a66",
    valueEl: document.querySelector("#dustValue"),
    hintEl: document.querySelector("#dustHint"),
    data: [],
  },
};

const canvas = document.querySelector("#trendChart");
const ctx = canvas.getContext("2d");
const pauseButton = document.querySelector("#pauseButton");
const pauseIcon = document.querySelector("#pauseIcon");
const exportButton = document.querySelector("#exportButton");
const feedbackForm = document.querySelector("#feedbackForm");
const feedbackList = document.querySelector("#feedbackList");
const feedbackFiles = document.querySelector("#feedbackFiles");
const clearFeedbackButton = document.querySelector("#clearFeedbackButton");
const recordTable = document.querySelector("#recordTable");
const feedbackApiBase = (window.ENV_MONITOR_CONFIG?.feedbackApiBase || "").replace(/\/$/, "");
const overviewPage = document.querySelector("#overviewPage");
const platformPage = document.querySelector("#platformPage");
const openPlatformButton = document.querySelector("#openPlatformButton");
const backOverviewButton = document.querySelector("#backOverviewButton");
const envStatusLabel = document.querySelector("#envStatusLabel");
const envStatusDetail = document.querySelector("#envStatusDetail");
const overviewUpdatedAt = document.querySelector("#overviewUpdatedAt");
const platformUpdatedAt = document.querySelector("#platformUpdatedAt");
const causeList = document.querySelector("#causeList");
const metricCards = document.querySelectorAll(".metric-card");
const metricTimes = document.querySelectorAll(".metric-time");
const overviewValues = {
  temperature: document.querySelector("#overviewTemperature"),
  humidity: document.querySelector("#overviewHumidity"),
  noise: document.querySelector("#overviewNoise"),
  dust: document.querySelector("#overviewDust"),
};
const weatherEls = {
  city: document.querySelector("#weatherCity"),
  summary: document.querySelector("#weatherSummary"),
  condition: document.querySelector("#weatherCondition"),
  temperature: document.querySelector("#weatherTemperature"),
  humidity: document.querySelector("#weatherHumidity"),
  wind: document.querySelector("#weatherWind"),
  updatedAt: document.querySelector("#weatherUpdatedAt"),
};
const locationEls = {
  status: document.querySelector("#locationStatus"),
  name: document.querySelector("#locationName"),
  source: document.querySelector("#locationSource"),
  weatherLink: document.querySelector("#weatherLinkStatus"),
};
const constructionEls = {
  panel: document.querySelector("#constructionPanel"),
  badge: document.querySelector("#constructionBadge"),
  title: document.querySelector("#constructionTitle"),
  detail: document.querySelector("#constructionDetail"),
  updatedAt: document.querySelector("#constructionUpdatedAt"),
};
const feedbackStatEls = {
  total: document.querySelector("#feedbackTotalCount"),
  pending: document.querySelector("#feedbackPendingCount"),
  processing: document.querySelector("#feedbackProcessingCount"),
  processed: document.querySelector("#feedbackProcessedCount"),
};

let paused = false;
let tick = 0;
const records = [];
let savedFeedback = JSON.parse(localStorage.getItem("environmentFeedback") || "[]");
let latestRecord = null;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function makeReading(key) {
  const metric = metrics[key];
  const wave = Math.sin((tick + Object.keys(metrics).indexOf(key) * 5) / 5);
  const midpoint = (metric.min + metric.max) / 2;
  const spread = (metric.max - metric.min) / 3;
  const noise = randomBetween(-spread * 0.22, spread * 0.22);
  return Math.max(metric.min, Math.min(metric.max, midpoint + wave * spread + noise));
}

// Replace this function with your cloud request when the STM32 upload interface is ready.
async function fetchCloudData() {
  return {
    temperature: makeReading("temperature"),
    humidity: makeReading("humidity"),
    noise: makeReading("noise"),
    dust: makeReading("dust"),
  };
}

function getHint(key, value) {
  if (key === "temperature") {
    if (value > 30) return "温度偏高，建议关注散热";
    if (value < 20) return "温度偏低，环境较凉";
    return "温度处于舒适范围";
  }

  if (key === "humidity") {
    if (value > 70) return "湿度偏高，注意通风";
    if (value < 40) return "湿度偏低，空气偏干";
    return "湿度状态良好";
  }

  if (key === "noise") {
    if (value > 65) return "噪声偏高，请检查现场";
    return "噪声水平稳定";
  }

  if (value > 75) return "粉尘浓度偏高，建议排查污染源";
  return "粉尘浓度正常";
}

function pushData(readings) {
  const record = {
    time: new Date(),
    temperature: Number(readings.temperature),
    humidity: Number(readings.humidity),
    noise: Number(readings.noise),
    dust: Number(readings.dust),
  };
  latestRecord = record;
  records.push(record);
  if (records.length > 240) records.shift();

  Object.entries(metrics).forEach(([key, metric], index) => {
    const value = record[key];
    metric.data.push(value);
    if (metric.data.length > 28) metric.data.shift();
    metric.valueEl.textContent = value.toFixed(key === "dust" ? 0 : 1);
    metric.hintEl.textContent = getHint(key, value);
    metricCards[index].classList.remove("level-good", "level-watch", "level-alert");
    metricCards[index].classList.add(`level-${getMetricLevel(key, value)}`);
    metricTimes[index].textContent = `更新时间：${record.time.toLocaleTimeString("zh-CN")}`;
  });

  renderRecords();
  renderOverview(record);
}

function drawChart() {
  const width = canvas.width;
  const height = canvas.height;
  const padding = 42;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255, 255, 255, 0.68)";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(39, 106, 98, 0.16)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = padding + ((height - padding * 2) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  Object.values(metrics).forEach((metric) => {
    if (metric.data.length < 2) return;

    ctx.beginPath();
    metric.data.forEach((value, index) => {
      const x = padding + ((width - padding * 2) / 27) * index;
      const ratio = (value - metric.min) / (metric.max - metric.min);
      const y = height - padding - ratio * (height - padding * 2);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = metric.color;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  });
}

async function refresh() {
  if (paused) return;
  tick += 1;
  const readings = await fetchCloudData();
  pushData(readings);
  drawChart();
}

pauseButton.addEventListener("click", () => {
  paused = !paused;
  pauseIcon.textContent = paused ? "▶" : "Ⅱ";
  document.querySelector("#connectionText").textContent = paused ? "模拟刷新已暂停" : "模拟云端数据运行中";
});

exportButton.addEventListener("click", () => {
  const rows = [["时间", "温度(°C)", "湿度(%RH)", "噪声(dB)", "粉尘(µg/m³)"]];
  records.forEach((record) => {
    rows.push([
      record.time.toLocaleString("zh-CN"),
      record.temperature.toFixed(1),
      record.humidity.toFixed(1),
      record.noise.toFixed(1),
      record.dust.toFixed(0),
    ]);
  });

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  downloadText(`environment-records-${Date.now()}.csv`, csv, "text/csv;charset=utf-8");
});

feedbackForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const type = document.querySelector("#feedbackType").value;
  const urgency = document.querySelector("#feedbackUrgency").value;
  const location = document.querySelector("#feedbackLocation").value.trim();
  const complaintAddress = document.querySelector("#feedbackAddress").value.trim();
  const contact = document.querySelector("#feedbackContact").value.trim();
  const callback = document.querySelector("input[name='callback']:checked").value;
  const text = document.querySelector("#feedbackText").value.trim();
  const files = Array.from(feedbackFiles.files || []);
  if (!location || !complaintAddress || !text) return;
  if (files.length > 3) {
    window.alert("最多只能上传 3 个文件。");
    return;
  }
  if (files.some((file) => file.size > 20 * 1024 * 1024)) {
    window.alert("单个文件不能超过 20MB。");
    return;
  }

  const feedback = {
    type,
    urgency,
    location,
    complaintAddress,
    contact,
    callback,
    text,
    status: "待处理",
    time: new Date().toISOString(),
  };

  const submitButton = feedbackForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "正在提交...";

  try {
    const result = await submitFeedback(feedback, files);
    savedFeedback.unshift(result.feedback);
    savedFeedback = savedFeedback.slice(0, 50);
    saveFeedback();
    renderFeedback();
    renderFeedbackStats();
    feedbackForm.reset();
    submitButton.textContent = result.synced ? "已提交到云端" : "提交失败，已暂存到本机";
  } catch (error) {
    window.alert(`提交失败：${error.message}`);
    submitButton.textContent = "提交失败，请重试";
  } finally {
    submitButton.disabled = false;
    window.setTimeout(() => {
      submitButton.textContent = "提交居民反馈";
    }, 1800);
  }
});

clearFeedbackButton.addEventListener("click", () => {
  const confirmed = window.confirm("确定清空本机保存的居民反馈记录吗？");
  if (!confirmed) return;
  savedFeedback = [];
  saveFeedback();
  renderFeedback();
  renderFeedbackStats();
});

openPlatformButton.addEventListener("click", () => {
  overviewPage.classList.add("is-hidden");
  platformPage.classList.remove("is-hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

backOverviewButton.addEventListener("click", () => {
  platformPage.classList.add("is-hidden");
  overviewPage.classList.remove("is-hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

function renderRecords() {
  recordTable.innerHTML = records
    .slice(-6)
    .reverse()
    .map(
      (record) => `<tr>
        <td>${record.time.toLocaleTimeString("zh-CN")}</td>
        <td>${record.temperature.toFixed(1)} °C</td>
        <td>${record.humidity.toFixed(1)} %RH</td>
        <td>${record.noise.toFixed(1)} dB</td>
        <td>${record.dust.toFixed(0)} µg/m³</td>
      </tr>`,
    )
    .join("");
}

function renderFeedback() {
  if (savedFeedback.length === 0) {
    feedbackList.innerHTML = `<li class="empty-feedback">${feedbackApiBase ? "暂无近期反馈" : "暂无本机反馈"}</li>`;
    return;
  }

  feedbackList.innerHTML = savedFeedback
    .map((item) => {
      const time = new Date(item.time);
      const urgencyClass = item.urgency === "紧急" ? "danger" : item.urgency === "较急" ? "warning" : "normal";
      return `<li>
        <div class="feedback-entry-head">
          <strong>${escapeHtml(item.type)}</strong>
          <span class="urgency ${urgencyClass}">${escapeHtml(item.urgency || "一般")}</span>
        </div>
        <p>${escapeHtml(item.text)}</p>
        <dl>
          <div><dt>区域</dt><dd>${escapeHtml(item.location || "未填写")}</dd></div>
          <div><dt>投诉地址</dt><dd>${escapeHtml(item.complaintAddress || item.location || "未填写")}</dd></div>
          <div><dt>回访</dt><dd>${escapeHtml(item.callback || "未填写")}</dd></div>
          <div><dt>联系</dt><dd>${escapeHtml(item.contact || "未留联系方式")}</dd></div>
          <div><dt>状态</dt><dd>${escapeHtml(item.synced === false ? "本机暂存" : item.status || "待处理")}</dd></div>
        </dl>
        ${renderAttachmentLinks(item.attachments)}
        <time>${time.toLocaleString("zh-CN")}</time>
      </li>`;
    })
    .join("");
}

function renderOverview(record) {
  overviewValues.temperature.textContent = `${record.temperature.toFixed(1)} °C`;
  overviewValues.humidity.textContent = `${record.humidity.toFixed(1)} %RH`;
  overviewValues.noise.textContent = `${record.noise.toFixed(1)} dB`;
  overviewValues.dust.textContent = `${record.dust.toFixed(0)} µg/m³`;

  const timeText = `更新时间：${record.time.toLocaleString("zh-CN")}`;
  overviewUpdatedAt.textContent = timeText;
  platformUpdatedAt.textContent = `数据${timeText}`;

  const levels = Object.keys(metrics).map((key) => getMetricLevel(key, record[key]));
  const status = levels.includes("alert") ? "alert" : levels.includes("watch") ? "watch" : "good";
  const hero = overviewPage.querySelector(".overview-hero");
  hero.classList.remove("status-good", "status-watch", "status-alert");
  hero.classList.add(`status-${status}`);

  if (status === "alert") {
    envStatusLabel.textContent = "环境状态异常";
    envStatusDetail.textContent = "当前至少一项指标达到异常阈值，建议尽快核查现场并优先处理相关反馈。";
  } else if (status === "watch") {
    envStatusLabel.textContent = "环境需关注";
    envStatusDetail.textContent = "部分指标出现偏高或偏低趋势，建议持续观察并结合居民反馈判断原因。";
  } else {
    envStatusLabel.textContent = "环境状态良好";
    envStatusDetail.textContent = "当前温度、湿度、噪声和粉尘浓度均处于正常观察范围。";
  }

  renderCauseTips(record);
  renderConstructionStatus(record);
  renderWeatherLocation(record);
}

function renderWeatherLocation(record) {
  const weather = getMockWeather(record);
  weatherEls.city.textContent = weather.city;
  weatherEls.summary.textContent = weather.summary;
  weatherEls.condition.textContent = weather.condition;
  weatherEls.temperature.textContent = `${weather.temperature.toFixed(0)} °C`;
  weatherEls.humidity.textContent = `${weather.humidity.toFixed(0)}%`;
  weatherEls.wind.textContent = weather.wind;
  weatherEls.updatedAt.textContent = `更新时间：${record.time.toLocaleString("zh-CN")}`;

  locationEls.status.textContent = "模拟定位";
  locationEls.name.textContent = "默认监测区域";
  locationEls.source.textContent = "静态地图预览";
  locationEls.weatherLink.textContent = "待接入天气 API";
}

function getMockWeather(record) {
  const isDusty = record.dust >= metrics.dust.watchHigh;
  const isNoisy = record.noise >= metrics.noise.watchHigh;
  const condition = isDusty ? "多云" : isNoisy ? "晴间多云" : "晴";
  return {
    city: "本地天气",
    condition,
    temperature: Math.max(18, Math.min(34, record.temperature + 2.4)),
    humidity: Math.max(35, Math.min(82, record.humidity - 4)),
    wind: isDusty ? "北风 3级" : "东南风 2级",
    summary: isDusty ? "空气扩散一般，建议关注粉尘变化" : "晴朗，适合巡查和户外采样",
  };
}

function renderConstructionStatus(record) {
  const state = getConstructionState(record);
  const copy = {
    resting: {
      badge: "休息中",
      title: "当前未检测到施工影响",
      detail: "噪声和粉尘浓度处于平稳范围，暂无明显施工扰动。",
    },
    working: {
      badge: "施工中",
      title: "疑似存在现场施工活动",
      detail: "噪声或粉尘浓度升高，建议结合投诉地址和现场巡查确认施工点位。",
    },
    completed: {
      badge: "完工",
      title: "施工影响正在回落",
      detail: "近期数据较为平稳，可继续观察粉尘和噪声是否恢复到正常范围。",
    },
  }[state];

  constructionEls.panel.classList.remove("state-resting", "state-working", "state-completed");
  constructionEls.panel.classList.add(`state-${state}`);
  constructionEls.badge.textContent = copy.badge;
  constructionEls.title.textContent = copy.title;
  constructionEls.detail.textContent = copy.detail;
  constructionEls.updatedAt.textContent = `更新时间：${record.time.toLocaleString("zh-CN")}`;
}

function getConstructionState(record) {
  if (record.noise >= metrics.noise.watchHigh || record.dust >= metrics.dust.watchHigh) {
    return "working";
  }
  if (records.length >= 8) {
    const recent = records.slice(-8, -1);
    const recentHigh = recent.some((item) => item.noise >= metrics.noise.watchHigh || item.dust >= metrics.dust.watchHigh);
    if (recentHigh) return "completed";
  }
  return "resting";
}

function renderCauseTips(record) {
  const tips = [];
  if (getMetricLevel("temperature", record.temperature) !== "good") {
    tips.push(record.temperature > metrics.temperature.watchHigh ? "温度偏高：可能与设备散热、日照强、通风不足有关。" : "温度偏低：可能与天气变化、测点阴影或通风过强有关。");
  }
  if (getMetricLevel("humidity", record.humidity) !== "good") {
    tips.push(record.humidity > metrics.humidity.watchHigh ? "湿度偏高：建议关注降雨、绿化浇灌、排水或通风情况。" : "湿度偏低：可能为空气干燥或测点附近热源影响。");
  }
  if (getMetricLevel("noise", record.noise) !== "good") {
    tips.push("噪声偏高：建议排查施工、车辆鸣笛、广场活动或设备运转声。");
  }
  if (getMetricLevel("dust", record.dust) !== "good") {
    tips.push("粉尘偏高：建议检查道路扬尘、施工点、垃圾投放点或大风天气影响。");
  }
  causeList.innerHTML = (tips.length ? tips : ["暂无异常提示，建议保持常规巡查。"]).map((tip) => `<li>${escapeHtml(tip)}</li>`).join("");
}

function getMetricLevel(key, value) {
  const metric = metrics[key];
  if ((metric.alertHigh !== undefined && value >= metric.alertHigh) || (metric.alertLow !== undefined && value <= metric.alertLow)) return "alert";
  if ((metric.watchHigh !== undefined && value >= metric.watchHigh) || (metric.watchLow !== undefined && value <= metric.watchLow)) return "watch";
  return "good";
}

async function renderFeedbackStats() {
  const stats = await getFeedbackStats();
  feedbackStatEls.total.textContent = stats.total;
  feedbackStatEls.pending.textContent = stats.pending;
  feedbackStatEls.processing.textContent = stats.processing;
  feedbackStatEls.processed.textContent = stats.processed;
}

async function getFeedbackStats() {
  if (feedbackApiBase) {
    try {
      const response = await fetch(`${feedbackApiBase}/api/feedback/stats`);
      if (response.ok) return await response.json();
    } catch {
      // Fall back to local recent feedback below.
    }
  }

  return summarizeFeedback(savedFeedback);
}

function summarizeFeedback(list) {
  return {
    total: list.length,
    pending: list.filter((item) => (item.status || "待处理") === "待处理" || item.synced === false).length,
    processing: list.filter((item) => item.status === "处理中").length,
    processed: list.filter((item) => item.status === "已处理" || item.status === "已回访").length,
  };
}

function saveFeedback() {
  localStorage.setItem("environmentFeedback", JSON.stringify(savedFeedback));
}

async function submitFeedback(feedback, files = []) {
  if (!feedbackApiBase) {
    return {
      synced: false,
      feedback: { ...feedback, id: createId(), synced: false },
    };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 60000);

  try {
    const formData = new FormData();
    Object.entries(feedback).forEach(([key, value]) => {
      formData.append(key, value);
    });
    files.forEach((file) => {
      formData.append("attachments", file);
    });

    const response = await fetch(`${feedbackApiBase}/api/feedback`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(message || "提交失败");
    }
    return { synced: true, feedback: await response.json() };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("上传超时，请检查网络或压缩附件后重试");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readErrorMessage(response) {
  try {
    const data = await response.json();
    return data.error;
  } catch {
    return response.status === 413 ? "附件过大，请压缩后再上传" : `服务器返回 ${response.status}`;
  }
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function renderAttachmentLinks(attachments = []) {
  if (!attachments.length) return "";
  return `<div class="attachment-links">${attachments
    .map((item, index) => {
      const href = item.url?.startsWith("http") ? item.url : `${feedbackApiBase}${item.url || ""}`;
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">&#38468;&#20214; ${index + 1}</a>`;
    })
    .join("")}</div>`;
}

async function loadFeedbackFromCloud() {
  if (!feedbackApiBase) return;
  const adminKey = localStorage.getItem("feedbackAdminKey");
  if (!adminKey) return;

  try {
    const response = await fetch(`${feedbackApiBase}/api/feedback?key=${encodeURIComponent(adminKey)}`);
    if (!response.ok) return;
    savedFeedback = await response.json();
    saveFeedback();
    renderFeedback();
    renderFeedbackStats();
  } catch {
    // Keep local cached feedback visible if the cloud service is unavailable.
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadText(filename, text, type) {
  const blob = new Blob(["\ufeff", text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

for (let i = 0; i < 16; i += 1) {
  tick += 1;
  pushData({
    temperature: makeReading("temperature"),
    humidity: makeReading("humidity"),
    noise: makeReading("noise"),
    dust: makeReading("dust"),
  });
}

renderFeedback();
renderFeedbackStats();
loadFeedbackFromCloud();
drawChart();
setInterval(refresh, 2200);
