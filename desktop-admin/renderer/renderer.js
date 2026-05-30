const apiBaseInput = document.querySelector("#apiBaseInput");
const adminKeyInput = document.querySelector("#adminKeyInput");
const loadButton = document.querySelector("#loadButton");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const urgencyFilter = document.querySelector("#urgencyFilter");
const exportCsvButton = document.querySelector("#exportCsvButton");
const exportJsonButton = document.querySelector("#exportJsonButton");
const feedbackTable = document.querySelector("#feedbackTable");
const connectionState = document.querySelector("#connectionState");

const totalCount = document.querySelector("#totalCount");
const pendingCount = document.querySelector("#pendingCount");
const urgentCount = document.querySelector("#urgentCount");
const callbackCount = document.querySelector("#callbackCount");

let feedback = [];

apiBaseInput.value = localStorage.getItem("adminApiBase") || "http://122.152.220.132";
adminKeyInput.value = localStorage.getItem("adminKey") || "";

loadButton.addEventListener("click", loadFeedback);
searchInput.addEventListener("input", render);
statusFilter.addEventListener("change", render);
urgencyFilter.addEventListener("change", render);
exportCsvButton.addEventListener("click", exportCsv);
exportJsonButton.addEventListener("click", exportJson);

async function loadFeedback() {
  const apiBase = normalizeApiBase();
  const adminKey = adminKeyInput.value.trim();
  if (!apiBase || !adminKey) {
    setConnection("error", "请填写服务器和密钥");
    return;
  }

  localStorage.setItem("adminApiBase", apiBase);
  localStorage.setItem("adminKey", adminKey);
  loadButton.disabled = true;
  loadButton.textContent = "读取中...";

  try {
    const response = await fetch(`${apiBase}/api/feedback?key=${encodeURIComponent(adminKey)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    feedback = await response.json();
    setConnection("ok", "已连接");
    render();
  } catch (error) {
    setConnection("error", "连接失败");
    feedbackTable.innerHTML = `<tr><td class="empty" colspan="9">读取失败：${escapeHtml(error.message)}</td></tr>`;
  } finally {
    loadButton.disabled = false;
    loadButton.textContent = "读取反馈";
  }
}

async function updateStatus(id, status) {
  const apiBase = normalizeApiBase();
  const adminKey = adminKeyInput.value.trim();
  try {
    const response = await fetch(`${apiBase}/api/feedback/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Key": adminKey,
      },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await loadFeedback();
  } catch (error) {
    setConnection("error", `更新失败：${error.message}`);
  }
}

function render() {
  renderStats();
  const list = getFilteredFeedback();
  if (list.length === 0) {
    feedbackTable.innerHTML = `<tr><td class="empty" colspan="11">暂无匹配的居民反馈</td></tr>`;
    return;
  }

  feedbackTable.innerHTML = list
    .map((item) => {
      const urgencyClass = item.urgency === "紧急" ? "danger" : item.urgency === "较急" ? "warning" : "normal";
      return `<tr>
        <td>${escapeHtml(item.type)}</td>
        <td><span class="badge ${urgencyClass}">${escapeHtml(item.urgency || "一般")}</span></td>
        <td>${escapeHtml(item.location || "未填写")}</td>
        <td>${escapeHtml(item.complaintAddress || item.location || "未填写")}</td>
        <td><div class="feedback-text">${escapeHtml(item.text || "")}</div></td>
        <td>${escapeHtml(item.contact || "未填写")}</td>
        <td>${renderAttachments(item.attachments)}</td>
        <td>${escapeHtml(item.callback || "未填写")}</td>
        <td>${escapeHtml(item.status || "待处理")}</td>
        <td>${formatTime(item.time)}</td>
        <td>
          <div class="row-actions">
            <select data-status="${escapeHtml(item.id)}">
              ${["待处理", "处理中", "已处理", "已回访"].map((status) => `<option value="${status}" ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}
            </select>
            <button type="button" data-update="${escapeHtml(item.id)}">更新</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  feedbackTable.querySelectorAll("[data-update]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.update;
      const select = feedbackTable.querySelector(`select[data-status="${CSS.escape(id)}"]`);
      updateStatus(id, select.value);
    });
  });
  feedbackTable.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => {
      window.desktopApi.openExternal(button.dataset.open);
    });
  });
}

function renderStats() {
  totalCount.textContent = feedback.length;
  pendingCount.textContent = feedback.filter((item) => item.status === "待处理").length;
  urgentCount.textContent = feedback.filter((item) => item.urgency === "紧急").length;
  callbackCount.textContent = feedback.filter((item) => item.callback === "需要回访").length;
}

function getFilteredFeedback() {
  const keyword = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const urgency = urgencyFilter.value;

  return feedback.filter((item) => {
    if (status && item.status !== status) return false;
    if (urgency && item.urgency !== urgency) return false;
    if (!keyword) return true;
    const haystack = [item.type, item.location, item.complaintAddress, item.text, item.contact, item.callback, item.status].join(" ").toLowerCase();
    return haystack.includes(keyword);
  });
}

async function exportCsv() {
  const list = getFilteredFeedback();
  const rows = [["类型", "紧急程度", "所在区域", "投诉地址", "反馈内容", "联系方式", "附件数量", "回访", "状态", "提交时间"]];
  list.forEach((item) => {
    rows.push([item.type, item.urgency, item.location, item.complaintAddress || item.location || "", item.text, item.contact || "", item.attachments?.length || 0, item.callback, item.status, formatTime(item.time)]);
  });
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  await window.desktopApi.saveFile({
    title: "导出居民反馈 CSV",
    defaultPath: `resident-feedback-${Date.now()}.csv`,
    filters: [{ name: "CSV", extensions: ["csv"] }],
    content: `\ufeff${csv}`,
  });
}

function renderAttachments(attachments = []) {
  if (!attachments.length) return "无";
  const apiBase = normalizeApiBase();
  return attachments
    .map((item, index) => {
      const href = item.url?.startsWith("http") ? item.url : `${apiBase}${item.url || ""}`;
      const title = escapeHtml(item.name || `附件 ${index + 1}`);
      const preview = item.type?.startsWith("image/")
        ? `<img src="${escapeHtml(href)}" alt="${title}" />`
        : item.type?.startsWith("video/")
          ? `<video src="${escapeHtml(href)}" controls preload="metadata"></video>`
          : "";
      return `<div class="attachment-preview">${preview}<button type="button" data-open="${escapeHtml(href)}">打开附件 ${index + 1}</button></div>`;
    })
    .join("");
}

async function exportJson() {
  await window.desktopApi.saveFile({
    title: "导出居民反馈 JSON",
    defaultPath: `resident-feedback-${Date.now()}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
    content: JSON.stringify(getFilteredFeedback(), null, 2),
  });
}

function normalizeApiBase() {
  return apiBaseInput.value.trim().replace(/\/$/, "");
}

function setConnection(type, text) {
  connectionState.className = `connection-state ${type}`;
  connectionState.lastChild.textContent = ` ${text}`;
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN");
}

function csvCell(value) {
  return `"${String(value || "").replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

renderStats();
