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

Strongly recommended fields:

- `image`
- `recipeYield`
- `recipeCategory`
- `recipeInstructions`
- `totalTime`, `prepTime`, or `cookTime` using ISO 8601 durations when known
- Ingredient quantities where available, because Bring can scale quantities from `baseQuantity` to `requestedQuantity`

Current implementation:

- `index.html` contains the main meal-card UI.
- Each `.card` is also marked up as `itemscope itemtype="https://schema.org/Recipe"`.
- Each card has a `data-recipe-page="recipes/<slug>.html"` attribute.
- `recipes/*.html` are per-meal static recipe pages with Schema.org JSON-LD and visible microdata.
- `service-worker.js` must include generated recipe pages in `ASSETS`, and `CACHE_NAME` should be bumped when cached assets change.
- `recipes/index.json` lists generated recipe pages for sanity checking.

Bring import behavior:

- On public HTTP/HTTPS deployments, the `Import to Bring!` button builds:
  `https://api.getbring.com/rest/bringrecipes/deeplink?url=<encoded recipe URL>&source=web&baseQuantity=4&requestedQuantity=4`
- Bring then parses the linked recipe URL and redirects to its app deeplink.
- On localhost, `127.0.0.1`, or local files, Bring cannot fetch the recipe URL, so the app falls back to Web Share / copy.

Before finishing recipe/import changes, verify:

- Inline scripts in `index.html` parse.
- Every card has a `data-recipe-page`.
- Every referenced recipe page exists.
- Every generated recipe page has parseable JSON-LD.
- Every generated JSON-LD recipe includes `name`, `author`, and a non-empty `recipeIngredient` list.

Useful validation command:

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
  if (!data.name || !data.author || !data.recipeIngredient?.length) {
    bad.push(file + ': missing required fields');
  }
}
console.log(JSON.stringify({ cards: cards.length, pages: pages.length, missing, bad }, null, 2));
NODE
```

## Conversation Summary

Original brief:

The family wants to optimise meal planning because sleep with a little one can be rough and the user's wife has often felt tired. The goal is to improve diet quality without increasing weekly decision load. They use recipe books and meal cards already, have a Thermomix, like the flexible card concept, and usually want to cook 3-4 times per week while using leftovers for lunch. The user's wife has recently liked the approach of the authors of "Nourished", so recipes should feel abundant, supportive, nutritious, quick, easy and genuinely delicious rather than austere.

Product direction:

- This is a phone-friendly family meal-card PWA for GitHub Pages.
- The first screen should be the usable meal-card experience, not a landing page.
- Cards should stay quick and scannable: recipe name, type/time tags, core ingredients, short leftover/reheat note, and actions.
- Richer content belongs in a phone-friendly popup opened by tapping a card.
- The modal should include ingredients, a more useful method, why the meal nourishes, little-one serving advice, leftovers/reheating, and a link to a similar external recipe.
- Avoid inline dropdowns for methods on the main card grid; they made the cards feel heavy.
- Weekly rhythm should read as static guidance, not like clickable tiles unless it gets a real filtering/planning function.
- Remove the standalone "Shopping list / Bring!" explainer block from the main page.

Recipe/content decisions:

- Existing cards were expanded with additional quick, nutrient-dense recipes:
  - Golden Chicken, Rice & Greens Pot
  - Beef, Lentil & Hidden Veg Ragu
  - Thermomix Carrot, Ginger & Red Lentil Soup
  - Sardine Tomato Pasta
  - Miso Butter Beans & Greens
  - Rainbow Nourish Plates
  - Warm Salmon, Pea & Potato Salad
  - Hummus Snack-Board Dinner
- Nutrition copy should be practical and reassuring, focused on protein, iron, B12, omega-3s, fibre, greens, slow-release carbohydrates, calcium, folate and energy steadiness.
- Little-one notes are for a 10-month-old and should cover texture, salt, choking hazards, spice level and safe serving formats.
- Methods in the modal should be more fleshed out than the old three-line card methods, especially for key recipes.
- External recipe links are expected for every card. Prefer reputable/high-signal recipe sources and close matches; highly rated links are ideal but not mandatory for every card.

Implementation notes from the conversation:

- `index.html` contains the main card UI and modal behavior.
- Cards are clickable and keyboard-accessible; action buttons should not open the modal.
- The modal header includes `#modal-recipe-link`, populated from the `recipeLinks` map.
- `nutritionTips` stores the per-recipe nourishment copy.
- `methodDetails` stores richer modal methods where available and falls back to the original card method.
- The current app has 32 cards.
- The user prefers "Import to Bring!" wording over generic "Share ingredients" wording where Bring integration is relevant.
- `service-worker.js` cache name was bumped during this work so cached assets refresh.

Verification already used:

- Inline script syntax check:

```sh
awk '/<script>/{flag=1;next}/<\/script>/{flag=0}flag' index.html | node --check
```

- Card/link sanity check:

```sh
perl -ne '$cards++ if /<article class="card"/; $links++ if /^        '\''/ && $in; $in=1 if /const recipeLinks =/; $in=0 if /^      };/ && $in; END{print "cards=$cards link_entries=$links\n"}' index.html
```
