# Rencana Integrasi Shopee Affiliate Open API — AI AFFILIATE by AppDIGI

Status: persiapan saja. Belum ada kredensial Shopee Affiliate Open API, sehingga belum ada koneksi akun yang dapat diuji. Dokumen ini tidak mengaktifkan integrasi atau mengubah website produksi.

## Tujuan
- Menghubungkan AI AFFILIATE by AppDIGI ke Shopee Affiliate Indonesia melalui API resmi setelah akses disetujui.
- Mengambil penawaran toko/produk dan laporan performa yang benar-benar diizinkan oleh akun.
- Menyediakan sinkronisasi berkala, analisis tren, rekomendasi produk, dan strategi marketing berbasis data.
- Mempertahankan publikasi otomatis dalam keadaan nonaktif.

## Prasyarat sebelum implementasi API
1. Shopee mengonfirmasi bahwa akun Affiliate Indonesia memenuhi syarat dan memberikan App ID serta Secret secara resmi.
2. Tinjau ulang dokumentasi Indonesia terkini di https://open-api.affiliate.shopee.co.id/explorer/v2 untuk metode autentikasi, format tanda tangan, timestamp, parameter wajib, pagination, rate limit, serta definisi tiap laporan.
3. Jangan menganggap akses endpoint produk berarti akses laporan konversi juga tersedia. Uji tiap endpoint secara terpisah.
4. Jangan menaruh App Secret pada HTML, JavaScript browser, GitHub, URL, atau log.

## Rancangan teknis
- Frontend GitHub Pages: hanya menampilkan data yang sudah diproses oleh backend dan status sinkronisasi.
- Cloudflare Worker: menyimpan rahasia melalui Worker Secrets, membuat tanda tangan request sesuai dokumentasi Shopee, memvalidasi permintaan dari frontend, memanggil API resmi, dan menyamarkan data sensitif di log.
- Cloudflare D1: menyimpan hasil sinkronisasi dan waktu pembaruan terakhir jika diperlukan; hindari menyimpan data pribadi pembeli yang tidak dibutuhkan.
- Sinkronisasi: jadwalkan setelah pengujian manual berhasil dan setelah batas pemanggilan API diketahui. Simpan status keberhasilan/kegagalan dan hindari duplikasi data.
- Analitik: hitung metrik hanya dari kolom yang tersedia; beri label jelas pada estimasi dan data tervalidasi.
- CSV: pertahankan impor CSV sebagai fallback selama akses API belum tersedia.

## Tahapan rilis
1. Dapatkan persetujuan akses API dan kredensial resmi.
2. Pasang Secret di Cloudflare Worker (jangan kirim nilai rahasia lewat chat).
3. Implementasikan endpoint backend di branch pengembangan.
4. Uji signature/auth, akses endpoint, pagination, rate limit, validasi data, dan error handling tanpa mengubah produksi.
5. Tinjau perubahan dan uji regresi.
6. Terapkan ke produksi hanya setelah hasil pengujian diperiksa dan disetujui.

## Batasan
- Tidak meminta password Shopee atau OTP.
- Tidak mengotomatisasi login browser atau scraping dashboard.
- Tidak melakukan publikasi konten otomatis.
- Tidak menjanjikan peningkatan penjualan; rekomendasi dinilai berdasarkan hasil yang terukur.
