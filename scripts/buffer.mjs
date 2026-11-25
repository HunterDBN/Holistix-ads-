#!/usr/bin/env node
// Buffer API helper for Holistix ads. No dependencies (Node 20+).
//
//   node scripts/buffer.mjs channels             List organizations and connected channels
//   node scripts/buffer.mjs localize             Download remote images in posts/queue/ into creatives/
//   node scripts/buffer.mjs schedule [--dry-run] Send queued posts due within WINDOW_HOURS to Buffer
//
// The API key is read from BUFFER_ACCESS_TOKEN (GitHub Actions secret, or a local
// gitignored .env file). It is never printed.

import { readFileSync, readdirSync, writeFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const QUEUE_DIR = join(ROOT, "posts", "queue");
const DONE_DIR = join(ROOT, "posts", "scheduled");
const FAILED_DIR = join(ROOT, "posts", "failed");
const CREATIVES_DIR = join(ROOT, "creatives");
// Buffer's free plan allows 10 scheduled posts per channel. At 4 posts a day, only
// send posts due within the next WINDOW_HOURS; the rest wait in posts/queue/ and
// a later run (the workflow runs every few hours) sends them.
const WINDOW_HOURS = Number(process.env.WINDOW_HOURS || 56);
const API_URL = "https://api.buffer.com";

loadDotEnv();
const TOKEN = process.env.BUFFER_ACCESS_TOKEN;

function loadDotEnv() {
  const file = join(ROOT, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function gql(query, variables = {}) {
  if (!TOKEN) fail("BUFFER_ACCESS_TOKEN is not set. Add it as a GitHub Actions secret or in a local .env file.");
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.text();
  let json;
  try { json = JSON.parse(body); } catch { fail(`Buffer API returned HTTP ${res.status}: ${body.slice(0, 300)}`); }
  if (!res.ok || json.errors?.length) {
    fail(`Buffer API error (HTTP ${res.status}): ${JSON.stringify(json.errors ?? json).slice(0, 500)}`);
  }
  return json.data;
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

async function getOrganizations() {
  const data = await gql(`query { account { organizations { id name } } }`);
  return data.account.organizations;
}

async function getChannels(organizationId) {
  const data = await gql(
    `query { channels(input: { organizationId: ${JSON.stringify(organizationId)} }) {
       id name displayName service isQueuePaused
     } }`,
  );
  return data.channels;
}

async function resolveOrganization() {
  if (process.env.BUFFER_ORGANIZATION_ID) return process.env.BUFFER_ORGANIZATION_ID;
  const orgs = await getOrganizations();
  if (!orgs.length) fail("This Buffer account has no organizations.");
  return orgs[0].id;
}

async function cmdChannels() {
  const orgs = await getOrganizations();
  console.log(`✓ Buffer API key works. ${orgs.length} organization(s):`);
  for (const org of orgs) {
    console.log(`\n${org.name}  (organization id: ${org.id})`);
    const channels = await getChannels(org.id);
    if (!channels.length) console.log("  (no channels connected)");
    for (const c of channels) {
      const paused = c.isQueuePaused ? "  [queue paused]" : "";
      console.log(`  - ${c.service.padEnd(10)} ${c.displayName || c.name}  (channel id: ${c.id})${paused}`);
    }
  }
}

// Serialize a JS value as a GraphQL input literal. Values wrapped in enumValue() stay unquoted.
const ENUM = Symbol("enum");
const enumValue = (v) => ({ [ENUM]: v });
function toGraphQL(v) {
  if (v && v[ENUM]) return v[ENUM];
  if (Array.isArray(v)) return `[${v.map(toGraphQL).join(", ")}]`;
  if (v && typeof v === "object") return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${toGraphQL(x)}`).join(", ")} }`;
  return JSON.stringify(v);
}

// Turn a repo-relative image path into a public raw.githubusercontent.com URL.
function publicImageUrl(image) {
  if (/^https?:\/\//.test(image)) return image;
  const repo = process.env.GITHUB_REPOSITORY || "HunterDBN/Holistix-ads-";
  const ref = process.env.IMAGE_REF || process.env.GITHUB_SHA || "main";
  const path = image.replace(/^\.?\//, "").split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${repo}/${ref}/${path}`;
}

function pickChannel(channels, wanted) {
  const w = String(wanted).toLowerCase();
  const matches = channels.filter(
    (c) => c.id === wanted || c.service.toLowerCase() === w || (c.name || "").toLowerCase() === w || (c.displayName || "").toLowerCase() === w,
  );
  if (matches.length === 1) return matches[0];
  if (!matches.length) throw new Error(`no Buffer channel matches "${wanted}". Run "channels" to see the options.`);
  throw new Error(`"${wanted}" matches ${matches.length} channels; use the channel id instead.`);
}


// Canva export links expire after a few hours, so copy every remote image into
// creatives/ and point the queue file at the committed copy.
async function cmdLocalize() {
  if (!existsSync(QUEUE_DIR)) return;
  mkdirSync(CREATIVES_DIR, { recursive: true });
  for (const file of readdirSync(QUEUE_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const path = join(QUEUE_DIR, file);
    const post = JSON.parse(readFileSync(path, "utf8"));
    const key = post.images ? "images" : "image";
    const list = [].concat(post[key] ?? []);
    if (!list.some((u) => /^https?:\/\//.test(u) && !u.includes("githubusercontent.com"))) continue;
    const stem = file.replace(/\.json$/, "").replace(/-(facebook|tiktok|instagram|twitter)$/, "");
    const out = [];
    for (const [i, url] of list.entries()) {
      if (!/^https?:\/\//.test(url) || url.includes("githubusercontent.com")) { out.push(url); continue; }
      const rel = `creatives/${stem}${list.length > 1 ? `-${i + 1}` : ""}.png`;
      if (!existsSync(join(ROOT, rel))) {
        const res = await fetch(url);
        if (!res.ok) { console.error(`✗ ${file}: could not download image ${i + 1} (HTTP ${res.status})`); out.push(url); continue; }
        writeFileSync(join(ROOT, rel), Buffer.from(await res.arrayBuffer()));
        console.log(`✓ saved ${rel}`);
      }
      out.push(rel);
    }
    post[key] = Array.isArray(post[key]) ? out : out[0];
    writeFileSync(path, JSON.stringify(post, null, 2) + "\n");
  }
}

async function cmdSchedule(dryRun) {
  if (!existsSync(QUEUE_DIR)) return console.log("No posts/queue folder; nothing to schedule.");
  const horizon = Date.now() + WINDOW_HOURS * 3600e3;
  const all = readdirSync(QUEUE_DIR).filter((f) => f.endsWith(".json")).sort();
  const files = all.filter((f) => {
    const { dueAt } = JSON.parse(readFileSync(join(QUEUE_DIR, f), "utf8"));
    return !dueAt || new Date(dueAt).getTime() <= horizon;
  });
  console.log(`${all.length} post(s) in the queue, ${files.length} due within ${WINDOW_HOURS}h.`);
  if (!files.length) return;

  const channels = await getChannels(await resolveOrganization());
  mkdirSync(DONE_DIR, { recursive: true });
  let failures = 0;

  for (const file of files) {
    const path = join(QUEUE_DIR, file);
    try {
      const post = JSON.parse(readFileSync(path, "utf8"));
      if (!post.text) throw new Error('missing "text"');
      const targets = [].concat(post.channels ?? post.channel ?? []);
      if (!targets.length) throw new Error('missing "channel" (for example "facebook" or "tiktok")');
      const images = [].concat(post.images ?? post.image ?? []);

      for (const target of targets) {
        const channel = pickChannel(channels, target);
        const input = {
          text: post.text,
          channelId: channel.id,
          schedulingType: enumValue("automatic"),
          mode: enumValue(post.dueAt ? "customScheduled" : "addToQueue"),
          // A time that has already passed (a late run) is moved to 10 minutes from now.
          ...(post.dueAt && { dueAt: new Date(Math.max(new Date(post.dueAt).getTime(), Date.now() + 10 * 60e3)).toISOString() }),
          ...(images.length && { assets: images.map((img) => ({ image: { url: publicImageUrl(img) } })) }),
          // Facebook (and Instagram) need a post type: post, story or reel. Defaults to a feed post.
          ...(["facebook", "instagram"].includes(channel.service) && {
            metadata: { [channel.service]: { type: enumValue(post.type || "post") } },
          }),
        };
        const when = input.dueAt ? `at ${input.dueAt}` : "to the next queue slot";
        if (dryRun) {
          console.log(`• [dry run] ${file} → ${channel.service} (${channel.displayName || channel.name}) ${when}`);
          continue;
        }
        const data = await gql(
          `mutation { createPost(input: ${toGraphQL(input)}) {
               ... on PostActionSuccess { post { id dueAt } }
               ... on MutationError { message }
             } }`,
        );
        const result = data.createPost;
        if (result.message) throw new Error(`Buffer refused the post: ${result.message}`);
        console.log(`✓ ${file} → ${channel.service} ${when} (Buffer post ${result.post.id}, due ${result.post.dueAt})`);
        (post.buffer ??= []).push({ channel: channel.service, channelId: channel.id, postId: result.post.id, dueAt: result.post.dueAt });
      }

      if (!dryRun) {
        post.scheduledAt = new Date().toISOString();
        writeFileSync(path, JSON.stringify(post, null, 2) + "\n");
        renameSync(path, join(DONE_DIR, basename(file)));
      }
    } catch (err) {
      // Buffer's free plan caps scheduled posts per channel. Nothing was created,
      // so leave the post queued; the 6-hourly run sends it once a slot frees up.
      if (/scheduled posts limit reached/i.test(err.message)) {
        console.log(`… ${file}: Buffer queue is full, keeping it queued for the next run`);
        continue;
      }
      failures++;
      console.error(`✗ ${file}: ${err.message}`);
      // Park it in posts/failed/ so the next run does not retry (and double-post) it.
      if (!dryRun && existsSync(path)) {
        mkdirSync(FAILED_DIR, { recursive: true });
        const post = JSON.parse(readFileSync(path, "utf8"));
        post.error = err.message;
        writeFileSync(path, JSON.stringify(post, null, 2) + "\n");
        renameSync(path, join(FAILED_DIR, basename(file)));
      }
    }
  }
  if (failures) process.exit(1);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "channels") await cmdChannels();
else if (cmd === "localize") await cmdLocalize();
else if (cmd === "schedule") await cmdSchedule(args.includes("--dry-run"));
else {
  console.log("Usage: node scripts/buffer.mjs <channels|localize|schedule> [--dry-run]");
  process.exit(cmd ? 1 : 0);
}
