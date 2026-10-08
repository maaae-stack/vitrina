/* Shared logic for the client site. Catalog data lives in data.js (rewritten every morning from the internal tracker). */
const SITE = {name: "Из Канады.ру", word: "Из Канады", tld: ".ру"};
const SELLERS = {
  pskov: {city: "Псков", name: "Лидер Авто", person: "Виктор", phone: "+7 911 355-99-66", whatsapp: "+79113559966", telegram: "+79113559966"},
  tver:  {city: "Тверь", name: "Сервис Хрустовъ", person: "", phone: "+7 996 923-64-28", whatsapp: "+79969236428", telegram: "+79969236428",
          lines: [{label: "Отдел продаж", phone: "+7 996 923-64-28"}, {label: "Сервисный центр", phone: "+7 996 137-38-37"}, {label: "Руководитель", phone: "+7 996 135-42-55"}]}
};
const GROUPS = [
  {k: "stock", t: "В наличии", d: "Можно посмотреть и забрать", pill: "p-stock", stages: ["moscow", "site"]},
  {k: "road",  t: "В пути", d: "Едет в Москву", pill: "p-road", stages: ["air", "bishkek"]},
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
  if (it.stage === "moscow" || it.stage === "site") return "уже в Москве";
  if (it.etaText) return it.etaText;
  if (!it.eta) return it.stage === "offer" ? "уточним при заказе" : "уточняется";
  const [y, m, d] = it.eta.split("-").map(Number);
  return (d <= 10 ? "начало " : d <= 20 ? "середина " : "конец ") + MONTHS[m - 1] + " " + y;
}
function where(it){ if (it.stage === "site") return it.dest === "pskov" ? "Псков" : it.dest === "tver" ? "Тверь" : "Москва"; if (it.stage === "moscow") return "Москва"; return ""; }
function groupOf(it){ return GROUPS.find(g => g.stages.includes(it.stage)) || GROUPS[GROUPS.length - 1]; }

/* Identical preorders/offers are shown as one model with a quantity. Each group keeps the id of its first unit. */
function grouped(items){
  const map = new Map(); let n = 0;
  items.forEach(it => {
    const canGroup = it.stage === "preorder" || it.stage === "offer";
    const key = canGroup ? [it.stage, it.type, it.make, it.model, it.year, it.color, it.price, it.eta, it.etaText, it.dest, it.reserved, (it.imgs || []).join(",")].join("|") : "u" + (++n);
    if (!map.has(key)) map.set(key, {...it, qty: 0, ids: []});
    const g = map.get(key); g.qty++; g.ids.push(it.id);
  });
  return [...map.values()];
}
const ALL = grouped(DATA.items);
const findModel = id => ALL.find(g => g.ids.includes(id));
const title = it => [it.make, it.model].filter(Boolean).join(" ");
const isFree = it => !it.reserved && ["deposit", "bought", "air", "bishkek", "moscow", "site"].includes(it.stage);
function pillsHtml(it){
  const g = groupOf(it);
  return `<div class="pills">${it.reserved ? `<span class="pill p-res">Забронировано</span>` : `<span class="pill ${g.pill}">${esc(g.t)}</span>`}${isFree(it) && !["moscow","site"].includes(it.stage) ? `<span class="pill p-free">В свободной продаже</span>` : ""}</div>`;
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
    <div class="row"><a class="btn primary" href="https://wa.me/${digits(s.whatsapp)}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">WhatsApp</a><a class="btn" href="${tgHref(s)}" target="_blank" rel="noopener">Telegram</a></div>
    ${s.lines && s.lines.length > 1 ? `<div class="where" style="margin-top:6px">WhatsApp и Telegram — ${esc(s.lines[0].label.toLowerCase())}</div>` : ""}</div>`;
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
  if (f) f.innerHTML = Object.values(SELLERS).map(s => `<div><h3>${esc(s.city)}</h3><p>${esc(sellerTitle(s))}</p>${sellerLines(s).map(l => `<p>${l.label ? `<span class="flbl">${esc(l.label)}</span><br>` : ""}<a class="tel num" href="${telHref(l.phone)}">${esc(l.phone)}</a></p>`).join("")}<p>${s.lines && s.lines.length > 1 ? "WhatsApp и Telegram — " + esc(s.lines[0].label.toLowerCase()) : "WhatsApp и Telegram на этом же номере"}</p></div>`).join("");
  const u = document.getElementById("updated"); if (u) u.textContent = updatedLine();
}

/* Photos close to the 4:3 frame (incl. square) fill it; tall or very wide ones are shown whole on a plain background */
function fitPhoto(img){ const r = img.naturalWidth / img.naturalHeight; if (r >= 0.95 && r <= 1.55) img.classList.add("fill"); }
document.addEventListener("load", e => { const t = e.target; if (t && t.tagName === "IMG" && t.closest(".gal")) fitPhoto(t); }, true);

/* Price calculator: dealer price in C$ -> turnkey price in Moscow (main site only) */
(function(){
  const C = DATA.calc, box = document.getElementById("calc");
  if (!C || !box) return;
  box.hidden = false;
  let T = "q", P = "d";
  const inp = document.getElementById("calcPrice"), outU = document.getElementById("calcUsd"), outR = document.getElementById("calcRub"), ask = document.getElementById("calcAsk");
  const num = v => { const x = parseFloat(String(v || "").replace(/\s/g, "").replace(",", ".")); return isFinite(x) ? x : 0; };
  function total(price){
    const buy = price * (1 + (P === "p" ? C.taxP : C.taxD) / 100) / C.buy;
    const air = (T === "s" ? C.airS : C.airQ) / C.airR, yul = C.yul / C.airR, ab = T === "s" ? C.abS : C.abQ;
    const fin = buy + yul + air + ab;
    const cost = fin + C.cust + fin * C.fin / 100 * C.days / C.per;
    return Math.ceil((cost + C.mk) / 100) * 100;
  }
  function calc(){
    const p = num(inp.value);
    if (p < 1000){ outU.textContent = "—"; outR.textContent = ""; ask.hidden = true; return; }
    const t = total(p);
    outU.textContent = fmt(t) + " $";
    outR.textContent = DATA.rate ? "≈ " + fmt(Math.round(t * DATA.rate / 100) * 100) + " ₽ по курсу " + rateStr() + " ₽" : "";
    ask.hidden = false;
  }
  function seg(attr, val){ box.querySelectorAll(`[${attr}]`).forEach(b => b.setAttribute("aria-checked", String(b.getAttribute(attr) === val))); }
  box.addEventListener("click", e => {
    const t = e.target.closest("[data-ctype]"); if (t){ T = t.dataset.ctype; seg("data-ctype", T); calc(); return; }
    const s = e.target.closest("[data-cseller]"); if (s){ P = s.dataset.cseller; seg("data-cseller", P); calc(); }
  });
  inp.addEventListener("input", calc);
  inp.addEventListener("blur", () => { const p = num(inp.value); if (p) inp.value = fmt(p); });
  ask.addEventListener("click", () => {
    const p = num(inp.value), kind = T === "s" ? "снегоход" : "квадроцикл";
    const text = "Здравствуйте! Посчитал на сайте " + kind + " за " + fmt(p) + " C$ (" + (P === "p" ? "у частного лица" : "у дилера") + "), вышло " + outU.textContent + ". Хочу узнать точную цену, пришлю ссылку на объявление.";
    openSheet("Точная цена", kind[0].toUpperCase() + kind.slice(1) + ", " + outU.textContent, text);
  });
})();
