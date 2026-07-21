#!/usr/bin/env node
/**
 * Verify assembled site directory before GitHub Pages deploy.
 * Usage: node scripts/verify-site.mjs [_site]
 */
import fs from "node:fs";
import path from "node:path";

const siteDir = path.resolve(process.argv[2] || "public");
const imagesDir = path.join(siteDir, "assets", "images");
const errors = [];

function check(filePath) {
  const full = path.join(siteDir, filePath);
  if (!fs.existsSync(full)) errors.push("missing: " + filePath);
}

function imageExists(filename) {
  if (!filename) return true;
  if (/^https?:\/\//i.test(filename) || filename.startsWith("/")) return true;
  return fs.existsSync(path.join(imagesDir, filename));
}

function isValidHttpsUrl(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

if (!fs.existsSync(siteDir)) {
  console.error("verify-site: directory not found: " + siteDir);
  process.exit(1);
}

check("index.html");
check("data/entities.json");
check("assets/js/app.js");
check("assets/css/picker.css");
check("assets/css/entity.css");
check("assets/images/favicon.png");
check("_headers");

let data;
try {
  data = JSON.parse(fs.readFileSync(path.join(siteDir, "data/entities.json"), "utf8"));
} catch (err) {
  errors.push("invalid data/entities.json: " + err.message);
}

if (data) {
  if (!data.site?.gaId) errors.push("data: site.gaId is required");
  if (!data.site?.productName) errors.push("data: site.productName is required");
  if (!data.buyers || typeof data.buyers !== "object") errors.push("data: buyers catalog is required");

  if (data.site?.org?.url && !isValidHttpsUrl(data.site.org.url)) {
    errors.push("data: site.org.url must be an https URL");
  }

  for (const [id, meta] of Object.entries(data.buyers || {})) {
    if (meta?.logo && !imageExists(meta.logo)) {
      errors.push("data: buyers." + id + ".logo file missing: " + meta.logo);
    }
  }

  for (const city of data.cities || []) {
    check(path.join(city.slug, "index.html"));
    for (const entity of city.entities || []) {
      const entityPath = path.join(city.slug, entity.slug, "index.html");
      check(entityPath);

      if (entity.photo && !imageExists(entity.photo)) {
        errors.push(city.slug + "/" + entity.slug + ": photo missing: " + entity.photo);
      }

      const entityHtml = fs.existsSync(path.join(siteDir, entityPath))
        ? fs.readFileSync(path.join(siteDir, entityPath), "utf8")
        : "";
      if (entityHtml && !entityHtml.includes('property="og:title"')) {
        errors.push(entityPath + ": missing og:title meta tag");
      }
      if (entityHtml && !entityHtml.includes('name="theme-color"')) {
        errors.push(entityPath + ": missing theme-color meta tag");
      }

      for (const buyer of entity.buyers || []) {
        if (buyer.status === "live" && !buyer.url) {
          errors.push(city.slug + "/" + entity.slug + ": live buyer missing url");
        }
        if (buyer.status === "live" && buyer.url && !isValidHttpsUrl(buyer.url)) {
          errors.push(city.slug + "/" + entity.slug + ": live buyer url must be https");
        }
        if (buyer.id && data.buyers && !data.buyers[buyer.id]) {
          errors.push(city.slug + "/" + entity.slug + ": unknown buyer id " + buyer.id);
        }
      }
    }
  }
}

const indexHtml = fs.readFileSync(path.join(siteDir, "index.html"), "utf8");
if (!indexHtml.includes("/assets/js/app.js")) {
  errors.push("index.html does not reference /assets/js/app.js");
}
if (!indexHtml.includes("/assets/css/picker.css")) {
  errors.push("index.html does not reference /assets/css/picker.css");
}
if (!indexHtml.includes('gtag("config"')) {
  errors.push("index.html does not initialize gtag config inline");
}

if (errors.length) {
  console.error("verify-site: failed:\n- " + errors.join("\n- "));
  process.exit(1);
}

console.log("verify-site: ok (" + siteDir + ")");
