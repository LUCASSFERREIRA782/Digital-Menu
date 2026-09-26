/**
 * ui.js
 * -------------------------------------------------------
 * Comportamento de interface. O bottom sheet é genérico —
 * tanto o detalhe do produto quanto o resumo do pedido usam
 * o mesmo overlay/container, só trocando o conteúdo interno.
 * Isso evita duplicar a mecânica de abrir/fechar/animar.
 * -------------------------------------------------------
 */

function openSheetGlobal(html) {
  const overlay = document.getElementById("sheet-overlay");
  const sheet = document.getElementById("product-sheet");
  sheet.innerHTML = html;
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeSheetGlobal() {
  const overlay = document.getElementById("sheet-overlay");
  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function setupProductSheet() {
  const overlay = document.getElementById("sheet-overlay");

  document.addEventListener("click", e => {
    const card = e.target.closest(".product-card");
    if (card) {
      const produto = JSON.parse(decodeURIComponent(card.dataset.product));
      openProductDetail(produto);
      return;
    }
    if (e.target.closest("[data-sheet-close]") || e.target === overlay) {
      closeSheetGlobal();
    }
    if (e.target.id === "view-order-btn") {
      openOrderSummary();
    }
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeSheetGlobal();
  });
}

function openProductDetail(produto) {
  const addControls = produto.available
    ? `
      <div class="qty-stepper qty-stepper--sheet">
        <button type="button" id="detail-qty-decrease" aria-label="Diminuir">−</button>
        <span id="detail-qty-value">1</span>
        <button type="button" id="detail-qty-increase" aria-label="Aumentar">+</button>
      </div>
      <button type="button" id="add-to-order-btn" class="send-order-btn">Adicionar ao pedido</button>`
    : "";

  openSheetGlobal(`
    <button type="button" class="sheet-close" data-sheet-close aria-label="Fechar">✕</button>
    <div class="sheet-image">${produto.image ? `<img src="${produto.image}" alt="${produto.name}">` : ""}</div>
    <div class="sheet-body">
      <h3>${produto.name}</h3>
      ${produto.description ? `<p class="sheet-desc">${produto.description}</p>` : ""}
      <span class="sheet-price">${produto.available ? money(produto.price) : "Indisponível no momento"}</span>
      ${addControls}
    </div>`);

  if (!produto.available) return;

  let qty = 1;
  const qtyValue = document.getElementById("detail-qty-value");
  document.getElementById("detail-qty-increase").addEventListener("click", () => {
    qty += 1;
    qtyValue.textContent = qty;
  });
  document.getElementById("detail-qty-decrease").addEventListener("click", () => {
    if (qty <= 1) return;
    qty -= 1;
    qtyValue.textContent = qty;
  });
  document.getElementById("add-to-order-btn").addEventListener("click", () => {
    addToCart(produto, qty);
    closeSheetGlobal();
  });
}

function openOrderSummary() {
  openSheetGlobal(`<div id="order-sheet-body"></div><button type="button" class="sheet-close" data-sheet-close aria-label="Fechar" style="position:absolute;top:14px;right:14px;">✕</button>`);
  renderOrderSheetContent();
}

/**
 * Marca a categoria ativa na navegação conforme o usuário rola a
 * página, e faz o clique na categoria levar até a seção certa.
 */
function setupCategoryNav() {
  const nav = document.getElementById("category-nav");
  const sections = [...document.querySelectorAll(".category-section")];

  nav.addEventListener("click", e => {
    const btn = e.target.closest("[data-cat-link]");
    if (!btn) return;
    const target = document.getElementById(`cat-${btn.dataset.catLink}`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  if (!("IntersectionObserver" in window) || sections.length === 0) return;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const slug = entry.target.id.replace("cat-", "");
        nav.querySelectorAll(".cat-btn").forEach(b => b.classList.toggle("is-active", b.dataset.catLink === slug));
        const activeBtn = nav.querySelector(`.cat-btn[data-cat-link="${slug}"]`);
        if (activeBtn) activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );

  sections.forEach(s => observer.observe(s));
}

/**
 * Revela os cards de produto suavemente conforme entram na tela.
 * rootMargin generoso evita "buraco" na tela quando o usuário
 * pula direto pra uma categoria distante via navegação.
 */
function setupScrollReveal() {
  const cards = document.querySelectorAll(".product-card");
  if (!("IntersectionObserver" in window) || cards.length === 0) {
    cards.forEach(c => c.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px 120px 0px" }
  );
  cards.forEach(c => observer.observe(c));
}

function setupPixCopy() {
  const btn = document.getElementById("pix-copy-btn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const chave = restaurantConfig.pix.key;
    const textoOriginal = btn.textContent;

    try {
      await navigator.clipboard.writeText(chave);
      mostrarCopiado();
    } catch {
      const temp = document.createElement("textarea");
      temp.value = chave;
      temp.style.position = "fixed";
      temp.style.opacity = "0";
      document.body.appendChild(temp);
      temp.select();
      try {
        document.execCommand("copy");
        mostrarCopiado();
      } catch {
        btn.textContent = "Toque e segure pra copiar";
      }
      document.body.removeChild(temp);
    }

    function mostrarCopiado() {
      btn.textContent = "Chave Pix copiada!";
      btn.classList.add("is-copied");
      setTimeout(() => {
        btn.textContent = textoOriginal;
        btn.classList.remove("is-copied");
      }, 2000);
    }
  });
}
