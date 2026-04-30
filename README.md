# Family Meal Cards

A simple phone-friendly meal-card app for GitHub Pages.

## Deploy on GitHub Pages

1. Create a new GitHub repository, for example `family-meal-cards`.
2. Upload all files from this folder to the repository root.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, choose:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/root**
5. Open the GitHub Pages URL on your phone.
6. On iPhone: **Share → Add to Home Screen**.

## Files

- `index.html` — the app
- `recipes/index.json` — the canonical recipe data source
- `recipes/` — generated per-meal Schema.org recipe pages used by Bring! import
- `scripts/build-recipes.mjs` — regenerates recipe cards, recipe pages, and the service worker cache list
- `site.config.json` — optional deployed site origin for absolute recipe/image URLs
- `manifest.json` — app metadata for home-screen install
- `service-worker.js` — offline caching
- `icons/` — app icons

## Edit recipes

1. Edit `recipes/index.json`.
2. If the site has a public URL, set `siteOrigin` in `site.config.json` or run the build with `SITE_ORIGIN=https://example.com/`.
3. Run:
   ```sh
   node scripts/build-recipes.mjs
   ```
4. Commit the regenerated `index.html`, `recipes/*.html`, and `service-worker.js`.

## Bring! import

Each meal card links to a generated recipe page with Bring-friendly Schema.org JSON-LD and microdata. On a public URL such as GitHub Pages, “Import to Bring!” uses Bring’s official recipe deeplink endpoint. When opened locally, the button falls back to the device share/copy flow because Bring cannot fetch local files.
