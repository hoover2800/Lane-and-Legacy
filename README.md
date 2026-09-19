> Current catalog integration checkpoint: `CATALOG_INTEGRATION.md`. Older deployment/link notes below are historical.

# Lane & Legacy Publishing website

A static HTML/CSS/JavaScript website. The existing GitHub → Cloudflare Workers Builds integration deploys `main`. No framework, package manager, compilation step, Wrangler configuration, or replacement hosting service has been introduced.

## Local preview

From this directory:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173. Serve over HTTP; opening `index.html` directly cannot fetch the JSON catalog.

## Product updates

Run the Factory catalog sync; `products.json` is generated and must not be maintained manually. See `CATALOG_INTEGRATION.md`. Each record supports:

- `id`, `slug`: stable unique identifiers.
- `title`, `subtitle`, `shortDescription`, `description`, `category`, `image`, `imageAlt`, image dimensions.
- `price` (null until verified), `status`, `productType`, optional `campaign` and `source`.
- `amazonUrl`, `etsyUrl`: verified HTTPS destinations, otherwise `null`.
- `featured`, `featuredPriority`, `active`: homepage eligibility and order. The homepage displays up to four verified active records, preferring featured records in priority order; title breaks ties.
- `formats`: confirmed formats (`print`, `digital`). Add `digital` only when confirmed; its Etsy button appears only with an exact verified live listing.
- `types`: `planner`, `workbook`, `tracker`, `journal`; used by footer filtering.
- `publishDate`: optional ISO date, currently unknown (`null`).

Category IDs: `home`, `education`, `wellness`, `finance`, `travel`, `work`, `hobbies`, `more`. Search, categories, product types, and featured selection all use this one catalog. Empty categories show an honest empty state. No automation service is needed to rotate featured records later.

## Shop and social destinations

Edit `site-config.json`. URLs were retained from repository commit `8623ffd535952b86ec83c4f3085d9ea3c5d84b91`. The general Amazon destination is null and the hero CTA is clearly pending. The verified 3D Print Project Lab URL is used only on its product card.

Connected: Homeowner, Teacher and 3D Print Amazon product URLs, and all five social profiles including YouTube. Missing: general Amazon storefront, Travel/Kiln/Pickleball/Espresso Amazon URLs, and all product-specific Etsy URLs. No digital product variants are claimed until confirmed. The Etsy shop CTA remains connected. Missing destinations do not use fake `#` links.

Outbound links use `outboundAttributes()` for consistent HTTPS validation, new-tab safety, platform/placement/product metadata. A local `lane:outbound` event is available for a later privacy-conscious analytics integration. There is no analytics service, storage, or visitor identifier. Optional UTM attribution is disabled by default. Set `outboundTracking.enabled`, a verified source/campaign, and permitted platforms to enable it; per-product source/campaign can override the defaults. This labels outbound URLs; it does not itself collect conversion data.

## Images

The three user-approved Krea PNGs are preserved byte-for-byte in `assets/originals/`. `assets/provenance.json` records source SHA-256 checksums and responsive WebP copies. Hero/scenic images use `srcset`; below-the-fold images load lazily. These approved originals are portrait (832 × 1248), so the website uses intentional object-fit crops.

Seven real product families are now cataloged. The owner-supplied Travel thumbnail replaces the older low-resolution image. Three additional approved covers were copied from existing Factory artifacts; `assets/catalog-provenance.json` records their provenance. Lossless WebP copies reduce bytes without altering artwork. The Travel source is still thumbnail-sized; a larger approved export would improve high-density displays.

`logo.png` is unchanged. `assets/images/logo.webp` is a lossless copy with identical decoded pixels. CSS excludes surrounding blank canvas without clipping the logo artwork. The footer uses CSS inversion and screen blending to display the existing logo in white without its white canvas. The source image and logo geometry are unchanged; no transparent source was available.

## Checks

With Node.js installed:

```sh
node --check app.js
node --test qa/catalog.test.cjs
git diff --check
```

This repository has no build, lint, or TypeScript task. The static site itself is the production artifact. See `WEBSITE_COMPLETION_REPORT.md` for current results; earlier reports are historical checkpoints.

## Review and deployment

Completed work is committed on `redesign/visual-review`. Existing publishing authorization applies. Authenticated GitHub access was verified September 19; production is https://laneandlegacy.com. The catalog continuation integrates with email production commit `12891b3` and retains the existing Cloudflare integration and disabled signup gates. See `CATALOG_INTEGRATION.md`.

## Featured selection

`site-config.json` → `featuredSelection` defaults to `manual`, preserving the approved four cards. `scheduled` uses the configured UTC epoch and periodDays for stable rotation (never random per reload); flag additional products featured to rotate a larger pool. `performance` accepts an externally supplied `performanceRankedIds` list. Missing/inactive images are excluded from featured selection; the catalog has a safe image fallback. No performance data collector or automatic product publishing is installed.
