import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT || 4173);
const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "public");
const DATA_DIR = join(ROOT, "work", "data");
const DATA_FILE = join(DATA_DIR, "locations.json");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

async function ensureStore() {
  await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(DATA_FILE)) {
    await writeFile(DATA_FILE, JSON.stringify({ links: {}, checkIns: [] }, null, 2));
  }
}

async function readStore() {
  await ensureStore();
  return JSON.parse(await readFile(DATA_FILE, "utf8"));
}

async function writeStore(store) {
  await writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 100_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => resolve(body ? JSON.parse(body) : {}));
    req.on("error", reject);
  });
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "";
}

async function serveStatic(req, res, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(PUBLIC_DIR, requestedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    res.writeHead(200, {
      "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store"
    });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

async function handleApi(req, res, url) {
  if (req.method === "POST" && url.pathname === "/api/links") {
    const body = await getRequestBody(req);
    const label = String(body.label || "Location link").slice(0, 80);
    const id = randomUUID().slice(0, 8);
    const store = await readStore();
    store.links[id] = {
      id,
      label,
      createdAt: new Date().toISOString()
    };
    await writeStore(store);
    sendJson(res, 201, { link: store.links[id] });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/links") {
    const store = await readStore();
    sendJson(res, 200, { links: Object.values(store.links).reverse() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/checkins") {
    const store = await readStore();
    sendJson(res, 200, { checkIns: store.checkIns.slice().reverse() });
    return;
  }

  const linkMatch = url.pathname.match(/^\/api\/links\/([a-zA-Z0-9-]+)$/);
  if (req.method === "GET" && linkMatch) {
    const store = await readStore();
    const link = store.links[linkMatch[1]];
    sendJson(res, link ? 200 : 404, link ? { link } : { error: "Link not found" });
    return;
  }

  const checkInMatch = url.pathname.match(/^\/api\/links\/([a-zA-Z0-9-]+)\/checkins$/);
  if (req.method === "POST" && checkInMatch) {
    const body = await getRequestBody(req);
    const store = await readStore();
    const link = store.links[checkInMatch[1]];
    if (!link) {
      sendJson(res, 404, { error: "Link not found" });
      return;
    }

    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const accuracy = Number(body.accuracy);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      sendJson(res, 400, { error: "Coordinates are required" });
      return;
    }

    const checkIn = {
      id: randomUUID(),
      linkId: link.id,
      linkLabel: link.label,
      latitude,
      longitude,
      accuracy: Number.isFinite(accuracy) ? accuracy : null,
      userAgent: String(req.headers["user-agent"] || ""),
      ip: getClientIp(req),
      createdAt: new Date().toISOString()
    };
    store.checkIns.push(checkIn);
    await writeStore(store);
    sendJson(res, 201, { checkIn });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

await ensureStore();
server.listen(PORT, () => {
  console.log(`Location finder running at http://localhost:${PORT}`);
});
