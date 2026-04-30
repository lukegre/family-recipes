#!/usr/bin/env node

const fs = require('fs');

const defaultBaseUrl = 'https://lukegre.github.io/family-recipes';
const args = process.argv.slice(2);
const baseUrl = (args.find(arg => arg.startsWith('--base-url=')) || '').split('=')[1] || defaultBaseUrl;
const slug = (args.find(arg => arg.startsWith('--recipe=')) || '').split('=')[1] || 'lemon-lentil-and-spinach-dahl';
const all = args.includes('--all');
const verbose = args.includes('--verbose');

function recipeUrl(recipeSlug) {
  return `${baseUrl.replace(/\/$/, '')}/recipes/${recipeSlug}.html`;
}

function parserUrl(url) {
  const params = new URLSearchParams({
    url,
    baseQuantity: '4',
    requestedQuantity: '4'
  });
  return `https://api.getbring.com/rest/bringrecipes/parser?${params.toString()}`;
}

function getRecipeSlugs() {
  if (!all) return [slug];

  const index = JSON.parse(fs.readFileSync('recipes/index.json', 'utf8'));
  return index.map(recipe => recipe.slug);
}

function validateParsedRecipe(recipeSlug, data) {
  const problems = [];

  if (!data.name) problems.push('missing name');
  if (!data.author) problems.push('missing author');
  if (!Array.isArray(data.items) || data.items.length === 0) problems.push('missing items');
  if (!Array.isArray(data.ingredients) || data.ingredients.length === 0) problems.push('missing ingredients');
  if (!data.imageUrl) problems.push('missing imageUrl');
  if (data.imageUrl && data.imageUrl.includes('/../')) problems.push(`broken imageUrl: ${data.imageUrl}`);
  if (data.linkOutUrl && !data.linkOutUrl.includes(`/recipes/${recipeSlug}.html`)) {
    problems.push(`unexpected linkOutUrl: ${data.linkOutUrl}`);
  }

  return problems;
}

async function checkRecipe(recipeSlug) {
  const url = recipeUrl(recipeSlug);
  const response = await fetch(parserUrl(url));
  const text = await response.text();

  if (!response.ok) {
    return {
      slug: recipeSlug,
      ok: false,
      problems: [`HTTP ${response.status}: ${text.slice(0, 300)}`]
    };
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return {
      slug: recipeSlug,
      ok: false,
      problems: [`invalid JSON: ${error.message}`]
    };
  }

  const problems = validateParsedRecipe(recipeSlug, data);

  return {
    slug: recipeSlug,
    ok: problems.length === 0,
    problems,
    parsed: {
      name: data.name,
      author: data.author,
      itemCount: Array.isArray(data.items) ? data.items.length : 0,
      imageUrl: data.imageUrl,
      linkOutUrl: data.linkOutUrl
    },
    url
  };
}

(async function main() {
  const results = [];

  for (const recipeSlug of getRecipeSlugs()) {
    results.push(await checkRecipe(recipeSlug));
  }

  if (verbose) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    const summary = results.map(result => ({
      slug: result.slug,
      ok: result.ok,
      problems: result.problems,
      itemCount: result.parsed ? result.parsed.itemCount : 0,
      imageUrl: result.parsed ? result.parsed.imageUrl : null
    }));
    console.log(JSON.stringify(summary, null, 2));
  }

  if (results.some(result => !result.ok)) {
    process.exitCode = 1;
  }
})();
