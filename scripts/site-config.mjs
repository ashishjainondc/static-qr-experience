/** Generic defaults — override per project via data/entities.json → site.copy */
export const DEFAULT_COPY = {
  rootDescription: "Browse available options near you.",
  rootTitle: "Select a location",
  rootSubtitle: "Choose a location to continue",
  cityDescription: "Browse options in {city}.",
  cityTitle: "{city}",
  citySubtitle: "Choose an item to see available apps",
  entityPageTitle: "{entity}, {city} | {brand}",
  entityDescription: "Book {entity}, {city} through an authorised app.",
  entitySubtitle: "",
  entityTitleDefault: "Get {name} via {brand}",
  loadingRoot: "Loading…",
  loadingCity: "Loading…",
  loadingEntity: "Loading…",
  notFoundEntity: "This item could not be found.",
  notFoundCity: "This location could not be found.",
  errorLoad:
    "We couldn't load this page.\nPlease check your connection and try again.",
  comingSoon: "Coming soon",
};

export function interpolate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

export function resolveSite(site = {}) {
  const brandName = site.brandName || site.productName || "";
  const copy = { ...DEFAULT_COPY, ...(site.copy || {}) };
  const org = site.org || {};

  return {
    productName: site.productName || "",
    brandName,
    gaId: site.gaId || "",
    themeColor: site.themeColor || "#1c75bc",
    orgName: org.name || brandName,
    orgUrl: org.url || "",
    orgLogo: org.logo || "",
    orgAriaLabel: org.ariaLabel || org.name || brandName,
    footerText: site.footerText || (brandName ? "Powered by " + brandName : ""),
    copy,
  };
}

export function entityTitle(entity, site) {
  if (entity.title) return entity.title;
  return interpolate(site.copy.entityTitleDefault, {
    name: entity.name,
    brand: site.brandName,
  });
}

export function rootTemplateVars(site) {
  return {
    PRODUCT_NAME: site.productName,
    BRAND_NAME: site.brandName,
    GA_ID: site.gaId,
    THEME_COLOR: site.themeColor,
    ROOT_DESCRIPTION: site.copy.rootDescription,
    ROOT_TITLE: site.copy.rootTitle,
    ROOT_SUBTITLE: site.copy.rootSubtitle,
    LOADING_TEXT: site.copy.loadingRoot,
    PAGE_TITLE: site.productName + " | " + site.brandName,
    OG_TITLE: site.productName + " | " + site.brandName,
  };
}

export function cityTemplateVars(site, city) {
  const cityName = city.name;
  return {
    ...rootTemplateVars(site),
    CITY_NAME: cityName,
    CITY_SLUG: city.slug,
    CITY_DESCRIPTION: interpolate(site.copy.cityDescription, { city: cityName }),
    CITY_TITLE: interpolate(site.copy.cityTitle, { city: cityName }),
    CITY_SUBTITLE: site.copy.citySubtitle,
    LOADING_TEXT: site.copy.loadingCity,
    PAGE_TITLE: site.productName + " — " + cityName + " | " + site.brandName,
    OG_TITLE: site.productName + " — " + cityName + " | " + site.brandName,
  };
}

export function entityTemplateVars(site, city, entity) {
  const cityName = city.name;
  const entityName = entity.name;
  const title = entityTitle(entity, site);
  const pageTitle = interpolate(site.copy.entityPageTitle, {
    entity: entityName,
    city: cityName,
    brand: site.brandName,
  });
  const description = interpolate(site.copy.entityDescription, {
    entity: entityName,
    city: cityName,
  });

  return {
    BRAND_NAME: site.brandName,
    GA_ID: site.gaId,
    THEME_COLOR: site.themeColor,
    CITY_NAME: cityName,
    CITY_SLUG: city.slug,
    ENTITY_NAME: entityName,
    ENTITY_SLUG: entity.slug,
    ENTITY_TITLE: title,
    ENTITY_SUBTITLE: site.copy.entitySubtitle,
    ENTITY_DESCRIPTION: description,
    ENTITY_PAGE_TITLE: pageTitle,
    OG_TITLE: pageTitle,
    OG_DESCRIPTION: description,
    LOADING_TEXT: site.copy.loadingEntity,
  };
}
