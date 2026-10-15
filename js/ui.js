/**
 * ui.js
 * -------------------------------------------------------
 * Sheet genérico (produto, comanda e confirmação usam o
 * mesmo container), montagem do item e navegação.
 *
 * Montagem do item, conforme o produto:
 *   tamanhos · meio a meio (pizza) · opções do nicho
 *   (ponto da carne, leite, sabores…) · adicionais · obs.
 * O valor mostrado vem de precos.js — a mesma regra que o
 * servidor usa para cobrar.
 * -------------------------------------------------------
 */

let lastFocus = null;

function openSheet(html, label = "Detalhes") {
  const overlay = document.getElementById("sheet-overlay");
  const sheet = document.getElementById("sheet");
  lastFocus = document.activeElement;
  sheet.innerHTML = `<button type="button" class="sheet-close" data-sheet-close aria-label="Fechar">✕</button>${html}`;
  sheet.setAttribute("aria-label", label);
  sheet.scrollTop = 0;
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
  sheet.focus({ preventScroll: true });
}

function closeSheet() {
  const overlay = document.getElementById("sheet-overlay");
  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
  if (typeof onSheetClosed === "function") onSheetClosed();
  lastFocus?.focus?.({ preventScroll: true });
}

function setupGlobalEvents() {
  const overlay = document.getElementById("sheet-overlay");

  document.addEventListener("click", e => {
    const productBtn = e.target.closest("[data-product-id]");
    if (productBtn) {
      const p = findProduct(productBtn.dataset.productId);
      if (p) openProductBuilder(p);
      return;
    }
    if (e.target.closest("[data-open-order]")) { openOrderSheet(); return; }
    if (e.target.closest("[data-sheet-close]") || e.target === overlay) closeSheet();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) closeSheet();
  });
}

/* ---------------- Montagem do item ---------------- */

