#!/usr/bin/env node
// Suggests what the next ads should feature, so every product and category on
// holistixhealth.ca gets a turn and the styles in docs/style-guide rotate.
//
//   node scripts/rotation.mjs            next 12 products, 6 collections, next styles
//   node scripts/rotation.mjs --json     same, as JSON
//   node scripts/rotation.mjs -n 20      more product suggestions
//
// Reads data/catalog.json and data/collections.json (written by the "Store -
// snapshot catalog" workflow) and every post in posts/queue, posts/scheduled
// and posts/failed. A post counts for a product when its "products" list holds
// the product handle (older posts without it are matched on the title in the
// text), and for a collection when its "collection" field holds the handle.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STYLES = [
  "quote-over-product",
  "split-panel",
  "sale-icons",
  "framed-arch",
  "hero-collage",
  "botanical-card",
  "photo-band",
  "flatlay-quote",
];
// Store collections that are not real shopping categories.
const SKIP_COLLECTIONS = /^(all|frontpage|home-page|featured|best-?sellers?|new-arrivals?|sale|coming-soon)$/i;

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const nIdx = args.indexOf("-n");
const N = nIdx >= 0 ? Number(args[nIdx + 1]) || 12 : 12;

const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);
const catalog = readJson(join(ROOT, "data/catalog.json"), []);
const collections = readJson(join(ROOT, "data/collections.json"), []);

const posts = [];
for (const dir of ["queue", "scheduled", "failed"]) {
  const d = join(ROOT, "posts", dir);
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d).filter((f) => f.endsWith(".json"))) {
    try {
      const p = JSON.parse(readFileSync(join(d, f), "utf8"));
      const date = p.dueAt || f.slice(0, 10);
      posts.push({ ...p, file: f, date });
    } catch {}
  }
}
// One entry per ad (facebook and tiktok copies share a slug).
const ads = new Map();
for (const p of posts) {
  const slug = p.file.replace(/-(facebook|tiktok|instagram|twitter|x)\.json$/, "");
  if (!ads.has(slug) || ads.get(slug).date < p.date) ads.set(slug, p);
}
const history = [...ads.values()].sort((a, b) => a.date.localeCompare(b.date));

const lastUsedProduct = new Map();
const lastUsedCollection = new Map();
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
for (const ad of history) {
  for (const h of ad.products || []) lastUsedProduct.set(h, ad.date);
  if (ad.collection) lastUsedCollection.set(ad.collection, ad.date);
}
// Older posts have no "products" field: match product titles in the copy.
const legacy = history.filter((a) => !a.products);
if (legacy.length) {
  for (const p of catalog) {
    const t = norm(p.title);
    if (t.length < 8) continue;
    for (const ad of legacy) if (norm(ad.text || "").includes(t)) lastUsedProduct.set(p.handle, ad.date);
  }
}

// Products: in stock, with a photo and a price. Never-advertised first, then the
// longest since their last ad, taking turns across product types for variety.
const eligible = catalog.filter((p) => p.available && p.images?.length && Number(p.price) > 0 && !/coming soon/i.test(p.type || ""));
const byType = new Map();
for (const p of eligible) {
  const t = p.type || "Other";
  if (!byType.has(t)) byType.set(t, []);
  byType.get(t).push(p);
}
const key = (p) => lastUsedProduct.get(p.handle) || "";
for (const list of byType.values()) list.sort((a, b) => key(a).localeCompare(key(b)));
const types = [...byType.keys()].sort((a, b) => key(byType.get(a)[0]).localeCompare(key(byType.get(b)[0])) || Math.random() - 0.5);
const productPicks = [];
for (let round = 0; productPicks.length < N && round < 50; round++) {
  for (const t of types) {
    const p = byType.get(t)[round];
    if (p && productPicks.length < N) productPicks.push(p);
  }
}

const collectionPicks = collections
  .filter((c) => !SKIP_COLLECTIONS.test(c.handle) && (c.products_count ?? 1) > 0)
  .sort((a, b) => (lastUsedCollection.get(a.handle) || "").localeCompare(lastUsedCollection.get(b.handle) || ""))
  .slice(0, 6);

const recentStyles = history.filter((a) => a.style).map((a) => a.style);
const last = recentStyles.at(-1);
const start = last && STYLES.includes(last) ? (STYLES.indexOf(last) + 1) % STYLES.length : 0;
const nextStyles = [0, 1, 2, 3].map((i) => STYLES[(start + i) % STYLES.length]);

const out = {
  nextStyles,
  recentStyles: recentStyles.slice(-8),
  products: productPicks.map((p) => ({
    handle: p.handle, title: p.title, type: p.type, price: p.price,
    compareAt: Number(p.compareAt) > Number(p.price) ? p.compareAt : null,
    lastAd: lastUsedProduct.get(p.handle) || null,
    url: `https://holistixhealth.ca/products/${p.handle}`, image: p.images[0],
  })),
  collections: collectionPicks.map((c) => ({
    handle: c.handle, title: c.title, products: c.products_count ?? null,
    lastAd: lastUsedCollection.get(c.handle) || null,
    url: `https://holistixhealth.ca/collections/${c.handle}`, image: c.image || null,
  })),
  coverage: { inStockProducts: eligible.length, advertised: eligible.filter((p) => lastUsedProduct.has(p.handle)).length },
};

if (asJson) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`Next styles: ${nextStyles.join(", ")}`);
  console.log(`Coverage: ${out.coverage.advertised} of ${out.coverage.inStockProducts} in-stock products have had an ad\n`);
  console.log("Products to feature next:");
  for (const p of out.products) console.log(`  ${p.title} [${p.type || "-"}] $${p.price}${p.compareAt ? ` (was $${p.compareAt})` : ""}  last ad: ${p.lastAd || "never"}  ${p.url}`);
  console.log("\nCategories to feature next:");
  if (!out.collections.length) console.log("  (no data/collections.json yet: run the Store - snapshot catalog workflow)");
  for (const c of out.collections) console.log(`  ${c.title} (${c.products ?? "?"} products)  last ad: ${c.lastAd || "never"}  ${c.url}`);
}
