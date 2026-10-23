# OfficeMe Google Sheets Bridge (Rp0)

This folder contains a Google Apps Script helper for a free Google Sheets workflow.

## What it does

- Creates three tabs: **Kalender Konten**, **Tugas OfficeMe**, and **Laporan**.
- Adds an **OfficeMe** menu in Google Sheets.
- Exports the active tab to a CSV file in your own Google Drive.
- Works with OfficeMe's in-browser content calendar via CSV import/export.
- Does not publish social content or claim social accounts are connected.

## Set up the Google Sheet

1. Open [Google Sheets](https://sheets.google.com) and create a blank spreadsheet.
2. Choose **Extensions → Apps Script**.
3. Replace the starter code in `Code.gs` with the contents of this folder's `Code.gs`.
4. Click **Save**. Return to the spreadsheet and reload it.
5. Choose **OfficeMe → Siapkan lembar kerja** and approve Google's permission screen. The script uses built-in Sheets/Drive services only.
6. Return to OfficeMe at https://dickv940-star.github.io/Officeme/ and open **Kalender Konten Google Sheets**.
7. Create drafts in OfficeMe and click **Ekspor CSV untuk Sheets**.
8. In your spreadsheet, choose **File → Import → Upload**, select the CSV, and import it into the **Kalender Konten** tab. Choose to replace the selected sheet only if you have backed up existing data first.
9. To bring rows back into OfficeMe, download the sheet as CSV (**File → Download → Comma-separated values**) and use **Impor CSV dari Sheets** in OfficeMe.
10. To create a Drive CSV directly from Sheets, choose **OfficeMe → Ekspor tab aktif ke CSV di Drive**.

## Important limits and safety

- No API key, billing account, Apps Script web-app deployment, or public endpoint is required.
- Drafts saved in the OfficeMe browser are local to that browser profile until exported. Clear browser storage only after exporting anything important.
- The Apps Script code executes inside the spreadsheet owner's Google account and may ask for Google Sheets/Drive permissions.
- Keep the spreadsheet private unless you intentionally want to share it. Do not put passwords, shared tokens, OAuth tokens, API secrets, payout details, or sensitive personal data in the sheet.
- CSV import/export is a manual bridge, not automatic two-way synchronization.
- Google quotas and product terms may change. Check [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas) before scaling up.
- Publication and account analytics still require the relevant platform's official API access and approved scopes.