function openProductBuilder(p) {
  const sizes = p.sizes?.length ? p.sizes : null;
  const addons = p.addons ? catalog.adicionais : [];
  const groups = [...new Set(addons.map(a => a.group || "Adicionais"))];
  const opcoes = Array.isArray(p.opcoes) ? p.opcoes : [];
  const halves = p.meioAMeio
    ? [...catalog.todos.values()].filter(x => x.id !== p.id && x.meioAMeio && x.available && x.categoriaSlug === p.categoriaSlug)
    : [];
  let src = safeUrl(p.image) || (typeof fotoCache !== "undefined" && typeof fotoCache.get(p.id) === "string" ? fotoCache.get(p.id) : "");

  const sizesHTML = sizes && sizes.length > 1
    ? `<fieldset class="field-group">
         <legend>Tamanho <span class="req">obrigatório</span></legend>
         <div class="size-options">
           ${sizes.map((s, i) => `
             <label class="size-option">
               <input type="radio" name="size" value="${i}" ${i === 0 ? "checked" : ""}>
               <span class="size-cup size-cup--${Math.min(i, 2)}" aria-hidden="true"></span>
               <span class="size-label">${esc(s.label)}</span>
               <span class="size-price">${money(s.price)}</span>
             </label>`).join("")}
         </div>
       </fieldset>`
    : "";

  const halfHTML = halves.length
    ? `<label class="field-group half-select">
         <span class="legend">Meio a meio? <span class="opt-hint">cobra o valor do sabor mais caro</span></span>
         <select class="field" name="metade">
           <option value="">Não, inteira de ${esc(p.name)}</option>
           ${halves.map(h => `<option value="${esc(h.id)}">½ ${esc(p.name)} + ½ ${esc(h.name)}</option>`).join("")}
         </select>
         <span class="half-preview" data-half-preview hidden><span class="half-disc" aria-hidden="true"></span><span data-half-text></span></span>
       </label>`
    : "";

  const opcoesHTML = opcoes.map((g, gi) => {
    const max = Math.max(1, Number(g.max) || 1), min = Number(g.min) || 0;
    const single = max === 1;
    const rule = min >= 1
      ? `<span class="req">${single ? "obrigatório" : min === max ? `escolha ${min}` : `de ${min} a ${max}`}</span>`
      : `<span class="opt-hint">${single ? "opcional" : `até ${max}`}</span>`;
    return `
      <fieldset class="field-group" data-group="${gi}" data-max="${max}">
        <legend>${esc(g.titulo)} ${rule}</legend>
        <div class="addon-list">
          ${g.itens.map((it, ii) => `
            <label class="addon">
              <input type="${single && min >= 1 ? "radio" : "checkbox"}" name="opt-${gi}" value="${ii}" ${single && min >= 1 && ii === 0 ? "checked" : ""}>
              <span class="addon-box" aria-hidden="true"></span>
              <span class="addon-name">${esc(it.nome)}</span>
              <span class="addon-price">${Number(it.preco) > 0 ? `+ ${money(it.preco)}` : ""}</span>
            </label>`).join("")}
        </div>
      </fieldset>`;
  }).join("");

  const addonsHTML = addons.length
    ? groups.map(g => `
        <fieldset class="field-group">
          <legend>${esc(g)} <span class="opt-hint">opcional</span></legend>
          <div class="addon-list">
            ${addons.map((a, i) => (a.group || "Adicionais") !== g ? "" : `
              <label class="addon">
                <input type="checkbox" name="addon" value="${i}">
                <span class="addon-box" aria-hidden="true"></span>
                <span class="addon-name">${esc(a.name)}</span>
                <span class="addon-price">${Number(a.price) > 0 ? `+ ${money(a.price)}` : "grátis"}</span>
              </label>`).join("")}
          </div>
        </fieldset>`).join("")
    : "";

  const builder = p.available
    ? `<form class="builder" id="builder" novalidate>
         ${sizesHTML}
         ${halfHTML}
         ${opcoesHTML}
         ${addonsHTML}
         <label class="field-group">
           <span class="legend">Alguma observação?</span>
           <textarea class="field" name="obs" rows="2" maxlength="120" placeholder="Ex.: sem cebola, molho à parte"></textarea>
         </label>
         <p class="form-error" data-builder-error role="alert"></p>
         <div class="builder-footer">
           <div class="stepper" role="group" aria-label="Quantidade">
             <button type="button" data-step="-1" aria-label="Diminuir">−</button>
             <output name="qty">1</output>
             <button type="button" data-step="1" aria-label="Aumentar">+</button>
           </div>
           <button type="submit" class="btn btn--accent btn--grow">
             Adicionar <span data-builder-total>${money(basePrice(p))}</span>
           </button>
         </div>
       </form>`
    : `<p class="notice notice--off">Esgotado por hoje. Que tal outra opção?</p>`;

  openSheet(`
    <div class="sheet-hero${src ? "" : " sheet-hero--empty"}">
      ${src
        ? `<button type="button" class="sheet-hero-zoom" data-zoom-photo aria-label="Ampliar a foto de ${esc(p.name)}">
             <img src="${esc(src)}" alt="${esc(p.name)}">
             <span class="zoom-badge" aria-hidden="true">⤢ Ver foto</span>
           </button>`
        : `<span class="photo-fallback photo-fallback--big" aria-hidden="true"></span>`}
    </div>
    <div class="sheet-body">
      <h3 class="sheet-title">${esc(p.name)}</h3>
      ${p.description ? `<p class="sheet-desc">${esc(p.description)}</p>` : ""}
      ${builder}
    </div>`, p.name);

  document.querySelector("[data-zoom-photo]")?.addEventListener("click", () => openPhotoViewer(src, p.name));
  // Foto ainda não carregada: busca e coloca no topo do detalhe quando chegar
  if (!src && p.foto) carregarFoto(p.id).then(url => {
    const hero = document.querySelector(".sheet-hero--empty");
    if (!url || !hero) return;
    src = url;
    hero.classList.remove("sheet-hero--empty");
    hero.innerHTML = `<button type="button" class="sheet-hero-zoom" data-zoom-photo aria-label="Ampliar a foto de ${esc(p.name)}"><img src="${esc(url)}" alt="${esc(p.name)}"><span class="zoom-badge" aria-hidden="true">⤢ Ver foto</span></button>`;
    hero.querySelector("[data-zoom-photo]").addEventListener("click", () => openPhotoViewer(url, p.name));
  });
  if (!p.available) return;

  const form = document.getElementById("builder");
  const errorEl = form.querySelector("[data-builder-error]");
  let qty = 1;

  const read = () => {
    const sizeIdx = sizes ? Number(form.querySelector('input[name="size"]:checked')?.value ?? 0) : -1;
    return {
      tamanho: sizes ? sizes[sizeIdx].label : "",
      metade: form.metade?.value || "",
      opcoes: opcoes.map((g, gi) => [...form.querySelectorAll(`input[name="opt-${gi}"]:checked`)].map(c => g.itens[Number(c.value)].nome)),
      adicionais: [...form.querySelectorAll('input[name="addon"]:checked')].map(c => addons[Number(c.value)].name),
    };
  };
  const compute = () => {
    const escolha = read();
    try {
      return { escolha, calc: calcularItem(p, escolha, { produtos: catalog.todos, adicionais: catalog.adicionais }) };
    } catch (err) {
      return { escolha, error: err.message };
    }
  };
  const refresh = () => {
    const { calc, escolha } = compute();
    form.querySelector("[data-builder-total]").textContent = calc ? money(calc.unit * qty) : "—";
    form.querySelector('output[name="qty"]').textContent = qty;
    const preview = form.querySelector("[data-half-preview]");
    if (preview) {
      preview.hidden = !escolha.metade;
      if (escolha.metade) preview.querySelector("[data-half-text]").textContent = calc ? calc.nome : "";
    }
    errorEl.textContent = "";
  };

  // Grupos de várias escolhas: não deixa passar do máximo
  form.addEventListener("change", e => {
    const box = e.target.closest("[data-group]");
    if (box && e.target.type === "checkbox") {
      const max = Number(box.dataset.max);
      if (box.querySelectorAll("input:checked").length > max) {
        e.target.checked = false;
        showToast(`Escolha no máximo ${max}`);
      }
    }
    refresh();
  });
  form.querySelectorAll("[data-step]").forEach(b =>
    b.addEventListener("click", () => { qty = Math.max(1, Math.min(20, qty + Number(b.dataset.step))); refresh(); })
  );
  form.addEventListener("submit", e => {
    e.preventDefault();
    const { escolha, calc, error } = compute();
    if (!calc) { errorEl.textContent = error; return; }
    const added = addToCart({
      productId: p.id,
      name: calc.nome,
      size: calc.tamanho,
      metade: escolha.metade,
      opcoes: escolha.opcoes,
      opcoesTexto: calc.opcoes,
      addons: escolha.adicionais.map(n => ({ name: n, price: Number(catalog.adicionais.find(a => a.name === n)?.price || 0) })),
      obs: form.obs.value.trim().slice(0, 120),
      qty,
      unit: calc.unit,
    });
    if (!added) { showToast("Máximo de 10 itens diferentes por comanda"); return; }
    closeSheet();
    showToast(`${calc.nome} foi para a comanda`);
  });
  refresh();
}

