/* Shared logic for the client site. Catalog data lives in data.js (rewritten every morning from the internal tracker). */
const SITE = {name: "Из Канады.ру", word: "Из Канады", tld: ".ру"};
const SELLERS = {
  pskov: {city: "Псков", name: "Лидер Авто", person: "Виктор", phone: "+7 911 355-99-66", whatsapp: "+79113559966", telegram: "+79113559966", max: "+7 911 355-99-66"},
  tver:  {city: "Тверь", name: "Сервис Хрустовъ", person: "", phone: "+7 996 923-64-28", whatsapp: "+79969236428", telegram: "+79969236428", max: "+7 996 135-42-55", maxLabel: "руководитель",
          lines: [{label: "Отдел продаж", phone: "+7 996 923-64-28"}, {label: "Сервисный центр", phone: "+7 996 137-38-37"}, {label: "Руководитель", phone: "+7 996 135-42-55"}]}
};
const GROUPS = [
  {k: "stock", t: "В наличии в РФ", d: "Можно посмотреть и забрать", pill: "p-stock", stages: ["moscow", "site"]},
  {k: "road",  t: "В пути", d: "Едет в Москву", pill: "p-road", stages: ["air", "bishkek", "road"]},
  {k: "ready", t: "Выкуплено", d: "Уже наше, готовится к отправке из Канады", pill: "p-road", stages: ["deposit", "bought"]},
  {k: "made",  t: "В производстве", d: "Заказано у завода, можно забронировать", pill: "p-made", stages: ["preorder"]},
  {k: "order", t: "Под заказ", d: "В наличии в Канаде, готовы к выкупу", pill: "p-order", stages: ["offer"]}
];
const KINDS = [
  {k: "atv",  t: "Квадроциклы", match: /квадро|atv/i},
  {k: "sxs",  t: "Багги", match: /багги|мотовездеход|sxs|utv/i},
  {k: "snow", t: "Снегоходы", match: /снегоход|snow/i},
  {k: "pwc",  t: "Гидроциклы", match: /гидроцикл|pwc|sea-doo/i}
];
const kindOf = it => (KINDS.find(k => k.match.test(it.type || "")) || (/ski-doo|lynx/i.test(it.make || "") ? KINDS[2] : KINDS[0])).k;
const MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = n => Math.round(n).toLocaleString("ru-RU");
const rateStr = () => Number(DATA.rate).toFixed(2).replace(".", ",");
const digits = s => String(s || "").replace(/\D/g, "");
const ATV = `<svg viewBox="0 0 120 70" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="50" r="14"/><circle cx="96" cy="50" r="14"/><path d="M38 44h44M18 34l14-12h22l10 10h22l14 10M56 22l6-10h10"/></g></svg>`;

