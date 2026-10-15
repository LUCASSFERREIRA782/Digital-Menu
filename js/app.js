/**
 * app.js
 * -------------------------------------------------------
 * Ponto de entrada. Ordem pensada para abrir rápido:
 *   1. identidade e eventos (sem esperar rede);
 *   2. cardápio ao vivo (cache local primeiro, depois o banco);
 *   3. cena 3D do topo só quando o navegador estiver ocioso.
 * O nicho segue o painel em tempo real (js/demo-ui.js).
 * -------------------------------------------------------
 */

document.addEventListener("DOMContentLoaded", () => {
  renderIdentity();
  setupGlobalEvents();
  seguirNichoDoPainel(); // o nicho só muda pelo painel (esta página não tem botão de troca)

  // Foto com URL quebrada vira a ilustração padrão em vez do ícone de erro
  document.addEventListener("error", e => {
    if (e.target.tagName === "IMG") {
      const ph = document.createElement("span");
      ph.className = "photo-fallback";
      e.target.replaceWith(ph);
    }
  }, true);

  mostrarMesa();

  watchCatalog(() => {
    conferirMesaNaLoja(catalog.mesas);
    mostrarMesa();
    renderIdentity(); // horários, nome e status vindos do painel
    renderCategoryNav();
    renderFeatured();
    renderCategories();
    setupCategoryNav();
    setupReveal();
    hidratarFotos();
    renderOrderBar();
    if (document.getElementById("order-body")) renderOrderBody(); // comanda aberta: atualiza preços/horário
  });

  // Topo 3D: depois que o cardápio já está na tela
  const stage = document.getElementById("hero-stage");
  const start3D = () => (NICHO.foto ? startPhoto3D(stage, NICHO.foto, () => startHero3D(stage, NICHO.cena)) : startHero3D(stage, NICHO.cena));
  ("requestIdleCallback" in window) ? requestIdleCallback(start3D, { timeout: 1200 }) : setTimeout(start3D, 300);
});

/** Aviso da mesa: "Você está na Mesa 7" ou QR inválido/antigo. */
function mostrarMesa() {
  const banner = document.getElementById("table-banner");
  if (MESA_DO_QR) {
    banner.hidden = false;
    banner.classList.remove("table-banner--off");
    banner.innerHTML = `<span>Você está na</span> <strong>Mesa ${esc(MESA_DO_QR)}</strong> <span>· o pedido vai direto para a cozinha</span>`;
  } else if (QR_MESA.invalida) {
    banner.hidden = false;
    banner.classList.add("table-banner--off");
    banner.textContent = "Este QR Code de mesa não é válido aqui. Dá para pedir normalmente; avise o atendente da sua mesa.";
  }
}
