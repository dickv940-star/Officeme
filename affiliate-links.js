(() => {
  "use strict";
  const STORAGE_KEY = "officeme.shopeeAffiliateLinks.v1";
  const $ = (id) => document.getElementById(id);
  const form = $("affiliateLinkForm");
  if (!form) return;
  const nameInput = $("affiliateLinkName");
  const urlInput = $("affiliateLinkUrl");
  const campaignInput = $("affiliateLinkCampaign");
  const platformInput = $("affiliateLinkPlatform");
  const status = $("affiliateLinkStatus");
  const list = $("affiliateLinkList");
  const count = $("affiliateLinkCount");
  const exportButton = $("affiliateLinkExport");
  const clearButton = $("affiliateLinkClear");
  let links = load();
  if (nameInput) {
    nameInput.required = false;
    nameInput.placeholder = "Opsional — AI akan mencoba menemukan nama produk";
    const nameLabel = form.querySelector('label[for="affiliateLinkName"]');
    if (nameLabel) nameLabel.textContent = "Nama produk (opsional)";
  }
  const researchPanel = document.createElement("div");
  researchPanel.className = "gemini-csv-result";
  researchPanel.hidden = true;
  researchPanel.setAttribute("aria-live", "polite");
  const researchHeading = document.createElement("strong");
  researchHeading.textContent = "Hasil riset AI";
  const researchBody = document.createElement("div");
  researchBody.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere;margin-top:8px;line-height:1.65";
  const researchSources = document.createElement("div");
  researchSources.style.cssText = "display:grid;gap:6px;margin-top:10px";
  researchPanel.append(researchHeading, researchBody, researchSources);
  list.parentNode.insertBefore(researchPanel, list);

  const workflowPanel = document.createElement("section");
  workflowPanel.className = "gemini-csv-result";
  workflowPanel.hidden = true;
  workflowPanel.setAttribute("aria-live", "polite");
  workflowPanel.style.marginTop = "12px";
  const workflowHeading = document.createElement("strong");
  workflowHeading.textContent = "Alur kerja Tim AI";
  const workflowStatus = document.createElement("div");
  workflowStatus.style.cssText = "margin-top:8px;white-space:pre-wrap;line-height:1.6";
  const workflowResults = document.createElement("div");
  workflowResults.style.cssText = "display:grid;gap:8px;margin-top:12px";
  workflowPanel.append(workflowHeading, workflowStatus, workflowResults);
  const metricoolActions = document.createElement("div");
  metricoolActions.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-top:12px";
  metricoolActions.hidden = true;
  const metricoolExportButton = button("Unduh paket konten untuk Metricool (.md)", () => {
    if (!metricoolExportButton.dataset.content) return;
    const blob = new Blob([metricoolExportButton.dataset.content], { type: "text/markdown;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "officeme-paket-konten-metricool.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
    setStatus("Paket konten diunduh. Periksa fakta, media, disclosure affiliate, dan jadwalkan secara manual di Metricool Free.");
  }, "primary");
  const metricoolOpenButton = button("Buka Metricool", () => {
    window.open("https://app.metricool.com/", "_blank", "noopener,noreferrer");
  });
  metricoolActions.append(metricoolExportButton, metricoolOpenButton);
  workflowPanel.append(metricoolActions);
  researchPanel.parentNode.insertBefore(workflowPanel, list);

  function makeMetricoolContentPack(data, url, productName) {
    const lines = [
      "# OfficeMe — Paket Konten untuk Metricool",
      "",
      "> Draf saja: belum dijadwalkan atau dipublikasikan. Periksa dan setujui secara manual sebelum mengunggah.",
      "",
      "## Informasi produk",
      "- Nama produk: " + (productName || "Belum terverifikasi dari riset"),
      "- Link affiliate: " + url,
      "- Dibuat: " + new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
      "",
      "## Disclosure affiliate",
      "Tambahkan disclosure yang jelas bahwa tautan dapat menghasilkan komisi, sesuai aturan platform dan program affiliate.",
      "",
      "## Pemeriksaan sebelum publikasi",
      "- [ ] Verifikasi nama, spesifikasi, harga, stok, klaim, dan setiap angka terhadap sumber resmi terbaru.",
      "- [ ] Pastikan video/gambar yang diperlukan sudah tersedia dan memiliki hak penggunaan.",
      "- [ ] Periksa caption, CTA, hashtag, link affiliate, dan aturan platform.",
      "- [ ] Pastikan William menyetujui isi dan waktu publikasi.",
      "",
      "## Hasil pemeriksaan tim AI",
      typeof data.finalReview === "string" ? data.finalReview : JSON.stringify(data.finalReview || "Tidak ada ringkasan pemeriksaan akhir.", null, 2),
      "",
      "## Hasil setiap agen"
    ];
    (Array.isArray(data.results) ? data.results : []).forEach((item) => {
      lines.push("", "### " + (item.name || item.agentId || "AI Agent") + " — " + (item.ok ? "hasil tersedia" : "perlu diperiksa"));
      lines.push(typeof item.result === "string" ? item.result : JSON.stringify(item.result ?? item.error ?? "Tidak ada hasil.", null, 2));
    });
    lines.push("", "## Alur gratis", "1. Buka Metricool dan pilih Planner.", "2. Buat posting baru untuk jaringan yang sudah terhubung.", "3. Salin draf yang sudah diperiksa dari dokumen ini; lampirkan media yang diwajibkan.", "4. Jadwalkan manual. Metricool Free memiliki batas publikasi bulanan; periksa penghitung di Planner.", "");
    return lines.join("\n");
  }

  let teamWorkflowRunning = false;
  async function runTeamWorkflow(url, productName, base, token, research, researchError) {
    if (teamWorkflowRunning) return;
    teamWorkflowRunning = true;
    workflowPanel.hidden = false;
    workflowHeading.textContent = "AI Manager · pembagian tugas otomatis";
    workflowStatus.textContent = "Manager sedang menugaskan Data Analyst, Product Researcher, Strategist, Content Producer, SEO, Visual Designer, Automation Engineer, lalu Quality & Compliance Reviewer. Tidak perlu instruksi terpisah.";
    workflowResults.replaceChildren();
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    const task = [
      "Jalankan alur standar OfficeMe untuk satu link affiliate Shopee yang diberikan William sebagai direktur.",
      "Setiap agen harus menjalankan tanggung jawab tetap sesuai spesialisasinya tanpa meminta William menulis instruksi tambahan.",
      "Mulai dengan mengidentifikasi produk hanya dari bukti yang tersedia; gunakan hasil riset Google Search bila tersedia.",
      "Hasil yang dibutuhkan: ringkasan produk dan batasan data; audiens dan strategi affiliate; konsep konten video pendek beserta hook/naskah/caption/CTA; kata kunci dan judul SEO; brief visual/shot list; kebutuhan integrasi dan langkah lanjutan; pemeriksaan klaim, disclosure affiliate, serta risiko kepatuhan.",
      "Jangan mengarang harga, rating, ulasan, komisi, stok, penjualan, atau performa. Jangan mengklaim konten telah dipublikasikan. Semua publikasi dan tindakan eksternal tetap menunggu persetujuan William.",
      "Jika riset produk tidak berhasil, lanjutkan bagian yang masih bisa dikerjakan dari link dan tandai dengan jelas data yang belum diketahui."
    ].join("\n");
    try {
      const response = await fetch(base + "/api/agents/run", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          mode: "team",
          context: {
            source: "Shopee Affiliate link submitted by William",
            productUrl: url,
            productName: productName || null,
            research: research ? { answer: research.answer || "", sources: Array.isArray(research.sources) ? research.sources : [] } : null,
            researchUnavailable: researchError || null,
            requiredOutputLanguage: "Bahasa Indonesia",
            approvalPolicy: "Human approval required before any external action"
          }
        }),
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data || !Array.isArray(data.results)) {
        throw new Error(data.error || ("Backend AI Team merespons HTTP " + response.status));
      }
      const successful = data.results.filter(item => item && item.ok).length;
      workflowHeading.textContent = "Alur kerja Tim AI · " + successful + "/" + data.results.length + " agen selesai";
      workflowStatus.textContent = data.qualityStatus
        ? "Status pemeriksaan: " + data.qualityStatus + ". " + (data.ok ? "Hasil tim tersedia untuk ditinjau." : "Sebagian tugas gagal atau perlu diperiksa; lihat status tiap agen.")
        : "Hasil tim diterima. Periksa status tiap agen sebelum menggunakan rekomendasi.";
      if (data.finalReview) {
        const review = document.createElement("article");
        review.style.cssText = "border:1px solid var(--line);border-radius:10px;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere";
        const label = document.createElement("b");
        label.textContent = "Ringkasan pemeriksaan Charlotte";
        const body = document.createElement("div");
        body.style.marginTop = "7px";
        body.textContent = typeof data.finalReview === "string" ? data.finalReview : JSON.stringify(data.finalReview, null, 2);
        review.append(label, body);
        workflowResults.append(review);
      }
      metricoolExportButton.dataset.content = makeMetricoolContentPack(data, url, productName);
      metricoolActions.hidden = false;
      data.results.forEach(item => {
        const card = document.createElement("details");
        card.style.cssText = "border:1px solid var(--line);border-radius:10px;padding:10px 12px";
        const summary = document.createElement("summary");
        summary.style.cursor = "pointer";
        summary.textContent = (item.name || item.agentId || "AI Agent") + " · " + (item.ok ? "hasil tersedia" : "gagal");
        const body = document.createElement("div");
        body.style.cssText = "margin-top:8px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6";
        const resultText = item.ok
          ? (typeof item.result === "string" ? item.result : JSON.stringify(item.result, null, 2))
          : (item.error || "Agen tidak mengembalikan hasil.");
        body.textContent = resultText;
        card.append(summary, body);
        workflowResults.append(card);
      });
      setStatus("Link tersimpan. Riset dan alur Tim AI sudah diproses; tinjau hasil serta keterbatasannya sebelum mengambil tindakan.");
    } catch (error) {
      workflowHeading.textContent = "Alur kerja Tim AI belum berhasil";
      workflowStatus.textContent = (error.message || "Backend AI Team gagal merespons.") + "\nLink tetap tersimpan. Periksa provider AI yang dikonfigurasi di backend; tidak ada publikasi otomatis yang dilakukan.";
      setStatus("Link tersimpan, tetapi alur Tim AI gagal: " + (error.message || "koneksi gagal"), true);
    } finally {
      teamWorkflowRunning = false;
      if (submitButton) submitButton.disabled = false;
    }
  }

  async function runResearch(url, productName) {
    const backendInput = $("geminiCsvWorkerUrl");
    const tokenInput = $("geminiCsvToken");
    let base;
    try {
      const backendUrl = new URL(backendInput?.value.trim() || "");
      if (backendUrl.protocol !== "https:" || !backendUrl.hostname.endsWith(".workers.dev") ||
          backendUrl.pathname !== "/" || backendUrl.search || backendUrl.hash ||
          backendUrl.username || backendUrl.password) throw new Error();
      base = backendUrl.origin;
    } catch (_) {
      researchPanel.hidden = false;
      researchBody.textContent = "Link tersimpan di browser, tetapi URL backend Cloudflare tidak valid. Periksa panel Analisis AI.";
      return;
    }
    const token = tokenInput?.value.trim();
    if (!token) {
      researchPanel.hidden = false;
      researchBody.textContent = "Link tersimpan di browser. Untuk menjalankan riset Google Search otomatis, masukkan APP_SHARED_TOKEN di panel Analisis AI. Token tidak perlu dikirim ke chat.";
      return;
    }
    researchPanel.hidden = false;
    researchBody.textContent = "Gemini sedang meneliti link dan mencari sumber publik melalui Google Search…";
    researchSources.replaceChildren();
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      const response = await fetch(base + "/api/affiliate/analyze", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ url, productName: productName || "" }),
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || ("Backend merespons HTTP " + response.status));
      researchHeading.textContent = "Hasil riset produk · " + (data.provider || "AI") + (data.searchGroundingUsed ? " + Google Search" : "");
      researchBody.textContent = data.answer || "Riset selesai tanpa teks hasil.";
      researchSources.replaceChildren();
      const sources = Array.isArray(data.sources) ? data.sources : [];
      if (sources.length) {
        const label = document.createElement("b");
        label.textContent = "Sumber yang dikembalikan Google Search";
        researchSources.append(label);
        sources.forEach(source => {
          if (!source || typeof source.url !== "string" || !/^https:\/\//i.test(source.url)) return;
          const anchor = document.createElement("a");
          anchor.href = source.url;
          anchor.target = "_blank";
          anchor.rel = "noopener noreferrer";
          anchor.textContent = String(source.title || source.url);
          anchor.style.cssText = "color:#a9c4ff;overflow-wrap:anywhere";
          researchSources.append(anchor);
        });
      } else {
        const note = document.createElement("small");
        note.textContent = "Google Search tidak mengembalikan daftar sumber yang bisa ditampilkan. Periksa klaim dan jangan menganggap data yang tidak bersumber sebagai fakta.";
        researchSources.append(note);
      }
      const note = document.createElement("small");
      note.style.cssText = "display:block;color:var(--muted);margin-top:8px";
      note.textContent = data.note || "Data komisi dan penjualan pribadi tetap memerlukan laporan resmi Shopee Affiliate.";
      researchSources.append(note);
      setStatus("Link tersimpan. Riset AI selesai; periksa fakta dan sumber sebelum memakai konten.");
      void runTeamWorkflow(url.href, productName, base, token, data, null);
    } catch (error) {
      researchHeading.textContent = "Riset otomatis belum berhasil";
      researchBody.textContent = error.message || "Koneksi riset gagal.";
      const note = document.createElement("small");
      note.textContent = "Link tetap tersimpan secara lokal. Periksa backend, token, kuota Gemini, dan konfigurasi Google Search grounding.";
      researchSources.replaceChildren(note);
      setStatus("Link tersimpan, tetapi riset gagal: " + (error.message || "koneksi gagal"), true);
      void runTeamWorkflow(url.href, productName, base, token, null, error.message || "Riset Google Search tidak berhasil.");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter((item) =>
        item && typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.url === "string" &&
        typeof item.createdAt === "string"
      ) : [];
    } catch (_) { return []; }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
      return true;
    } catch (_) {
      setStatus("Browser tidak dapat menyimpan data lokal. Periksa ruang penyimpanan atau pengaturan browser.", true);
      return false;
    }
  }
  function setStatus(message, isError = false) {
    status.textContent = message;
    status.dataset.state = isError ? "error" : "success";
  }
  function parseUrl(raw) {
    try {
      const u = new URL(raw.trim());
      if (u.protocol !== "https:") return null;
      const host = u.hostname.toLowerCase();
      if (!(host === "shope.ee" || host.endsWith(".shopee.co.id") || host === "shopee.co.id" || host === "shopee.ee")) return null;
      return u;
    } catch (_) { return null; }
  }
  function looksAffiliate(u) {
    const host = u.hostname.toLowerCase();
    return host === "shope.ee" || host === "shopee.ee" ||
      host === "s.shopee.co.id" || u.pathname.includes("/an_redir") ||
      u.searchParams.has("affiliate_id") ||
      (u.searchParams.get("utm_medium") || "").toLowerCase() === "affiliates" ||
      (u.searchParams.get("utm_source") || "").toLowerCase().startsWith("an_");
  }
  function safeText(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    return node;
  }
  function button(label, action, className = "") {
    const b = safeText("button", className, label);
    b.type = "button";
    b.addEventListener("click", action);
    return b;
  }
  function render() {
    list.replaceChildren();
    count.textContent = String(links.length);
    exportButton.disabled = links.length === 0;
    clearButton.disabled = links.length === 0;
    if (!links.length) {
      list.appendChild(safeText("p", "muted", "Belum ada tautan tersimpan. Tambahkan link Affiliate yang sudah dibuat melalui Shopee."));
      return;
    }
    [...links].reverse().forEach((item) => {
      const card = document.createElement("article");
      card.className = "affiliate-link-card";
      const top = document.createElement("div");
      top.className = "affiliate-link-card-top";
      const info = document.createElement("div");
      info.className = "affiliate-link-info";
      info.appendChild(safeText("strong", "", item.name));
      info.appendChild(safeText("div", "muted", [item.platform || "Belum ditentukan", item.campaign ? "SubID/kampanye: " + item.campaign : ""].filter(Boolean).join(" · ")));
      const link = safeText("a", "affiliate-link-url", item.url);
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.addEventListener("click", (event) => {
        if (!parseUrl(item.url)) event.preventDefault();
      });
      info.appendChild(link);
      top.appendChild(info);
      top.appendChild(safeText("span", "pill", new Date(item.createdAt).toLocaleDateString("id-ID")));
      card.appendChild(top);
      const actions = document.createElement("div");
      actions.className = "affiliate-link-actions";
      actions.appendChild(button("Salin link", async () => {
        try {
          await navigator.clipboard.writeText(item.url);
          setStatus("Link disalin. Tempelkan pada caption, bio, atau deskripsi konten Anda.");
        } catch (_) {
          const temporary = document.createElement("textarea");
          temporary.value = item.url;
          temporary.setAttribute("readonly", "");
          temporary.style.position = "fixed";
          temporary.style.opacity = "0";
          document.body.appendChild(temporary);
          temporary.select();
          const copied = document.execCommand("copy");
          temporary.remove();
          setStatus(copied ? "Link disalin." : "Tidak dapat menyalin otomatis. Buka link lalu salin dari bilah alamat.", !copied);
        }
      }, "primary"));
      actions.appendChild(button("Buka Shopee", () => window.open(item.url, "_blank", "noopener,noreferrer")));
      actions.appendChild(button("Hapus", () => {
        if (!window.confirm("Hapus tautan ini dari daftar lokal OfficeMe?")) return;
        links = links.filter((x) => x.id !== item.id);
        if (save()) { render(); setStatus("Tautan dihapus dari daftar lokal."); }
      }));
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const rawUrl = urlInput.value.trim();
    const campaign = campaignInput.value.trim().slice(0, 100);
    const platform = platformInput.value;
    const url = parseUrl(rawUrl);
    if (!url) { setStatus("Masukkan URL HTTPS Shopee yang valid. Tautan eksternal atau URL yang tidak aman ditolak.", true); urlInput.focus(); return; }
    if (!looksAffiliate(url)) {
      setStatus("Link ini belum tampak seperti tautan Affiliate. Buat/salin link dari fitur Shopee Affiliate terlebih dahulu, lalu masukkan link tersebut.", true);
      urlInput.focus();
      return;
    }
    if (links.some((x) => x.url === url.href)) {
      setStatus("Tautan ini sudah ada di daftar OfficeMe.", true);
      return;
    }
    const researchName = name;
    const savedName = name || "Produk dari link Shopee";
    links.push({ id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2), name: savedName, url: url.href, campaign, platform, createdAt: new Date().toISOString() });
    if (!save()) { links.pop(); return; }
    form.reset();
    render();
    setStatus("Tautan disimpan di browser ini. Memulai riset produk otomatis jika backend dan token tersedia.");
    runResearch(url.href, researchName);
  });

  exportButton.addEventListener("click", () => {
    if (!links.length) return;
    const rows = [["Nama produk/kampanye", "Link Affiliate", "Platform", "SubID/kampanye", "Tanggal disimpan"]];
    links.forEach((x) => rows.push([x.name, x.url, x.platform || "", x.campaign || "", x.createdAt]));
    const csv = rows.map((row) => row.map((value) => '"' + String(value).replace(/"/g, '""') + '"').join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href; a.download = "officeme-shopee-affiliate-links.csv";
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(href);
    setStatus("Daftar tautan diekspor sebagai CSV.");
  });
  clearButton.addEventListener("click", () => {
    if (!window.confirm("Hapus semua tautan yang tersimpan secara lokal di browser ini?")) return;
    links = [];
    if (save()) { render(); setStatus("Daftar tautan lokal dibersihkan."); }
  });
  render();
})();