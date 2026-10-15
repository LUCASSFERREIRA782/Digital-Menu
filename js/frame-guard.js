/**
 * frame-guard.js
 * Impede que o site e o painel sejam abertos dentro de um iframe de outro site
 * (clickjacking: uma página falsa por cima, enganando o clique).
 * O GitHub Pages não permite o cabeçalho X-Frame-Options, então a
 * proteção é feita aqui, antes de qualquer outro script.
 */
if (window.top !== window.self) {
  document.documentElement.style.display = "none";
  try { window.top.location = window.self.location.href; } catch { /* bloqueado: a página segue oculta */ }
}
