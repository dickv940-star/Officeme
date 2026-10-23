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
    if (!response.ok || data.ok === false) { const code = typeof data.diagnosticCode === "string" && /^[A-Z0-9_-]{1,80}$/.test(data.diagnosticCode) ? " (kode diagnostik: " + data.diagnosticCode + ")" : ""; throw new Error((data.error || ("Backend merespons HTTP " + response.status)) + code); }
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
}
  // Google Sheets Rp0 bridge: local-first content calendar with CSV import/export.
  function installGoogleSheetsBridge() {
    if (document.getElementById("officeGoogleSheetsBridge")) return;
    const panel = document.createElement("section");
    panel.id = "officeGoogleSheetsBridge";
    panel.className = "panel";
    panel.style.cssText = "margin:22px 0;padding:20px;border:1px solid var(--line,#263650);border-radius:16px;background:linear-gradient(160deg,#16223a,#10182a)";
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <div><div class="eyebrow">Google Workspace · Rp0</div><h2 style="margin:5px 0 6px;font-size:22px">Kalender Konten Google Sheets</h2><p class="muted" style="margin:0">Buat draf, simpan di browser, lalu ekspor/impor CSV ke Google Sheets. Belum ada posting otomatis.</p></div>
        <a href="https://sheets.google.com" target="_blank" rel="noopener noreferrer" style="color:var(--accent,#86aaff)">Buka Google Sheets ↗</a>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:10px;margin-top:16px">
        <label style="font-size:12px;color:var(--muted,#9aabc5)">Platform<select id="officeGsPlatform" style="display:block;width:100%;margin-top:5px;padding:10px;border-radius:9px;background:#0a1120;color:inherit;border:1px solid var(--line,#263650)"><option>Instagram</option><option>Facebook</option><option>TikTok</option><option>YouTube</option><option>Shopee</option><option>Lainnya</option></select></label>
        <label style="font-size:12px;color:var(--muted,#9aabc5)">Tanggal rencana<input id="officeGsDate" type="date" style="display:block;width:100%;margin-top:5px;padding:10px;border-radius:9px;background:#0a1120;color:inherit;border:1px solid var(--line,#263650)"></label>
        <label style="font-size:12px;color:var(--muted,#9aabc5)">Jenis konten<select id="officeGsType" style="display:block;width:100%;margin-top:5px;padding:10px;border-radius:9px;background:#0a1120;color:inherit;border:1px solid var(--line,#263650)"><option>Post</option><option>Reel / Short</option><option>Video</option><option>Story</option><option>Live</option><option>Produk afiliasi</option></select></label>
        <label style="font-size:12px;color:var(--muted,#9aabc5)">Status<select id="officeGsState" style="display:block;width:100%;margin-top:5px;padding:10px;border-radius:9px;background:#0a1120;color:inherit;border:1px solid var(--line,#263650)"><option>Draf</option><option>Perlu ditinjau</option><option>Disetujui</option><option>Terjadwal manual</option><option>Terbit (konfirmasi manual)</option></select></label>
      </div>
      <label style="display:block;font-size:12px;color:var(--muted,#9aabc5);margin-top:12px">Caption / ide konten<textarea id="officeGsCaption" rows="3" placeholder="Tulis ide atau caption di sini…" style="display:block;width:100%;margin-top:5px;min-height:85px"></textarea></label>
      <label style="display:block;font-size:12px;color:var(--muted,#9aabc5);margin-top:10px">URL produk / aset (opsional)<input id="officeGsUrl" type="url" placeholder="https://…" style="display:block;width:100%;margin-top:5px;padding:10px;border-radius:9px;background:#0a1120;color:inherit;border:1px solid var(--line,#263650)"></label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" id="officeGsSave" class="primary">Simpan draf</button><button type="button" id="officeGsExport">Ekspor CSV untuk Sheets</button><label for="officeGsImport" style="display:inline-flex;align-items:center;padding:9px 12px;border:1px solid var(--line,#263650);border-radius:10px;cursor:pointer;font-weight:700">Impor CSV dari Sheets</label><input id="officeGsImport" type="file" accept=".csv,text/csv" hidden></div>
      <p id="officeGsStatus" class="toast" role="status" aria-live="polite"></p>
      <div id="officeGsRows" style="display:grid;gap:8px;margin-top:10px"></div>
      <p class="notice">Data draf disimpan di localStorage browser ini, bukan otomatis di akun Google. Gunakan ekspor/impor untuk memindahkan data. Jangan masukkan password, token, atau data sensitif.</p>
    `;
    const footer = document.querySelector(".footer");
    if (footer?.parentNode) footer.parentNode.insertBefore(panel, footer); else document.body.appendChild(panel);
    const $g = (id) => document.getElementById(id);
    const key = "officeme.googleSheetsBridge.v1";
    const headers = ["id","created_at","platform","planned_date","content_type","caption","asset_url","status"];
    let rows = [];
    try { const saved = JSON.parse(localStorage.getItem(key) || "[]"); if (Array.isArray(saved)) rows = saved.filter(x => x && typeof x === "object"); } catch (_) {}
    const today = new Date();
    $g("officeGsDate").value = [today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");
    const statusText = (msg, kind) => { $g("officeGsStatus").textContent = msg; $g("officeGsStatus").style.color = kind === "error" ? "#ffaaa8" : "var(--green,#72e0b2)"; };
    const persist = () => { try { localStorage.setItem(key, JSON.stringify(rows)); } catch (_) { statusText("Penyimpanan browser penuh atau diblokir. Ekspor CSV agar data tidak hilang.", "error"); } };
    const safeUrl = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : ""; } catch (_) { return ""; } };
    const render = () => {
      const list = $g("officeGsRows"); list.replaceChildren();
      if (!rows.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "Belum ada draf. Tambahkan ide pertama di atas."; list.appendChild(empty); return; }
      rows.slice().reverse().forEach(row => {
        const card = document.createElement("article");
        card.style.cssText = "border:1px solid var(--line,#263650);border-radius:12px;padding:12px;background:#0b1425";
        const head = document.createElement("div"); head.style.cssText = "display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap";
        const title = document.createElement("strong"); title.textContent = [row.platform || "Platform",row.planned_date || "Tanpa tanggal",row.content_type || "Konten"].join(" · ");
        const state = document.createElement("span"); state.className = "pill"; state.textContent = row.status || "Draf";
        head.append(title,state);
        const caption = document.createElement("p"); caption.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;margin:8px 0"; caption.textContent = row.caption || "(Caption kosong)";
        card.append(head,caption);
        if (row.asset_url && safeUrl(row.asset_url)) { const a = document.createElement("a"); a.href = safeUrl(row.asset_url); a.target="_blank"; a.rel="noopener noreferrer"; a.textContent="Buka URL aset"; a.style.color="var(--accent,#86aaff)"; card.appendChild(a); }
        const remove = document.createElement("button"); remove.type="button"; remove.textContent="Hapus draf"; remove.style.marginTop="8px"; remove.addEventListener("click",()=>{ rows=rows.filter(x=>x.id!==row.id);persist();render();statusText("Draf dihapus dari browser ini."); }); card.appendChild(remove);
        list.appendChild(card);
      });
    };
    const csvCell = value => '"' + String(value ?? "").replace(/"/g,'""') + '"';
    const exportCsv = () => {
      const csv = "\uFEFF" + [headers, ...rows.map(row=>headers.map(h=>row[h] ?? ""))].map(line=>line.map(csvCell).join(",")).join("\r\n");
      const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
      const url = URL.createObjectURL(blob); const a=document.createElement("a");a.href=url;a.download="officeme-kalender-konten.csv";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
      statusText("CSV diekspor. Buka Google Sheets → File → Impor → Upload, lalu pilih file CSV.");
    };
    const parseCsv = text => {
      const data=[]; let row=[], cell="", quoted=false;
      for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"')quoted=true;else if(c===","){row.push(cell);cell="";}else if(c==="\n"){row.push(cell.replace(/\r$/,""));data.push(row);row=[];cell="";}else cell+=c;}
      if(cell.length||row.length){row.push(cell.replace(/\r$/,""));data.push(row);}
      return data.filter(r=>r.some(v=>String(v).trim())).map(r=>r.map(v=>String(v).replace(/^\uFEFF/,"")));
    };
    $g("officeGsSave").addEventListener("click",()=>{
      const caption=$g("officeGsCaption").value.trim(), assetUrl=$g("officeGsUrl").value.trim();
      if(!caption){statusText("Isi caption atau ide konten terlebih dahulu.","error");return;}
      if(assetUrl && !safeUrl(assetUrl)){statusText("URL aset harus berupa tautan HTTPS/HTTP yang valid.","error");return;}
      rows.push({id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+"-"+Math.random().toString(36).slice(2,8),created_at:new Date().toISOString(),platform:$g("officeGsPlatform").value,planned_date:$g("officeGsDate").value,content_type:$g("officeGsType").value,caption,asset_url:assetUrl,status:$g("officeGsState").value});
      persist();render();$g("officeGsCaption").value="";$g("officeGsUrl").value="";statusText("Draf tersimpan di browser ini. Ekspor CSV untuk memindahkannya ke Google Sheets.");
    });
    $g("officeGsExport").addEventListener("click",exportCsv);
    $g("officeGsImport").addEventListener("change",async event=>{
      const file=event.target.files?.[0]; if(!file)return;
      try{
        const parsed=parseCsv((await file.text()).replace(/^\uFEFF/,""));
        if(parsed.length<2)throw new Error("CSV tidak memiliki baris data.");
        const cols=parsed[0].map(x=>x.trim().toLowerCase());
        const index=Object.fromEntries(headers.map(h=>[h,cols.indexOf(h)]));
        if(index.platform<0||index.caption<0)throw new Error("Header CSV harus mencakup kolom platform dan caption. Ekspor CSV OfficeMe untuk format yang cocok.");
        let count=0;
        parsed.slice(1).forEach(line=>{
          const val=h=>index[h]>=0?(line[index[h]]||""):"";
          const caption=val("caption").trim(); if(!caption)return;
          const asset=val("asset_url");
          rows.push({id:val("id")||"import-"+Date.now()+"-"+count,created_at:val("created_at")||new Date().toISOString(),platform:val("platform")||"Lainnya",planned_date:val("planned_date"),content_type:val("content_type")||"Post",caption,asset_url:safeUrl(asset)||"",status:val("status")||"Draf"});count++;
        });
        persist();render();statusText(count+" baris diimpor dari CSV. Periksa isi sebelum digunakan.");
      }catch(error){statusText("Impor gagal: "+error.message,"error");}
      finally{event.target.value="";}
    });
    render();
  }
  installGoogleSheetsBridge();

})();