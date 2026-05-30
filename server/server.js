import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "data");
const dataFile = join(dataDir, "feedback.json");
const publicDir = join(__dirname, "public");
const uploadDir = join(__dirname, "uploads");
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
      const { fields, attachments } = await readFeedbackBody(request);
      const feedback = normalizeFeedback(fields, attachments);
      const list = await readFeedback();
      list.unshift(feedback);
      await writeFeedback(list.slice(0, 1000));
      sendJson(response, 201, feedback);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/feedback/stats") {
      sendJson(response, 200, summarizeFeedback(await readFeedback()));
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

    if (request.method === "GET" && url.pathname.startsWith("/uploads/")) {
      const fileName = basename(decodeURIComponent(url.pathname.replace("/uploads/", "")));
      const file = await readFile(join(uploadDir, fileName));
      send(response, 200, file, getContentType(fileName));
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

async function readFeedbackBody(request) {
  const contentType = request.headers["content-type"] || "";
  if (!contentType.startsWith("multipart/form-data")) {
    return { fields: await readJsonBody(request), attachments: [] };
  }

  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  if (!boundaryMatch) throw Object.assign(new Error("缺少上传边界"), { statusCode: 400 });

  const raw = await readRawBody(request);
  return parseMultipart(raw, boundaryMatch[1] || boundaryMatch[2]);
}

async function readRawBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function parseMultipart(buffer, boundary) {
  const fields = {};
  const attachments = [];
  const delimiter = Buffer.from(`--${boundary}`);
  let cursor = 0;

  while (cursor < buffer.length) {
    const start = buffer.indexOf(delimiter, cursor);
    if (start === -1) break;
    const next = buffer.indexOf(delimiter, start + delimiter.length);
    if (next === -1) break;

    let part = buffer.subarray(start + delimiter.length, next);
    if (part.subarray(0, 2).toString() === "--") break;
    if (part.subarray(0, 2).toString() === "\r\n") part = part.subarray(2);
    if (part.subarray(part.length - 2).toString() === "\r\n") part = part.subarray(0, part.length - 2);

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd !== -1) {
      const headerText = part.subarray(0, headerEnd).toString("utf8");
      const content = part.subarray(headerEnd + 4);
      const disposition = headerText.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || "";
      const name = disposition.match(/name="([^"]+)"/)?.[1];
      const fileName = disposition.match(/filename="([^"]*)"/)?.[1];
      const fileType = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "application/octet-stream";

      if (fileName && content.length > 0) {
        if (attachments.length >= 3) throw Object.assign(new Error("最多上传 3 个文件"), { statusCode: 400 });
        if (content.length > 20 * 1024 * 1024) throw Object.assign(new Error("单个文件不能超过 20MB"), { statusCode: 400 });
        if (!isAllowedUpload(fileType, fileName)) {
          throw Object.assign(new Error("仅支持图片或视频附件"), { statusCode: 400 });
        }
        await mkdir(uploadDir, { recursive: true });
        const safeName = `${Date.now()}-${randomUUID()}${extname(fileName).slice(0, 12)}`;
        await writeFile(join(uploadDir, safeName), content);
        attachments.push({
          name: fileName,
          type: fileType,
          size: content.length,
          url: `/uploads/${safeName}`,
        });
      } else if (name) {
        fields[name] = content.toString("utf8");
      }
    }

    cursor = next;
  }

  return { fields, attachments };
}

function normalizeFeedback(input, attachments = []) {
  const feedback = {
    id: randomUUID(),
    type: requiredText(input.type, "反馈类型"),
    urgency: requiredText(input.urgency, "紧急程度"),
    location: requiredText(input.location, "所在位置"),
    complaintAddress: requiredText(input.complaintAddress || input.location, "投诉地址"),
    contact: optionalText(input.contact),
    callback: requiredText(input.callback, "是否需要回访"),
    text: requiredText(input.text, "反馈内容"),
    attachments,
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

function summarizeFeedback(list) {
  return {
    total: list.length,
    pending: list.filter((item) => (item.status || "待处理") === "待处理").length,
    processing: list.filter((item) => item.status === "处理中").length,
    processed: list.filter((item) => item.status === "已处理" || item.status === "已回访").length,
    urgent: list.filter((item) => item.urgency === "紧急").length,
    callback: list.filter((item) => item.callback === "需要回访").length,
  };
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

function getContentType(fileName) {
  const ext = extname(fileName).toLowerCase();
  if ([".jpg", ".jpeg"].includes(ext)) return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  return "application/octet-stream";
}

function isAllowedUpload(fileType, fileName) {
  if (fileType.startsWith("image/") || fileType.startsWith("video/")) return true;
  const ext = extname(fileName).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm", ".mov"].includes(ext);
}
