const AGENTS = {
  alexander: {
    name: "Alexander",
    role: "Lead Data Analyst",
    brief: "Analyze only provided affiliate data. Calculate or interpret clicks, orders, conversion, commission, EPC and anomalies when inputs support them. Never invent missing values. State formulas and data limitations."
  },
  olivia: {
    name: "Olivia",
    role: "Senior Product Researcher",
    brief: "Assess product opportunities using only supplied evidence. Compare product performance, audience fit, risks and evidence gaps. Do not claim live prices, reviews or trends unless supplied."
  },
  ethan: {
    name: "Ethan",
    role: "Growth & Affiliate Strategist",
    brief: "Create measurable affiliate growth strategies, audience segments, campaign hypotheses and low-risk experiments. Tie recommendations to supplied data and define success metrics."
  },
  sophia: {
    name: "Sophia",
    role: "Senior Content Producer",
    brief: "Create platform-appropriate hooks, scripts, captions and calls to action. Do not invent product claims. Include clear affiliate disclosure when drafting promotional content."
  },
  daniel: {
    name: "Daniel",
    role: "SEO & Discovery Specialist",
    brief: "Develop search intent, keyword clusters, titles, descriptions and content outlines. Clearly label keyword ideas as hypotheses unless actual search-volume data is supplied."
  },
  isabella: {
    name: "Isabella",
    role: "Lead Visual Designer",
    brief: "Produce practical creative direction for affiliate assets: composition, hierarchy, aspect ratio, mobile readability, accessibility and brand consistency. Do not claim to have created an image file."
  },
  lucas: {
    name: "Lucas",
    role: "Automation & Integration Engineer",
    brief: "Design safe, testable workflows and API integration plans. Validate inputs, keep credentials server-side, add logging and failure handling. Never ask for secrets in chat or expose them."
  },
  charlotte: {
    name: "Charlotte",
    role: "Quality & Compliance Lead",
    brief: "Audit the supplied work for factual support, unsupported claims, privacy, security, affiliate disclosure and policy risks. Return PASS or NEEDS REVISION with concrete issues."
  }
};

const TEAM_ORDER = ["alexander", "olivia", "ethan", "sophia", "daniel", "isabella", "lucas"];

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, headers || {})
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const configured = String(env.ALLOWED_ORIGINS || "https://dickv940-star.github.io").split(",").map(x => x.trim()).filter(Boolean);
  const headers = { "Vary": "Origin", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "86400" };
  if (origin && configured.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return { origin, allowed: !origin || configured.includes(origin), headers };
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function askOpenAI(env, agent, task, context, extraInstructions) {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY belum dikonfigurasi sebagai secret backend.");
  const model = String(env.OPENAI_MODEL || "gpt-4.1-mini").trim();
  const instructions = [
    "Anda adalah agen AI khusus untuk aplikasi Shopee Affiliate berbahasa Indonesia.",
    "Nama agen: " + agent.name + ". Peran: " + agent.role + ".",
    agent.brief,
    "Aturan: gunakan hanya fakta dari tugas dan konteks yang diberikan; pisahkan fakta, asumsi, dan rekomendasi; jika data tidak cukup, nyatakan dengan jelas; jangan mengaku sudah menjalankan tindakan eksternal; jangan meminta atau mengeluarkan API key, password, cookie, atau token.",
    "Jawab dalam Bahasa Indonesia yang jelas, terstruktur, dan dapat ditindaklanjuti.",
    extraInstructions || ""
  ].filter(Boolean).join("\n");
  const input = "TUGAS:\n" + task + "\n\nKONTEKS / DATA YANG DISEDIAKAN PENGGUNA:\n" + (context || "(Tidak ada konteks tambahan)");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ model, instructions, input, max_output_tokens: 1100, store: false })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const upstreamMessage = payload && payload.error && payload.error.message;
    throw new Error("OpenAI API menolak permintaan (HTTP " + response.status + ")" + (upstreamMessage ? ": " + String(upstreamMessage).slice(0, 240) : ""));
  }
  let output = typeof payload.output_text === "string" ? payload.output_text.trim() : "";
  if (!output && Array.isArray(payload.output)) {
    output = payload.output.flatMap(item => Array.isArray(item.content) ? item.content : []).filter(item => item.type === "output_text").map(item => item.text || "").join("\n").trim();
  }
  if (!output) throw new Error("Model tidak mengembalikan teks analisis.");
  return { agentId: Object.keys(AGENTS).find(key => AGENTS[key] === agent) || "agent", name: agent.name, role: agent.role, output };
}

