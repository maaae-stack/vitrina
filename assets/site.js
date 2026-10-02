/* Shared logic for the client site. Catalog data lives in data.js (rewritten every morning from the internal tracker). */
const SITE = {name: "Из Канады.ру", word: "Из Канады", tld: ".ру"};
const SELLERS = {
  pskov: {city: "Псков", name: "Лидер Авто", person: "Виктор", phone: "+7 911 355-99-66", whatsapp: "+79113559966", telegram: "+79113559966"},
  tver:  {city: "Тверь", name: "Сервис Хрустовъ", person: "Александр", phone: "+7 996 135-42-55", whatsapp: "+79961354255", telegram: "+79961354255"}
};
const GROUPS = [
  {k: "stock", t: "В наличии", d: "Можно посмотреть и забрать", pill: "p-stock", stages: ["moscow", "site"]},
  {k: "road",  t: "В пути", d: "Едет в Москву", pill: "p-road", stages: ["air", "bishkek"]},
  {k: "ready", t: "Выкуплено", d: "Уже наше, готовится к отправке из Канады", pill: "p-road", stages: ["deposit", "bought"]},
  {k: "made",  t: "В производстве", d: "Заказано у завода, можно забронировать", pill: "p-made", stages: ["preorder"]},
  {k: "order", t: "Под заказ", d: "Привезём по вашему запросу", pill: "p-order", stages: ["offer"]}
];
const MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = n => Math.round(n).toLocaleString("ru-RU");
const rateStr = () => String(DATA.rate).replace(".", ",");
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
    const key = canGroup ? [it.stage, it.make, it.model, it.year, it.color, it.price, it.eta, it.etaText, it.dest, it.reserved, (it.imgs || []).join(",")].join("|") : "u" + (++n);
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
  return `<div class="gal" tabindex="0" aria-label="Фото, листайте">${imgs.map((src, i) => `<img src="${esc(src)}" alt="${alt}, фото ${i + 1}" loading="${i || !eager ? "lazy" : "eager"}" decoding="async">`).join("")}</div>`
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
function toast(t){ const el = document.getElementById("toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => el.hidden = true, 2600); }
function tgHref(s){ const t = String(s.telegram || ""); return "https://t.me/" + (/^\+?\d[\d\s()-]{6,}$/.test(t) ? "+" + digits(t) : t.replace(/^@|^https?:\/\/t\.me\//, "")); }
function sellerBlock(key, text){
  const s = SELLERS[key];
  return `<div class="seller"><div class="who">${esc(s.person)}, ${esc(s.name)}</div><div class="where">${esc(s.city)}</div>
    <div class="tel"><span class="num">${esc(s.phone)}</span><button class="btn" type="button" data-copy="${esc(s.phone)}">Скопировать</button></div>
    <div class="row"><a class="btn primary" href="https://wa.me/${digits(s.whatsapp)}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">WhatsApp</a><a class="btn" href="${tgHref(s)}" target="_blank" rel="noopener">Telegram</a></div></div>`;
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
    if (cp) { try { await navigator.clipboard.writeText(cp.dataset.copy); toast("Номер скопирован"); } catch (err) { toast(cp.dataset.copy); } }
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
  if (f) f.innerHTML = Object.values(SELLERS).map(s => `<div><h3>${esc(s.city)}</h3><p>${esc(s.name)}, ${esc(s.person)}</p><p><a class="tel num" href="tel:${digits(s.phone).replace(/^/, "+")}">${esc(s.phone)}</a></p><p>WhatsApp и Telegram на этом же номере</p></div>`).join("");
  const u = document.getElementById("updated"); if (u) u.textContent = updatedLine();
}