/* ---------------- Navegação ---------------- */

/* Pode ser chamada a cada redesenho do cardápio: o clique é ligado uma vez
 * só e o observador é refeito para as seções novas. */
let categoryObserver = null;
let jumpingUntil = 0; // durante o "pulo" do clique, o destaque não muda

function setCategoryActive(slug) {
  const nav = document.getElementById("category-nav");
  const track = nav.querySelector(".cat-nav-track");
  nav.querySelectorAll(".cat-chip").forEach(b => {
    const active = b.dataset.catLink === slug;
    b.classList.toggle("is-active", active);
    // Desliza SÓ a barra de categorias (na horizontal). Não usar
    // scrollIntoView aqui: ele também mexe na rolagem da página.
    if (active) {
      const left = b.offsetLeft - (track.clientWidth - b.offsetWidth) / 2;
      track.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    }
  });
}

function setupCategoryNav() {
  const nav = document.getElementById("category-nav");
  if (!nav.dataset.ready) {
    nav.dataset.ready = "1";
    nav.addEventListener("click", e => {
      const btn = e.target.closest("[data-cat-link]");
      if (!btn) return;
      const section = document.getElementById(`cat-${btn.dataset.catLink}`);
      if (!section) return;
      // Altura fixa no topo DEPOIS da rolagem (topo + barra de categorias)
      const offset = (parseFloat(getComputedStyle(nav).top) || 0) + nav.offsetHeight + 8;
      const top = section.getBoundingClientRect().top + window.scrollY - offset;
      jumpingUntil = Date.now() + 900;
      setCategoryActive(btn.dataset.catLink);
      window.scrollTo({ top, behavior: "smooth" });
    });
  }
  const sections = [...document.querySelectorAll(".category")];
  categoryObserver?.disconnect();
  if (!("IntersectionObserver" in window) || !sections.length) return;
  categoryObserver = new IntersectionObserver(entries => {
    if (Date.now() < jumpingUntil) return;
    entries.forEach(entry => { if (entry.isIntersecting) setCategoryActive(entry.target.id.replace("cat-", "")); });
  }, { rootMargin: "-40% 0px -55% 0px" });
  sections.forEach(sec => categoryObserver.observe(sec));
}

function setupReveal() {
  const els = document.querySelectorAll(".product, .feat-card");
  if (!("IntersectionObserver" in window)) { els.forEach(el => el.classList.add("is-in")); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    });
  }, { rootMargin: "0px 0px 80px 0px" });
  els.forEach(el => io.observe(el));
}