/* City: ?city= in the link wins, then the visitor's last choice. */
let CITY = "";
(function initCity(){
  const q = new URLSearchParams(location.search).get("city");
  if (q && SELLERS[q]) { CITY = q; try { localStorage.setItem("city", q); } catch (e) {} return; }
  try { const s = localStorage.getItem("city"); if (s && SELLERS[s]) CITY = s; } catch (e) {}
})();
function setCity(c){
  CITY = SELLERS[c] ? c : "";
  try { CITY ? localStorage.setItem("city", CITY) : localStorage.removeItem("city"); } catch (e) {}
  document.querySelectorAll("[data-city]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.city === CITY)));
  document.dispatchEvent(new CustomEvent("citychange"));
}
function cityToggle(){
  return `<div class="city" role="group" aria-label="Ваш город">${Object.entries(SELLERS).map(([k, s]) => `<button type="button" data-city="${k}" aria-pressed="${k === CITY}">${esc(s.city)}</button>`).join("")}</div>`;
}

function descHtml(it){
  const t = String(it.desc || "").trim(); if (!t) return "";
  const ps = t.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => {
    const m = p.match(/^([^:\n]{2,40}):\s+([\s\S]+)$/);
    return m ? `<p><b>${esc(m[1])}.</b> ${esc(m[2].charAt(0).toUpperCase() + m[2].slice(1))}</p>` : `<p>${esc(p)}</p>`;
  }).join("");
  return `<section class="desc" aria-labelledby="descH"><h2 id="descH">Описание</h2>${ps}</section>`;
}
function yearStr(it){ return Number(it.year) > new Date().getFullYear() ? "Новая модель " + it.year + " года" : String(it.year || ""); }
function eta(it){
  if (it.stage === "moscow" || it.stage === "site") return "в наличии в РФ";
  if (it.etaText) return it.etaText;
  if (!it.eta) return it.stage === "offer" ? "уточним при заказе" : "уточняется";
  const [y, m, d] = it.eta.split("-").map(Number);
  return (d <= 10 ? "начало " : d <= 20 ? "середина " : "конец ") + MONTHS[m - 1] + " " + y;
}
function where(it){ if (it.stage === "site") return it.dest === "pskov" ? "Псков" : it.dest === "tver" ? "Тверь" : "Москва"; if (it.stage === "moscow") return "Россия"; return ""; }
function groupOf(it){ return GROUPS.find(g => g.stages.includes(it.stage)) || GROUPS[GROUPS.length - 1]; }

