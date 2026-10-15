/**
 * app.js
 * -------------------------------------------------------
 * Ponto de entrada: identidade → cardápio → comportamentos.
 * Quando o painel muda algo (outra aba), o cardápio se
 * atualiza sozinho.
 * -------------------------------------------------------
 */

async function renderMenu() {
  await loadCatalog();
  renderIdentity(); // agora com horários/nome vindos do painel
  renderCategoryNav();
  renderFeatured();
  renderCategories();
  setupReveal();
}

document.addEventListener("DOMContentLoaded", async () => {
  renderIdentity();
  setupGlobalEvents();
  setupDemoUI();
  // Topo: foto real com profundidade; se falhar (sem WebGL, imagem fora), a cena desenhada
  const stage = document.getElementById("hero-stage");
  if (NICHO.foto) startPhoto3D(stage, NICHO.foto, () => startHero3D(stage, NICHO.cena));
  else startHero3D(stage, NICHO.cena);

  // Foto com URL quebrada vira a ilustração padrão em vez do ícone de erro
  document.addEventListener("error", e => {
    if (e.target.tagName === "IMG") {
      const ph = document.createElement("span");
      ph.className = "photo-fallback";
      e.target.replaceWith(ph);
    }
  }, true);

  const banner = document.getElementById("table-banner");
  if (MESA_DO_QR) {
    banner.hidden = false;
    banner.querySelector("[data-table-number]").textContent = MESA_DO_QR;
  }

  await renderMenu();
  setupCategoryNav();
  renderOrderBar();

  // Mudanças feitas no painel em outra aba: recarrega o cardápio (sem mexer na comanda)
  let pending = null;
  DemoStore.subscribe(() => {
    clearTimeout(pending);
    pending = setTimeout(async () => {
      const prevNav = document.querySelector("#category-nav .cat-nav-track").innerHTML;
      await renderMenu();
      if (document.querySelector("#category-nav .cat-nav-track").innerHTML !== prevNav) setupCategoryNav();
    }, 300);
  });
});
