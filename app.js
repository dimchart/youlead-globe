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

  var globe = null;
  var userTouched = false;
  var allPlaces = [];
  var searchIndex = [];
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

  // Міста ближче за цю відстань зливаються в одну точку (Буча, Ірпінь, Бориспіль → Київ),
  // інакше на глобусі вони лежать одна на одній і в них неможливо поцілити.
  var MERGE_KM = 60;      // Відень і Братислава (≈55 км) теж зливаємо: інакше точки лежать одна на одній
  var FAR_KM = 45;        // якщо місто далі за це від «головного», його назва додається в заголовок картки

  function distKm(a, b) {
    var rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var h = Math.pow(Math.sin(dLat / 2), 2) +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.pow(Math.sin(dLng / 2), 2);
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }

  function groupByCity(members) {
    var byCity = {};
    members.forEach(function (m) {
      var key = m.lat.toFixed(2) + "," + m.lng.toFixed(2);
      if (!byCity[key]) byCity[key] = { city: m.city, lat: m.lat, lng: m.lng, people: [] };
      byCity[key].people.push(m);
    });
    var cities = Object.keys(byCity).map(function (k) { return byCity[k]; });
    cities.sort(function (a, b) { return b.people.length - a.people.length; });

    var places = [];
    cities.forEach(function (c) {
      var host = null;
      for (var i = 0; i < places.length; i++) {
        if (distKm(places[i], c) <= MERGE_KM) { host = places[i]; break; }
      }
      if (host) {
        host.people = host.people.concat(c.people);
        host.cities.push(c.city);
        if (distKm(host, c) > FAR_KM) host.far.push(c.city);
      } else {
        places.push({ city: c.city, lat: c.lat, lng: c.lng, people: c.people.slice(), cities: [c.city], far: [] });
      }
    });
    return places;
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
    // поки курсор на точці — глобус не крутиться, щоб легко було натиснути
    pin.addEventListener("mouseenter", function () {
      if (globe) globe.controls().autoRotate = false;
    });
    pin.addEventListener("mouseleave", function () {
      if (globe && !reduceMotion && !userTouched && !card.classList.contains("open")) globe.controls().autoRotate = true;
    });
    return pin;
  }

  /* ---------- Глобус ---------- */

  function initGlobe() {
    if (globe) return;

    var members = window.MEMBERS || [];
    var places = groupByCity(members);
    allPlaces = places;
    buildSearchIndex(places);

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
    controls.autoRotateSpeed = 0.18;
    controls.enableDamping = true;
    controls.minDistance = 115;
    controls.maxDistance = 520;

    // стартуємо з Європи, наближено — Україна займає більшу частину екрана
    var narrow = window.innerWidth < 640;
    globe.pointOfView({ lat: 47.5, lng: 26, altitude: narrow ? 1.5 : 0.95 }, 0);
    // щойно користувач торкнувся глобуса — обертання зупиняється назавжди
    controls.addEventListener("start", function () { userTouched = true; controls.autoRotate = false; });
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

  function openCard(place, focusPerson) {
    if (!place) return;
    var count = place.people.length;

    cardCity.textContent = [place.city].concat(place.far || []).join(" · ");
    cardCount.textContent = count + " " + plural(count, "учасник", "учасники", "учасників");
    card.classList.toggle("multi", count > 1);
    cardList.textContent = "";

    place.people.forEach(function (p) {
      var li = document.createElement("li");

      var name = document.createElement("div");
      name.className = "m-name";
      name.textContent = p.name;
      li.appendChild(name);

      var roleText = [p.role, p.city !== place.city ? p.city : ""].filter(Boolean).join(" · ");
      if (roleText) {
        var role = document.createElement("div");
        role.className = "m-role";
        role.textContent = roleText;
        li.appendChild(role);
      }
      if (focusPerson && p === focusPerson) li.className = "hl";

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
    card.scrollTop = 0;
    var hl = cardList.querySelector(".hl");
    if (hl) hl.scrollIntoView({ block: "nearest" });
    globe.controls().autoRotate = false;
    globe.pointOfView({ lat: place.lat, lng: place.lng, altitude: 0.7 }, 900);
  }

  function closeCard() {
    if (!card.classList.contains("open")) return;
    card.classList.remove("open");
    if (globe && !reduceMotion && !userTouched) globe.controls().autoRotate = true;
  }


  /* ---------- Пошук за містом ---------- */

  var searchBox = document.getElementById("search");
  var searchInput = document.getElementById("search-input");
  var searchList = document.getElementById("search-results");

  // Англійські назви міст, щоб знаходилось і за "Kyiv", і за "Київ"
  var CITY_ALIASES = {
    "київ": "kyiv kiev", "дніпро": "dnipro dnepr", "львів": "lviv lvov", "варшава": "warsaw warszawa",
    "братислава": "bratislava", "відень": "vienna wien", "гельсінкі": "helsinki", "аліканте": "alicante alacant",
    "золотурн": "solothurn", "нешвілл": "nashville", "філадельфія": "philadelphia", "одеса": "odesa odessa",
    "харків": "kharkiv kharkov", "вінниця": "vinnytsia vinnitsa", "хмельницький": "khmelnytskyi khmelnitsky",
    "ірпінь": "irpin", "буча": "bucha", "бориспіль": "boryspil", "ковель": "kovel", "світловодськ": "svitlovodsk"
  };
  var TR = { "а":"a","б":"b","в":"v","г":"h","ґ":"g","д":"d","е":"e","є":"ie","ж":"zh","з":"z","и":"y","і":"i","ї":"i","й":"y",
    "к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"kh","ц":"ts","ч":"ch",
    "ш":"sh","щ":"shch","ь":"","ю":"iu","я":"ia" };

  function norm(t) {
    return String(t || "").toLowerCase().replace(/[’'ʼ`]/g, "").replace(/ё/g, "е");
  }
  function translit(t) {
    return norm(t).replace(/[а-яіїєґь]/g, function (ch) { return TR[ch] !== undefined ? TR[ch] : ch; });
  }
  function cityKeys(city) {
    var n = norm(city);
    return n + " " + translit(city) + " " + (CITY_ALIASES[n] || "");
  }

  function buildSearchIndex(places) {
    searchIndex = [];
    places.forEach(function (place) {
      var counts = {};
      place.people.forEach(function (p) { counts[p.city] = (counts[p.city] || 0) + 1; });
      Object.keys(counts).forEach(function (city) {
        searchIndex.push({
          type: "city", label: city, place: place,
          sub: counts[city] + " " + plural(counts[city], "учасник", "учасники", "учасників") +
               (city !== place.city ? " · поруч із містом " + place.city : ""),
          keys: cityKeys(city)
        });
      });
    });
  }

  function runSearch(q) {
    q = norm(q).trim();
    if (!q) return [];
    var hits = searchIndex.filter(function (e) { return e.keys.indexOf(q) !== -1; });
    hits.sort(function (a, b) {
      var ta = a.type === "city" ? 0 : 1, tb = b.type === "city" ? 0 : 1;
      if (ta !== tb) return ta - tb;
      var sa = a.keys.indexOf(q) === 0 ? 0 : 1, sb = b.keys.indexOf(q) === 0 ? 0 : 1;
      return sa - sb;
    });
    return hits.slice(0, 8);
  }

  var currentHits = [];
  function renderSearch() {
    currentHits = runSearch(searchInput.value);
    searchList.textContent = "";
    if (!searchInput.value.trim()) { searchList.hidden = true; return; }
    if (!currentHits.length) {
      var empty = document.createElement("li");
      empty.className = "search-empty";
      empty.textContent = "нічого не знайдено";
      searchList.appendChild(empty);
    }
    currentHits.forEach(function (hit) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "search-item " + hit.type;
      var l = document.createElement("span");
      l.className = "si-label";
      l.textContent = hit.label;
      var s = document.createElement("span");
      s.className = "si-sub";
      s.textContent = hit.sub;
      b.appendChild(l);
      b.appendChild(s);
      b.addEventListener("click", function () { pickHit(hit); });
      li.appendChild(b);
      searchList.appendChild(li);
    });
    searchList.hidden = false;
  }

  function pickHit(hit) {
    searchList.hidden = true;
    searchInput.value = hit.label;
    searchInput.blur();
    openCard(hit.place, hit.person);
  }

  searchInput.addEventListener("input", renderSearch);
  searchInput.addEventListener("focus", renderSearch);
  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && currentHits.length) { e.preventDefault(); pickHit(currentHits[0]); }
    if (e.key === "Escape") { searchInput.value = ""; searchList.hidden = true; searchInput.blur(); e.stopPropagation(); }
  });
  document.addEventListener("click", function (e) {
    if (!searchBox.contains(e.target)) searchList.hidden = true;
  });

  /* ---------- Старт ---------- */

  if (isRemembered()) {
    enter(false);
  } else {
    input.focus();
  }
})();
