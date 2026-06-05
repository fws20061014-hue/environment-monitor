const WORKER_IMAGE_LOCAL_KEY = "helmetWorkerImages";
const WORKER_NAME_KEY = "helmetWorkerNames";
const WORKER_TOTAL = 20;
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

const apiBase = window.ENV_MONITOR_CONFIG?.feedbackApiBase || window.location.origin;
const workerNames = readJson(WORKER_NAME_KEY, {});
let serverRecords = [];
let localSessionRecords = [];

const form = document.querySelector("#workerImageForm");
const workerIdInput = document.querySelector("#workerId");
const workerNameInput = document.querySelector("#workerName");
const workerPhotoInput = document.querySelector("#workerPhoto");
const workerNoteInput = document.querySelector("#workerNote");
const uploadButton = document.querySelector("#workerUploadButton");
const statusEl = document.querySelector("#workerImageStatus");
const previewImage = document.querySelector("#workerPhotoPreview");
const previewPlaceholder = document.querySelector("#previewPlaceholder");
const previewName = document.querySelector("#previewName");
const previewSize = document.querySelector("#previewSize");
const imageList = document.querySelector("#workerImageList");
const imageCount = document.querySelector("#workerImageCount");

init();

function init() {
  populateWorkerOptions();
  fillWorkerName();
  renderRecords();
  loadServerRecords();

  workerIdInput.addEventListener("change", fillWorkerName);
  workerPhotoInput.addEventListener("change", updatePreview);
  form.addEventListener("submit", handleSubmit);
}

function populateWorkerOptions() {
  workerIdInput.innerHTML = Array.from({ length: WORKER_TOTAL }, (_, index) => {
    const id = index + 1;
    const label = workerNames[id] || `工人 ${String(id).padStart(2, "0")}`;
    return `<option value="${id}">${String(id).padStart(2, "0")} - ${escapeHtml(label)}</option>`;
  }).join("");
}

function fillWorkerName() {
  const id = workerIdInput.value;
  if (!workerNameInput.value.trim()) {
    workerNameInput.value = workerNames[id] || `工人 ${String(Number(id)).padStart(2, "0")}`;
  }
}

function updatePreview() {
  const file = workerPhotoInput.files?.[0];
  if (!file) {
    previewImage.removeAttribute("src");
    previewImage.classList.remove("is-visible");
    previewPlaceholder.classList.remove("is-hidden");
    previewName.textContent = "未选择文件";
    previewSize.textContent = "文件大小：-";
    setStatus("等待选择图片");
    return;
  }

  if (!file.type.startsWith("image/")) {
    setStatus("请选择图片文件", "error");
    workerPhotoInput.value = "";
    clearPreview();
    return;
  }

  if (file.size > MAX_IMAGE_SIZE) {
    setStatus("单张图片不能超过 20MB", "error");
    workerPhotoInput.value = "";
    clearPreview();
    return;
  }

  previewImage.src = URL.createObjectURL(file);
  previewImage.classList.add("is-visible");
  previewPlaceholder.classList.add("is-hidden");
  previewName.textContent = file.name;
  previewSize.textContent = `文件大小：${formatFileSize(file.size)}`;
  setStatus("图片已选择，可以上传", "ready");
}

async function handleSubmit(event) {
  event.preventDefault();
  const file = workerPhotoInput.files?.[0];
  if (!file) {
    setStatus("请先选择工人图片", "error");
    return;
  }
  if (!file.type.startsWith("image/")) {
    setStatus("只支持图片文件", "error");
    return;
  }
  if (file.size > MAX_IMAGE_SIZE) {
    setStatus("单张图片不能超过 20MB", "error");
    return;
  }

  uploadButton.disabled = true;
  uploadButton.textContent = "上传中";
  setStatus("正在上传图片", "busy");

  try {
    const record = await uploadToServer(file);
    serverRecords.unshift(record);
    resetFormAfterUpload();
    setStatus("上传成功，已保存到服务器", "success");
  } catch (error) {
    const record = await saveLocalRecord(file);
    localSessionRecords.unshift(record);
    resetFormAfterUpload();
    setStatus(record.localOnlyMessage || "服务器暂不可用，已暂存本机", "warning");
  } finally {
    uploadButton.disabled = false;
    uploadButton.textContent = "上传图片";
    renderRecords();
  }
}

