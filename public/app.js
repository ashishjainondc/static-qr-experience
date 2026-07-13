(function () {
  "use strict";

  var DATA_URL = "/data/entities.json";
  var GA_ID = "G-17W29WN58K";

  var LOCATION_ICON =
    '<svg class="experience-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />' +
    '<circle cx="12" cy="10" r="3" />' +
    "</svg>";

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

  function logoLabel(label, logoUrl, iconClass) {
    var icon = logoUrl
      ? '<span class="' +
        (iconClass || "seller-logo") +
        '"><img src="' +
        logoUrl +
        '" alt="" /></span>'
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

  function renderCityPicker(container, cities) {
    container.innerHTML =
      '<ul class="seller-list">' +
      cities
        .map(function (city) {
          return (
            '<li class="seller-item"><a href="/' +
            city.slug +
            '/">' +
            logoLabel(city.name) +
            "</a></li>"
          );
        })
        .join("") +
      "</ul>";
  }

  function renderEntityPicker(container, city) {
    container.innerHTML =
      '<ul class="seller-list">' +
      city.entities
        .map(function (entity) {
          return (
            '<li class="seller-item"><a href="/' +
            city.slug +
            "/" +
            entity.slug +
            '/">' +
            logoLabel(entity.name) +
            "</a></li>"
          );
        })
        .join("") +
      "</ul>";
  }

  function renderBuyerList(container, entity) {
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
          entity_name: entity.fullName,
          destination_url: link.href,
        });
      });
    });

    gtag("event", "platform_detected", {
      platform_os: os,
      entity_name: entity.fullName,
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
    var body = document.body;
    var citySlug = body.getAttribute("data-city");
    var entitySlug = body.getAttribute("data-entity");
    var container = document.getElementById("main-content");
    var titleEl = document.getElementById("page-title");

    fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load " + DATA_URL);
        return res.json();
      })
      .then(function (data) {
        if (citySlug && entitySlug) {
          var city = data.cities.filter(function (c) {
            return c.slug === citySlug;
          })[0];
          var entity =
            city &&
            city.entities.filter(function (e) {
              return e.slug === entitySlug;
            })[0];
          if (!entity)
            return renderStatus(
              container,
              "Not found",
              "This experience could not be found."
            );

          if (titleEl) titleEl.textContent = entity.fullName;
          document.title = "Book Tickets — " + entity.fullName + " | ONDC";
          applyHeaderLogo(entity.photo, entity.fullName);
          renderBuyerList(container, entity);
        } else if (citySlug) {
          var cityOnly = data.cities.filter(function (c) {
            return c.slug === citySlug;
          })[0];
          if (!cityOnly)
            return renderStatus(
              container,
              "Not found",
              "This city could not be found."
            );

          if (titleEl) titleEl.textContent = cityOnly.name;
          document.title = "Experience Discover — " + cityOnly.name + " | ONDC";
          renderEntityPicker(container, cityOnly);
        } else {
          renderCityPicker(container, data.cities);
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
