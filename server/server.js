import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "data");
const dataFile = join(dataDir, "feedback.json");
const publicDir = join(__dirname, "public");
const port = Number(process.env.PORT || 3000);
const adminKey = process.env.ADMIN_KEY || "change-this-admin-key";
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

const server = createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      send(response, 204, "");
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/feedback") {
      const body = await readJsonBody(request);
      const feedback = normalizeFeedback(body);
      const list = await readFeedback();
      list.unshift(feedback);
      await writeFeedback(list.slice(0, 1000));
      sendJson(response, 201, feedback);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/feedback") {
      if (!isAdmin(request, url)) {
        sendJson(response, 401, { error: "需要管理员密钥" });
        return;
      }
      sendJson(response, 200, await readFeedback());
      return;
    }

    if (request.method === "PATCH" && url.pathname.startsWith("/api/feedback/")) {
      if (!isAdmin(request, url)) {
        sendJson(response, 401, { error: "需要管理员密钥" });
        return;
      }
      const id = decodeURIComponent(url.pathname.split("/").pop());
      const body = await readJsonBody(request);
      const nextStatus = String(body.status || "").trim();
      if (!["待处理", "处理中", "已处理", "已回访"].includes(nextStatus)) {
        sendJson(response, 400, { error: "无效的处理状态" });
        return;
      }
      const list = await readFeedback();
      const item = list.find((entry) => entry.id === id);
      if (!item) {
        sendJson(response, 404, { error: "未找到反馈记录" });
        return;
      }
      item.status = nextStatus;
      item.updatedAt = new Date().toISOString();
      await writeFeedback(list);
      sendJson(response, 200, item);
      return;
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/admin")) {
      const html = await readFile(join(publicDir, "admin.html"), "utf8");
      send(response, 200, html, "text/html; charset=utf-8");
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    sendJson(response, error.statusCode || 500, { error: error.message || "服务器内部错误" });
  }
});

server.listen(port, () => {
  console.log(`Feedback server is running at http://localhost:${port}`);
});

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function normalizeFeedback(input) {
  const feedback = {
    id: randomUUID(),
    type: requiredText(input.type, "反馈类型"),
    urgency: requiredText(input.urgency, "紧急程度"),
    location: requiredText(input.location, "所在位置"),
    contact: optionalText(input.contact),
    callback: requiredText(input.callback, "是否需要回访"),
    text: requiredText(input.text, "反馈内容"),
    status: "待处理",
    time: new Date().toISOString(),
  };

  if (!["一般", "较急", "紧急"].includes(feedback.urgency)) {
    throw Object.assign(new Error("无效的紧急程度"), { statusCode: 400 });
  }

  return feedback;
}

function requiredText(value, label) {
  const text = optionalText(value);
  if (!text) {
    throw Object.assign(new Error(`${label}不能为空`), { statusCode: 400 });
  }
  return text;
}

function optionalText(value) {
  return String(value || "").trim().slice(0, 500);
}

async function readFeedback() {
  try {
    const raw = await readFile(dataFile, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeFeedback(list) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, JSON.stringify(list, null, 2), "utf8");
}

function isAdmin(request, url) {
  const key = request.headers["x-admin-key"] || url.searchParams.get("key");
  return key === adminKey;
}

function sendJson(response, statusCode, payload) {
  send(response, statusCode, JSON.stringify(payload), "application/json; charset=utf-8");
}

function send(response, statusCode, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-Admin-Key",
  });
  response.end(body);
}
