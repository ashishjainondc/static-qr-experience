(function () {
  "use strict";

  var DATA_URL = "/data/entities.json";
  var IMAGE_BASE = "/assets/images/";

  var LOCATION_ICON =
    '<svg class="placeholder-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />' +
    '<circle cx="12" cy="10" r="3" />' +
    "</svg>";

  var dataPromise = fetch(DATA_URL).then(function (res) {
    if (!res.ok) throw new Error("Failed to load " + DATA_URL);
    return res.json();
  });

  function getOS() {
    var ua = navigator.userAgent || navigator.vendor || window.opera || "";
    if (/android/i.test(ua)) return "Android";
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return "iOS";
    return "Other";
  }

  var os = getOS();

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
  }
  var gtag = window.gtag;
  // gtag("config") runs inline in each HTML template so pageviews fire before fetch.
  gtag("set", "user_properties", { platform_os: os });

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  function safeHttpsUrl(url) {
    if (!url || !/^https:\/\//i.test(String(url))) return "";
    return String(url);
  }

  function interpolate(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, function (_, key) {
      return vars[key] != null ? vars[key] : "";
    });
  }

  function resolveSite(raw) {
    var site = raw || {};
    var brandName = site.brandName || site.productName || "";
    var org = site.org || {};
    // Keep defaults in sync with scripts/site-config.mjs → DEFAULT_COPY
    var copy = Object.assign(
      {
        entityPageTitle: "{entity}, {city} | {brand}",
        entityTitleDefault: "Get {name} via {brand}",
        notFoundEntity: "This item could not be found.",
        notFoundCity: "This location could not be found.",
        errorLoad:
          "We couldn't load this page.\nPlease check your connection and try again.",
        comingSoon: "Coming soon",
      },
      site.copy || {}
    );
    return {
      productName: site.productName || "",
      brandName: brandName,
      gaId: site.gaId || "",
      orgName: org.name || brandName,
      orgUrl: org.url || "",
      orgLogo: org.logo || "",
      orgAriaLabel: org.ariaLabel || org.name || brandName,
      footerText:
        site.footerText || (brandName ? "Powered by " + brandName : ""),
      copy: copy,
    };
  }

  function findBySlug(list, slug) {
    return (list || []).find(function (item) {
      return item.slug === slug;
    });
  }

  function imageUrl(filename) {
    if (!filename) return "";
    if (/^https?:\/\//i.test(filename) || filename.charAt(0) === "/") {
      return filename;
    }
    return IMAGE_BASE + filename;
  }

  function entityTitle(entity, site) {
    if (entity.title) return entity.title;
    return interpolate(site.copy.entityTitleDefault, {
      name: entity.name,
      brand: site.brandName,
    });
  }

  function resolveApp(app, catalog) {
    var meta = (catalog && catalog[app.id]) || {};
    return {
      id: app.id,
      label: app.label || meta.label || app.id,
      logo: imageUrl(app.logo || meta.logo),
      status: app.status,
      url: app.url,
    };
  }

  function buildFooter(site) {
    return (
      '<footer class="app-footer">' +
      '<div class="app-footer-inner">' +
      '<span class="app-footer-brand">' +
      escapeHtml(site.footerText) +
      "</span>" +
      "</div>" +
      "</footer>"
    );
  }

  function buildNavbar(site) {
    var logoHtml = site.orgLogo
      ? '<img src="' +
        imageUrl(site.orgLogo) +
        '" alt="' +
        escapeHtml(site.orgName) +
        '" class="site-logo-img" height="34" />'
      : "";
    var orgHref = safeHttpsUrl(site.orgUrl);
    var logoLink = orgHref
      ? '<a class="site-logo" href="' +
        escapeHtml(orgHref) +
        '" target="_blank" rel="noopener noreferrer" aria-label="' +
        escapeHtml(site.orgAriaLabel) +
        '">' +
        logoHtml +
        "</a>"
      : '<span class="site-logo">' + logoHtml + "</span>";

    return (
      '<nav class="site-navbar" aria-label="' +
      escapeHtml(site.orgName || site.productName) +
      '">' +
      '<div class="site-navbar-inner">' +
      logoLink +
      '<span class="site-navbar-product">' +
      escapeHtml(site.productName) +
      "</span>" +
      "</div>" +
      "</nav>"
    );
  }

  function logoLabel(label, logoUrl) {
    var icon = logoUrl
      ? '<span class="list-logo"><img src="' + logoUrl + '" alt="" /></span>'
      : '<span class="list-dot"></span>';
    return (
      '<span class="list-name">' +
      icon +
      '<span class="list-label">' +
      escapeHtml(label) +
      "</span></span>"
    );
  }

  function renderStatus(container, title, body) {
    container.innerHTML =
      '<div class="status-wrap">' +
      (title ? '<p class="status-title">' + escapeHtml(title) + "</p>" : "") +
      '<p class="status-body">' +
      escapeHtml(body) +
      "</p>" +
      "</div>";
  }

  function renderLinkList(container, items, hrefFor) {
    container.innerHTML =
      '<ul class="link-list">' +
      items
        .map(function (item) {
          return (
            '<li class="link-item"><a href="' +
            hrefFor(item) +
            '">' +
            logoLabel(item.name) +
            "</a></li>"
          );
        })
        .join("") +
      "</ul>";
  }

  function renderAppList(container, apps, fullName, site) {
    var items = apps
      .map(function (app) {
        if (app.status === "live" && app.url) {
          var appUrl = safeHttpsUrl(app.url);
          if (!appUrl) return "";
          return (
            '<li class="link-item"><a href="' +
            escapeHtml(appUrl) +
            '" target="_blank" rel="noopener noreferrer" ' +
            'data-app="' +
            escapeHtml(app.label) +
            '">' +
            logoLabel(app.label, app.logo) +
            "</a></li>"
          );
        }
        if (app.status === "pending") {
          return (
            '<li class="link-item--disabled">' +
            '<span class="list-name"><span class="list-dot list-dot--soon"></span>' +
            escapeHtml(app.label) +
            "</span>" +
            '<span class="list-soon-badge">' +
            escapeHtml(site.copy.comingSoon) +
            "</span></li>"
          );
        }
        return "";
      })
      .join("");

    container.innerHTML = '<ul class="link-list">' + items + "</ul>";

    container.querySelectorAll(".link-item a").forEach(function (link) {
      link.addEventListener("click", function () {
        gtag("event", "buyer_app_click", {
          app_name: link.dataset.app || "unknown",
          platform_os: os,
          entity_name: fullName,
          destination_url: link.href,
        });
      });
    });

    gtag("event", "platform_detected", {
      platform_os: os,
      entity_name: fullName,
    });
  }

  function applyHeaderLogo(photoUrl, altText) {
    var logoEl = document.getElementById("header-logo");
    if (!logoEl) return;
    if (photoUrl) {
      logoEl.classList.add("has-photo");
      logoEl.innerHTML =
        '<img class="header-photo" src="' +
        photoUrl +
        '" alt="' +
        escapeHtml(altText) +
        '" />';
    } else {
      logoEl.classList.remove("has-photo");
      logoEl.innerHTML = LOCATION_ICON;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var body = document.body;
    var citySlug = body.getAttribute("data-city");
    var entitySlug = body.getAttribute("data-entity");
    var container = document.getElementById("main-content");
    var titleEl = document.getElementById("page-title");

    dataPromise
      .then(function (data) {
        var site = resolveSite(data.site);

        var navSlot = document.getElementById("navbar-slot");
        if (navSlot) navSlot.outerHTML = buildNavbar(site);
        var footerSlot = document.getElementById("footer-slot");
        if (footerSlot) footerSlot.outerHTML = buildFooter(site);

        var logoEl = document.getElementById("header-logo");
        if (logoEl) logoEl.innerHTML = LOCATION_ICON;

        var catalog = data.buyers || {};

        if (citySlug && entitySlug) {
          var city = findBySlug(data.cities, citySlug);
          var entity = city && findBySlug(city.entities, entitySlug);
          if (!entity)
            return renderStatus(
              container,
              "Not found",
              site.copy.notFoundEntity
            );

          var fullName = entity.name + ", " + city.name;
          if (titleEl) titleEl.textContent = entityTitle(entity, site);
          document.title = interpolate(site.copy.entityPageTitle || "{entity}, {city} | {brand}", {
            entity: entity.name,
            city: city.name,
            brand: site.brandName,
          });
          applyHeaderLogo(imageUrl(entity.photo), fullName);
          var resolvedBuyers = (entity.buyers || []).map(function (buyer) {
            return resolveApp(buyer, catalog);
          });
          renderAppList(container, resolvedBuyers, fullName, site);
        } else if (citySlug) {
          var cityOnly = findBySlug(data.cities, citySlug);
          if (!cityOnly)
            return renderStatus(
              container,
              "Not found",
              site.copy.notFoundCity
            );

          if (titleEl) titleEl.textContent = cityOnly.name;
          document.title = site.productName + " — " + cityOnly.name + " | " + site.brandName;
          renderLinkList(container, cityOnly.entities, function (entity) {
            return "/" + cityOnly.slug + "/" + entity.slug + "/";
          });
        } else {
          renderLinkList(container, data.cities, function (city) {
            return "/" + city.slug + "/";
          });
        }
      })
      .catch(function () {
        var navSlot = document.getElementById("navbar-slot");
        if (navSlot) navSlot.outerHTML = buildNavbar(resolveSite({}));
        renderStatus(
          container,
          "Something went wrong",
          resolveSite({}).copy.errorLoad
        );
      });
  });
})();
