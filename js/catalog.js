/**
 * catalog.js
 * -------------------------------------------------------
 * Carrega o cardápio do banco (na amostra, o banco local da
 * demonstração) e monta o DOM. Pratos do dia aparecem só nos
 * dias marcados no painel.
 * -------------------------------------------------------
 */

const catalog = {
  categorias: [],   // [{ nome, slug, produtos: [...] }]
  todos: new Map(), // id → produto (inclui os que não são servidos hoje)
  adicionais: [],   // [{ name, price, group }]
  delivery: { ativo: false, retirada: false, modo: "fixo", taxaFixa: 0, bairros: [] },
  online: false,
};

/**
 * Escuta o cardápio ao vivo (categorias, produtos e configurações públicas).
 * A primeira resposta vem do cache local (imediata); as mudanças do painel
 * chegam sozinhas. Várias mudanças juntas viram UM redesenho (~16 ms) — com
 * timer, e não requestAnimationFrame, que fica parado em aba escondida.
 */
function watchCatalog(onChange) {
  const raw = { cats: null, prods: null, adicionais: null, delivery: null, loja: null, mesas: null };
  let frame = 0;
  const rebuild = () => {
    frame = 0;
    if (!raw.cats || !raw.prods) return; // espera o mínimo para desenhar
    if (raw.loja) applyStoreConfig(raw.loja);
    const produtos = raw.prods.map(d => ({ id: d.id, ...d.data() }));
    catalog.todos = new Map(produtos.map(p => [p.id, p]));
    catalog.categorias = raw.cats.map(d => {
      const cat = d.data(), slug = cat.slug || d.id;
      return { nome: cat.nome, slug, produtos: produtos.filter(p => p.categoriaSlug === slug && servidoHoje(p)) };
    });
    catalog.adicionais = raw.adicionais?.itens || [];
    catalog.delivery = { ativo: false, retirada: false, modo: "fixo", taxaFixa: 0, bairros: [], ...(raw.delivery || {}) };
    catalog.mesas = Number(raw.mesas?.quantidade) || 0;
    catalog.online = true;
    onChange();
  };
  const schedule = () => { if (!frame) frame = setTimeout(rebuild, 16); };
  const fail = err => {
    console.error("Cardápio indisponível:", err.code || err.message);
    if (!catalog.online) onChange();
  };
  db.collection("categorias").orderBy("ordem").onSnapshot(s => { raw.cats = s.docs; schedule(); }, fail);
  db.collection("produtos").orderBy("ordem").onSnapshot(s => { raw.prods = s.docs; schedule(); }, fail);
  db.collection("config").doc("adicionais").onSnapshot(s => { raw.adicionais = s.data() || null; schedule(); }, fail);
  db.collection("config").doc("deliveryFees").onSnapshot(s => { raw.delivery = s.data() || null; schedule(); }, fail);
  db.collection("config").doc("loja").onSnapshot(s => { raw.loja = s.data() || null; schedule(); }, fail);
  db.collection("config").doc("mesas").onSnapshot(s => { raw.mesas = s.data() || null; schedule(); }, fail);
}

/* ---------------- Fotos (só carregam quando aparecem na tela) ----------------
 * Plano gratuito: sem Cloud Storage. A foto do produto fica num documento
 * próprio (fotos/{id}), leve (WebP reduzido), separado do cardápio — o
 * cardápio abre rápido e cada foto vem só quando o cartão entra na tela.
 */
