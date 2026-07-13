# Card Benefits Dashboard — auto-publishing (Model B)

A single-file dashboard (`index.html`) that consolidates the restaurant/wine/food
benefits of three cards (Santander WorldMember Limited, Scotiabank Singular Visa
Infinite, Banco Bice Visa Infinite), enriched with Google ratings, price bands and
links. It publishes to a **fixed GitHub Pages URL** so the WhatsApp link never
changes — only the content does.

## How the automation works (Model B — hybrid)

| Stage | Who / what | Notes |
|-------|-----------|-------|
| **Schedule** | `.github/workflows/nudge.yml` (cron, 2nd of month) | Opens a reminder **issue** (GitHub emails you). It does **not** scrape — the banks' feeds are geo-/bot-protected and unreliable from a cloud IP. |
| **Data pull** | You / Claude via the browser on a **Chilean IP** | The reliable way to get past the banks' defences. Produces the three `data/*.json` files. |
| **Build + publish** | `.github/workflows/build.yml` (on data commit) | Runs `build.js`, validates, regenerates `index.html`, and GitHub Pages redeploys. **No manual re-upload.** |

## One-time setup (~5 min)

1. Create a new GitHub repository and push these files (or upload them via the web UI).
2. **Settings → Pages → Build and deployment → Source: `GitHub Actions`.**
3. **Settings → Actions → General →** allow workflows, and under *Workflow permissions* select **Read and write permissions** (so the build can commit `index.html` and open issues).
4. Push once (or run **Actions → Build & deploy dashboard → Run workflow**). Your site goes live at:
   `https://<your-username>.github.io/<repo-name>/`
5. Share **that** URL on WhatsApp — once. It never changes.

> Want a prettier link like `beneficios.tudominio.cl`? Add a custom domain under Settings → Pages.

## The monthly loop (~5 min, on the 2nd)

1. You get an auto-issue: *“Refresh benefits dashboard — <Month>”*.
2. Ask Claude to **pull the three bank feeds** (browser, Chilean IP) and update:
   - `data/san.json`, `data/sco.json`, `data/bice.json`
   - append any brand-new venues to `enrich.json` (ratings) and `web.json` (sites)
3. Commit. **Build & deploy** runs automatically → same URL, new month. Close the issue.

## Data file formats

- `data/san.json` — Santander rows: `[name, daysCSV, region, flags]`
  - `daysCSV`: comma list of `lun,mar,mie,jue,vie,sab,dom` or `diario` (every day)
  - `region`: `RM` (Metropolitana) · `R` (Regiones) · `RMR` (both) · `""` (Nacional)
  - `flags`: string that may contain `W` (WorldMember Limited), `M` (Miércoles de Sabores), `A` (Amex — excluded from this card set)
- `data/sco.json` — Scotiabank rows: `[name, day, discNum, loc, subcat]`
  - `subcat`: `Local` · `Internacional` · `Vinas` · `Dulce` · `Rapida`
- `data/bice.json` — Bice rows: `[name, daysCSV, disc, loc, cat]`
  - `disc`: e.g. `"40%"` · `cat`: `R` (restaurant) · `G` (gourmet/dessert) · `D` (delivery)
- `enrich.json` — ratings cache: `{ "venue (lowercased, accents stripped)": [rating, reviewCount, priceLevel 0–4] }`
- `web.json` — official-site cache: `{ "venue (same key)": "https://..." }` (missing → the card falls back to a Google listing link)

## Local build / test

```bash
node build.js                 # rebuild index.html for the current month
DATA_MONTH="August 2026" node build.js   # override the stamp
```

`build.js` **validates before writing**: if any bank feed is empty or the total is
below 120 venues, it exits non-zero and refuses to publish — so a half-scraped
month can never overwrite a working dashboard.

## Gotchas

- **Cron is UTC.** `0 4 2 * *` ≈ midnight in Santiago on the 2nd; GitHub may also delay scheduled runs a few minutes (irrelevant monthly).
- **Pages source must be `GitHub Actions`** (not “Deploy from a branch”), or `deploy-pages` will fail.
- **Ratings are a cache** — don't re-pull all ~150 venues each month; only add new ones.
- **Phone caching:** the same URL means a browser may show yesterday's copy briefly; the visible “Updated <Month>” stamp is the tell, and a pull-to-refresh forces the latest.
