const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const MAX_BODY_BYTES = 80 * 1024;
const MAX_PRODUCTS = 30;

function json(data, status = 200, origin = "") {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin"
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGIN || "").trim();
  if (!origin) return { ok: true, origin: "" };
  return { ok: Boolean(allowed) && origin === allowed, origin: origin === allowed ? origin : "" };
}

async function readLimitedBody(request, maxBytes) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      const error = new Error("Ukuran permintaan terlalu besar.");
      error.status = 413;
      throw error;
    }
    chunks.push(part.value);
  }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

function safeString(value, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}
function number(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
async function constantTimeEqual(a, b) {
  const encoder = new TextEncoder();
  const ha = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(a)));
  const hb = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(b)));
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}
async function authOk(request, env) {
  const secret = String(env.APP_SHARED_TOKEN || "");
  const match = (request.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!secret || !match) return false;
  return constantTimeEqual(match[1].trim(), secret);
}
function validatePayload(input) {
  if (!input || typeof input !== "object") throw new Error("Format permintaan tidak valid.");
  const m = input.metrics || {};
  const metrics = {
    productCount: number(m.productCount),
    clicks: number(m.clicks),
    orders: number(m.orders),
    commission: number(m.commission),
    conversionRate: number(m.conversionRate)
  };
  if (Object.values(metrics).some((v) => v === null)) throw new Error("Metrik wajib berupa angka nol atau lebih.");
  if (!Array.isArray(input.products) || input.products.length < 1 || input.products.length > MAX_PRODUCTS) {
    throw new Error("Kirim 1 sampai " + MAX_PRODUCTS + " produk teratas.");
  }
  const products = input.products.map((item) => {
    const name = safeString(item?.name, 80);
    const clicks = number(item?.clicks);
    const orders = number(item?.orders);
    const commission = number(item?.commission);
    if (!name || clicks === null || orders === null || commission === null) throw new Error("Ada data produk yang kosong atau tidak valid.");
    return { name, clicks, orders, commission };
  });
  return { metrics, products };
}

export default {
  async fetch(request, env) {
    const cors = allowedOrigin(request, env);
    if (!cors.ok) return json({ ok: false, error: "Origin tidak diizinkan." }, 403);
    if (request.method === "OPTIONS") {
      if (!cors.origin) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": cors.origin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "officeme-w001-gemini-test",
        configured: { geminiApiKey: Boolean(env.GEMINI_API_KEY), appSharedToken: Boolean(env.APP_SHARED_TOKEN) },
        model: env.GEMINI_MODEL || DEFAULT_MODEL
      }, 200, cors.origin);
    }
    if (request.method !== "POST" || url.pathname !== "/v1/w001/analyze") {
      return json({ ok: false, error: "Endpoint tidak ditemukan." }, 404, cors.origin);
    }
    if (!env.GEMINI_API_KEY || !env.APP_SHARED_TOKEN) {
      return json({ ok: false, error: "Backend belum dikonfigurasi. Tambahkan GEMINI_API_KEY dan APP_SHARED_TOKEN sebagai Secret." }, 503, cors.origin);
    }
    if (!(await authOk(request, env))) return json({ ok: false, error: "Token akses tidak valid." }, 401, cors.origin);

    let payload;
    try {
      payload = validatePayload(JSON.parse(await readLimitedBody(request, MAX_BODY_BYTES)));
    } catch (error) {
      return json({ ok: false, error: error?.status === 413 ? error.message : (error?.message || "JSON tidak valid.") }, error?.status || 400, cors.origin);
    }
    const model = safeString(env.GEMINI_MODEL || DEFAULT_MODEL, 80);
    if (!/^[a-zA-Z0-9._-]+$/.test(model)) return json({ ok: false, error: "Nama model tidak valid." }, 500, cors.origin);

    const prompt = [
      "Kamu adalah W001, Data Analyst untuk Shopee Affiliate Indonesia.",
      "Analisis hanya berdasarkan angka yang diberikan. Jangan mengarang data, tren pasar, harga, atau penyebab yang tidak ada di data.",
      "Bedakan fakta, dugaan, dan rekomendasi. Sebutkan keterbatasan data jika ada.",
      "Gunakan bahasa Indonesia yang ringkas. Susun bagian: Ringkasan, Temuan, Rekomendasi Prioritas, Data yang Perlu Diperiksa.",
      "Jangan melakukan tindakan eksternal, jangan mengklaim telah membuka Shopee, dan jangan meminta kredensial akun.",
      "Metrik agregat: " + JSON.stringify(payload.metrics),
      "Produk terpilih: " + JSON.stringify(payload.products)
    ].join("\n\n");

    let upstream;
    try {
      upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 800 }
        }),
        signal: AbortSignal.timeout(20000)
      });
    } catch {
      return json({ ok: false, error: "Tidak dapat menghubungi Gemini API. Coba lagi nanti." }, 502, cors.origin);
    }
    if (!upstream.ok) {
      if (upstream.status === 429) return json({ ok: false, error: "Kuota atau batas laju Gemini tercapai. Periksa kuota Google AI Studio." }, 429, cors.origin);
      if (upstream.status === 401 || upstream.status === 403) return json({ ok: false, error: "Gemini menolak API key atau izin proyek. Periksa Secret GEMINI_API_KEY." }, 502, cors.origin);
      return json({ ok: false, error: "Gemini API mengembalikan HTTP " + upstream.status + "." }, 502, cors.origin);
    }
    let result;
    try { result = await upstream.json(); }
    catch { return json({ ok: false, error: "Respons Gemini tidak dapat dibaca." }, 502, cors.origin); }
    const analysis = (result?.candidates?.[0]?.content?.parts || [])
      .map((part) => typeof part.text === "string" ? part.text : "").join("\n").trim();
    if (!analysis) return json({ ok: false, error: "Gemini tidak mengembalikan teks analisis." }, 502, cors.origin);
    return json({ ok: true, model, analysis, metrics: payload.metrics, productsAnalyzed: payload.products.length }, 200, cors.origin);
  }
};
