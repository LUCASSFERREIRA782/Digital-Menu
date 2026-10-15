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

  if (MESA_DO_QR) {
    const banner = document.getElementById("table-banner");
    banner.hidden = false;
    banner.querySelector("[data-table-number]").textContent = MESA_DO_QR;
  }

  watchCatalog(() => {
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
