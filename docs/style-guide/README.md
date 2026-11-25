# Holistix Health ad style guide

Hunter picked the eight designs in [`references/`](references/) on 2026-11-25 as the look for every ad from now on. Use them for inspiration only: copy the layout and mood, never another brand's name or text.

## Never break these

1. **The Holistix Health logo is on every image.** Use the official logo asset from Canva (folder "Brand logos", asset `MAHUaRZ9GTo`). Never redraw it with AI and never use the illustrated apothecary picture (`MAHUatwMBPo`).
2. **`holistixhealth.ca` is written on every image**, large enough to read on a phone.
3. **Real product photos only**, from the product page on holistixhealth.ca. An AI image is fine for the background or props, never for a product. No made-up labels or garbled label text (reference 03, 04 and 08 show exactly this problem: do not copy it).
4. **Real prices only**, from `data/catalog.json` on the day. Show a "was" price only when the site shows a higher compare-at price.
5. **No template leftovers.** Delete every placeholder brand, name and URL (for example "Sweety's Spa", "reallygreatsite.com", "Medicube").
6. **Nothing overlaps.** Text never sits on top of the product, the logo, or other text. Check the exported thumbnail before queueing.
7. No medical claims, fake reviews, or fake app screens.

## The styles

Rotate through these so that no two posts in a row use the same one. `scripts/rotation.mjs` suggests the next one; record the style id in the queue file as `"style"`.

| Id | Reference | Layout | Good for |
| --- | --- | --- | --- |
| `split-panel` | [01](references/01-split-panel-headline-url.jpg) | Sage colour block on top with the URL and a 2-3 line headline; lifestyle photo band in the middle; two footer boxes (short slogan + "Visit us at holistixhealth.ca"). Logo in the top block. | Categories, brand messages |
| `hero-collage` | [02](references/02-hero-collage-logo-cta.jpg) | Big centred logo, serif headline ("Your wellness. Your way."), a line of categories, several real products arranged on a stone or wood surface, dark green pill button, URL under a thin rule. | Category and whole-store ads |
| `quote-over-product` | [03](references/03-quote-over-product.jpg) | Soft single-colour room (blush, sand or sage), a short quote in a warm serif at the top, one product standing in soft window light, price under it. Logo at the top, URL at the bottom. | Single skincare or self-care products |
| `framed-arch` | [04](references/04-framed-arch-photo.jpg) | Rounded card with a small category word at the top, a photo cropped in an arch shape, a large soft headline under it. Logo + URL in the bottom margin. | Self-care, bath, candles, crystals |
| `photo-band` | [05](references/05-photo-band-headline-footer.jpg) | Thin top bar with the logo, wide lifestyle photo, big light headline + subline, footer with a CTA on the left and holistixhealth.ca on the right. | Categories, seasonal themes |
| `sale-icons` | [06](references/06-sale-price-feature-icons.jpg) | Product large on one side on draped fabric with flowers; on the other side the product name, "SALE", the price, the struck-out "was" price, and 3 round feature icons with short labels; a two-line tagline. Logo + URL at the bottom. | Products that are on sale on the site |
| `flatlay-quote` | [07](references/07-flatlay-lifestyle-quote.jpg) | Top-down wood or linen flat lay with leaves and real products along one edge, sunlight shadows, a large serif statement and a short paragraph on the open side. Logo + URL in a corner. | Brand messages, herbal and wellness categories |
| `botanical-card` | [08](references/08-botanical-product-card.jpg) | Cream background, the product framed by dried botanicals on a torn-paper panel, product name in a green serif, one benefit line, price, then logo + URL. | Single products, especially bottles and jars |

## Colours and type

- Pastel and earthy: sage `#bfcca3`, muted green `#4e6b45`, cream `#f4efe6`, sand `#e9dfcf`, blush `#f3c6c6`, terracotta `#c0643b`, warm brown `#7a3e22`, a touch of gold.
- Warm serif display fonts for headlines; clean light sans for small labels. No plain black corporate type.
- Soft natural window light, plant shadows, linen, stone, wood.

## Products and categories

Hunter wants **every product on the site** to get a turn, and **category ads** too (for example Dog & Cat, Healthy Home, Skincare, Supplements, Teas, Wellness Tech, Saunas, Candles, Crystals, Swimwear).

- Aim for about 1 category ad for every 3 product ads (so roughly 1 of the 4 daily posts).
- A category ad may show several real products from that category, links to the collection page (`holistixhealth.ca/collections/<handle>`), and needs no price.
- A product ad shows one product (carousels: one product per slide, 3 slides on a shared theme).
- Run `node scripts/rotation.mjs` to see which in-stock products and which collections have gone longest without an ad, and the next style to use. Add `"products"` (handles), `"collection"` (handle, for category ads) and `"style"` to every queue file so the rotation keeps track.
