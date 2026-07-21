# static-qr-experience

Static, zero-build landing pages for ONDC "Experience" QR codes. Each physical
QR code at a venue (museum, attraction, etc.) points to a page that lists the
authorised ONDC buyer apps a visitor can use to book a ticket.

Live at [experience.ondc.tech](https://experience.ondc.tech).

## How it's structured

The site has three levels, each a thin static HTML shell rendered by one
shared script:

```
/                                          → pick a city
/<city>/                                   → pick an experience in that city
/<city>/<experience>/                      → pick a buyer app to book with
```

For example:

```
/mumbai/
/mumbai/nehru-science-centre-mumbai/
```

There is no build step. Every page is a plain `.html` file that:

1. Sets its own `<title>`/`<meta>` tags (so link previews and SEO work without JS).
2. Declares which slice of data it needs via `data-city` / `data-entity` attributes on `<body>`.
3. Links a shared stylesheet (`public/picker.css` for city/experience pickers,
   `public/entity.css` for buyer-app lists) instead of inlining CSS per page.
4. Loads `public/app.js`, which fetches `data/entities.json` and renders
   _everything dynamic_ — the navbar, footer, header icon/photo, and the list
   itself (cities, experiences, or buyer apps) — into placeholder elements
   (`#navbar-slot`, `#footer-slot`, `#header-logo`, `#main-content`).

```
index.html                                           # city picker
mumbai/index.html                                    # experience picker (data-city="mumbai")
mumbai/nehru-science-centre-mumbai/index.html         # buyer-app list (data-city + data-entity)
bangalore/index.html
bangalore/visvesvaraya-industrial-technological-museum-bangalore/index.html

data/entities.json                                    # single source of truth for all content
public/app.js                                         # shared renderer + navbar/footer/icon injection + GA4 tracking
public/picker.css                                     # shared styles for city/experience picker pages
public/entity.css                                     # shared styles for buyer-app list pages
public/assets/buyers/                                 # buyer app logos + venue photos
public/ondc-logo.svg
public/_headers                                       # security headers + cache rules (Netlify/CF Pages)
public/_redirects                                     # SPA-style fallback to city picker
CNAME                                                  # custom domain for GitHub Pages
```

Only the per-page bits that must exist before JS runs — `<title>`/`<meta>`
tags and the `data-city`/`data-entity`/`header-title` fallback text — live in
each HTML file. Everything else (navbar, footer, header icon, list content)
is identical markup generated once by `app.js`, so there's a single place to
change the site chrome.

## Editing content

All venue and buyer-app data lives in **`data/entities.json`** — nothing else
needs to change for day-to-day updates.

```json
{
  "cities": [
    {
      "slug": "mumbai",
      "name": "Mumbai",
      "entities": [
        {
          "slug": "nehru-science-centre-mumbai",
          "name": "Nehru Science Centre",
          "photo": "/public/assets/buyers/Nehru%20science%20center%20logo.jpg",
          "buyers": [
            {
              "label": "Highway Delite",
              "status": "live",
              "logo": "/public/assets/buyers/highway-delite.png",
              "url": "https://experiences.highwaydelite.com/..."
            }
          ]
        }
      ]
    }
  ]
}
```

- **`status`**: `"live"` (shows as a clickable link, requires `url`), `"pending"`
  (shows as a greyed-out "Coming soon" row), or `"na"` (omitted entirely).
- **`logo`**: optional. If omitted, the row falls back to a plain colored dot.
- **`photo`**: optional venue image shown in the page header. Falls back to a
  generic location-pin icon if omitted.
- An entity's full display name (`"Nehru Science Centre, Mumbai"`) isn't
  stored — `app.js` composes it as `entity.name + ", " + city.name` wherever
  it's needed (page title, header, GA event data), so the city name is never
  duplicated inside every entity record.
- Asset filenames with spaces must be percent-encoded in the JSON (e.g.
  `Oneticket%20logo.jpg` for a file literally named `Oneticket logo.jpg`).

### Adding a buyer app to an existing venue

Add an entry to that entity's `buyers` array — no HTML changes needed.

### Adding a new venue to an existing city

Two steps:

1. Add an entry to that city's `entities` array in `data/entities.json`.
2. Copy an existing entity folder (e.g. `mumbai/nehru-science-centre-mumbai/`)
   to the new slug, and update its `<title>`, `<meta>`, the `data-entity`
   attribute on `<body>`, and the `#page-title` fallback text to match the
   new slug/name.

### Adding a new city

1. Add an entry to the `cities` array in `data/entities.json`.
2. Copy an existing city folder (e.g. `mumbai/`) to the new city slug, and
   update `<title>`, `<meta>`, `data-city` on `<body>`, and the `#page-title`
   fallback text.
3. Add at least one entity folder inside it, as above.

## Local development

No build tooling required — serve the repo root with any static file server:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Deployment

This is a static site with no build step, deployable to Netlify, Cloudflare
Pages, GitHub Pages, or any static host serving the repo root:

- `public/_headers` sets security headers (CSP, HSTS, etc.) and cache rules — Netlify/Cloudflare Pages convention.
- `public/_redirects` — fallback rule, Netlify/Cloudflare Pages convention.
- `CNAME` — custom domain, GitHub Pages convention.

Only wire up the convention matching your actual host; the others are inert.

## Analytics

Every page loads GA4 via `public/app.js`, which fires:

- `platform_detected` — on every buyer-app list page, with detected OS (Android/iOS/Other).
- `buyer_app_click` — when a visitor taps a buyer app link, with the app name, entity name, and destination URL.
