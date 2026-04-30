# Agent Notes

## Bring! Recipe Import Compatibility

This app supports Bring! through Bring's official recipe import flow, not through an arbitrary shopping-list API.

Bring-compatible recipes must be parseable as Schema.org `Recipe` structured data, preferably with JSON-LD on the recipe page and matching visible microdata where practical.

Required fields for every Bring-compatible recipe page:

- `@context`: `https://schema.org`
- `@type`: `Recipe`
- `name`: recipe title
- `author`: `Person` or `Organization`
- `recipeIngredient`: non-empty list of ingredients
- `ingredients`: duplicate legacy ingredient list for Bring's older parser. Bring's own guide examples still use `ingredients`, even though Schema.org superseded it with `recipeIngredient`.

Strongly recommended fields:

- `image`
- `recipeYield`
- `recipeCategory`
- `recipeInstructions`
- `totalTime`, `prepTime`, or `cookTime` using ISO 8601 durations when known
- Ingredient quantities where available, because Bring can scale quantities from `baseQuantity` to `requestedQuantity`
- Use an absolute public image URL in generated recipe pages. Bring's parser can turn relative `../icons/...` values into broken URLs such as `https://lukegre.github.io/../icons/...`, which may make the app handoff fail even when parsing succeeds.

Current implementation:

- `index.html` contains the main meal-card UI.
- Each `.card` is also marked up as `itemscope itemtype="https://schema.org/Recipe"`.
- Each card has a `data-recipe-page="recipes/<slug>.html"` attribute.
- `recipes/*.html` are per-meal static recipe pages with Schema.org JSON-LD and visible microdata.
- Ingredient `<li>` elements should use `itemprop="recipeIngredient ingredients"` so modern Schema.org parsers and Bring's legacy parser can both read them.
- `recipes/index.json` is the canonical recipe source. Do not hand-edit generated recipe pages unless explicitly debugging; update the JSON and run `node scripts/build-recipes.mjs`.
- `site.config.json` must contain the deployed GitHub Pages origin so generated recipe `url` and `image` fields are absolute public URLs.
- `service-worker.js` must include generated recipe pages in `ASSETS`, and `CACHE_NAME` should be bumped when cached assets change.
- `recipes/index.json` lists generated recipe pages for sanity checking.

Bring import behavior:

- On public HTTP/HTTPS deployments, the `Import to Bring!` button builds:
  `https://api.getbring.com/rest/bringrecipes/deeplink?url=<encoded recipe URL>&source=web&baseQuantity=4&requestedQuantity=4`
- Bring then parses the linked recipe URL and redirects to its app deeplink.
- On localhost, `127.0.0.1`, or local files, Bring cannot fetch the recipe URL, so the app falls back to Web Share / copy.

Before finishing recipe/import changes, verify locally:

- Run `node scripts/build-recipes.mjs` after editing `recipes/index.json`.
- Run `node scripts/test-recipes.mjs`. This checks card/page consistency, required Schema.org fields, duplicate legacy `ingredients`, dual ingredient microdata, absolute public recipe URLs, and absolute public image URLs.
- Run an inline script parse check if you changed hand-written JavaScript in `index.html`.

After deployment, verify against Bring:

- Run `node scripts/check-bring-import.js` to check Bring's live backend parser for one recipe.
- Run `node scripts/check-bring-import.js --all` to check every recipe.
- If the parser returns `broken imageUrl: https://lukegre.github.io/../icons/icon-512.png`, the live site is still serving stale generated recipe HTML or was built without `siteOrigin`.
- A successful Bring parser response can still be followed by iOS/PWA cache issues, so if the phone still opens old behavior, delete and re-add the Home Screen app after deployment.

Useful local validation command:

```sh
node - <<'NODE'
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const cards = [...html.matchAll(/<article class="card"[^>]*data-recipe-page="([^"]+)"[^>]*itemscope itemtype="https:\/\/schema.org\/Recipe"/g)].map(m => m[1]);
const missing = cards.filter(p => !fs.existsSync(p));
const pages = fs.readdirSync('recipes').filter(f => f.endsWith('.html'));
const bad = [];
for (const file of pages) {
  const page = fs.readFileSync('recipes/' + file, 'utf8');
  const match = page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) {
    bad.push(file + ': no jsonld');
    continue;
  }
  const data = JSON.parse(match[1]);
  if (!data.name || !data.author || !data.recipeIngredient?.length || !data.ingredients?.length) {
    bad.push(file + ': missing required fields');
  }
}
console.log(JSON.stringify({ cards: cards.length, pages: pages.length, missing, bad }, null, 2));
NODE
```

## Conversation Summary

Build a phone-friendly family meal-card PWA for GitHub Pages. The first screen should be the usable card grid, not a landing page.

The app is for reducing meal-planning load while improving diet quality for a tired family with a little one. Recipes should feel abundant, supportive, nutritious, quick, easy and genuinely delicious rather than austere. The family uses a Thermomix, likes flexible meal-card planning, usually cooks 3-4 times per week, and relies on leftovers for lunches.

Keep cards scannable: recipe name, type/time tags, core ingredients, a short leftover/reheat note, and actions. Put richer content in the phone-friendly modal opened by tapping a card: ingredients, fuller method, nourishment note, 10-month-old serving advice, leftovers/reheating, and a similar external recipe link. Avoid inline method dropdowns on the grid.

Content guidance:

- Nutrition copy should be practical and reassuring, especially around protein, iron, B12, omega-3s, fibre, greens, slow-release carbs, calcium, folate and steady energy.
- Baby notes should cover texture, salt, choking hazards, spice level and safe serving formats.
- Prefer reputable, close-match external recipe links.
- Use "Import to Bring!" wording where Bring integration is relevant.

Implementation reminders:

- `recipes/index.json` is the canonical recipe data source.
- Run `node scripts/build-recipes.mjs` after recipe edits.
- Generated outputs include `index.html`, `recipes/*.html`, and `service-worker.js`.
- Cards should remain clickable and keyboard-accessible; action buttons should not open the modal.
