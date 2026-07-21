# static-qr-experience

Static landing pages for ONDC "Experience" QR codes. Each QR at a venue points
to a page that lists authorised ONDC buyer apps for booking tickets.

Live at [experience.ondc.tech](https://experience.ondc.tech).

## For content editors (BD)

Day-to-day updates need **only** `data/entities.json` (and new images when required).
You do **not** create HTML folders or edit page files by hand.

### 1. Edit content

All content lives in **`data/entities.json`** at the repo root.
Project-specific branding and copy go under `site` — the shared `scripts/` folder has no hardcoded names.

```json
{
  "site": {
    "productName": "Discover Experiences",
    "brandName": "ONDC",
    "gaId": "G-X9LS4KMKBC",
    "org": {
      "name": "ONDC",
      "url": "https://ondc.org",
      "logo": "ondc-logo.svg"
    },
    "copy": {
      "rootTitle": "Select Your City",
      "entitySubtitle": "Beat the queue, entry tickets in a jiffy"
    }
  },
  "buyers": {
    "highway-delite": {
      "label": "Highway Delite",
      "logo": "highway-delite.png"
    }
  },
  "cities": [
    {
      "slug": "mumbai",
      "name": "Mumbai",
      "entities": [
        {
          "slug": "nehru-science-centre-mumbai",
          "name": "Nehru Science Centre",
          "photo": "nehru-science-centre.jpg",
          "buyers": [
            { "id": "highway-delite", "status": "live", "url": "https://..." }
          ]
        }
      ]
    }
  ]
}
```

| Field              | Notes                                                      |
| ------------------ | ---------------------------------------------------------- |
| `site.copy`        | All page text — see `scripts/site-config.mjs` for defaults |
| `buyers` (top-level) | Catalog — define `label` + `logo` once                     |
| `photo` / `logo`   | **Filename only** — file in `public/assets/images/`        |
| Entity `buyers`      | Use catalog `id`, plus `status` and `url`                  |
| `status`           | `"live"` (needs `url`), `"pending"`, or `"na"` (hidden)    |

**Adding a city or venue:** add entries to JSON only — `node scripts/generate.mjs` creates the HTML folders.

### 2. Add an image

1. Drop a **kebab-case** file into `public/assets/images/`.
2. Reference just the filename in JSON.

### 3. Publish

Push to `main`. CI runs generate and deploys `public/`.

**Local preview** (same folder CI deploys):

```bash
node scripts/generate.mjs
cp data/entities.json public/data/entities.json
python3 -m http.server 8000 -d public
```

Open `http://localhost:8000/`.

## Site structure

```
data/entities.json          # edit this (source of truth)
public/                     # full website after generate (preview + deploy)
  index.html, delhi/, …     # generated HTML
  data/entities.json        # copied from data/ before preview or deploy (not by generate)
  assets/images/            # project images (you add these)
  assets/js, css/           # synced from scripts/static/ on generate
scripts/                    # generic generator — copy to other projects
CNAME                       # custom domain (repo root only)
```

Edit JSON in `data/`. Run generate. `public/` is the complete site.

See [`scripts/README.md`](scripts/README.md) for the reusable generator contract.

## Deployment

GitHub Actions on every `main` push:

1. `node scripts/generate.mjs`
2. Copy `data/entities.json` → `public/data/entities.json`
3. `node scripts/verify-site.mjs public`
4. Deploy `public/` to GitHub Pages

**One-time setup:** Repo **Settings → Pages → Source:** GitHub Actions.

`public/_headers` and `public/_redirects` follow the Netlify / Cloudflare Pages
convention. **GitHub Pages does not apply them** — CSP, HSTS, and cache rules in
`_headers` are inactive unless you put Cloudflare (or similar) in front of the site.
They are kept for portability if you switch hosts later.

## Analytics

Edit `scripts/static/js/app.js`. Generate syncs it to `public/assets/js/`.
GA initializes inline in each HTML template (before `app.js` loads).
Events: `platform_detected`, `buyer_app_click`.
