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
  var cardCount = document.getElementById("card-count");
  var cardList = document.getElementById("card-list");
  var statsEl = document.getElementById("stats");

  var globe = null;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Допоміжне ---------- */

  // Українська множина: 1 учасник, 2 учасники, 5 учасників
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

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

  /* ---------- Точка на глобусі (велика кнопка) ---------- */

  function makePin(place) {
    var count = place.people.length;

    var pin = document.createElement("button");
    pin.type = "button";
    pin.className = "pin" + (count > 1 ? " multi" : "");
    pin.setAttribute(
      "aria-label",
      place.city + ": " + count + " " + plural(count, "учасник", "учасники", "учасників")
    );

    var ring = document.createElement("span");
    ring.className = "ring";
    var dot = document.createElement("span");
    dot.className = "dot";
    var tip = document.createElement("span");
    tip.className = "tip";
    tip.textContent = place.city + (count > 1 ? " · " + count : "");

    pin.appendChild(ring);
    pin.appendChild(dot);
    pin.appendChild(tip);

    pin.addEventListener("click", function (e) {
      e.stopPropagation();
      openCard(place);
    });
    return pin;
  }

  /* ---------- Глобус ---------- */

  function initGlobe() {
    if (globe) return;

    var members = window.MEMBERS || [];
    var places = groupByCity(members);
    statsEl.textContent =
      members.length + " " + plural(members.length, "учасник", "учасники", "учасників") +
      " · " +
      places.length + " " + plural(places.length, "місто", "міста", "міст");

    var el = document.getElementById("globe");

    globe = Globe()(el)
      .backgroundColor("rgba(0,0,0,0)")
      .showAtmosphere(true)
      .atmosphereColor("#9a9a9a")
      .atmosphereAltitude(0.14)

      // мінімалістична мапа: суша з сірих крапок
      .hexPolygonsData(window.COUNTRIES.features)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.42)
      .hexPolygonColor(function () { return "#8f8f8f"; })

      // точки учасників — HTML-кнопки (біла = 1 учасник, помаранчева = кілька)
      .htmlElementsData(places)
      .htmlLat("lat")
      .htmlLng("lng")
      .htmlAltitude(0.01)
      .htmlElement(makePin)
      .htmlElementVisibilityModifier(function (elem, visible) {
        // ховаємо точки на зворотному боці кулі
        elem.style.opacity = visible ? "1" : "0";
        elem.style.pointerEvents = visible ? "auto" : "none";
      })

      .onGlobeClick(function (coords, ev) {
        // клік по самій точці не має закривати картку
        if (ev && ev.target && ev.target.closest && ev.target.closest(".pin")) return;
        closeCard();
      });

    // сама куля — майже чорна, щоб сіра суша добре читалась
    var mat = globe.globeMaterial();
    mat.color.set("#141414");
    mat.emissive.set("#0c0c0c");
    mat.emissiveIntensity = 0.9;
    mat.shininess = 0.3;

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
    var count = place.people.length;

    cardCity.textContent = place.city;
    cardCount.textContent = count + " " + plural(count, "учасник", "учасники", "учасників");
    card.classList.toggle("multi", count > 1);
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

  /* ---------- Старт ---------- */

  if (isRemembered()) {
    enter(false);
  } else {
    input.focus();
  }
})();
