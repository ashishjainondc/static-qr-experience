#!/usr/bin/env node
// Generate static HTML pages from data/entities.json into the repo root.
// Generic — copy scripts/ (this file + templates/) to any project; the only
// thing that changes per project is data/entities.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data", "entities.json");
const TEMPLATES_DIR = path.join(__dirname, "templates");

const VALID_STATUSES = new Set(["live", "pending", "na"]);
// Fixed project directories a group slug must not collide with, and that
// removeStale() must never touch.
const RESERVED_ROOT_DIRS = new Set(["public", "data", "scripts", ".github"]);

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

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c])
  );
}

function fill(template, vars) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
    if (!(key in vars)) die("template missing value for {{" + key + "}}");
    return escapeHtml(vars[key]);
  });
}

function isValidHttpsUrl(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

// Resolves an image reference (as used in data/entities.json) to a local
// path under the repo, so we can check the file actually exists. External
// (http/https) URLs are left unchecked.
function localAssetPath(basePath, ref) {
  if (!ref || /^https?:\/\//i.test(ref)) return null;
  const decoded = decodeURIComponent(ref);
  const relative = decoded.startsWith(basePath + "/")
    ? decoded.slice(basePath.length + 1)
    : decoded.replace(/^\//, "");
  return path.join(ROOT, relative);
}

function validate(data) {
  const errors = [];

  if (!data || typeof data !== "object") die("entities.json must be an object");

  const site = data.site || {};
  if (!site.basePath) errors.push("site.basePath is required");
  if (!site.gaId) errors.push("site.gaId is required");
  if (!site.productName) errors.push("site.productName is required");
  if (!site.orgName) errors.push("site.orgName is required");

  if (!Array.isArray(data.groups) || data.groups.length === 0) {
    errors.push("groups must be a non-empty array");
  }

  const groupSlugs = new Set();
  for (const group of data.groups || []) {
    if (!group.slug) errors.push("group missing slug");
    else if (groupSlugs.has(group.slug))
      errors.push("duplicate group slug: " + group.slug);
    else if (RESERVED_ROOT_DIRS.has(group.slug)) {
      errors.push(
        "group slug conflicts with a reserved project folder: " + group.slug
      );
    } else groupSlugs.add(group.slug);

    if (!group.name)
      errors.push("group " + (group.slug || "?") + " missing name");
    if (!Array.isArray(group.entities)) {
      errors.push(
        "group " + (group.slug || "?") + " entities must be an array"
      );
      continue;
    }

    const entitySlugs = new Set();
    for (const entity of group.entities) {
      const label = (group.slug || "?") + "/" + (entity.slug || "?");
      if (!entity.slug) errors.push("entity missing slug under " + group.slug);
      else if (entitySlugs.has(entity.slug))
        errors.push("duplicate entity slug: " + label);
      else entitySlugs.add(entity.slug);

      if (!entity.name) errors.push("entity " + label + " missing name");
      if (!entity.title) errors.push("entity " + label + " missing title");

      const photoPath = localAssetPath(site.basePath, entity.photo);
      if (photoPath && !fs.existsSync(photoPath)) {
        errors.push("entity " + label + " photo missing: " + entity.photo);
      }

      if (!Array.isArray(entity.buyers)) {
        errors.push("entity " + label + " buyers must be an array");
        continue;
      }

      for (const buyer of entity.buyers) {
        if (!buyer.label) errors.push("buyer missing label under " + label);
        if (!VALID_STATUSES.has(buyer.status)) {
          errors.push(
            "invalid status '" +
              buyer.status +
              "' under " +
              label +
              " (" +
              buyer.label +
              ")"
          );
        }
        if (buyer.status === "live" && !buyer.url) {
          errors.push(
            "live buyer '" + buyer.label + "' under " + label + " needs url"
          );
        }
        if (
          buyer.status === "live" &&
          buyer.url &&
          !isValidHttpsUrl(buyer.url)
        ) {
          errors.push(
            "live buyer '" +
              buyer.label +
              "' under " +
              label +
              " needs an https url"
          );
        }
        const logoPath = localAssetPath(site.basePath, buyer.logo);
        if (logoPath && !fs.existsSync(logoPath)) {
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

function removeStale(data) {
  const expectedGroups = new Set(data.groups.map((g) => g.slug));
  const expectedEntities = new Map(
    data.groups.map((g) => [
      g.slug,
      new Set((g.entities || []).map((e) => e.slug)),
    ])
  );

  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;
    if (RESERVED_ROOT_DIRS.has(entry.name)) continue;

    const groupDir = path.join(ROOT, entry.name);
    if (!expectedGroups.has(entry.name)) {
      fs.rmSync(groupDir, { recursive: true, force: true });
      console.log("removed stale group folder: " + entry.name + "/");
      continue;
    }

    const keep = expectedEntities.get(entry.name) || new Set();
    for (const child of fs.readdirSync(groupDir, { withFileTypes: true })) {
      if (!child.isDirectory()) continue;
      if (!keep.has(child.name)) {
        fs.rmSync(path.join(groupDir, child.name), {
          recursive: true,
          force: true,
        });
        console.log(
          "removed stale entity folder: " + entry.name + "/" + child.name + "/"
        );
      }
    }
  }
}

function templateVars(site) {
  return {
    BASE_PATH: site.basePath,
    GA_ID: site.gaId,
    PRODUCT_NAME: site.productName,
    ORG_NAME: site.orgName,
  };
}

function generate(data) {
  const site = data.site;
  const rootTpl = readTemplate("root.html");
  const groupTpl = readTemplate("group.html");
  const entityTpl = readTemplate("entity.html");

  writeFile(path.join(ROOT, "index.html"), fill(rootTpl, templateVars(site)));
  console.log("wrote index.html");

  for (const group of data.groups) {
    writeFile(
      path.join(ROOT, group.slug, "index.html"),
      fill(groupTpl, {
        ...templateVars(site),
        GROUP_NAME: group.name,
        GROUP_SLUG: group.slug,
      })
    );
    console.log("wrote " + group.slug + "/index.html");

    for (const entity of group.entities || []) {
      writeFile(
        path.join(ROOT, group.slug, entity.slug, "index.html"),
        fill(entityTpl, {
          ...templateVars(site),
          GROUP_NAME: group.name,
          GROUP_SLUG: group.slug,
          ENTITY_NAME: entity.name,
          ENTITY_SLUG: entity.slug,
          ENTITY_TITLE: entity.title,
        })
      );
      console.log("wrote " + group.slug + "/" + entity.slug + "/index.html");
    }
  }
}

const data = readJson(DATA_PATH);
validate(data);
removeStale(data);
generate(data);
console.log("generate: done");