/* Identical preorders/offers are shown as one model with a quantity. Each group keeps the id of its first unit. */
function grouped(items){
  const map = new Map(); let n = 0;
  items.forEach(it => {
    const canGroup = true;
    const key = canGroup ? [it.stage, it.type, it.make, it.model, it.year, it.color, it.price, it.eta, it.etaText, it.dest, it.reserved, (it.imgs || []).join(",")].join("|") : "u" + (++n);
    if (!map.has(key)) map.set(key, {...it, qty: 0, ids: []});
    const g = map.get(key); g.qty++; g.ids.push(it.id);
  });
  return [...map.values()];
}
const ALL = grouped(DATA.items);
const findModel = id => ALL.find(g => g.ids.includes(id));
const title = it => [it.make, it.model].filter(Boolean).join(" ");
const isFree = it => !it.reserved && ["deposit", "bought", "air", "bishkek", "road", "moscow", "site"].includes(it.stage);
function pillsHtml(it){
  const g = groupOf(it);
  return `<div class="pills">${it.reserved ? `<span class="pill p-res">Забронировано</span>` : `<span class="pill ${g.pill}">${esc(g.t)}</span>`}${isFree(it) && !["moscow","site"].includes(it.stage) ? `<span class="pill p-free">Доступно</span>` : ""}</div>`;
}
function galleryHtml(it, eager){
  const imgs = it.imgs || [], alt = esc(title(it) + " " + it.year);
  if (!imgs.length) return `<div class="noimg">${ATV}<span>Фото добавим</span></div>`;
  return `<div class="gal" tabindex="0" aria-label="Фото, листайте">${imgs.map((src, i) => `<img src="${esc(src)}?v=43" alt="${alt}, фото ${i + 1}" loading="${i || !eager ? "lazy" : "eager"}" decoding="async">`).join("")}</div>`
    + (imgs.length > 1 ? `<button class="gnav prev" type="button" data-gal="-1" aria-label="Предыдущее фото">‹</button><button class="gnav next" type="button" data-gal="1" aria-label="Следующее фото">›</button><div class="dots">${imgs.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : "");
}
function priceHtml(it){
  return it.price > 0
    ? `<div class="usd num">${fmt(it.price)} $</div><div class="rub num">≈ ${fmt(it.price * DATA.rate)} ₽ по курсу ${rateStr()}</div><div class="rub">цена в Москве</div>`
    : `<div class="soon">Цену уточняйте</div><div class="rub">можно забронировать уже сейчас</div>`;
}
const askLabel = it => it.reserved ? "Узнать о похожей" : it.stage === "offer" ? "Заказать" : "Забронировать";
const modelUrl = it => "model/?id=" + encodeURIComponent(it.ids[0]);

/* Gallery arrows and dots, for any page. */
document.addEventListener("click", e => {
  const b = e.target.closest("[data-gal]"); if (!b) return;
  const g = b.parentElement.querySelector(".gal"); g.scrollBy({left: g.clientWidth * Number(b.dataset.gal), behavior: "smooth"});
});
document.addEventListener("scroll", e => {
  const g = e.target; if (!g.classList || !g.classList.contains("gal")) return;
  const i = Math.round(g.scrollLeft / g.clientWidth);
  g.parentElement.querySelectorAll(".dots i").forEach((d, k) => d.classList.toggle("on", k === i));
  const th = document.querySelectorAll(".thumbs button"); th.forEach((t, k) => t.setAttribute("aria-current", String(k === i)));
}, true);
document.addEventListener("click", e => { const b = e.target.closest("[data-city]"); if (b) setCity(b.dataset.city); });

/* Contact sheet: the chosen city's seller, or both if no city is chosen yet. */
async function copyText(t){
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); return true; } } catch (e) {}
  try {
    const ta = document.createElement("textarea"); ta.value = t; ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
    document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, t.length);
    const ok = document.execCommand("copy"); ta.remove(); return ok;
  } catch (e) { return false; }
}
function toast(t){ const el = document.getElementById("toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => el.hidden = true, 2600); }
function tgHref(s){ const t = String(s.telegram || ""); return "https://t.me/" + (/^\+?\d[\d\s()-]{6,}$/.test(t) ? "+" + digits(t) : t.replace(/^@|^https?:\/\/t\.me\//, "")); }
const telHref = p => "tel:+" + digits(p);
const sellerTitle = s => s.person ? s.person + ", " + s.name : s.name;
const sellerLines = s => s.lines && s.lines.length ? s.lines : [{label: "", phone: s.phone}];
function sellerBlock(key, text){
  const s = SELLERS[key];
  return `<div class="seller"><div class="who">${esc(sellerTitle(s))}</div><div class="where">${esc(s.city)}</div>
    ${sellerLines(s).map(l => `<div class="tel">${l.label ? `<span class="lbl">${esc(l.label)}</span>` : ""}<a class="num" href="${telHref(l.phone)}">${esc(l.phone)}</a><button class="btn" type="button" data-copy="${esc(l.phone)}">Скопировать</button></div>`).join("")}
    <div class="row"><a class="btn primary" href="https://wa.me/${digits(s.whatsapp)}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">WhatsApp</a><a class="btn" href="${tgHref(s)}" target="_blank" rel="noopener">Telegram</a>${s.max ? `<button class="btn" type="button" data-max="${esc(s.max)}">Max</button>` : ""}</div>
    ${s.lines && s.lines.length > 1 ? `<div class="where" style="margin-top:6px">WhatsApp и Telegram — ${esc(s.lines[0].label.toLowerCase())}${s.max ? ", Max — " + esc(s.maxLabel || "") : ""}</div>` : ""}</div>`;
}
function openSheet(heading, sub, text){
  const el = document.getElementById("sheet");
  const keys = CITY ? [CITY] : Object.keys(SELLERS);
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="shT">
    <h3 id="shT">${esc(heading)}</h3>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}
    ${CITY ? "" : `<div class="sub">Выберите продавца в вашем городе</div>`}
    ${keys.map(k => sellerBlock(k, text)).join("")}
    ${CITY ? `<button class="close" type="button" data-other>Показать продавца в другом городе</button>` : ""}
    <button class="close" type="button" data-close>Закрыть</button></div>`;
  el.hidden = false;
  const close = () => { el.hidden = true; el.innerHTML = ""; document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  el.onclick = async e => {
    if (e.target === el || e.target.closest("[data-close]")) return close();
    if (e.target.closest("[data-other]")) { const c = CITY; CITY = ""; close(); openSheet(heading, sub, text); CITY = c; return; }
    const mx = e.target.closest("[data-max]");
    if (mx) { toast(await copyText(mx.dataset.max) ? "Номер скопирован: найдите его в Max" : "Max: " + mx.dataset.max); return; }
    const cp = e.target.closest("[data-copy]");
    if (cp) { toast(await copyText(cp.dataset.copy) ? "Номер скопирован" : cp.dataset.copy); }
  };
  el.querySelector(".btn.primary")?.focus();
}
function askAbout(it){
  const text = "Здравствуйте! Интересует " + title(it) + " " + it.year + (it.color ? ", " + it.color : "") + (it.price > 0 ? ", " + fmt(it.price) + " $" : "") + ". " + (it.stage === "offer" ? "Хочу заказать, подскажите по срокам и условиям." : it.reserved ? "Есть ли похожая?" : "Хочу забронировать, как внести задаток?");
  openSheet(title(it) + " " + it.year, [it.color, it.price > 0 ? fmt(it.price) + " $" : ""].filter(Boolean).join(", "), text);
}
function updatedLine(){
  const d = (DATA.updated || "").slice(0, 10).split("-");
  return d.length === 3 ? `Цены и наличие обновлены ${d[2]}.${d[1]}.${d[0]}. Курс: 1 $ = ${rateStr()} ₽.` : "";
}
function frame(){
  document.querySelectorAll("[data-sitename]").forEach(el => el.innerHTML = `<span class="w">${esc(SITE.word)}</span><span class="t">${esc(SITE.tld)}</span>`);
  const ct = document.getElementById("cityToggle"); if (ct) ct.innerHTML = cityToggle();
  const f = document.getElementById("footSellers");
  if (f) f.innerHTML = Object.values(SELLERS).map(s => `<div><h3>${esc(s.city)}</h3><p>${esc(sellerTitle(s))}</p>${sellerLines(s).map(l => `<p>${l.label ? `<span class="flbl">${esc(l.label)}</span><br>` : ""}<a class="tel num" href="${telHref(l.phone)}">${esc(l.phone)}</a></p>`).join("")}<p>${s.lines && s.lines.length > 1 ? "WhatsApp и Telegram — " + esc(s.lines[0].label.toLowerCase()) + (s.max ? ", Max — " + esc(s.maxLabel || "") : "") : (s.max ? "WhatsApp, Telegram и Max на этом же номере" : "WhatsApp и Telegram на этом же номере")}</p></div>`).join("");
  const u = document.getElementById("updated"); if (u) u.textContent = updatedLine();
}

/* Photos close to the 4:3 frame (incl. square) fill it; tall or very wide ones are shown whole on a plain background */
function fitPhoto(img){ const r = img.naturalWidth / img.naturalHeight; if (r >= 0.95 && r <= 1.55) img.classList.add("fill"); }
document.addEventListener("load", e => { const t = e.target; if (t && t.tagName === "IMG" && t.closest(".gal")) fitPhoto(t); }, true);

/* Price calculator: price in C$ -> turnkey price in Moscow (main site only). New: settings from DATA.calc; used (Б/У): DATA.calc.used or defaults below */
(function(){
  const C = DATA.calc, box = document.getElementById("calc");
  if (!C || !box) return;
  box.hidden = false;
  const U = Object.assign({tax: 15, yul: 1500, airQ: 3700, airS: 4150, airM: 3100, ab: 650, custQ: 2500, custS: 3000, custM: 2500, mk: 1000, pre: 50, deliv: 20000,
    url: "https://www.autotrader.ca/snowmobiles/lst/reg_qc/cit_montreal/ot_used?cy=CA&damaged_listing=exclude&desc=0&sort=standard&ustate=N%2CU&zip=H2y1c6+Montr%C3%A9al&zipr=50&lat=45.509119&lon=-73.554666&atype=S&size=20"}, C.used || {});
  const NEW_URL = C.url || "https://www.shoparide.ca/en/snowmobile/?region=montreal";
  const MOTO_URL = C.urlMoto || "https://www.shoparide.ca/en/motorcycle/?region=montreal";
  let T = "q", P = "d", K = "n";
  const $id = id => document.getElementById(id);
  const inp = $id("calcPrice"), outU = $id("calcUsd"), outR = $id("calcRub"), ask = $id("calcAsk"), pre = $id("calcPre"), dv = $id("calcDeliv");
  const num = v => { const x = parseFloat(String(v || "").replace(/\s/g, "").replace(",", ".")); return isFinite(x) ? x : 0; };
  const rubOf = usd => DATA.rate ? fmt(Math.round(usd * DATA.rate / 100) * 100) + " ₽" : "";
  function total(price){
    if (K === "u" || T === "m"){
      const buy = price * (1 + U.tax / 100) / C.buy;
      const air = (T === "s" ? U.airS : T === "m" ? U.airM : U.airQ) / C.airR, yul = U.yul / C.airR;
      const cost = buy + yul + air + U.ab + (T === "s" ? U.custS : T === "m" ? U.custM : U.custQ);
      return Math.ceil((cost + (K === "u" ? U.mk : (C.mkMoto ?? 2500))) / 100) * 100;
    }
    const buy = price * (1 + (P === "p" ? C.taxP : C.taxD) / 100) / C.buy;
    const air = (T === "s" ? C.airS : C.airQ) / C.airR, yul = C.yul / C.airR, ab = T === "s" ? C.abS : C.abQ;
    const fin = buy + yul + air + ab;
    const cost = fin + (T === "s" && C.custS ? C.custS : C.cust) + fin * C.fin / 100 * C.days / C.per;
    return Math.ceil((cost + C.mk) / 100) * 100;
  }
  function calc(){
    const p = num(inp.value);
    if (p < 1000){ outU.textContent = "—"; outR.textContent = ""; ask.hidden = true; pre.hidden = true; return; }
    const t = total(p);
    outU.textContent = fmt(t) + " $";
    outR.textContent = DATA.rate ? "≈ " + rubOf(t) + " по курсу " + rateStr() + " ₽" : "";
    const lines = [];
    if (K === "u"){ const h = Math.round(t * U.pre / 100); lines.push("Предоплата " + U.pre + "%: " + fmt(h) + " $" + (DATA.rate ? " (≈ " + rubOf(h) + ")" : ""), "Остаток после доставки: " + fmt(t - h) + " $"); }
    if (dv.checked) lines.push("Доставка дальше из Москвы: ориентир " + fmt(U.deliv) + " ₽, рассчитываем индивидуально", "<b>С доставкой: " + fmt(t) + " $ + ≈ " + fmt(U.deliv) + " ₽</b>");
    pre.innerHTML = lines.join("<br>"); pre.hidden = !lines.length;
    ask.hidden = false;
  }
  function seg(attr, val){ box.querySelectorAll(`[${attr}]`).forEach(b => b.setAttribute("aria-checked", String(b.getAttribute(attr) === val))); }
  function mode(){
    seg("data-ccond", K);
    const a = $id("calcSrc"); a.href = K === "u" ? U.url : (T === "m" ? MOTO_URL : NEW_URL); a.textContent = (K === "u" ? "autotrader.ca" : "shoparide.ca") + " ↗";
    $id("calcSrcTip").textContent = K === "u" ? "Впишите цену из объявления. Перед покупкой проверим состояние и документы." : "Выбирайте проверенного продавца со звёздочками, затем впишите цену из объявления.";
    $id("calcNote").textContent = K === "u" ? "Предварительный расчёт под ключ до Москвы, со склада: выкуп, доставка и растаможка. Точную цену подтвердим после проверки объявления." : "Предварительный расчёт под ключ: выкуп, доставка и растаможка. Точную цену подтвердим после проверки объявления.";
    calc();
  }
  box.addEventListener("click", e => {
    const k = e.target.closest("[data-ccond]"); if (k){ K = k.dataset.ccond; mode(); return; }
    const t = e.target.closest("[data-ctype]"); if (t){ T = t.dataset.ctype; seg("data-ctype", T); mode(); return; }
    const s = e.target.closest("[data-cseller]"); if (s){ P = s.dataset.cseller; seg("data-cseller", P); calc(); }
  });
  inp.addEventListener("input", calc);
  dv.addEventListener("change", calc);
  inp.addEventListener("blur", () => { const p = num(inp.value); if (p) inp.value = fmt(p); });
  ask.addEventListener("click", () => {
    const p = num(inp.value), kind = (K === "u" ? "б/у " : "") + (T === "s" ? "снегоход" : T === "m" ? "мотоцикл" : "квадроцикл");
    const from = K === "u" ? "" : " (" + (P === "p" ? "у частного лица" : "у дилера") + ")";
    const text = "Здравствуйте! Посчитал на сайте " + kind + " за " + fmt(p) + " C$" + from + ", вышло " + outU.textContent + (dv.checked ? " + доставка дальше из Москвы" : "") + ". Хочу узнать точную цену, пришлю ссылку на объявление.";
    openSheet("Точная цена", kind[0].toUpperCase() + kind.slice(1) + ", " + outU.textContent, text);
  });
})();

/* Used snowmobiles from Canada (USED from used.js): listing price in C$ -> turnkey price in Moscow */
(function(){
  const box = document.getElementById("used");
  if (typeof USED === "undefined" || !box || !USED.items || !USED.items.length) return;
  const C = DATA.calc || {}, R = Object.assign({tax: 15, taxPriv: 10, yul: 1500, air: 4150, ab: 650, cust: 3000, mk: 1000}, USED.calc || {});
  const buy = C.buy || 1.42, airR = C.airR || 1.42;
  const total = (p, priv) => Math.ceil((p * (1 + (priv ? R.taxPriv : R.tax) / 100) / buy + R.yul / airR + R.air / airR + R.ab + R.cust + R.mk) / 100) * 100;
  const KIND = {tour: "Туристический", mount: "Горный", sport: "Спортивный", cross: "Кроссовер", util: "Утилитарный"};
  const KINDS = {tour: "Туристические", mount: "Горные", sport: "Спортивные", cross: "Кроссоверы", util: "Утилитарные"};
  const PROV = {QC: "Квебек", ON: "Онтарио"};
  const items = USED.items.map(it => Object.assign({}, it, {total: total(it.price, it.priv)})).sort((a, b) => a.total - b.total);
  let brand = "", kind = "";
  const rub = t => DATA.rate ? "≈ " + fmt(Math.round(t * DATA.rate / 1000) * 1000) + " ₽" : "";
  const card = (it, i) => `<article class="uc" style="--i:${i}">
      <a class="uc-plate ${it.brand === "Yamaha" ? "is-yam" : "is-brp"}" href="${esc(it.url)}" target="_blank" rel="noopener" aria-label="${esc(it.make + " " + it.fam + " " + it.trim)}: фото в объявлении">
        <span class="uc-stripe" aria-hidden="true"></span>
        <span class="uc-kind">${esc(KIND[it.kind] || "")}</span>
        <span class="uc-year num">${it.year}</span>
        <span class="uc-fam">${esc(it.make)}</span>
        <span class="uc-trim">${esc(it.fam)} ${esc(it.trim)}</span>
        <span class="uc-photo">Фото в объявлении ↗</span>
      </a>
      <div class="uc-body">
        <div class="uc-price"><span class="uc-usd num">${fmt(it.total)} $</span><span class="uc-rub num">${rub(it.total)} под ключ в Москве</span></div>
        <dl class="uc-spec"><div><dt>Пробег</dt><dd class="num">${fmt(it.km)} км</dd></div><div><dt>Мотор</dt><dd>${esc(it.engine || "")}</dd></div></dl>
        <p class="uc-note">${esc(it.note || "")}</p>
        <p class="uc-where">В Канаде <b class="num">${fmt(it.price)} C$</b>, ${esc(it.city)}, ${esc(PROV[it.prov] || it.prov)}</p>
        <div class="uc-act"><button class="btn primary" type="button" data-used="${esc(it.id)}">Хочу этот</button></div>
      </div>
    </article>`;
  const chips = (el, list, cur, attr) => { el.innerHTML = list.map(([v, t, n]) => `<button type="button" ${attr}="${v}" aria-pressed="${v === cur}">${esc(t)} <span class="num">${n}</span></button>`).join(""); };
  function render(){
    const byBrand = items.filter(x => !brand || x.brand === brand);
    chips(document.getElementById("ucBrand"), [["", "Все марки", items.length], ["BRP", "Ski-Doo и Lynx", items.filter(x => x.brand === "BRP").length], ["Yamaha", "Yamaha", items.filter(x => x.brand === "Yamaha").length]], brand, "data-ub");
    const kinds = Object.keys(KINDS).filter(k => byBrand.some(x => x.kind === k));
    if (kind && !kinds.includes(kind)) kind = "";
    chips(document.getElementById("ucKind"), [["", "Любой тип", byBrand.length], ...kinds.map(k => [k, KINDS[k], byBrand.filter(x => x.kind === k).length])], kind, "data-uk");
    document.getElementById("usedList").innerHTML = byBrand.filter(x => !kind || x.kind === kind).map(card).join("");
  }
  render();
  const d = String(USED.updated || "").split("-");
  document.getElementById("usedUpd").textContent = d.length === 3 ? `Подборка обновлена ${d[2]}.${d[1]}.${d[0]}. Цена под ключ включает выкуп с налогом, доставку до Москвы и растаможку. Наличие у продавца проверим перед покупкой.` : "";
  box.hidden = false;
  box.addEventListener("click", e => {
    const b = e.target.closest("[data-ub]"); if (b){ brand = b.dataset.ub; render(); return; }
    const k = e.target.closest("[data-uk]"); if (k){ kind = k.dataset.uk; render(); return; }
    const u = e.target.closest("[data-used]"); if (!u) return;
    const it = items.find(x => x.id === u.dataset.used); if (!it) return;
    openSheet("Б/У из Канады", it.make + " " + it.fam + " " + it.trim + ", " + it.year + ", " + fmt(it.total) + " $",
      "Здравствуйте! Интересует б/у снегоход с сайта: " + it.make + " " + it.fam + " " + it.trim + ", " + it.year + " г., " + fmt(it.km) + " км, " + fmt(it.total) + " $ под ключ в Москве. Объявление: " + it.url);
  });
})();

/* Scroll reveal: cards and list items fade up the first time they enter the screen */
(function(){
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const SEL = ".card, .uc, .steps li, .faq details, .block-h, .calc-box";
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } }), {rootMargin: "0px 0px -8% 0px", threshold: 0.08});
  const scan = root => (root.querySelectorAll ? root : document).querySelectorAll(SEL).forEach((el, i) => {
    if (el.dataset.rv) return; el.dataset.rv = 1;
    const r = el.getBoundingClientRect(); if (r.top < innerHeight * 0.92 && r.bottom > 0 && !el.closest("#usedList, #list")) return;
    el.classList.add("rv"); el.style.setProperty("--rd", (Array.prototype.indexOf.call(el.parentNode.children, el) % 3) * 90 + "ms"); io.observe(el);
  });
  scan(document);
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1){ if (n.matches && n.matches(SEL)) scan(n.parentNode); else scan(n); } }))).observe(document.body, {childList: true, subtree: true});
})();
