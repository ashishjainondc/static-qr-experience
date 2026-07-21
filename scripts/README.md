# scripts/

Generic static-site generator. Copy this folder to any project.

## What to configure per project

Only edit **`data/entities.json`** and **`public/assets/images/`** (plus root `CNAME`).

| Key                        | Purpose                                                  |
| -------------------------- | -------------------------------------------------------- |
| `site.productName`         | Navbar title                                             |
| `site.brandName`           | Page titles, footer                                      |
| `site.gaId`                | Google Analytics                                         |
| `site.themeColor`          | `<meta theme-color>`                                     |
| `site.org`                 | Logo link in navbar (`name`, `url`, `logo`, `ariaLabel`) |
| `site.footerText`          | Footer line                                              |
| `site.copy`                | All user-facing strings (see `site-config.mjs` defaults) |
| `buyers`                     | Buyer catalog — `label` + `logo` defined once              |
| `cities[].entities[].buyers` | Per-item buyer list — `id`, `status`, `url`                |

## Layout

```
scripts/
  generate.mjs       # validates JSON, writes HTML, syncs static assets
  site-config.mjs  # generic defaults + template variable helpers
  templates/       # root, city, entity HTML shells (placeholders only)
  static/
    js/app.js        # runtime renderer (reads site config from JSON)
    css/             # picker.css, entity.css
```

On `node scripts/generate.mjs`:

1. Validates `data/entities.json`
2. Syncs `scripts/static/js/` → `public/assets/js/` and `scripts/static/css/` → `public/assets/css/`
3. Writes generated HTML under `public/`

CI copies `data/entities.json` → `public/data/entities.json` after generate (see `.github/workflows/deploy.yml`).
For local preview, copy it yourself before serving `public/`.

`public/` is the complete site — use it for local preview and deploy.

CI runs `node scripts/verify-site.mjs public` before publishing.

**Note:** `public/_headers` and `public/_redirects` are Netlify/Cloudflare Pages
conventions. GitHub Pages does not apply them unless another layer (e.g.
Cloudflare) sits in front of the site.

## JSON schema (generic)

```json
{
  "site": { "productName", "brandName", "gaId", "themeColor", "org", "footerText", "copy" },
  "buyers": { "<id>": { "label", "logo" } },
  "cities": [
    {
      "slug", "name",
      "entities": [
        { "slug", "name", "photo", "title?", "buyers": [{ "id", "status", "url" }] }
      ]
    }
  ]
}
```

Status values: `"live"` | `"pending"` | `"na"`.