async function handleAgentRun(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!env.APP_SHARED_TOKEN || !safeEqual(token, env.APP_SHARED_TOKEN)) {
    return json({ ok: false, error: "Akses ditolak. Periksa token backend." }, 401);
  }
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 30000) return json({ ok: false, error: "Permintaan terlalu besar. Batasi konteks." }, 413);
  let body;
  try { body = await request.json(); } catch (_) { return json({ ok: false, error: "Body harus berupa JSON yang valid." }, 400); }
  const task = typeof body.task === "string" ? body.task.trim() : "";
  const context = typeof body.context === "string" ? body.context.trim() : "";
  const mode = body.mode === "team" ? "team" : "single";
  const agentId = typeof body.agentId === "string" ? body.agentId : "";
  if (!task || task.length > 1200) return json({ ok: false, error: "Tugas wajib diisi dan maksimal 1.200 karakter." }, 400);
  if (context.length > 12000) return json({ ok: false, error: "Konteks maksimal 12.000 karakter." }, 400);
  if (mode === "single" && !Object.prototype.hasOwnProperty.call(AGENTS, agentId)) {
    return json({ ok: false, error: "Pilih agen yang valid." }, 400);
  }
  if (!env.OPENAI_API_KEY) return json({ ok: false, error: "Backend belum dikonfigurasi: secret OPENAI_API_KEY belum tersedia." }, 503);

  try {
    if (mode === "single") {
      const result = await askOpenAI(env, AGENTS[agentId], task, context);
      return json({ ok: true, mode, model: env.OPENAI_MODEL || "gpt-4.1-mini", results: [result], completed: 1 });
    }
    const specialistResults = await Promise.all(TEAM_ORDER.map(id => askOpenAI(env, AGENTS[id], task, context)));
    const teamContext = specialistResults.map(result => "## " + result.name + " — " + result.role + "\n" + result.output).join("\n\n");
    const qaTask = "Tinjau hasil tujuh spesialis untuk tugas direktur berikut: " + task + ". Gabungkan hasil yang saling melengkapi, tandai perbedaan atau asumsi yang belum terbukti, dan berikan prioritas tindakan. Jangan mengubah asumsi menjadi fakta.";
    const finalReview = await askOpenAI(env, AGENTS.charlotte, qaTask, context + "\n\nHASIL SPESIALIS:\n" + teamContext, "Anda adalah gerbang QA akhir. Awali dengan status LULUS atau PERLU REVISI, lalu berikan ringkasan eksekutif, rekomendasi prioritas, keterbatasan bukti, dan langkah berikutnya. Tidak ada tindakan eksternal yang dijalankan.");
    return json({ ok: true, mode, model: env.OPENAI_MODEL || "gpt-4.1-mini", results: specialistResults, supervisor: finalReview, completed: 8 });
  } catch (error) {
    return json({ ok: false, error: String(error && error.message || "Analisis AI gagal").slice(0, 500) }, 502);
  }
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") {
      if (!cors.allowed) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors.headers });
    }
    if (!cors.allowed) return json({ ok: false, error: "Origin tidak diizinkan." }, 403, cors.headers);
    const url = new URL(request.url);
    const headers = cors.headers;
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "AppDIGI Multi-Agent Affiliate", model: env.OPENAI_MODEL || "gpt-4.1-mini", openAIConfigured: Boolean(env.OPENAI_API_KEY), authConfigured: Boolean(env.APP_SHARED_TOKEN) }, 200, headers);
    }
    if (request.method === "POST" && url.pathname === "/api/agents/run") {
      const response = await handleAgentRun(request, env);
      const mergedHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(headers)) mergedHeaders.set(key, value);
      return new Response(response.body, { status: response.status, headers: mergedHeaders });
    }
    return json({ ok: false, error: "Endpoint tidak ditemukan." }, 404, headers);
  }
};
