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
    if (!name) { setStatus("Masukkan nama produk atau kampanye.", true); nameInput.focus(); return; }
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
    links.push({ id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2), name, url: url.href, campaign, platform, createdAt: new Date().toISOString() });
    if (!save()) { links.pop(); return; }
    form.reset();
    render();
    setStatus("Tautan disimpan di browser ini. OfficeMe belum memverifikasi atribusi komisi Shopee.");
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