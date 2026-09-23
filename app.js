(function () {
  "use strict";

  var SESSION_KEY = "youlead_auth";

  var loginScreen = document.getElementById("login");
  var appScreen = document.getElementById("app");
  var form = document.getElementById("login-form");
  var input = document.getElementById("password");
  var errorEl = document.getElementById("login-error");

  var card = document.getElementById("card");
  var cardCity = document.getElementById("card-city");
  var cardList = document.getElementById("card-list");
  var statsEl = document.getElementById("stats");

  var globe = null;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Логін ---------- */

  function remember() {
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) {}
  }
  function isRemembered() {
    try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch (e) { return false; }
  }

  function enter(animate) {
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    if (!animate) appScreen.style.transition = "none";
    initGlobe();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (input.value === window.CONFIG.password) {
      remember();
      enter(true);
    } else {
      errorEl.textContent = "невірний пароль";
      errorEl.classList.add("show");
      form.classList.remove("shake");
      void form.offsetWidth; // перезапуск анімації
      form.classList.add("shake");
      input.value = "";
      input.focus();
    }
  });
  input.addEventListener("input", function () { errorEl.classList.remove("show"); });

  /* ---------- Дані: групуємо учасників за містом ---------- */

  function groupByCity(members) {
    var map = {};
    members.forEach(function (m) {
      var key = m.lat.toFixed(2) + "," + m.lng.toFixed(2);
      if (!map[key]) map[key] = { city: m.city, lat: m.lat, lng: m.lng, people: [] };
      map[key].people.push(m);
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  /* ---------- Глобус ---------- */

  function initGlobe() {
    if (globe) return;

    var places = groupByCity(window.MEMBERS || []);
    var total = (window.MEMBERS || []).length;
    statsEl.textContent = total + " учасників · " + places.length + " міст";

    var el = document.getElementById("globe");

    globe = Globe()(el)
      .backgroundColor("rgba(0,0,0,0)")
      .showAtmosphere(true)
      .atmosphereColor("#5b86ff")
      .atmosphereAltitude(0.16)

      // мінімалістична мапа: суша з крапок
      .hexPolygonsData(window.COUNTRIES.features)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.42)
      .hexPolygonColor(function () { return "rgba(140, 170, 255, 0.55)"; })

      // точки учасників
      .pointsData(places)
      .pointLat("lat")
      .pointLng("lng")
      .pointAltitude(0.02)
      .pointRadius(0.55)
      .pointColor(function () { return "#7fe3ff"; })
      .pointLabel(function (d) { return '<div class="tip">' + escapeHtml(d.city) + "</div>"; })
      .onPointClick(openCard)
      .onGlobeClick(closeCard)

      // світіння: пульсуючі кільця
      .ringsData(places)
      .ringLat("lat")
      .ringLng("lng")
      .ringColor(function () {
        return function (t) { return "rgba(127, 227, 255," + (1 - t) * 0.8 + ")"; };
      })
      .ringMaxRadius(3.2)
      .ringPropagationSpeed(1.6)
      .ringRepeatPeriod(2000);

    // сама куля — темна, майже злита з фоном
    var mat = globe.globeMaterial();
    mat.color.set("#0b1a45");
    mat.emissive.set("#08122e");
    mat.emissiveIntensity = 0.9;
    mat.shininess = 0.4;

    var controls = globe.controls();
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 0.45;
    controls.enableDamping = true;
    controls.minDistance = 180;
    controls.maxDistance = 520;

    globe.pointOfView({ lat: 40, lng: 20, altitude: 2.0 }, 0);
    window.__globe = globe; // для налагодження в консолі браузера

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeCard(); });
    document.getElementById("card-close").addEventListener("click", closeCard);
  }

  function resize() {
    if (!globe) return;
    globe.width(window.innerWidth).height(window.innerHeight);
  }

  /* ---------- Картка ---------- */

  function openCard(place) {
    if (!place) return;
    cardCity.textContent = place.city;
    cardList.textContent = "";

    place.people.forEach(function (p) {
      var li = document.createElement("li");

      var name = document.createElement("div");
      name.className = "m-name";
      name.textContent = p.name;
      li.appendChild(name);

      if (p.role) {
        var role = document.createElement("div");
        role.className = "m-role";
        role.textContent = p.role;
        li.appendChild(role);
      }

      if (p.telegram) {
        var a = document.createElement("a");
        a.className = "m-tg";
        a.href = "https://t.me/" + encodeURIComponent(String(p.telegram).replace(/^@/, ""));
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "Написати в Telegram";
        li.appendChild(a);
      }

      cardList.appendChild(li);
    });

    card.classList.add("open");
    globe.controls().autoRotate = false;
    globe.pointOfView({ lat: place.lat, lng: place.lng, altitude: 1.6 }, 900);
  }

  function closeCard() {
    if (!card.classList.contains("open")) return;
    card.classList.remove("open");
    if (globe && !reduceMotion) globe.controls().autoRotate = true;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Старт ---------- */

  if (isRemembered()) {
    enter(false);
  } else {
    input.focus();
  }
})();
