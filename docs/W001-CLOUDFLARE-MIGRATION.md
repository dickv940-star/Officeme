# W001: Migrasi Google Apps Script ke Cloudflare Workers

## Tujuan dan batas perubahan

- Memindahkan backend Gemini ke Cloudflare Workers.
- Mempertahankan GitHub Pages sebagai frontend selama tahap migrasi.
- Tidak mengubah branch `main`, deployment produksi, atau menghapus Apps Script lama.
- CSV diproses di browser; hanya agregat dan maksimal 30 produk teratas berdasarkan komisi dikirim ketika pengguna menekan tombol analisis.
- API key hanya disimpan sebagai secret di Cloudflare.

## Status

Kode Worker dan perubahan frontend disiapkan di branch `feature/w001-cloudflare-workers-migration`. Backend belum dianggap aktif sampai Worker di-deploy dan pengujian nyata berhasil.

## Setup manual satu kali

1. Buka Cloudflare Dashboard → Workers & Pages dan buat Worker baru bernama `appdigi-w001-backend`, atau hubungkan repository ini melalui Workers Builds.
2. Jika memakai integrasi GitHub, gunakan branch pengembangan terlebih dahulu dan root directory `backend/cloudflare-worker`.
3. Pasang secret `GEMINI_API_KEY` dan `APP_SHARED_TOKEN` pada pengaturan Worker. Jangan menaruh nilai rahasia di source code, file `wrangler.toml`, GitHub, atau chat.
4. Atur `GEMINI_MODEL` ke `gemini-2.5-flash` dan `ALLOWED_ORIGINS` ke origin frontend yang benar, saat ini `https://dickv940-star.github.io`.
5. Deploy Worker dan salin URL `workers.dev`.
6. Pada Orchestrator, masukkan URL Worker dan shared token, lalu tekan **Tes koneksi backend**. Setelah sukses, unggah CSV uji dan tekan **Jalankan analisis Gemini**.
7. Uji token salah, CSV tidak valid, dan origin tidak diizinkan. Pastikan tidak ada rahasia dalam response, log, atau repository.

## Pengujian penerimaan

- [ ] GET `/health` dengan token benar merespons `ok: true`.
- [ ] Token kosong/salah ditolak.
- [ ] Origin selain yang diizinkan ditolak.
- [ ] CSV diproses lokal dan tidak dikirim sebelum tombol analisis ditekan.
- [ ] Maksimal 30 produk dikirim.
- [ ] Analisis Gemini sungguhan berhasil.
- [ ] Kunci Gemini tidak pernah tampil di frontend atau respons.
- [ ] Produksi `main` tidak berubah selama uji.

## Batas integrasi

Cloudflare Workers menggantikan server-side Apps Script untuk fungsi W001 ini. Ia tidak otomatis memberi akses ke Shopee atau Canva. Shopee tetap memakai CSV sampai API resmi tersedia; Canva memerlukan integrasi dan otorisasi tersendiri. Google Apps Script lama tidak dihapus dan boleh dibiarkan sampai pengujian selesai.
