/**
 * cart.js
 * -------------------------------------------------------
 * Carrinho simples, 100% em memória (sem backend, sem
 * persistência) — o "envio do pedido" é só um link de
 * WhatsApp pré-preenchido pro número do restaurante. Isso
 * mantém a filosofia "sem overengineering": nenhum servidor,
 * nenhum banco de dados, nenhum gateway de pagamento — quem
 * confirma e processa o pedido continua sendo a equipe do
 * restaurante, manualmente, como já era combinado pro Pix.
 * -------------------------------------------------------
 */

const cart = { items: [] }; // { name, price, quantity }

function addToCart(produto, quantity) {
  const existing = cart.items.find(i => i.name === produto.name);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({ name: produto.name, price: produto.price, quantity });
  }
  renderOrderBar();
}

function updateCartQuantity(index, delta) {
  const item = cart.items[index];
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) cart.items.splice(index, 1);
  renderOrderBar();
  renderOrderSheetContent(); // mantém o sheet em sincronia se estiver aberto
}

function cartTotal() {
  return cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

function cartCount() {
  return cart.items.reduce((sum, i) => sum + i.quantity, 0);
}

/**
 * Barra fixa no rodapé que aparece assim que há 1+ item no carrinho.
 */
function renderOrderBar() {
  const bar = document.getElementById("order-bar");
  if (cart.items.length === 0) {
    bar.classList.remove("is-visible");
    document.body.classList.remove("has-order-bar");
    return;
  }
  bar.classList.add("is-visible");
  document.body.classList.add("has-order-bar");
  bar.innerHTML = `
    <span class="order-bar-info">${cartCount()} ${cartCount() === 1 ? "item" : "itens"} · ${money(cartTotal())}</span>
    <button type="button" id="view-order-btn">Ver pedido</button>`;
}

/**
 * Monta o conteúdo do sheet de resumo do pedido — identificação,
 * lista de itens com controle de quantidade, forma de pagamento.
 */
function renderOrderSheetContent() {
  const container = document.getElementById("order-sheet-body");
  if (!container) return; // sheet não está aberto no momento

  if (cart.items.length === 0) {
    closeSheetGlobal();
    return;
  }

  const itemsHTML = cart.items
    .map(
      (item, i) => `
      <div class="order-item-row">
        <div class="order-item-name">${item.name}</div>
        <div class="qty-stepper">
          <button type="button" data-qty-decrease="${i}" aria-label="Diminuir">−</button>
          <span>${item.quantity}</span>
          <button type="button" data-qty-increase="${i}" aria-label="Aumentar">+</button>
        </div>
        <div class="order-item-subtotal">${money(item.price * item.quantity)}</div>
      </div>`
    )
    .join("");

  container.innerHTML = `
    <h3>Seu pedido</h3>
    <div class="order-items-list">${itemsHTML}</div>
    <div class="order-total-row"><strong>Total</strong><strong>${money(cartTotal())}</strong></div>

    <div class="field-label">Vai consumir onde?</div>
    <div class="choice-group">
      ${["local", "viagem"]
        .map(
          v => `
        <label class="choice-option${orderIdentity.consumo === v ? " is-selected" : ""}">
          <input type="radio" name="consumo" value="${v}" ${orderIdentity.consumo === v ? "checked" : ""}>
          ${v === "local" ? "Comer no local" : "Para viagem"}
        </label>`
        )
        .join("")}
    </div>

    <label class="field-label" for="order-name">Nome</label>
    <input class="field" id="order-name" type="text" placeholder="Seu nome" value="${orderIdentity.name}">

    <div id="mesa-field-wrapper" style="${orderIdentity.consumo === "viagem" ? "display:none;" : ""}">
      <label class="field-label" for="order-table">Ou número da mesa</label>
      <input class="field" id="order-table" type="text" placeholder="Ex: Mesa 5" value="${orderIdentity.table}">
    </div>

    <div class="field-label">Forma de pagamento</div>
    <div class="choice-group">
      ${["pix", "cartao", "dinheiro"]
        .map(
          v => `
        <label class="choice-option${orderIdentity.payment === v ? " is-selected" : ""}">
          <input type="radio" name="payment" value="${v}" ${orderIdentity.payment === v ? "checked" : ""}>
          ${v === "pix" ? "Pix" : v === "cartao" ? "Cartão" : "Dinheiro"}
        </label>`
        )
        .join("")}
    </div>

    <div id="payment-note" class="payment-note"></div>

    <button type="button" id="send-order-btn" class="send-order-btn">Enviar pedido no WhatsApp</button>`;

  renderPaymentNote();
  attachOrderSheetEvents();
}

const orderIdentity = { name: "", table: "", payment: "pix", consumo: "local" };

function renderPaymentNote() {
  const note = document.getElementById("payment-note");
  if (!note) return;
  note.innerHTML =
    orderIdentity.payment === "pix"
      ? `Pague com a chave Pix <strong>${restaurantConfig.pix.key}</strong> (${restaurantConfig.pix.keyType}) — nome do recebedor: ${restaurantConfig.pix.receiverName}.`
      : `Por gentileza, dirija-se até o balcão de atendimento para efetuar o pagamento.`;
}

function attachOrderSheetEvents() {
  const container = document.getElementById("order-sheet-body");

  container.querySelectorAll("[data-qty-increase]").forEach(btn =>
    btn.addEventListener("click", () => updateCartQuantity(Number(btn.dataset.qtyIncrease), 1))
  );
  container.querySelectorAll("[data-qty-decrease]").forEach(btn =>
    btn.addEventListener("click", () => updateCartQuantity(Number(btn.dataset.qtyDecrease), -1))
  );

  container.querySelectorAll('input[name="consumo"]').forEach(radio =>
    radio.addEventListener("change", e => {
      orderIdentity.consumo = e.target.value;
      container.querySelectorAll('input[name="consumo"]').forEach(r => r.closest(".choice-option").classList.remove("is-selected"));
      e.target.closest(".choice-option").classList.add("is-selected");
      document.getElementById("mesa-field-wrapper").style.display = orderIdentity.consumo === "viagem" ? "none" : "block";
    })
  );

  container.querySelectorAll('input[name="payment"]').forEach(radio =>
    radio.addEventListener("change", e => {
      orderIdentity.payment = e.target.value;
      container.querySelectorAll('input[name="payment"]').forEach(r => r.closest(".choice-option").classList.remove("is-selected"));
      e.target.closest(".choice-option").classList.add("is-selected");
      renderPaymentNote();
    })
  );

  document.getElementById("order-name").addEventListener("input", e => (orderIdentity.name = e.target.value));
  document.getElementById("order-table").addEventListener("input", e => (orderIdentity.table = e.target.value));

  document.getElementById("send-order-btn").addEventListener("click", sendOrderToWhatsApp);
}

function sendOrderToWhatsApp() {
  const precisaNome = orderIdentity.consumo === "viagem";
  if (precisaNome && !orderIdentity.name.trim()) {
    alert("Preencha seu nome antes de enviar — é como a equipe vai identificar seu pedido para viagem.");
    return;
  }
  if (!precisaNome && !orderIdentity.name.trim() && !orderIdentity.table.trim()) {
    alert("Preencha seu nome ou o número da mesa antes de enviar — isso ajuda a equipe a identificar o pedido.");
    return;
  }

  const linhas = [];
  linhas.push(`🧾 Novo pedido — ${restaurantConfig.name}`);
  linhas.push("");
  linhas.push(`Consumo: ${orderIdentity.consumo === "local" ? "Comer no local" : "Para viagem"}`);
  if (orderIdentity.name.trim()) linhas.push(`Cliente: ${orderIdentity.name.trim()}`);
  if (orderIdentity.consumo === "local" && orderIdentity.table.trim()) linhas.push(`Mesa: ${orderIdentity.table.trim()}`);
  linhas.push("");
  linhas.push("Itens:");
  cart.items.forEach(item => {
    linhas.push(`${item.quantity}x ${item.name} — ${money(item.price * item.quantity)}`);
  });
  linhas.push("");
  linhas.push(`Total: ${money(cartTotal())}`);
  linhas.push("");
  linhas.push(
    orderIdentity.payment === "pix"
      ? `Pagamento: Pix (chave ${restaurantConfig.pix.key})`
      : `Pagamento: ${orderIdentity.payment === "cartao" ? "Cartão" : "Dinheiro"} — cliente irá até o balcão`
  );

  const url = `https://wa.me/${restaurantConfig.whatsapp}?text=${encodeURIComponent(linhas.join("\n"))}`;
  window.open(url, "_blank");

  cart.items = [];
  renderOrderBar();
  closeSheetGlobal();
}