const fotoCache = new Map(); // id → Promise<url> | url
function carregarFoto(id) {
  if (fotoCache.has(id)) return Promise.resolve(fotoCache.get(id));
  const p = db.collection("fotos").doc(id).get()
    .then(s => { const u = safeUrl(s.data()?.data); fotoCache.set(id, u); return u; })
    .catch(() => { fotoCache.delete(id); return ""; });
  fotoCache.set(id, p);
  return p;
}
const fotoVisivel = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    fotoVisivel.unobserve(en.target);
    trocarPorFoto(en.target);
  });
}, { rootMargin: "200px 0px" }) : null;
async function trocarPorFoto(el) {
  const url = await carregarFoto(el.dataset.foto);
  if (!url || !el.isConnected) return;
  const img = new Image();
  img.alt = "";
  img.decoding = "async";
  img.src = url;
  el.replaceWith(img);
}
function hidratarFotos(root = document) {
  root.querySelectorAll("[data-foto]").forEach(el => (fotoVisivel ? fotoVisivel.observe(el) : trocarPorFoto(el)));
}

/** Dados da loja editados no painel (config/loja) sobrepõem o config.js. */
function applyStoreConfig(loja) {
  const cfg = restaurantConfig;
  if (loja.nome) { cfg.name = loja.nome; cfg.seo.title = `${loja.nome} — ${NICHO.nome}`; }
  if (loja.slogan) cfg.slogan = loja.slogan;
  if (loja.endereco) cfg.address = loja.endereco;
  cfg.instagram = loja.instagram || "";
  if (Array.isArray(loja.horarios) && loja.horarios.length) cfg.hours = loja.horarios;
  cfg.whatsapps = Array.isArray(loja.whatsapps) ? loja.whatsapps : [];
  cfg.whatsapp = cfg.whatsapps[0]?.numero || "";
  cfg.statusManual = loja.statusManual || "auto";
}

/** Aberto agora? Respeita o "abrir/fechar agora" do painel. */
function storeStatus() {
  const manual = restaurantConfig.statusManual;
  if (manual === "fechado") return { open: false, manual: true };
  if (manual === "aberto") return { open: true, manual: true };
  return openStatus(restaurantConfig.hours);
}

function findProduct(id) {
  return catalog.todos?.get(id) || null;
}

/** Menor preço do produto — mostrado como "a partir de". */
function basePrice(p) {
  return p.sizes?.length ? Math.min(...p.sizes.map(s => Number(s.price))) : Number(p.price);
}
const hasChoices = p => Boolean(p.sizes?.length > 1 || p.opcoes?.length || p.meioAMeio);

/* ---------------- Render ---------------- */

function renderIdentity() {
  const cfg = restaurantConfig;
  document.title = cfg.seo.title;
  document.querySelector('meta[name="description"]').setAttribute("content", cfg.seo.description);
  document.querySelectorAll("[data-brand-name]").forEach(el => (el.textContent = cfg.name));
  document.querySelectorAll("[data-slogan]").forEach(el => (el.textContent = cfg.slogan));
  document.querySelectorAll("[data-address]").forEach(el => (el.textContent = cfg.address));
  document.querySelectorAll("[data-niche-name]").forEach(el => (el.textContent = NICHO.nome));

  // Título do topo: texto do nicho com uma palavra destacada em <em>
  const title = document.querySelector("[data-hero-title]");
  if (title) {
    const [antes, meio = "", depois = ""] = NICHO.titulo.split(/<em>|<\/em>/);
    title.innerHTML = `${esc(antes)}<em>${esc(meio)}</em>${esc(depois)}`;
  }
  const tags = document.querySelector("[data-hero-tags]");
  if (tags) {
    const kinds = ["tag--accent", "tag--on-ink", "tag--outline"];
    tags.innerHTML = NICHO.tags.map((t, i) => `<li class="tag ${kinds[i % 3]}">${esc(t)}</li>`).join("");
  }

  const whats = document.querySelector("[data-whats-link]");
  if (whats) { whats.hidden = !cfg.whatsapp; whats.href = cfg.whatsapp ? `https://wa.me/${encodeURIComponent(cfg.whatsapp)}` : "#"; }
  const insta = document.querySelector("[data-instagram-link]");
  if (insta) { insta.hidden = !safeUrl(cfg.instagram); insta.href = safeUrl(cfg.instagram) || "#"; }

  const hoursEl = document.querySelector("[data-hours-list]");
  const todayIdx = new Date().getDay();
  hoursEl.innerHTML = [1, 2, 3, 4, 5, 6, 0]
    .map(day => cfg.hours.find(h => h.day === day))
    .filter(Boolean)
    .map(h => `
      <div class="hours-row${h.day === todayIdx ? " is-today" : ""}">
        <dt>${esc(h.label)}</dt>
        <dd>${h.open ? `${esc(h.open)} – ${esc(h.close)}` : "Fechado"}</dd>
      </div>`)
    .join("");

  const sticker = document.querySelector("[data-open-status]");
  const st = storeStatus();
  sticker.hidden = false;
  sticker.classList.toggle("is-closed", !st.open);
  sticker.textContent = st.manual ? (st.open ? "Aberto agora" : "Fechado agora") : openStatusText(st);
}

