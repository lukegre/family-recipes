import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const recipeDir = path.join(rootDir, 'recipes');
const dataPath = path.join(recipeDir, 'index.json');
const indexPath = path.join(rootDir, 'index.html');
const serviceWorkerPath = path.join(rootDir, 'service-worker.js');
const siteConfigPath = path.join(rootDir, 'site.config.json');

const siteConfig = fs.existsSync(siteConfigPath) ? JSON.parse(fs.readFileSync(siteConfigPath, 'utf8')) : {};
const SITE_ORIGIN = process.env.SITE_ORIGIN || siteConfig.siteOrigin || '';
const AUTHOR_NAME = 'Family Meal Cards';
const DEFAULT_IMAGE = 'icons/icon-512.png';
const START_MARKER = '<!-- BEGIN GENERATED RECIPE CARDS -->';
const END_MARKER = '<!-- END GENERATED RECIPE CARDS -->';
const NUTRITION_MARKER = '      const nutritionTips = ';
const RECIPE_LINKS_MARKER = '      const recipeLinks = ';
const METHOD_MARKER = '      const methodDetails = ';

function readRecipes() {
  const recipes = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const required = ['title', 'slug', 'type', 'time', 'prepTime', 'tags', 'yield', 'description', 'ingredients', 'instructions', 'baby'];
  const slugs = new Set();

  recipes.forEach((recipe, index) => {
    required.forEach((field) => {
      if (recipe[field] === undefined || recipe[field] === null || recipe[field] === '') {
        throw new Error(`Recipe ${index + 1} is missing ${field}`);
      }
    });

    if (slugs.has(recipe.slug)) {
      throw new Error(`Duplicate recipe slug: ${recipe.slug}`);
    }

    slugs.add(recipe.slug);

    ['tags', 'ingredients', 'instructions'].forEach((field) => {
      if (!Array.isArray(recipe[field]) || recipe[field].length === 0) {
        throw new Error(`${recipe.title} must have a non-empty ${field} array`);
      }
    });
  });

  return recipes;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function absoluteUrl(relativePath) {
  if (!SITE_ORIGIN) return relativePath;
  return new URL(relativePath, SITE_ORIGIN.replace(/\/?$/, '/')).href;
}

function recipePagePath(recipe) {
  return `recipes/${recipe.slug}.html`;
}

function recipePageUrl(recipe) {
  return SITE_ORIGIN ? absoluteUrl(recipePagePath(recipe)) : `${recipe.slug}.html`;
}

function imageUrl(prefix = '') {
  return SITE_ORIGIN ? absoluteUrl(DEFAULT_IMAGE) : `${prefix}${DEFAULT_IMAGE}`;
}

function makeList(items, itemprop) {
  const itempropValue = itemprop === 'recipeIngredient' ? 'recipeIngredient ingredients' : itemprop;
  const attr = itempropValue ? ` itemprop="${itempropValue}"` : '';
  return `<ul>${items.map((item) => `<li${attr}>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function recipeMethod(recipe) {
  return recipe.detailedInstructions && recipe.detailedInstructions.length > 0
    ? recipe.detailedInstructions
    : recipe.instructions;
}

function recipeKeywords(recipe) {
  return [recipe.type, recipe.time, ...recipe.tags].join(', ');
}

function makeCard(recipe) {
  const pills = [recipe.type, recipe.time, ...recipe.tags];
  return `      <article class="card" data-type="${escapeHtml(recipe.type)}" data-recipe-page="${escapeHtml(recipePagePath(recipe))}" itemscope itemtype="https://schema.org/Recipe">
        <meta itemprop="author" content="${escapeHtml(AUTHOR_NAME)}">
        <meta itemprop="image" content="${escapeHtml(imageUrl())}">
        <meta itemprop="recipeYield" content="${escapeHtml(recipe.yield)}">
        <meta itemprop="recipeCategory" content="${escapeHtml(recipe.type)}">
        <meta itemprop="prepTime" content="${escapeHtml(recipe.prepTime)}">
        <h3 itemprop="name">${escapeHtml(recipe.title)}</h3>
        <div class="meta">${pills.map((pill, index) => `<span class="pill${index === 0 ? ` ${escapeHtml(recipe.type)}` : ''}">${escapeHtml(pill)}</span>`).join('')}</div>
        <h4>Ingredients</h4>
        ${makeList(recipe.ingredients, 'recipeIngredient')}
        <details><summary>Method</summary>${makeList(recipe.instructions, 'recipeInstructions')}</details>
        <p class="note" itemprop="description">${escapeHtml(recipe.description)}</p>

        <div class="baby"><b>For 10-month-old</b>${escapeHtml(recipe.baby)}</div>
        <div class="actions">
          <button class="copy-ingredients" type="button">Copy ingredients</button>
          <button class="share-ingredients" type="button">Import to Bring!</button>
        </div>
      </article>`;
}

function replaceGeneratedBlock(html, cardsHtml) {
  const start = html.indexOf(START_MARKER);
  const end = html.indexOf(END_MARKER);

  if (start === -1 || end === -1 || end < start) {
    throw new Error('index.html is missing generated recipe card markers');
  }

  return `${html.slice(0, start + START_MARKER.length)}\n${cardsHtml}\n      ${html.slice(end)}`;
}

function replaceConstObject(html, marker, value) {
  const start = html.indexOf(marker);
  if (start === -1) {
    throw new Error(`index.html is missing marker: ${marker.trim()}`);
  }

  const objectStart = start + marker.length;
  const end = html.indexOf('\n      };', objectStart);
  if (end === -1) {
    throw new Error(`Could not find object end for marker: ${marker.trim()}`);
  }

  return `${html.slice(0, objectStart)}${JSON.stringify(value, null, 8).replace(/\n/g, '\n      ')};\n${html.slice(end + '\n      };'.length)}`;
}

function jsonLdFor(recipe) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.title,
    author: {
      '@type': 'Person',
      name: AUTHOR_NAME
    },
    description: recipe.description,
    image: imageUrl('../'),
    url: recipePageUrl(recipe),
    recipeYield: recipe.yield,
    prepTime: recipe.prepTime,
    recipeCategory: recipe.type,
    keywords: recipeKeywords(recipe),
    ingredients: recipe.ingredients,
    recipeIngredient: recipe.ingredients,
    recipeInstructions: recipeMethod(recipe),
    nutrition: recipe.nutrition ? {
      '@type': 'NutritionInformation',
      description: recipe.nutrition
    } : undefined,
    isBasedOn: recipe.similarRecipe ? recipe.similarRecipe.url : undefined
  };
}

