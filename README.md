# static-qr-experience

Static, zero-build landing pages for ONDC "Experience" QR codes. Each physical
QR code at a venue (museum, attraction, etc.) points to a page that lists the
authorised ONDC buyer apps a visitor can use to book a ticket.

Live at [experience.ondc.tech](https://experience.ondc.tech).

## How it's structured

The site has three levels, each a thin static HTML shell rendered by one
shared script. This repo is deployed as a GitHub Pages *project* site, so
every real URL is prefixed with the repo name (`site.basePath` in
`data/entities.json`, currently `/static-qr-experience`) — and because
generated pages live under `public/` (see below), every page URL also has a
`/public/` segment:

```
{basePath}/public/                                  → pick a group (e.g. a city)
{basePath}/public/<group>/                          → pick an experience in that group
{basePath}/public/<group>/<experience>/              → pick a buyer app to book with
```

For example:

```
/static-qr-experience/public/mumbai/
/static-qr-experience/public/mumbai/nehru-science-centre-mumbai/
```

`public/js/app.js` hardcodes this same `BASE_PATH` (alongside `DATA_URL`/
`GA_ID`, see [Reusing this generator](#reusing-this-generator-in-another-project))
so that the links it generates between pages (city picker → experience
picker → buyer-app list) resolve to the right place.

There is no build step for the *runtime* — every page is a plain `.html` file
that:

1. Sets its own `<title>`/`<meta>` tags (so link previews and SEO work without JS).
2. Declares which slice of data it needs via `data-group` / `data-entity` attributes on `<body>`.
3. Links a shared stylesheet (`public/css/picker.css` for group/experience pickers,
   `public/css/entity.css` for buyer-app lists) instead of inlining CSS per page.
4. Loads `public/js/app.js`, which fetches `data/entities.json` and renders
   _everything dynamic_ — the navbar, footer, header icon/photo, and the list
   itself (groups, experiences, or buyer apps) — into placeholder elements
   (`#navbar-slot`, `#footer-slot`, `#header-logo`, `#main-content`).

All of those HTML files, though, are **generated** — see
[Generating pages](#generating-pages) below. You never hand-write or copy
folders; you edit `data/entities.json` and run one script.

```
public/index.html                                     # group picker (generated)
public/mumbai/index.html                               # experience picker (generated, data-group="mumbai")
public/mumbai/nehru-science-centre-mumbai/index.html   # buyer-app list (generated, data-group + data-entity)
public/bangalore/index.html
public/bangalore/visvesvaraya-industrial-technological-museum-bangalore/index.html

data/entities.json                                    # single source of truth for all content + site config
scripts/generate.mjs                                  # reads data/entities.json, writes public/**/index.html
.github/workflows/deploy.yml                          # runs the generator and deploys to GitHub Pages on push
scripts/templates/root.html                           # template for the group picker
scripts/templates/group.html                          # template for the experience picker
scripts/templates/entity.html                         # template for the buyer-app list
public/js/app.js                                      # shared renderer + navbar/footer/icon injection + GA4 tracking
public/css/picker.css                                 # shared styles for group/experience picker pages
public/css/entity.css                                 # shared styles for buyer-app list pages
public/images/buyers/                                 # buyer app logos + venue photos
public/images/ondc-logo.svg
public/images/favicon.png
CNAME                                                  # custom domain for GitHub Pages
```

Only the per-page bits that must exist before JS runs — `<title>`/`<meta>`
tags and the `data-group`/`data-entity`/`header-title` fallback text — live in
each generated HTML file. Everything else (navbar, footer, header icon, list
content) is identical markup rendered once by `app.js` at runtime, so there's
a single place to change the site chrome.

## Editing content

All venue, buyer-app, and site-level data lives in **`data/entities.json`** —
nothing else needs to change for day-to-day updates.

```json
{
  "site": {
    "basePath": "/static-qr-experience",
    "gaId": "G-X9LS4KMKBC",
    "productName": "Discover Experiences",
    "orgName": "ONDC"
  },
  "groups": [
    {
      "slug": "mumbai",
      "name": "Mumbai",
      "entities": [
        {
          "slug": "nehru-science-centre-mumbai",
          "name": "Nehru Science Centre",
          "title": "Get Nehru Science Centre Tickets via ONDC",
          "photo": "/static-qr-experience/public/images/buyers/Nehru%20science%20center%20logo.jpg",
          "buyers": [
            {
              "label": "Highway Delite",
              "status": "live",
              "logo": "/static-qr-experience/public/images/buyers/highway-delite.png",
              "url": "https://experiences.highwaydelite.com/..."
            }
          ]
        }
      ]
    }
  ]
}
```

- **`site`**: project-wide config used to fill every generated page.
  - **`basePath`**: absolute URL prefix every page/asset link is generated
    with (e.g. `/static-qr-experience`). Matches wherever this repo is
    actually served from.
  - **`gaId`**: GA4 measurement ID, used in the `gtag.js` script tag on every page.
  - **`productName`** / **`orgName`**: used to compose `<title>`/`<meta>` text
    (e.g. `"{productName} — {group} | {orgName}"`).
- **`groups`**: the top-level array — in this project each group is a city,
  but the concept is generic (could be a brand, a category, a region, etc.).
- **`status`**: `"live"` (shows as a clickable link, requires `url`), `"pending"`
  (shows as a greyed-out "Coming soon" row), or `"na"` (omitted entirely).
- **`logo`**: optional. If omitted, the row falls back to a plain colored dot.
- **`photo`**: optional venue image shown in the page header. Falls back to a
  generic location-pin icon if omitted.
- **`title`**: the entity's page headline (e.g. `"Get Nehru Science Centre
  Tickets via ONDC"`), used verbatim as the `<h1>` on its buyer-app page.
- An entity's full display name (`"Nehru Science Centre, Mumbai"`) isn't
  stored — both `app.js` and the generator compose it as
  `entity.name + ", " + group.name` wherever it's needed (page title, header,
  GA event data), so the group name is never duplicated inside every entity
  record.
- Asset filenames with spaces must be percent-encoded in the JSON (e.g.
  `Oneticket%20logo.jpg` for a file literally named `Oneticket logo.jpg`).

### Adding a buyer app to an existing venue

Add an entry to that entity's `buyers` array and re-run the generator (below)
— no HTML changes needed.

### Adding a new venue to an existing group

Add an entry to that group's `entities` array in `data/entities.json` and
re-run the generator. It creates `public/<group>/<entity>/index.html` for you.

### Adding a new group

Add an entry to the `groups` array (with at least one entity) in
`data/entities.json` and re-run the generator. It creates
`public/<group>/index.html` and every `public/<group>/<entity>/index.html`.

## Generating pages

```
node scripts/generate.mjs
```

This reads `data/entities.json`, validates it (unique slugs, valid buyer
`status`, `https` URLs, referenced image files actually existing, etc.), and
writes every `public/**/index.html` from the templates in
`scripts/templates/`. It also deletes any previously generated group/entity
folder under `public/` that's no longer in the JSON, so stale pages never
linger. `public/index.html` and `public/*/` (aside from `images/`, `js/`,
`css/`) are git-ignored — they're build output, not source.

Run it any time `data/entities.json` changes, before deploying.

### Reusing this generator in another project

The generator is intentionally decoupled from ONDC-specific content — copy
`scripts/generate.mjs` and `scripts/templates/` into a new project, write a
`data/entities.json` with your own `site` block and `groups`, and run it.
Everything page-specific (product name, org name, GA ID, base path,
group/venue copy) comes from that one JSON file; nothing in `scripts/` needs
editing. The one thing that stays project-specific outside the JSON is
`public/js/app.js` itself (it hardcodes its own `BASE_PATH`/`DATA_URL`/`GA_ID`
constants — `BASE_PATH` must match `site.basePath` in `data/entities.json` —
and the "ONDC"/"Discover Experiences" copy in the navbar/footer) — update
those by hand once per project.

## Local development

Run the generator, then serve from the **parent** of a folder literally named
to match `site.basePath` (`static-qr-experience` by default), since every page
links assets/data with that absolute prefix:

```
node scripts/generate.mjs
cd ..   # parent of this repo checkout, assuming it's named static-qr-experience
python3 -m http.server 8000
```

Then open `http://localhost:8000/static-qr-experience/public/`.

## Deployment

Deployed to GitHub Pages via `.github/workflows/deploy.yml`: on every push to
`main`, it runs `node scripts/generate.mjs` and publishes the result. Generated
HTML is **never committed** — it's rebuilt fresh on every deploy, so it can't
drift out of sync with `data/entities.json`.

This requires the repo's Pages source (Settings → Pages → Build and
deployment) to be set to **"GitHub Actions"** (a one-time setting, not
something the workflow file itself can change).

- `CNAME` — custom domain, GitHub Pages convention. Copied into the deployed
  artifact by the workflow.

If you deploy elsewhere (Netlify, Cloudflare Pages, etc.) instead, run
`node scripts/generate.mjs` as your host's build command and publish the
repo root (or add `public/_headers`/`public/_redirects` for their
security-header/redirect conventions).

## Analytics

Every page loads GA4 via `public/js/app.js`, which fires:

- `platform_detected` — on every buyer-app list page, with detected OS (Android/iOS/Other).
- `buyer_app_click` — when a visitor taps a buyer app link, with the app name, entity name, and destination URL.
