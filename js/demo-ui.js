/**
 * demo-ui.js
 * -------------------------------------------------------
 * Botão flutuante "Amostra": troca de nicho, abre o painel
 * da loja e restaura os dados de exemplo. Existe só nesta
 * amostra — some na versão de cada cliente.
 * -------------------------------------------------------
 */

/** Pasta do site (funciona em /Digital-Menu/, /Digital-Menu/index.html e no painel). */
const siteRoot = () => location.pathname.replace(/[^/]*$/, "").replace(/admin\/$/, "");
const nichoUrl = (id, extra = "") => `${siteRoot()}?nicho=${encodeURIComponent(id)}${extra}`;
const adminUrl = id => `${siteRoot()}admin/?nicho=${encodeURIComponent(id)}`;

function setupDemoUI() {
  const pill = document.createElement("div");
  pill.className = "demo-pill";
  pill.innerHTML = `<span class="demo-pill-dot" aria-hidden="true"></span><span>Amostra · ${esc(NICHO.nome)}</span><button type="button" data-demo-open>Trocar</button>`;
  document.body.appendChild(pill);
  pill.querySelector("[data-demo-open]").addEventListener("click", openDemoSheet);
}

function openDemoSheet() {
  openSheet(`
    <div class="sheet-body">
      <span class="ticket-kicker">Cardápio de demonstração</span>
      <h3 class="sheet-title">Escolha o tipo de negócio</h3>
      <p class="sheet-desc">Mesmo sistema, visual e cardápio de cada nicho. Tudo aqui é exemplo: nada é enviado de verdade.</p>
      <div class="demo-niches">
        ${Object.entries(NICHOS).map(([id, n]) => `
          <a class="demo-niche${id === NICHO_ID ? " is-current" : ""}" href="${esc(nichoUrl(id))}">
            <strong>${esc(n.nome)}</strong><span>${esc(n.resumo)}</span>
          </a>`).join("")}
      </div>
      <div class="demo-actions">
        <a class="btn btn--ink" href="${esc(adminUrl(NICHO_ID))}" target="_blank" rel="noopener">Abrir o painel da loja ↗</a>
        <a class="btn" href="${esc(nichoUrl(NICHO_ID, "&mesa=7"))}">Ver como cliente na Mesa 7</a>
        <button type="button" class="btn btn--ghost" data-demo-reset>Restaurar dados de exemplo</button>
      </div>
      <p class="demo-note">Os dados desta demonstração ficam só neste navegador. Abra o painel em outra aba: os pedidos feitos aqui chegam lá na hora.</p>
    </div>`, "Demonstração");
  document.querySelector("[data-demo-reset]").addEventListener("click", () => {
    if (!confirm("Restaurar o cardápio, as configurações e os pedidos de exemplo deste nicho?")) return;
    DemoStore.reset();
    closeSheet();
    showToast("Dados de exemplo restaurados");
  });
}
