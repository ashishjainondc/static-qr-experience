(function () {
  "use strict";

  var DATA_URL = "/static-qr-experience/data/entities.json";
  var GA_ID = "G-X9LS4KMKBC";

  var LOCATION_ICON =
    '<svg class="experience-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />' +
    '<circle cx="12" cy="10" r="3" />' +
    "</svg>";

  var NAVBAR_HTML =
    '<nav class="ondc-navbar" aria-label="ONDC">' +
    '<div class="ondc-navbar-inner">' +
    '<a class="ondc-logo" href="https://ondc.org" target="_blank" rel="noopener noreferrer" ' +
    'aria-label="ONDC – Open Network for Digital Commerce">' +
    '<img src="/static-qr-experience/public/images/ondc-logo.svg" alt="ONDC" class="ondc-logo-img" height="34" />' +
    "</a>" +
    '<span class="ondc-navbar-product">Discover Experiences</span>' +
    "</div>" +
    "</nav>";

  var FOOTER_HTML =
    '<footer class="app-footer">' +
    '<div class="app-footer-inner">' +
    '<span class="app-footer-brand">Powered by ONDC</span>' +
    "</div>" +
    "</footer>";

  // Kick off the data fetch as soon as this (deferred) script runs, instead
  // of waiting for a DOMContentLoaded handler to fire and start it later.
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
  function gtag() {
    window.dataLayer.push(arguments);
  }
  gtag("js", new Date());
  gtag("set", "user_properties", { platform_os: os });
  gtag("config", GA_ID);

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

  function findBySlug(list, slug) {
    return (list || []).find(function (item) {
      return item.slug === slug;
    });
  }

  function logoLabel(label, logoUrl) {
    var icon = logoUrl
      ? '<span class="seller-logo"><img src="' + logoUrl + '" alt="" /></span>'
      : '<span class="seller-dot"></span>';
    return (
      '<span class="seller-name">' +
      icon +
      '<span class="seller-label">' +
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

  // Renders a plain list of links (groups, or entities within a group) —
  // shared by the group picker and the entity picker.
  function renderLinkList(container, items, hrefFor) {
    container.innerHTML =
      '<ul class="seller-list">' +
      items
        .map(function (item) {
          return (
            '<li class="seller-item"><a href="' +
            hrefFor(item) +
            '">' +
            logoLabel(item.name) +
            "</a></li>"
          );
        })
        .join("") +
      "</ul>";
  }

  function renderBuyerList(container, entity, fullName) {
    var items = entity.buyers
      .map(function (buyer) {
        if (buyer.status === "live" && buyer.url) {
          return (
            '<li class="seller-item"><a href="' +
            buyer.url +
            '" target="_blank" rel="noopener noreferrer" ' +
            'data-app="' +
            escapeHtml(buyer.label) +
            '">' +
            logoLabel(buyer.label, buyer.logo) +
            "</a></li>"
          );
        }
        if (buyer.status === "pending") {
          return (
            '<li class="seller-item--disabled">' +
            '<span class="seller-name"><span class="seller-dot seller-dot--soon"></span>' +
            escapeHtml(buyer.label) +
            "</span>" +
            '<span class="seller-soon-badge">Coming soon</span></li>'
          );
        }
        return ""; // status === 'na' → omit entirely
      })
      .join("");

    container.innerHTML = '<ul class="seller-list">' + items + "</ul>";

    container.querySelectorAll(".seller-item a").forEach(function (link) {
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
        '<img class="venue-photo" src="' +
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
    var navSlot = document.getElementById("navbar-slot");
    if (navSlot) navSlot.outerHTML = NAVBAR_HTML;
    var footerSlot = document.getElementById("footer-slot");
    if (footerSlot) footerSlot.outerHTML = FOOTER_HTML;

    var logoEl = document.getElementById("header-logo");
    if (logoEl) logoEl.innerHTML = LOCATION_ICON;

    var body = document.body;
    var groupSlug = body.getAttribute("data-group");
    var entitySlug = body.getAttribute("data-entity");
    var container = document.getElementById("main-content");
    var titleEl = document.getElementById("page-title");

    dataPromise
      .then(function (data) {
        if (groupSlug && entitySlug) {
          var group = findBySlug(data.groups, groupSlug);
          var entity = group && findBySlug(group.entities, entitySlug);
          if (!entity)
            return renderStatus(
              container,
              "Not found",
              "This experience could not be found."
            );

          var fullName = entity.name + ", " + group.name;
          if (titleEl) titleEl.textContent = entity.title || fullName;
          document.title = "Book Tickets — " + fullName + " | ONDC";
          applyHeaderLogo(entity.photo, fullName);
          renderBuyerList(container, entity, fullName);
        } else if (groupSlug) {
          var groupOnly = findBySlug(data.groups, groupSlug);
          if (!groupOnly)
            return renderStatus(
              container,
              "Not found",
              "This group could not be found."
            );

          if (titleEl) titleEl.textContent = groupOnly.name;
          document.title =
            "Discover Experiences — " + groupOnly.name + " | ONDC";
          renderLinkList(container, groupOnly.entities, function (entity) {
            return "/" + groupOnly.slug + "/" + entity.slug + "/";
          });
        } else {
          renderLinkList(container, data.groups, function (group) {
            return "/" + group.slug + "/";
          });
        }
      })
      .catch(function () {
        renderStatus(
          container,
          "Something went wrong",
          "We couldn't load this page.\nPlease check your connection and try again."
        );
      });
  });
})();
