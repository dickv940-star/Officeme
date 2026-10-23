(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const connect = $("metricoolMcpConnect");
  const refresh = $("metricoolMcpRefresh");
  const status = $("metricoolMcpStatus");
  const tools = $("metricoolMcpTools");
  if (!connect || !status) return;

  function backend() {
    const raw = ($("geminiCsvWorkerUrl")?.value || "").trim();
    const token = ($("geminiCsvToken")?.value || "").trim();
    let url;
    try { url = new URL(raw); } catch (_) { throw new Error("Masukkan URL backend Cloudflare yang valid."); }
    if (url.protocol !== "https:" || !url.hostname.endsWith(".workers.dev") || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
      throw new Error("URL backend harus berupa alamat HTTPS Cloudflare Worker yang valid.");
    }
    if (!token) throw new Error("Masukkan APP_SHARED_TOKEN di panel konfigurasi backend terlebih dahulu.");
    return { base: url.origin, token };
  }
  async function api(path, options = {}) {
    const cfg = backend();
    const response = await fetch(cfg.base + path, {
      ...options,
      headers: { "Authorization": "Bearer " + cfg.token, "Content-Type": "application/json", ...(options.headers || {}) },
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || ("Backend merespons HTTP " + response.status));
    return data;
  }
  function setStatus(message, kind = "info") {
    status.textContent = message;
    status.dataset.state = kind;
  }
  async function refreshStatus() {
    if (refresh) refresh.disabled = true;
    setStatus("Memeriksa status OfficeMe ↔ Metricool MCP…");
    if (tools) { tools.hidden = true; tools.textContent = ""; }
    try {
      const data = await api("/api/integrations/metricool/status");
      if (data.connected && data.verified) {
        setStatus("TERHUBUNG dan terverifikasi. OfficeMe berhasil mengakses Metricool MCP. Alat tersedia: " + (data.toolCount ?? data.tools?.length ?? 0) + ". Belum ada posting yang dibuat atau diterbitkan.", "success");
        if (tools) {
          const lines = ["Alat Metricool yang terdeteksi:"];
          (data.tools || []).forEach((item) => lines.push("• " + item.name + (item.description ? " — " + item.description : "")));
          if (data.brands) lines.push("", "Ringkasan brand (hasil MCP):", JSON.stringify(data.brands, null, 2));
          tools.textContent = lines.join("\n");
          tools.style.whiteSpace = "pre-wrap";
          tools.hidden = false;
        }
      } else if (data.blockers?.length) {
        setStatus("Belum terhubung: " + data.blockers.join(" "), "info");
      } else {
        setStatus("Status belum dapat diverifikasi.", "error");
      }
    } catch (error) {
      setStatus("Pemeriksaan gagal: " + (error.message || "kesalahan koneksi"), "error");
    } finally {
      if (refresh) refresh.disabled = false;
    }
  }
  connect.addEventListener("click", async () => {
    connect.disabled = true;
    setStatus("Menyiapkan otorisasi OAuth Metricool…");
    try {
      const data = await api("/api/integrations/metricool/start", { method: "POST", body: "{}" });
      if (!data.authorizationUrl || !data.authorizationUrl.startsWith("https://")) throw new Error("URL otorisasi Metricool tidak valid.");
      setStatus("Membuka halaman resmi Metricool. Login dan setujui akses untuk menyelesaikan koneksi.");
      window.location.assign(data.authorizationUrl);
    } catch (error) {
      setStatus("Koneksi belum dimulai: " + (error.message || "kesalahan otorisasi"), "error");
      connect.disabled = false;
    }
  });
  if (refresh) refresh.addEventListener("click", refreshStatus);

  const query = new URLSearchParams(window.location.search);
  if (query.get("platform") === "metricool" && query.has("integration")) {
    const outcome = query.get("integration");
    const messages = {
      success: "Otorisasi Metricool selesai. Memverifikasi koneksi MCP…",
      denied: "Otorisasi dibatalkan di halaman Metricool.",
      expired: "Permintaan otorisasi kedaluwarsa. Tekan Hubungkan Metricool lagi.",
      invalid_state: "State OAuth tidak valid. Demi keamanan, mulai koneksi ulang.",
      oauth_discovery_failed: "Metadata OAuth Metricool tidak ditemukan oleh backend.",
      oauth_registration_failed: "Metricool tidak menerima pendaftaran OAuth otomatis OfficeMe.",
      permission_denied: "Metricool menolak izin yang diminta.",
      reauthorization_required: "Sesi otorisasi perlu diulang.",
      authorization_failed: "Otorisasi gagal. Coba lagi; jangan kirim token rahasia ke chat."
    };
    setStatus(messages[outcome] || "Status otorisasi: " + outcome, outcome === "success" ? "success" : "info");
    window.history.replaceState({}, document.title, window.location.pathname);
    if (outcome === "success") void refreshStatus();
  } else {
    void refreshStatus();
  }
})();