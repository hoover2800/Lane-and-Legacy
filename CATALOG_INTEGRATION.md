# Factory catalog integration

Controlled Factory → SQLite → catalog E2E PASS (September 19, 2026). Integrated with production email commit `12891b3`; deployment and live QA tracked in the Factory production report.

The source of truth is the existing KDP Factory `data/performance.sqlite3` database: `factory_products`, `factory_listings`, and additive `factory_website_profiles`. `products.json` is generated. Do not edit individual cards or maintain a second catalog.

From the KDP Factory root, run:

```sh
python3 -m kdp_factory.website_catalog sync --site production/lane-catalog-integration
python3 -m kdp_factory.website_catalog sync --site production/lane-catalog-integration --apply
```

Full operator workflow, record/readback schema, checks and human gates: `KDP_Factory/docs/WEBSITE_CATALOG_INTEGRATION.md`.

Only approved website profiles with saved, checksum-valid live marketplace evidence are activated. Three existing products qualify; four remain inactive. Full/category catalogs are unlimited; featured selection remains capped at four. Amazon cards share cart-icon BUY NOW. Etsy requires a verified live listing. The main Amazon CTA stays disabled until `shops.amazon` has matching `shopVerification.amazon` with `verified: true` and `scope: "full-catalog"`; never use an individual book URL.

Existing design, HTML/CSS, Worker, analytics and GitHub → Cloudflare settings are unchanged. No changes were made to the separate active email review checkout. Integrate this branch with the latest site work before deploying through the existing pipeline; do not copy over a concurrent checkout wholesale.

QA: 14 Node catalog tests; isolated browser testing at 1440/768/390/320 pixels; all eight filters; no overflow, broken loaded images or page errors. Nine-product browser fixture confirms 4 featured and 9 full/category cards. Results in `qa/catalog-browser-results.json`. External destinations use saved September 19 verification, not a fresh remote probe.

Production continuation: 372 Python and 28 JavaScript tests passed. The SQLite-backup fixture used approved real products and existing verified URLs; category/featured updates, idempotence, asset/output/backup checksums, invalid-input rejection, and byte-exact rollback passed. Production SQLite was not modified. The merge preserves Worker, analytics, signup, secrets declarations, routes, freebie, and disabled signup settings. Footer navigation now wraps at narrow mobile widths.