async function uploadToServer(file) {
  const formData = new FormData();
  formData.append("workerId", workerIdInput.value);
  formData.append("workerName", workerNameInput.value.trim());
  formData.append("note", workerNoteInput.value.trim());
  formData.append("photo", file);

  const response = await fetch(`${apiBase}/api/worker-images`, {
    method: "POST",
    body: formData,
  });

  const payload = await safeJson(response);
  if (!response.ok) {
    throw new Error(payload?.error || "上传失败");
  }
  return payload;
}

async function loadServerRecords() {
  try {
    const response = await fetch(`${apiBase}/api/worker-images`, { cache: "no-store" });
    if (!response.ok) throw new Error("server unavailable");
    const payload = await response.json();
    serverRecords = Array.isArray(payload) ? payload : [];
    renderRecords();
  } catch {
    setStatus("服务器未连接时，上传会暂存在本机", "warning");
  }
}

async function saveLocalRecord(file) {
  const imageData = await fileToDataUrl(file);
  const record = {
    id: createId(),
    workerId: workerIdInput.value,
    workerName: workerNameInput.value.trim() || `工人 ${String(Number(workerIdInput.value)).padStart(2, "0")}`,
    note: workerNoteInput.value.trim(),
    image: {
      name: file.name,
      type: file.type,
      size: file.size,
      url: imageData,
    },
    local: true,
    time: new Date().toISOString(),
  };

  const localRecords = getLocalRecords();
  try {
    localStorage.setItem(WORKER_IMAGE_LOCAL_KEY, JSON.stringify([record, ...localRecords].slice(0, 18)));
  } catch {
    record.localOnlyMessage = "本机缓存空间不足，当前图片只在本次页面打开期间显示";
  }
  return record;
}

function resetFormAfterUpload() {
  const currentId = workerIdInput.value;
  form.reset();
  workerIdInput.value = currentId;
  fillWorkerName();
  updatePreview();
}

function clearPreview() {
  previewImage.removeAttribute("src");
  previewImage.classList.remove("is-visible");
  previewPlaceholder.classList.remove("is-hidden");
  previewName.textContent = "未选择文件";
  previewSize.textContent = "文件大小：-";
}

function renderRecords() {
  const records = [...localSessionRecords, ...getLocalRecords(), ...serverRecords]
    .filter((record, index, list) => list.findIndex((item) => item.id === record.id) === index)
    .slice(0, 60);

  imageCount.textContent = `${records.length} 条记录`;
  if (!records.length) {
    imageList.innerHTML = `<article class="worker-photo-empty">还没有上传记录</article>`;
    return;
  }

  imageList.innerHTML = records.map(renderRecordCard).join("");
}

function renderRecordCard(record) {
  const imageUrl = resolveImageUrl(record.image?.url || "");
  const time = record.time ? new Date(record.time).toLocaleString("zh-CN") : "未知时间";
  const tag = record.local ? "本机暂存" : "服务器";

  return `<article class="worker-photo-card">
    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(record.workerName || "工人图片")}" loading="lazy" />
    <div>
      <span class="photo-source ${record.local ? "local" : "server"}">${tag}</span>
      <h3>${escapeHtml(record.workerName || "未命名工人")}</h3>
      <p>编号：${escapeHtml(record.workerId || "-")}</p>
      <p>时间：${escapeHtml(time)}</p>
      ${record.note ? `<p>备注：${escapeHtml(record.note)}</p>` : ""}
    </div>
  </article>`;
}

function resolveImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("http")) return url;
  return `${apiBase}${url}`;
}

function setStatus(text, state = "idle") {
  statusEl.textContent = text;
  statusEl.className = `upload-status state-${state}`;
}

function getLocalRecords() {
  return readJson(WORKER_IMAGE_LOCAL_KEY, []);
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatFileSize(size) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
