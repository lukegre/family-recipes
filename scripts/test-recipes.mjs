import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const recipeDir = path.join(rootDir, 'recipes');
const indexPath = path.join(rootDir, 'index.html');
const dataPath = path.join(recipeDir, 'index.json');
const siteConfigPath = path.join(rootDir, 'site.config.json');

const siteConfig = JSON.parse(fs.readFileSync(siteConfigPath, 'utf8'));
const expectedOrigin = String(siteConfig.siteOrigin || '').replace(/\/$/, '');
const recipes = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const indexHtml = fs.readFileSync(indexPath, 'utf8');
const failures = [];

function fail(message) {
  failures.push(message);
}

function getJsonLd(html, file) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) {
    fail(`${file}: missing JSON-LD script`);
    return null;
  }

  try {
    return JSON.parse(match[1]);
  } catch (error) {
    fail(`${file}: invalid JSON-LD (${error.message})`);
    return null;
  }
}

function validateRecipeData() {
  const slugs = new Set();

  recipes.forEach((recipe, index) => {
    const label = recipe.title || `recipe ${index + 1}`;

    ['title', 'slug', 'type', 'time', 'prepTime', 'yield', 'description', 'baby'].forEach((field) => {
      if (!recipe[field]) fail(`${label}: missing ${field}`);
    });

    ['tags', 'ingredients', 'instructions'].forEach((field) => {
      if (!Array.isArray(recipe[field]) || recipe[field].length === 0) {
        fail(`${label}: ${field} must be a non-empty array`);
      }
    });

    if (slugs.has(recipe.slug)) fail(`${label}: duplicate slug ${recipe.slug}`);
    slugs.add(recipe.slug);
  });
}

function validateIndexCards() {
  const cardMatches = [...indexHtml.matchAll(/<article class="card"[^>]*data-recipe-page="([^"]+)"[^>]*itemscope itemtype="https:\/\/schema.org\/Recipe"/g)];
  const cardPages = cardMatches.map((match) => match[1]);

  if (cardPages.length !== recipes.length) {
    fail(`index.html: expected ${recipes.length} recipe cards, found ${cardPages.length}`);
  }

  recipes.forEach((recipe) => {
    const recipePath = `recipes/${recipe.slug}.html`;
    if (!cardPages.includes(recipePath)) {
      fail(`index.html: missing card data-recipe-page for ${recipePath}`);
    }
  });
}

function validateRecipePages() {
  recipes.forEach((recipe) => {
    const relativePath = `recipes/${recipe.slug}.html`;
    const filePath = path.join(rootDir, relativePath);

    if (!fs.existsSync(filePath)) {
      fail(`${relativePath}: missing generated recipe page`);
      return;
    }

    const html = fs.readFileSync(filePath, 'utf8');
    const data = getJsonLd(html, relativePath);
    if (!data) return;

    if (data['@context'] !== 'https://schema.org') fail(`${relativePath}: @context must be https://schema.org`);
    if (data['@type'] !== 'Recipe') fail(`${relativePath}: @type must be Recipe`);
    if (data.name !== recipe.title) fail(`${relativePath}: name does not match recipe title`);
    if (!data.author) fail(`${relativePath}: missing author`);
    if (!Array.isArray(data.recipeIngredient) || data.recipeIngredient.length === 0) fail(`${relativePath}: missing recipeIngredient`);
    if (!Array.isArray(data.ingredients) || data.ingredients.length === 0) fail(`${relativePath}: missing legacy ingredients`);
    if (JSON.stringify(data.recipeIngredient) !== JSON.stringify(data.ingredients)) fail(`${relativePath}: recipeIngredient and ingredients differ`);
    if (!String(data.image || '').startsWith(`${expectedOrigin}/icons/`)) fail(`${relativePath}: image must be an absolute public icon URL`);
    if (String(data.image || '').includes('/../')) fail(`${relativePath}: image contains /../`);
    if (data.url !== `${expectedOrigin}/${relativePath}`) fail(`${relativePath}: url must be the public recipe URL`);
    if (!html.includes('itemprop="recipeIngredient ingredients"')) fail(`${relativePath}: missing dual ingredient microdata`);
  });
}

validateRecipeData();
validateIndexCards();
validateRecipePages();

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(`Recipe validation passed for ${recipes.length} recipes.`);