function renderCategoryNav() {
  const track = document.querySelector("#category-nav .cat-nav-track");
  track.innerHTML = catalog.categorias
    .filter(c => c.produtos.length)
    .map(c => `<button type="button" class="cat-chip" data-cat-link="${esc(c.slug)}">${esc(c.nome)}</button>`)
    .join("");
}

function renderFeatured() {
  const items = catalog.categorias.flatMap(c => c.produtos.filter(p => p.featured && p.available));
  const section = document.getElementById("destaques");
  if (!items.length) { section.hidden = true; return; }
  section.hidden = false;
  section.querySelector(".featured-track").innerHTML = items
    .map((p, i) => `
      <button type="button" class="feat-card feat-card--${i % 3}" data-product-id="${esc(p.id)}">
        <span class="feat-photo">${photoHTML(p)}</span>
        <span class="feat-name">${esc(p.name)}</span>
        <span class="feat-price">${p.sizes?.length > 1 ? "a partir de " : ""}${money(basePrice(p))}</span>
      </button>`)
    .join("");
}

function renderCategories() {
  const container = document.getElementById("menu-categories");
  if (!catalog.online) {
    container.innerHTML = `<p class="notice">Não conseguimos carregar o cardápio agora. Atualize a página em instantes.</p>`;
    return;
  }
  const withItems = catalog.categorias.filter(c => c.produtos.length);
  if (!withItems.length) {
    container.innerHTML = `<p class="empty-state">O cardápio está sendo preparado. Volte daqui a pouquinho.</p>`;
    return;
  }
  container.innerHTML = withItems
    .map(cat => `
      <section class="category" id="cat-${esc(cat.slug)}">
        <h2 class="section-title"><span>${esc(cat.nome)}</span></h2>
        <div class="product-grid">${cat.produtos.map(productRowHTML).join("")}</div>
      </section>`)
    .join("");
}

function photoHTML(p) {
  const src = safeUrl(p.image);
  if (src) return `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`;
  // Foto salva no painel: mostra a ilustração e troca pela foto quando aparecer na tela
  return `<span class="photo-fallback" aria-hidden="true"${p.foto ? ` data-foto="${esc(p.id)}"` : ""}></span>`;
}

function productRowHTML(p) {
  const price = p.available
    ? `<span class="price">${p.sizes?.length > 1 ? `<small>a partir de</small> ` : ""}${money(basePrice(p))}</span>`
    : `<span class="price price--off">Esgotado</span>`;
  const today = p.dias?.length ? `<span class="badge-today">Hoje</span>` : "";

  return `
    <button type="button" class="product${p.available ? "" : " is-off"}" data-product-id="${esc(p.id)}">
      <span class="product-photo">${photoHTML(p)}</span>
      <span class="product-info">
        <span class="product-name">${esc(p.name)}${today}</span>
        ${p.description ? `<span class="product-desc">${esc(p.description)}</span>` : ""}
        ${price}
      </span>
      ${p.available ? `<span class="product-add" aria-hidden="true">+</span>` : ""}
    </button>`;
}
