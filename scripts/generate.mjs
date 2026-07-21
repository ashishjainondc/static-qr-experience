#!/usr/bin/env node
/**
 * Generate static HTML shells from data/entities.json into public/.
 * Generic — copy scripts/ to any project; configure via data/entities.json only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveSite,
  rootTemplateVars,
  cityTemplateVars,
  entityTemplateVars,
} from "./site-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_PATH = path.join(ROOT, "data", "entities.json");
const IMAGES_DIR = path.join(PUBLIC_DIR, "assets", "images");
const TEMPLATES_DIR = path.join(__dirname, "templates");
const STATIC_DIR = path.join(__dirname, "static");

const VALID_STATUSES = new Set(["live", "pending", "na"]);
const RESERVED_PUBLIC = new Set(["assets", "data"]);

function die(message) {
  console.error("generate: " + message);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    die("failed to read " + filePath + ": " + err.message);
  }
}

function readTemplate(name) {
  const filePath = path.join(TEMPLATES_DIR, name);
  if (!fs.existsSync(filePath)) die("missing template " + filePath);
  return fs.readFileSync(filePath, "utf8");
}

function fill(template, vars) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
    if (!(key in vars)) die("template missing value for {{" + key + "}}");
    return String(vars[key]);
  });
}

function imageExists(filename) {
  if (!filename) return true;
  if (/^https?:\/\//i.test(filename) || filename.startsWith("/")) return true;
  return fs.existsSync(path.join(IMAGES_DIR, filename));
}

function isValidHttpsUrl(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function validate(data) {
  const errors = [];

  if (!data || typeof data !== "object") {
    die("entities.json must be an object");
  }

  const site = data.site || {};
  if (!site.gaId) errors.push("site.gaId is required");
  if (!site.productName) errors.push("site.productName is required");
  if (site.org?.url && !isValidHttpsUrl(site.org.url)) {
    errors.push("site.org.url must be an https URL");
  }

  const catalog = data.buyers || {};
  if (typeof catalog !== "object" || Array.isArray(catalog)) {
    errors.push("buyers must be an object catalog");
  } else {
    for (const [id, meta] of Object.entries(catalog)) {
      if (!meta || !meta.label) errors.push("buyers." + id + ".label is required");
      if (meta.logo && !imageExists(meta.logo)) {
        errors.push("buyers." + id + ".logo file missing: " + meta.logo);
      }
    }
  }

  if (!Array.isArray(data.cities) || data.cities.length === 0) {
    errors.push("cities must be a non-empty array");
  }

  const citySlugs = new Set();
  for (const city of data.cities || []) {
    if (!city.slug) errors.push("city missing slug");
    else if (citySlugs.has(city.slug)) errors.push("duplicate city slug: " + city.slug);
    else if (RESERVED_PUBLIC.has(city.slug)) {
      errors.push("city slug conflicts with reserved public/ folder: " + city.slug);
    } else citySlugs.add(city.slug);

    if (!city.name) errors.push("city " + (city.slug || "?") + " missing name");
    if (!Array.isArray(city.entities)) {
      errors.push("city " + (city.slug || "?") + " entities must be an array");
      continue;
    }

    const entitySlugs = new Set();
    for (const entity of city.entities) {
      const label = (city.slug || "?") + "/" + (entity.slug || "?");
      if (!entity.slug) errors.push("entity missing slug under " + city.slug);
      else if (entitySlugs.has(entity.slug)) {
        errors.push("duplicate entity slug: " + label);
      } else entitySlugs.add(entity.slug);

      if (!entity.name) errors.push("entity " + label + " missing name");
      if (entity.photo && !imageExists(entity.photo)) {
        errors.push("entity " + label + " photo missing: " + entity.photo);
      }

      if (!Array.isArray(entity.buyers)) {
        errors.push("entity " + label + " buyers must be an array");
        continue;
      }

      for (const buyer of entity.buyers) {
        if (!buyer.id) errors.push("buyer missing id under " + label);
        else if (!catalog[buyer.id]) {
          errors.push("unknown buyer id '" + buyer.id + "' under " + label);
        }
        if (!VALID_STATUSES.has(buyer.status)) {
          errors.push(
            "invalid status '" + buyer.status + "' under " + label + " (" + buyer.id + ")"
          );
        }
        if (buyer.status === "live" && !buyer.url) {
          errors.push("live buyer '" + buyer.id + "' under " + label + " needs url");
        }
        if (buyer.status === "live" && buyer.url && !isValidHttpsUrl(buyer.url)) {
          errors.push(
            "live buyer '" + buyer.id + "' under " + label + " needs an https url"
          );
        }
        if (buyer.logo && !imageExists(buyer.logo)) {
          errors.push("buyer logo missing under " + label + ": " + buyer.logo);
        }
      }
    }
  }

  if (errors.length) {
    console.error("generate: validation failed:\n- " + errors.join("\n- "));
    process.exit(1);
  }
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function syncStaticAssets() {
  copyDir(path.join(STATIC_DIR, "js"), path.join(PUBLIC_DIR, "assets", "js"));
  copyDir(path.join(STATIC_DIR, "css"), path.join(PUBLIC_DIR, "assets", "css"));
  console.log("synced scripts/static → public/assets/");
}

function removeLegacyRootCityFolders(data) {
  const citySlugs = new Set((data.cities || []).map((city) => city.slug));
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!citySlugs.has(entry.name)) continue;
    fs.rmSync(path.join(ROOT, entry.name), { recursive: true, force: true });
    console.log("removed legacy root folder: " + entry.name + "/");
  }
  const legacyIndex = path.join(ROOT, "index.html");
  if (fs.existsSync(legacyIndex)) {
    fs.unlinkSync(legacyIndex);
    console.log("removed legacy root index.html");
  }
}

function removeStale(data) {
  const expectedCities = new Set(data.cities.map((c) => c.slug));
  const expectedEntities = new Map();
  for (const city of data.cities) {
    expectedEntities.set(
      city.slug,
      new Set((city.entities || []).map((e) => e.slug))
    );
  }

  for (const entry of fs.readdirSync(PUBLIC_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (RESERVED_PUBLIC.has(entry.name) || entry.name.startsWith(".")) continue;

    const cityDir = path.join(PUBLIC_DIR, entry.name);
    if (!expectedCities.has(entry.name)) {
      fs.rmSync(cityDir, { recursive: true, force: true });
      console.log("removed stale city folder: public/" + entry.name + "/");
      continue;
    }

    const keep = expectedEntities.get(entry.name) || new Set();
    for (const child of fs.readdirSync(cityDir, { withFileTypes: true })) {
      if (!child.isDirectory()) continue;
      if (!keep.has(child.name)) {
        fs.rmSync(path.join(cityDir, child.name), { recursive: true, force: true });
        console.log(
          "removed stale entity folder: public/" + entry.name + "/" + child.name + "/"
        );
      }
    }
  }
}

function removePublicCname() {
  const publicCname = path.join(PUBLIC_DIR, "CNAME");
  if (fs.existsSync(publicCname)) {
    fs.unlinkSync(publicCname);
    console.log("removed public/CNAME (custom domain uses root CNAME + GitHub Pages settings)");
  }
}

function generate(data) {
  const site = resolveSite(data.site);
  const rootTpl = readTemplate("root.html");
  const cityTpl = readTemplate("city.html");
  const entityTpl = readTemplate("entity.html");

  writeFile(
    path.join(PUBLIC_DIR, "index.html"),
    fill(rootTpl, rootTemplateVars(site))
  );
  console.log("wrote public/index.html");

  for (const city of data.cities) {
    writeFile(
      path.join(PUBLIC_DIR, city.slug, "index.html"),
      fill(cityTpl, cityTemplateVars(site, city))
    );
    console.log("wrote public/" + city.slug + "/index.html");

    for (const entity of city.entities || []) {
      writeFile(
        path.join(PUBLIC_DIR, city.slug, entity.slug, "index.html"),
        fill(entityTpl, entityTemplateVars(site, city, entity))
      );
      console.log(
        "wrote public/" + city.slug + "/" + entity.slug + "/index.html"
      );
    }
  }
}

const data = readJson(DATA_PATH);
validate(data);
removeLegacyRootCityFolders(data);
removeStale(data);
removePublicCname();
syncStaticAssets();
generate(data);
console.log("generate: done");
