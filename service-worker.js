const CACHE_NAME = 'family-meal-cards-v4';
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./recipes/index.json",
  "./recipes/10-minute-egg-fried-rice.html",
  "./recipes/baked-eggs-and-greens.html",
  "./recipes/baked-potato-bar.html",
  "./recipes/beef-lentil-and-hidden-veg-ragu.html",
  "./recipes/chicken-sweet-potato-and-broccoli-traybake.html",
  "./recipes/chickpea-tomato-feta-skillet.html",
  "./recipes/coconut-noodle-soup.html",
  "./recipes/freezer-soup-upgrade.html",
  "./recipes/frittata-with-potatoes-and-greens.html",
  "./recipes/golden-chicken-rice-and-greens-pot.html",
  "./recipes/green-power-soup.html",
  "./recipes/halloumi-veg-bowls.html",
  "./recipes/hummus-snack-board-dinner.html",
  "./recipes/lemon-lentil-and-spinach-dahl.html",
  "./recipes/miso-butter-beans-and-greens.html",
  "./recipes/moroccan-chickpea-and-carrot-stew.html",
  "./recipes/omelette-plate.html",
  "./recipes/quinoa-loaded-bowl.html",
  "./recipes/rainbow-nourish-plates.html",
  "./recipes/red-pesto-beans-on-toast.html",
  "./recipes/rotisserie-chicken-plate.html",
  "./recipes/salmon-potato-traybake.html",
  "./recipes/sardine-tomato-pasta.html",
  "./recipes/saucy-gnocchi.html",
  "./recipes/soup-eggs-bread.html",
  "./recipes/tacos-wraps.html",
  "./recipes/thai-curry.html",
  "./recipes/thermomix-carrot-ginger-and-red-lentil-soup.html",
  "./recipes/tuna-beans-and-tomato-salad.html",
  "./recipes/turkey-or-lentil-bolognese.html",
  "./recipes/warm-salmon-pea-and-potato-salad.html",
  "./recipes/yoghurt-bowl-dinner.html"
];

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
