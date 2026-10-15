/**
 * cart.js
 * -------------------------------------------------------
 * Comanda em memória. Nada do cliente é gravado no navegador
 * (sem localStorage/cookies) — fechou a aba, sumiu.
 * -------------------------------------------------------
 */

const cart = { items: [] };
// item: { key, productId, name, size, metade, opcoes: [[nomes]], opcoesTexto: [], addons: [{name, price}], obs, qty, unit }

const MAX_CART_LINES = 10; // mesmo limite do servidor

function addToCart(item) {
  // Mesmas escolhas = soma a quantidade
  const key = JSON.stringify([item.productId, item.size, item.metade, item.opcoes, item.addons.map(a => a.name).sort(), item.obs]);
  const existing = cart.items.find(i => i.key === key);
  if (existing) existing.qty = Math.min(20, existing.qty + item.qty);
  else if (cart.items.length >= MAX_CART_LINES) return false;
  else cart.items.push({ ...item, key });
  renderOrderBar();
  return true;
}

function changeQty(index, delta) {
  const item = cart.items[index];
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart.items.splice(index, 1);
  renderOrderBar();
}

function clearCart() {
  cart.items = [];
  renderOrderBar();
}

const cartSubtotal = () => cart.items.reduce((s, i) => s + i.unit * i.qty, 0);
const cartCount = () => cart.items.reduce((s, i) => s + i.qty, 0);

function renderOrderBar() {
  const bar = document.getElementById("order-bar");
  const tracking = typeof activeOrder !== "undefined" && activeOrder &&
    !["concluido", "cancelado"].includes(activeOrder.status);
  const visible = cart.items.length > 0 || tracking;
  bar.classList.toggle("is-visible", visible);
  document.body.classList.toggle("has-order-bar", visible);
  if (!visible) { bar.innerHTML = ""; return; }

  if (!cart.items.length) {
    bar.innerHTML = `
      <button type="button" class="order-bar-btn order-bar-btn--track" data-open-order>
        <span class="order-bar-pulse" aria-hidden="true"></span>
        <span class="order-bar-label">Acompanhar pedido #${esc(activeOrder.code)}</span>
      </button>`;
    return;
  }

  bar.innerHTML = `
    <button type="button" class="order-bar-btn" data-open-order>
      <span class="order-bar-count">${cartCount()}</span>
      <span class="order-bar-label">Ver comanda</span>
      <span class="order-bar-total">${money(cartSubtotal())}</span>
    </button>`;
}

function itemDetailsText(item) {
  return [item.size, ...(item.opcoesTexto || []), item.addons.map(a => a.name).join(", "), item.obs && `obs: ${item.obs}`]
    .filter(Boolean)
    .join(" · ");
}
