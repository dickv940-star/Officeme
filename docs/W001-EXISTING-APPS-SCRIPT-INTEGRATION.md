# Integrasi W001 ke proyek Apps Script AI AFFILIATE yang sudah ada

Panduan ini sengaja tidak membuat proyek Apps Script baru dan tidak mengganti halaman utama yang sudah ada.

## Yang sudah disiapkan di branch
- `backend/apps-script/ExistingProjectBackend.gs`: fungsi backend tambahan tanpa `doGet()`.
- `backend/apps-script/Bridge.html`: iframe bridge dengan pemeriksaan origin.
- `tests/w001-gemini-apps-script.html`: halaman uji CSV + backend + Gemini.
- `tests/W001-APPS-SCRIPT-ACCEPTANCE.md`: kriteria penerimaan.

## Penting sebelum mengubah Apps Script
Saya tidak dapat mengedit atau menerbitkan proyek Apps Script dari repository GitHub. Perubahan berikut perlu ditempel oleh pemilik proyek di editor Apps Script. Jangan menghapus fungsi logging dan email notifikasi yang sekarang sudah ada.

### 1. Tambahkan file backend
1. Buka proyek Apps Script AI AFFILIATE yang sudah digunakan.
2. Tambahkan file skrip bernama `ExistingProjectBackend`.
3. Salin seluruh isi file `backend/apps-script/ExistingProjectBackend.gs` dari branch ini.
4. Jangan menyalin `backend/apps-script/Code.gs` ke proyek yang sama; file standalone itu punya `doGet()` sendiri dan bisa bentrok.

### 2. Tambahkan HTML bridge
1. Di editor Apps Script, tambah file HTML bernama persis `Bridge`.
2. Salin isi `backend/apps-script/Bridge.html`.
3. Bridge hanya melayani halaman dari origin `https://dickv940-star.github.io`; jika website frontend memakai domain berbeda, ubah origin pada Bridge dan Script Property agar sama persis.

### 3. Tambahkan rute bridge pada doGet yang sudah ada
JANGAN mengganti fungsi `doGet()` yang ada. Pertahankan kode pencatatan akses, notifikasi email, cache, dan perilaku Index. Ubah deklarasi menjadi `function doGet(e)` jika saat ini belum menerima parameter, lalu sisipkan kondisi berikut **setelah blok pencatatan akses/notifikasi yang sudah ada dan tepat sebelum baris yang mengembalikan Index**:

```javascript
if (e && e.parameter && e.parameter.bridge === "1") {
  return HtmlService.createHtmlOutputFromFile("Bridge")
    .setTitle("AppDIGI W001 Backend Bridge")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

Baris terakhir untuk halaman utama harus tetap mengembalikan `Index` seperti sebelumnya. Jangan menambahkan fungsi `doGet()` kedua.

### 4. Script Properties
Di Project Settings → Script Properties, tambahkan:
- `GEMINI_API_KEY`: kunci API Google AI Studio (rahasia).
- `APP_SHARED_TOKEN`: token acak panjang, minimal 32 karakter.
- `ALLOWED_ORIGIN`: `https://dickv940-star.github.io`.
- `GEMINI_MODEL`: `gemini-2.5-flash` atau model yang tersedia pada akun API kamu.

Jangan kirim token atau API key ke chat, jangan taruh di HTML/GitHub, dan jangan masukkan ke URL.

### 5. Deploy versi baru dan uji
1. Simpan perubahan.
2. Deploy → Manage deployments → edit deployment Web app yang dipakai → pilih versi baru → Deploy. Pertahankan konfigurasi akses yang sesuai dengan website.
3. URL bridge untuk halaman uji adalah URL deployment yang sama dengan tambahan `?bridge=1`.
4. Buka halaman uji dari GitHub Pages (bukan file lokal) agar origin cocok.
5. Muat data contoh: harus menunjukkan 3 produk, 200 klik, 11 pesanan, komisi Rp39.000, konversi 5,5%.
6. Tes backend: hanya mengonfirmasi konfigurasi dan model; ini belum membuktikan Gemini aktif.
7. Jalankan analisis Gemini: status hanya dianggap berhasil jika ada analisis teks non-kosong dari panggilan API nyata.

## Status dan batasan
- Kode di GitHub: disiapkan; belum ditempel ke Apps Script kamu.
- Backend: belum terverifikasi sampai deployment milikmu diuji.
- Gemini: belum terverifikasi sampai panggilan API nyata berhasil.
- Shopee Affiliate: masih lewat CSV; tidak ada login, scraping, atau publikasi otomatis.
- Jangan gabungkan PR ke `main` sebelum acceptance checklist lulus.
