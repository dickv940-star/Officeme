# Google AI Studio — Virtual Animation Integration

This branch is a safe staging point for integrating the OfficeMe virtual-character animation developed in Google AI Studio.

## Important
- Do not replace the existing OfficeMe application wholesale.
- Do not commit API keys, tokens, credentials, or secrets.
- Keep Cloudflare backend/authentication contracts unchanged unless a reviewed change is necessary.
- Keep this integration isolated until assets and build/runtime compatibility are verified.

## Integration workflow
1. Open https://aistudio.google.com/app/apps and open the animation app.
2. In Google AI Studio Build, choose the GitHub import/connect option and authorize GitHub when prompted. This authorization must be completed by the account owner in Google's UI.
3. Import `dickv940-star/Officeme` or work from this staging branch: `aistudio-virtual-animation`.
4. Inspect the existing project structure before editing. The current site includes a single-page `index.html` with existing virtual-room visuals and application features.
5. Bring over only the required character component, model assets (prefer optimized `.glb`/VRM where applicable), animation clips, styles, and runtime dependencies.
6. Keep assets under a clearly scoped folder such as `assets/virtual-character/` and use paths compatible with GitHub Pages.
7. Test the page at the GitHub Pages base path, including model loading, mobile layout, reduced-motion fallback, and browser console errors.
8. Review the changed-file list and diff before syncing or merging changes to `main`.

## Prompt for AI Studio
Integrate the existing virtual 3D character animation into OfficeMe on branch `aistudio-virtual-animation`. First inspect the project and propose the exact files to change. Preserve all current UI, agent workflows, API routes, Cloudflare integration, authentication, and human approval requirements. Do not replace the app with a new scaffold. Use only properly licensed assets, optimize for Chrome on a 4–8 GB RAM computer, and provide a 2D fallback if WebGL/model loading fails. Never put secrets in frontend code. Run available build/tests and report what was and was not verified. Do not merge into main until reviewed.
