/**
 * OfficeMe Google Sheets helper — Rp0 starter.
 * Uses built-in Google Apps Script services only; no paid API keys.
 * Run OfficeMe > Siapkan lembar kerja once from the spreadsheet.
 */
const OFFICEME_SHEETS = {
  "Kalender Konten": ["id","created_at","platform","planned_date","content_type","caption","asset_url","status"],
  "Tugas OfficeMe": ["task_id","created_at","agent","task","priority","status","notes"],
  "Laporan": ["date","platform","metric","value","source","notes"]
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("OfficeMe")
    .addItem("Siapkan lembar kerja", "setupOfficeMeSheets")
    .addItem("Ekspor tab aktif ke CSV di Drive", "exportActiveSheetToDrive")
    .addToUi();
}

function setupOfficeMeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(OFFICEME_SHEETS).forEach(function(name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    const headers = OFFICEME_SHEETS[name];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getDisplayValues()[0];
      if (headers.some(function(h, i) { return String(existing[i] || "").trim() !== h; })) {
        SpreadsheetApp.getUi().alert(
          'Tab "' + name + '" sudah berisi header berbeda. Tidak ditimpa untuk mencegah kehilangan data. Periksa header baris pertama secara manual.'
        );
        return;
      }
    }
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setWrap(true);
    sheet.autoResizeColumns(1, headers.length);
    if (name === "Kalender Konten") sheet.setColumnWidth(6, 420);
    if (name === "Tugas OfficeMe") sheet.setColumnWidth(4, 360);
  });
  SpreadsheetApp.getUi().alert(
    "Selesai. Tab Kalender Konten, Tugas OfficeMe, dan Laporan siap digunakan. Data tidak dikirim ke platform sosial."
  );
}

function exportActiveSheetToDrive() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) {
    SpreadsheetApp.getUi().alert("Tab aktif kosong.");
    return;
  }
  const csv = values.map(function(row) {
    return row.map(csvCell_).join(",");
  }).join("\r\n");
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
  const file = DriveApp.createFile(
    "OfficeMe-" + sheet.getName().replace(/[^a-zA-Z0-9_-]/g, "-") + "-" + stamp + ".csv",
    "\uFEFF" + csv,
    MimeType.CSV
  );
  SpreadsheetApp.getUi().alert(
    "CSV dibuat di Google Drive. Buka tautan berikut untuk memeriksa file:\n" + file.getUrl()
  );
}

function csvCell_(value) {
  let text = String(value == null ? "" : value);
  // Reduce spreadsheet formula-injection risk when exporting text values.
  if (/^[=+@]/.test(text) || /^-\d/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