function makeRecipePage(recipe) {
  const pills = [recipe.type, recipe.time, ...recipe.tags];
  const method = recipeMethod(recipe);
  const jsonLd = JSON.stringify(jsonLdFor(recipe), null, 2);
  const similarRecipeLink = recipe.similarRecipe
    ? `<p><a href="${escapeHtml(recipe.similarRecipe.url)}" rel="noopener">${escapeHtml(recipe.similarRecipe.label)}</a></p>`
    : '';
  const nutritionSection = recipe.nutrition
    ? `<h2>Why it nourishes</h2>
      <p class="callout" itemprop="nutrition" itemscope itemtype="https://schema.org/NutritionInformation"><span itemprop="description">${escapeHtml(recipe.nutrition)}</span></p>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(recipe.title)} | Family Meal Cards</title>
  <link rel="manifest" href="../manifest.json">
  <link rel="apple-touch-icon" href="../icons/icon-192.png">
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #faf7f0; color: #2f2a24; line-height: 1.5; }
    main { max-width: 760px; margin: 0 auto; padding: 2rem 1rem 3rem; }
    article { background: #fffdf8; border: 1px solid #e2d8c8; border-radius: 22px; padding: 1.2rem; box-shadow: 0 8px 22px rgba(80, 60, 35, .06); }
    h1 { margin: 0 0 .5rem; font-size: clamp(1.8rem, 5vw, 2.8rem); letter-spacing: -0.02em; }
    h2 { margin: 1.1rem 0 .25rem; font-size: .9rem; text-transform: uppercase; letter-spacing: .05em; color: #6f665d; }
    ul, ol { padding-left: 1.25rem; }
    li { margin: .2rem 0; }
    .meta { display: flex; gap: .4rem; flex-wrap: wrap; margin: .6rem 0 1rem; }
    .pill { border-radius: 999px; padding: .2rem .55rem; font-size: .82rem; background: #f2eadf; color: #6f665d; }
    .callout, .note, .baby { border: 1px solid #e2d8c8; border-left: 5px solid #6a7f59; border-radius: 14px; padding: .7rem .8rem; background: #eef5eb; color: #3e5d35; }
    .note, .baby { background: #fffaf0; color: #6f665d; }
    .baby { background: #f7efe1; }
    a { color: #6a7f59; font-weight: 650; }
  </style>
</head>
<body>
  <main>
    <p><a href="../index.html">Back to meal cards</a></p>
    <article itemscope itemtype="https://schema.org/Recipe">
      <meta itemprop="author" content="${escapeHtml(AUTHOR_NAME)}">
      <meta itemprop="image" content="${escapeHtml(imageUrl('../'))}">
      <meta itemprop="recipeYield" content="${escapeHtml(recipe.yield)}">
      <meta itemprop="recipeCategory" content="${escapeHtml(recipe.type)}">
      <meta itemprop="prepTime" content="${escapeHtml(recipe.prepTime)}">
      <h1 itemprop="name">${escapeHtml(recipe.title)}</h1>
      <p itemprop="description">${escapeHtml(recipe.description)}</p>
      <div class="meta">${pills.map((pill) => `<span class="pill">${escapeHtml(pill)}</span>`).join('')}</div>
      ${similarRecipeLink}
      <h2>Ingredients</h2>
      ${makeList(recipe.ingredients, 'recipeIngredient')}
      <h2>Method</h2>
      <ol>${method.map((step) => `<li itemprop="recipeInstructions">${escapeHtml(step)}</li>`).join('')}</ol>
      ${nutritionSection}
      <h2>For your little one</h2>
      <p class="baby"><b>For 10-month-old</b> ${escapeHtml(recipe.baby)}</p>
      <h2>Leftovers / reheating</h2>
      <p class="note">${escapeHtml(recipe.description)}</p>
    </article>
  </main>
</body>
</html>
`;
}

