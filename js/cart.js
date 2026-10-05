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

    <div class="field-label">Como vai ser?</div>
    <div class="choice-group choice-group--3">
      ${[
        ["local", "🍽️", "Comer no local"],
        ["retirada", "🛍️", "Retirar no balcão"],
        ["entrega", "🛵", "Receber em casa"],
      ]
        .map(
          ([v, icone, label]) => `
        <label class="choice-option${orderIdentity.consumo === v ? " is-selected" : ""}">
          <input type="radio" name="consumo" value="${v}" ${orderIdentity.consumo === v ? "checked" : ""}>
          <span class="choice-icon">${icone}</span>${label}
        </label>`
        )
        .join("")}
    </div>

    <label class="field-label" for="order-name">Nome</label>
    <input class="field" id="order-name" type="text" placeholder="Seu nome" value="${orderIdentity.name}">

    <div id="mesa-field-wrapper" style="${orderIdentity.consumo === "local" ? "" : "display:none;"}">
      <label class="field-label" for="order-table">Ou número da mesa</label>
      <input class="field" id="order-table" type="text" placeholder="Ex: Mesa 5" value="${orderIdentity.table}">
    </div>

    <div id="address-fields-wrapper" style="${orderIdentity.consumo === "entrega" ? "" : "display:none;"}">
      <label class="field-label" for="addr-cep">CEP</label>
      <input class="field" id="addr-cep" type="text" placeholder="00000-000" value="${orderIdentity.address.cep}">

      <label class="field-label" for="addr-rua">Rua</label>
      <input class="field" id="addr-rua" type="text" placeholder="Nome da rua" value="${orderIdentity.address.rua}">

      <label class="field-label" for="addr-numero">Número</label>
      <input class="field" id="addr-numero" type="text" placeholder="Nº da casa/apto" value="${orderIdentity.address.numero}">

      <label class="field-label" for="addr-complemento">Complemento (opcional)</label>
      <input class="field" id="addr-complemento" type="text" placeholder="Bloco, apto, etc." value="${orderIdentity.address.complemento}">

      <label class="field-label" for="addr-referencia">Ponto de referência (opcional)</label>
      <input class="field" id="addr-referencia" type="text" placeholder="Próximo a..." value="${orderIdentity.address.referencia}">
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

const orderIdentity = {
  name: "",
  table: "",
  payment: "pix",
  consumo: "local",
  address: { cep: "", rua: "", numero: "", complemento: "", referencia: "" },
};

function renderPaymentNote() {
  const note = document.getElementById("payment-note");
  if (!note) return;

  if (orderIdentity.payment === "pix") {
    note.innerHTML = `
      <p>Pix para <strong>${restaurantConfig.pix.receiverName}</strong> — copie a chave e cole no seu app do banco.</p>
      <button type="button" id="order-pix-copy-btn" class="pix-copy-btn">Copiar chave Pix</button>`;
    attachPixCopyHandler();
  } else {
    note.innerHTML = `Por gentileza, dirija-se até o balcão de atendimento para efetuar o pagamento.`;
  }
}

function attachPixCopyHandler() {
  const btn = document.getElementById("order-pix-copy-btn");
  if (!btn) return;
  const textoOriginal = btn.textContent;

  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(restaurantConfig.pix.key);
      mostrarCopiado();
    } catch {
      const temp = document.createElement("textarea");
      temp.value = restaurantConfig.pix.key;
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
  });

  function mostrarCopiado() {
    btn.textContent = "Chave Pix copiada!";
    btn.classList.add("is-copied");
    setTimeout(() => {
      btn.textContent = textoOriginal;
      btn.classList.remove("is-copied");
    }, 2000);
  }
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
      document.getElementById("mesa-field-wrapper").style.display = orderIdentity.consumo === "local" ? "block" : "none";
      document.getElementById("address-fields-wrapper").style.display = orderIdentity.consumo === "entrega" ? "block" : "none";
    })
  );

  ["cep", "rua", "numero", "complemento", "referencia"].forEach(campo => {
    const el = document.getElementById(`addr-${campo}`);
    if (el) el.addEventListener("input", e => (orderIdentity.address[campo] = e.target.value));
  });

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
  const { consumo } = orderIdentity;

  if ((consumo === "retirada" || consumo === "entrega") && !orderIdentity.name.trim()) {
    alert(
      consumo === "retirada"
        ? "Preencha seu nome antes de enviar — é o nome que vai ser chamado no balcão."
        : "Preencha seu nome antes de enviar — é como a equipe vai identificar seu pedido."
    );
    return;
  }
  if (consumo === "local" && !orderIdentity.name.trim() && !orderIdentity.table.trim()) {
    alert("Preencha seu nome ou o número da mesa antes de enviar — isso ajuda a equipe a identificar o pedido.");
    return;
  }
  if (consumo === "entrega") {
    const a = orderIdentity.address;
    if (!a.cep.trim() || !a.rua.trim() || !a.numero.trim()) {
      alert("Preencha CEP, rua e número antes de enviar — a equipe precisa do endereço pra entrega.");
      return;
    }
  }

  const rotuloConsumo = { local: "Comer no local", retirada: "Retirar no balcão", entrega: "Entrega" }[consumo];

  const linhas = [];
  linhas.push(`🧾 Novo pedido — ${restaurantConfig.name}`);
  linhas.push("");
  linhas.push(`Consumo: ${rotuloConsumo}`);
  if (orderIdentity.name.trim()) linhas.push(`Cliente: ${orderIdentity.name.trim()}`);
  if (consumo === "local" && orderIdentity.table.trim()) linhas.push(`Mesa: ${orderIdentity.table.trim()}`);

  if (consumo === "entrega") {
    const a = orderIdentity.address;
    linhas.push(`Endereço: ${a.rua.trim()}, ${a.numero.trim()}${a.complemento.trim() ? " - " + a.complemento.trim() : ""}`);
    linhas.push(`CEP: ${a.cep.trim()}`);
    if (a.referencia.trim()) linhas.push(`Referência: ${a.referencia.trim()}`);
  }

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
