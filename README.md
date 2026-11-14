# Holistix-ads-

Ad creatives for Holistix Health, with posting to X (and any other channel connected in Buffer) through the [Buffer API](https://developers.buffer.com).

## One-time setup

1. In Buffer, create an API key at **Settings → API** (publish.buffer.com/settings/api).
2. In this repo on GitHub, go to **Settings → Secrets and variables → Actions → New repository secret**, name it `BUFFER_ACCESS_TOKEN`, and paste the key. Never put the key in a file in this repo: the repo is public.
3. Go to **Actions → Buffer - check connection → Run workflow**. The log lists your Buffer organization and every connected channel with its id.

## Scheduling a post

1. Put the image in `creatives/` (it must be committed, because Buffer fetches it from the public raw GitHub URL).
2. Add a JSON file to `posts/queue/`, for example `posts/queue/2026-11-20-lumo.json`:

```json
{
  "channel": "twitter",
  "text": "EvenSkyn Lumo+ now $499.99 CAD. Shop at holistixhealth.ca",
  "image": "creatives/lumo-plus.png",
  "dueAt": "2026-11-20T15:00:00-05:00"
}
```

| Field | Meaning |
| --- | --- |
| `channel` | A service name (`twitter`, `instagram`, `facebook`…), a channel name, or a channel id. Use `channels` for several at once. Defaults to `twitter`. |
| `text` | The post copy. |
| `image` / `images` | A path in this repo or a public URL. |
| `dueAt` | Optional exact time (ISO 8601 with time zone). Leave it out to add the post to the next open slot in your Buffer queue. |

3. Commit to `main`. The **Buffer - schedule posts** workflow sends each queued file to Buffer and moves it to `posts/scheduled/` with the Buffer post id, so nothing is posted twice. You can also run that workflow by hand with **Dry run** ticked to preview.

## Running locally

```sh
cp .env.example .env   # then paste your key into .env (gitignored)
node scripts/buffer.mjs channels
node scripts/buffer.mjs schedule --dry-run
```

Requires Node 20 or newer; no packages to install.
