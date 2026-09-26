/**
 * menu-render.js
 * -------------------------------------------------------
 * Lê restaurantConfig e menu (definidos em config.js e data/menu.js)
 * e monta o DOM. Nenhum produto é escrito manualmente no HTML —
 * adicionar/remover produto é só editar data/menu.js.
 * -------------------------------------------------------
 */

const money = valor => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function renderIdentity() {
  document.title = restaurantConfig.seo.title;
  document.querySelector('meta[name="description"]').setAttribute("content", restaurantConfig.seo.description);

  document.querySelectorAll("[data-brand-name]").forEach(el => (el.textContent = restaurantConfig.name));
  document.querySelectorAll("[data-brand-mark]").forEach(el => (el.textContent = restaurantConfig.shortMark));
  setText("[data-slogan]", restaurantConfig.slogan);
  setText("[data-description]", restaurantConfig.description);

  const whatsLink = document.querySelector("[data-whats-link]");
  if (whatsLink) whatsLink.href = `https://wa.me/${restaurantConfig.whatsapp}`;

  const instaLink = document.querySelector("[data-instagram-link]");
  if (instaLink) instaLink.href = restaurantConfig.instagram;

  setText("[data-address]", restaurantConfig.address);

  const hoursList = document.querySelector("[data-hours-list]");
  if (hoursList) {
    hoursList.innerHTML = restaurantConfig.hours
      .map(h => `<div class="info-row"><strong>${h.day}:</strong>&nbsp;${h.time}</div>`)
      .join("");
  }

  setText("[data-pix-key]", restaurantConfig.pix.key);
  setText("[data-pix-name]", restaurantConfig.pix.receiverName);
  setText("#pix-key-type", restaurantConfig.pix.keyType);
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach(el => (el.textContent = value));
}

function renderCategoryNav() {
  const nav = document.getElementById("category-nav");
  nav.innerHTML = menu.categorias
    .map((cat, i) => `<button class="cat-btn${i === 0 ? " is-active" : ""}" data-cat-link="${cat.slug}">${cat.nome}</button>`)
    .join("");
}

function renderFeatured() {
  const destaques = menu.categorias.flatMap(cat => cat.produtos.filter(p => p.featured && p.available));
  const section = document.getElementById("destaques");
  if (destaques.length === 0) {
    section.remove();
    return;
  }
  const track = section.querySelector(".carousel-track");
  track.innerHTML = destaques.map(p => productCardHTML(p, true)).join("");
}

function renderCategories() {
  const container = document.getElementById("menu-categories");
  container.innerHTML = menu.categorias
    .map(cat => {
      const produtosHTML =
        cat.produtos.length > 0
          ? `<div class="carousel-track">${cat.produtos.map(p => productCardHTML(p)).join("")}</div>`
          : `<p class="empty-state">Nenhum produto disponível nesta categoria no momento.</p>`;

      return `
      <section class="category-section" id="cat-${cat.slug}">
        <h2>${cat.nome}</h2>
        ${produtosHTML}
      </section>`;
    })
    .join("");
}

function productCardHTML(produto, isFeaturedCard = false) {
  const badge = !produto.available
    ? `<span class="badge indisponivel">Indisponível</span>`
    : produto.featured
    ? `<span class="badge">Destaque</span>`
    : "";

  const thumbContent = produto.image
    ? `<img src="${produto.image}" alt="${produto.name}" loading="lazy">`
    : "";

  const priceOrStatus = produto.available
    ? `<span class="price">${money(produto.price)}</span>`
    : `<span class="price" style="color:var(--text-muted);font-weight:600;">Indisponível</span>`;

  return `
    <button type="button" class="product-card${isFeaturedCard ? "" : ""}${!produto.available ? " is-unavailable" : ""}"
            data-product='${encodeURIComponent(JSON.stringify(produto))}'>
      <div class="thumb">${badge}${thumbContent}</div>
      <div class="info">
        <span class="name">${produto.name}</span>
        ${produto.description ? `<span class="desc">${produto.description}</span>` : ""}
        <div class="price-row">${priceOrStatus}</div>
      </div>
    </button>`;
}
