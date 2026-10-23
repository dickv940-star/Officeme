# OfficeMe Local Video Agent (prototype)

This helper opens a visible browser, searches Google for Pinterest product-video results, and lets the owner review a Pin. It does **not** log in automatically, collect passwords/cookies, bypass CAPTCHA, or bypass Pinterest's download restrictions.

## Requirements

- Windows 10/11
- Node.js LTS
- A Pinterest account that you can sign into yourself
- Permission to reuse the video for your intended commercial purpose

## Run on Windows

1. Download/clone the OfficeMe repository.
2. Open PowerShell in the `local-video-agent` folder.
3. Run:

   ```powershell
   npm install
   npx playwright install chromium
   npm start
   ```

4. Paste your affiliate URL and enter the product name/keywords.
5. A visible browser opens. Review Google results, open the relevant Pinterest Pin, and sign in manually if Pinterest asks.
6. Use Pinterest's own Download/Unduh action only if it is available for that video. Do not use this tool to bypass restrictions.
7. Files are expected in `local-video-agent/imports` by default.

## Optional folder override

PowerShell:

```powershell
$env:OFFICEME_IMPORT_DIR = "$HOME\Videos\OfficeMe-Imports"
npm start
```

## Important current limitations

- This is a supervised browser helper, **not yet a fully autonomous product-matching or download bot**. The owner confirms the selected Pin and any available official download action.
- Pinterest UI and download availability vary. The helper does not scrape private data or extract protected media streams.
- The downloaded file is not yet automatically uploaded to GitHub Pages or Cloudflare. GitHub Pages is static hosting and should not be used as a video-file store. A separate local import/upload step is needed to hand files to OfficeMe.
- It does not publish to YouTube. Video editing and upload must be implemented and tested separately, with owner approval before publishing.
- The browser profile is stored in `browser-profile`. Treat it as sensitive because it may contain a signed-in session. Do not share it or commit it to Git.
- Keep `browser-profile/`, `imports/`, and `node_modules/` out of Git. Do not put account credentials or cookies into source files.
