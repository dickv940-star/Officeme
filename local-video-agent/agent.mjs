import { chromium } from "playwright";
import readline from "node:readline/promises";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

const outputDir = path.resolve(process.env.OFFICEME_IMPORT_DIR || "./imports");
const profileDir = path.resolve(process.env.OFFICEME_BROWSER_PROFILE || "./browser-profile");

function cleanQuery(value) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, 180);
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const affiliateUrl = (await rl.question("Tempel link affiliate produk: ")).trim();
  let parsed;
  try {
    parsed = new URL(affiliateUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("protocol");
  } catch {
    console.error("Link tidak valid. Masukkan URL http/https yang benar.");
    rl.close();
    process.exitCode = 1;
    return;
  }

  const query = cleanQuery(await rl.question("Nama produk/kata kunci untuk pencarian (wajib): "));
  if (!query) {
    console.error("Kata kunci produk diperlukan agar hasil tidak menebak produk.");
    rl.close();
    process.exitCode = 1;
    return;
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(profileDir, { recursive: true });
  console.log("\nOfficeMe Local Video Agent");
  console.log("- Browser tampil agar kamu bisa mengawasi proses.");
  console.log("- Login Pinterest dilakukan sendiri di browser jika diminta; jangan berikan password/cookie ke agent.");
  console.log("- Agent tidak melewati CAPTCHA, login, paywall, atau pembatasan download.");
  console.log("- Gunakan hanya video yang kamu miliki atau punya izin untuk digunakan ulang.\n");

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    acceptDownloads: true,
    downloadsPath: outputDir,
    viewport: { width: 1365, height: 900 }
  });

  try {
    const page = context.pages()[0] || await context.newPage();
    const googleUrl = "https://www.google.com/search?q=" + encodeURIComponent("site:pinterest.com/pin/ " + query + " product video");
    await page.goto(googleUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    console.log("Google menampilkan hasil Pinterest. Periksa hasilnya, lalu buka Pin yang sesuai.");
    await rl.question("\nTekan ENTER setelah kamu membuka Pin video yang sesuai di tab browser... ");

    const pinPage = context.pages().find((p) => /pinterest\./i.test(p.url())) || page;
    if (!/pinterest\./i.test(pinPage.url())) {
      console.log("Belum terdeteksi halaman Pinterest. Buka Pinterest secara manual di browser, login jika perlu, lalu buka Pin yang sesuai.");
      await rl.question("Tekan ENTER setelah halaman Pin terbuka... ");
    }
    const activePage = context.pages().find((p) => /pinterest\./i.test(p.url())) || page;
    console.log("Halaman aktif:", activePage.url());

    await rl.question("\nJika Pinterest menawarkan menu resmi Download/Unduh untuk video ini, pilih menu tersebut sekarang. Jangan gunakan downloader pihak ketiga atau melewati pembatasan. Tekan ENTER setelah download selesai atau jika opsi tidak tersedia... ");
    const files = await fs.readdir(outputDir);
    const candidates = files.filter((name) => !name.startsWith("."));
    console.log("\nFile yang tersedia di folder impor lokal:");
    if (!candidates.length) {
      console.log("Belum ada file terdeteksi. Video ini mungkin tidak menyediakan opsi unduh. Kamu bisa menggunakan video milik sendiri atau materi yang diizinkan penjual.");
    } else {
      for (const name of candidates) console.log(" •", path.join(outputDir, name));
    }
    console.log("\nFolder impor OfficeMe:", outputDir);
    console.log("Langkah berikutnya: impor file ke ruang kerja video OfficeMe setelah fitur penerimaan file lokal diaktifkan.");
  } finally {
    await context.close();
    rl.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error("Agent berhenti:", error?.message || "Kesalahan tidak diketahui");
    process.exitCode = 1;
  });
}