/* ---------------- Foto em tela cheia (com zoom) ----------------
 * Toque/clique na foto do produto abre em tela cheia.
 * Celular: pinça para aproximar, arrasta para mover, toque duplo alterna o zoom.
 * Computador: clique alterna o zoom (no ponto clicado), arrastar move, roda do mouse aproxima.
 * Fecha no ✕, no Esc ou tocando fora da foto.
 */
function openPhotoViewer(src, name) {
  const safe = safeUrl(src);
  if (!safe) return;
  const back = document.activeElement;
  const viewer = document.createElement("div");
  viewer.className = "photo-viewer";
  viewer.setAttribute("role", "dialog");
  viewer.setAttribute("aria-modal", "true");
  viewer.setAttribute("aria-label", `Foto: ${name}`);
  viewer.innerHTML = `
    <img class="photo-viewer-img" src="${esc(safe)}" alt="${esc(name)}" draggable="false">
    <button type="button" class="photo-viewer-close" aria-label="Fechar foto">✕</button>
    <p class="photo-viewer-hint">${matchMedia("(hover: hover)").matches ? "Clique para aproximar · arraste para mover" : "Pince para aproximar · toque duplo"}</p>`;
  document.body.appendChild(viewer);
  const img = viewer.querySelector("img");
  const closeBtn = viewer.querySelector(".photo-viewer-close");

  let scale = 1, x = 0, y = 0;
  const pointers = new Map();
  let pinchStart = null, panStart = null, moved = false, lastTap = 0;

  const clampPan = () => {
    const r = img.getBoundingClientRect();
    const w = (r.width / scale) * (scale - 1) / 2, h = (r.height / scale) * (scale - 1) / 2;
    x = Math.max(-w, Math.min(w, x)); y = Math.max(-h, Math.min(h, y));
  };
  const apply = (animate = false) => {
    if (scale <= 1.01) { scale = 1; x = 0; y = 0; }
    clampPan();
    img.style.transition = animate ? "transform .22s ease" : "none";
    img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    viewer.classList.toggle("is-zoomed", scale > 1);
  };
  const zoomAt = (clientX, clientY, target) => {
    const r = img.getBoundingClientRect();
    const cx = clientX - (r.left + r.width / 2), cy = clientY - (r.top + r.height / 2);
    const k = target / scale;
    x = (x - cx) * k + cx; y = (y - cy) * k + cy;
    scale = target;
    apply(true);
  };

  img.addEventListener("pointerdown", e => {
    try { img.setPointerCapture(e.pointerId); } catch { /* alguns navegadores recusam: segue sem captura */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y), scale };
    } else {
      panStart = { px: e.clientX, py: e.clientY, x, y };
    }
  });
  img.addEventListener("pointermove", e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinchStart) {
      const [a, b] = [...pointers.values()];
      scale = Math.max(1, Math.min(4, pinchStart.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinchStart.d));
      moved = true;
      apply();
    } else if (panStart && scale > 1) {
      const dx = e.clientX - panStart.px, dy = e.clientY - panStart.py;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      x = panStart.x + dx; y = panStart.y + dy;
      apply();
    }
  });
  const end = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 1) { const [p] = pointers.values(); panStart = { px: p.x, py: p.y, x, y }; }
    if (pointers.size === 0) panStart = null;
  };
  img.addEventListener("pointerup", e => {
    end(e);
    if (moved) return;
    const now = Date.now();
    const isTouch = e.pointerType !== "mouse";
    if (!isTouch || now - lastTap < 300) zoomAt(e.clientX, e.clientY, scale > 1 ? 1 : 2.5);
    lastTap = now;
  });
  img.addEventListener("pointercancel", end);
  img.addEventListener("wheel", e => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, Math.max(1, Math.min(4, scale * (e.deltaY < 0 ? 1.2 : 1 / 1.2))));
  }, { passive: false });

  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    viewer.remove();
    back?.focus?.({ preventScroll: true });
  };
  const onKey = e => {
    if (e.key === "Escape") { e.stopPropagation(); close(); }
    if (e.key === "Tab") { e.preventDefault(); closeBtn.focus(); } // foco fica dentro da foto
  };
  document.addEventListener("keydown", onKey, true);
  closeBtn.addEventListener("click", close);
  viewer.addEventListener("click", e => { if (e.target === viewer) close(); });
  requestAnimationFrame(() => viewer.classList.add("is-open"));
  closeBtn.focus();
}
