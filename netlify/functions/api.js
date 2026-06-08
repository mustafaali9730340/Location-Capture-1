import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "location-finder";
const DATA_KEY = "locations";

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store"
    }
  });
}

function getApiPath(url) {
  const path = url.pathname
    .replace(/^\/\.netlify\/functions\/api/, "")
    .replace(/^\/api/, "");
  return path || "/";
}

function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("client-ip") || "";
}

function adminTokenRequired() {
  return Boolean(process.env.ADMIN_TOKEN && process.env.ADMIN_TOKEN.trim());
}

function isAdmin(request) {
  if (!adminTokenRequired()) return true;
  return request.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;
}

function requireAdmin(request) {
  if (isAdmin(request)) return null;
  return json({ error: "Admin password required" }, 401);
}

async function readStore() {
  const store = getStore(STORE_NAME);
  const data = await store.get(DATA_KEY, {
    type: "json",
    consistency: "strong"
  });
  return data || { links: {}, checkIns: [] };
}

async function writeStore(data) {
  const store = getStore(STORE_NAME);
  await store.setJSON(DATA_KEY, data);
}

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const apiPath = getApiPath(url);
    const method = request.method;

    if (method === "GET" && apiPath === "/links") {
      const blocked = requireAdmin(request);
      if (blocked) return blocked;

      const data = await readStore();
      return json({ links: Object.values(data.links).reverse() });
    }

    if (method === "POST" && apiPath === "/links") {
      const blocked = requireAdmin(request);
      if (blocked) return blocked;

      const body = await request.json().catch(() => ({}));
      const label = String(body.label || "Location link").slice(0, 80);
      const id = randomUUID().slice(0, 8);
      const data = await readStore();
      data.links[id] = {
        id,
        label,
        createdAt: new Date().toISOString()
      };
      await writeStore(data);
      return json({ link: data.links[id] }, 201);
    }

    if (method === "GET" && apiPath === "/checkins") {
      const blocked = requireAdmin(request);
      if (blocked) return blocked;

      const data = await readStore();
      return json({ checkIns: data.checkIns.slice().reverse() });
    }

    const linkMatch = apiPath.match(/^\/links\/([a-zA-Z0-9-]+)$/);
    if (method === "GET" && linkMatch) {
      const data = await readStore();
      const link = data.links[linkMatch[1]];
      return link ? json({ link }) : json({ error: "Link not found" }, 404);
    }

    const checkInMatch = apiPath.match(/^\/links\/([a-zA-Z0-9-]+)\/checkins$/);
    if (method === "POST" && checkInMatch) {
      const body = await request.json().catch(() => ({}));
      const data = await readStore();
      const link = data.links[checkInMatch[1]];
      if (!link) return json({ error: "Link not found" }, 404);

      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);
      const accuracy = Number(body.accuracy);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return json({ error: "Coordinates are required" }, 400);
      }

      const checkIn = {
        id: randomUUID(),
        linkId: link.id,
        linkLabel: link.label,
        latitude,
        longitude,
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
        userAgent: request.headers.get("user-agent") || "",
        ip: getClientIp(request),
        createdAt: new Date().toISOString()
      };
      data.checkIns.push(checkIn);
      await writeStore(data);
      return json({ checkIn }, 201);
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    return json({ error: error.message || "Server error" }, 500);
  }
}
