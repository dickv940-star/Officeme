/**
 * Append-only W001 backend for an EXISTING AI AFFILIATE Apps Script project.
 *
 * IMPORTANT:
 * - Do NOT replace the existing Code.gs with this file.
 * - Do NOT copy the standalone Code.gs too; it defines a separate doGet().
 * - Add this as a separate Apps Script file named ExistingProjectBackend.gs.
 * - Then add the small Bridge route to the existing doGet(e), as documented.
 * - Existing access logs/email notices and Index.html remain in place.
 *
 * Script Properties required:
 *   GEMINI_API_KEY
 *   APP_SHARED_TOKEN (long random secret; never put in GitHub)
 * Optional:
 *   ALLOWED_ORIGIN = https://dickv940-star.github.io
 *   GEMINI_MODEL = gemini-2.5-flash
 */
const W001_DEFAULT_MODEL = "gemini-2.5-flash";
const W001_MAX_PRODUCTS = 30;

function handleW001Request(input) {
  try {
    const props = PropertiesService.getScriptProperties();
    const apiKey = props.getProperty("GEMINI_API_KEY") || "";
    const sharedToken = props.getProperty("APP_SHARED_TOKEN") || "";
    const allowedOrigin = (props.getProperty("ALLOWED_ORIGIN") || "https://dickv940-star.github.io").trim();

    if (!input || typeof input !== "object") return w001Fail_("Format permintaan tidak valid.");
    if (String(input.origin || "") !== allowedOrigin) return w001Fail_("Origin tidak diizinkan.");
    if (!sharedToken || !apiKey) {
      return { ok: false, error: "Backend belum dikonfigurasi. Tambahkan GEMINI_API_KEY dan APP_SHARED_TOKEN di Script Properties." };
    }
    if (!w001ConstantTimeEqual_(String(input.token || ""), sharedToken)) {
      return { ok: false, error: "Token akses tidak valid." };
    }

    if (input.action === "health") {
      return {
        ok: true,
        service: "officeme-w001-gemini-apps-script",
        configured: { geminiApiKey: Boolean(apiKey), appSharedToken: Boolean(sharedToken) },
        model: props.getProperty("GEMINI_MODEL") || W001_DEFAULT_MODEL
      };
    }
    if (input.action !== "analyze") return w001Fail_("Aksi tidak dikenal.");

    const payload = w001ValidatePayload_(input.payload);
    const model = (props.getProperty("GEMINI_MODEL") || W001_DEFAULT_MODEL).trim();
    if (!/^[a-zA-Z0-9._-]+$/.test(model)) return w001Fail_("Nama model tidak valid.");

    const prompt = [
      "Kamu adalah W001, Data Analyst untuk Shopee Affiliate Indonesia.",
      "Analisis hanya berdasarkan angka yang diberikan. Jangan mengarang tren pasar, harga, atau penyebab yang tidak ada dalam data.",
      "Bedakan fakta, dugaan, dan rekomendasi. Sebutkan keterbatasan data jika relevan.",
      "Gunakan bahasa Indonesia yang ringkas dan praktis.",
      "Susun bagian: Ringkasan, Temuan, Rekomendasi Prioritas, dan Data yang Perlu Diperiksa.",
      "Jangan melakukan tindakan eksternal, jangan mengklaim telah membuka Shopee, dan jangan meminta kredensial akun.",
      "Metrik agregat: " + JSON.stringify(payload.metrics),
      "Produk terpilih: " + JSON.stringify(payload.products)
    ].join("\n\n");

    const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) + ":generateContent";
    let response;
    try {
      response = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        headers: { "x-goog-api-key": apiKey },
        payload: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 800 }
        }),
        muteHttpExceptions: true
      });
    } catch (err) {
      return { ok: false, error: "Tidak dapat menghubungi Gemini API. Periksa izin UrlFetch dan coba lagi." };
    }

    const status = response.getResponseCode();
    if (status < 200 || status >= 300) {
      if (status === 429) return { ok: false, error: "Kuota atau batas laju Gemini tercapai. Periksa kuota Google AI Studio." };
      if (status === 400 || status === 401 || status === 403) {
        return { ok: false, error: "Gemini menolak permintaan atau API key/izin proyek. Periksa Script Property GEMINI_API_KEY dan model." };
      }
      return { ok: false, error: "Gemini API mengembalikan HTTP " + status + "." };
    }

    let result;
    try { result = JSON.parse(response.getContentText()); }
    catch (err) { return { ok: false, error: "Respons Gemini tidak dapat dibaca." }; }
    const parts = result && result.candidates && result.candidates[0] &&
      result.candidates[0].content && result.candidates[0].content.parts || [];
    const analysis = parts.map(function(part) {
      return typeof part.text === "string" ? part.text : "";
    }).join("\n").trim();
    if (!analysis) return { ok: false, error: "Gemini tidak mengembalikan teks analisis." };

    return { ok: true, model: model, analysis: analysis, metrics: payload.metrics, productsAnalyzed: payload.products.length };
  } catch (err) {
    console.error("W001 request failed: " + String(err && err.message || err));
    return { ok: false, error: String(err && err.message || "Permintaan W001 gagal.") };
  }
}

function w001ValidatePayload_(input) {
  if (!input || typeof input !== "object") throw new Error("Format data tidak valid.");
  const m = input.metrics || {};
  const metrics = {
    productCount: w001NonNegativeNumber_(m.productCount),
    clicks: w001NonNegativeNumber_(m.clicks),
    orders: w001NonNegativeNumber_(m.orders),
    commission: w001NonNegativeNumber_(m.commission),
    conversionRate: w001NonNegativeNumber_(m.conversionRate)
  };
  Object.keys(metrics).forEach(function(key) {
    if (metrics[key] === null) throw new Error("Metrik " + key + " wajib berupa angka nol atau lebih.");
  });
  if (!Array.isArray(input.products) || input.products.length < 1 || input.products.length > W001_MAX_PRODUCTS) {
    throw new Error("Kirim 1 sampai " + W001_MAX_PRODUCTS + " produk teratas.");
  }
  const products = input.products.map(function(p) {
    const name = String(p && p.name || "").trim().slice(0, 80);
    const clicks = w001NonNegativeNumber_(p && p.clicks);
    const orders = w001NonNegativeNumber_(p && p.orders);
    const commission = w001NonNegativeNumber_(p && p.commission);
    if (!name || clicks === null || orders === null || commission === null) {
      throw new Error("Ada data produk yang kosong atau tidak valid.");
    }
    return { name: name, clicks: clicks, orders: orders, commission: commission };
  });
  return { metrics: metrics, products: products };
}
function w001NonNegativeNumber_(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function w001ConstantTimeEqual_(a, b) {
  if (!a || !b) return false;
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) diff |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0);
  return diff === 0;
}
function w001Fail_(message) { return { ok: false, error: message }; }
