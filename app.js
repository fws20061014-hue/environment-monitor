const metrics = {
  temperature: {
    label: "温度",
    unit: "°C",
    min: 18,
    max: 34,
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
const recordTable = document.querySelector("#recordTable");

let paused = false;
let tick = 0;
const records = [];
const savedFeedback = JSON.parse(localStorage.getItem("environmentFeedback") || "[]");

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
  records.push(record);
  if (records.length > 240) records.shift();

  Object.entries(metrics).forEach(([key, metric]) => {
    const value = record[key];
    metric.data.push(value);
    if (metric.data.length > 28) metric.data.shift();
    metric.valueEl.textContent = value.toFixed(key === "dust" ? 0 : 1);
    metric.hintEl.textContent = getHint(key, value);
  });

  renderRecords();
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
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `environment-records-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

feedbackForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const type = document.querySelector("#feedbackType").value;
  const text = document.querySelector("#feedbackText").value.trim();
  if (!text) return;

  savedFeedback.unshift({ type, text, time: new Date().toISOString() });
  localStorage.setItem("environmentFeedback", JSON.stringify(savedFeedback.slice(0, 30)));
  renderFeedback();
  feedbackForm.reset();
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
  feedbackList.innerHTML = savedFeedback
    .map((item) => {
      const time = new Date(item.time);
      return `<li><strong>${escapeHtml(item.type)}</strong><span>${escapeHtml(item.text)}</span><time>${time.toLocaleString("zh-CN")}</time></li>`;
    })
    .join("");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
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
drawChart();
setInterval(refresh, 2200);