function buildServiceWorker(recipes) {
  const assets = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './recipes/index.json',
    ...recipes.map((recipe) => `./${recipePagePath(recipe)}`).sort()
  ];

  return `const CACHE_NAME = 'family-meal-cards-v7';
const ASSETS = ${JSON.stringify(assets, null, 2)};

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});
`;
}

function build() {
  const recipes = readRecipes();
  let indexHtml = fs.readFileSync(indexPath, 'utf8');

  indexHtml = replaceGeneratedBlock(indexHtml, recipes.map(makeCard).join('\n\n'));
  indexHtml = replaceConstObject(indexHtml, NUTRITION_MARKER, Object.fromEntries(recipes.map((recipe) => [recipe.title, recipe.nutrition || ''])));
  indexHtml = replaceConstObject(indexHtml, RECIPE_LINKS_MARKER, Object.fromEntries(recipes.filter((recipe) => recipe.similarRecipe).map((recipe) => [recipe.title, recipe.similarRecipe])));
  indexHtml = replaceConstObject(indexHtml, METHOD_MARKER, Object.fromEntries(recipes.filter((recipe) => recipe.detailedInstructions).map((recipe) => [recipe.title, recipe.detailedInstructions])));

  fs.writeFileSync(indexPath, indexHtml);

  recipes.forEach((recipe) => {
    fs.writeFileSync(path.join(recipeDir, `${recipe.slug}.html`), makeRecipePage(recipe));
  });

  fs.writeFileSync(serviceWorkerPath, buildServiceWorker(recipes));
}

build();
