/**
 * app.js
 * -------------------------------------------------------
 * Ponto de entrada. Ordem importa: primeiro renderiza o DOM
 * a partir dos dados, depois liga os comportamentos de
 * interface (que dependem dos elementos já existirem).
 * -------------------------------------------------------
 */

document.addEventListener("DOMContentLoaded", () => {
  renderIdentity();
  renderCategoryNav();
  renderFeatured();
  renderCategories();

  setupCategoryNav();
  setupProductSheet();
  setupPixCopy();
  setupScrollReveal();
  renderOrderBar();
});
