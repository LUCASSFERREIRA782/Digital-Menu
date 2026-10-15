/**
 * admin-auth.js
 * Entrada no painel + troca de abas.
 *
 * Na demonstração o login é um botão: não existe senha nem conta
 * (os dados ficam só neste navegador). Na versão de cada cliente
 * o login é o da açaiteria: Firebase Auth com e-mail/senha e só
 * entra quem tem a permissão { admin: true }.
 */

const loginScreen = document.getElementById("login-screen");
const adminPanel = document.getElementById("admin-panel");
let adminStarted = false;

document.querySelectorAll("[data-brand-name]").forEach(el => (el.textContent = restaurantConfig.name));
document.querySelectorAll("[data-niche-name]").forEach(el => (el.textContent = NICHO.nome));
document.title = `Painel — ${restaurantConfig.name} (${NICHO.nome})`;

auth.onAuthStateChanged(user => {
  if (!user) {
    loginScreen.hidden = false;
    adminPanel.hidden = true;
    return;
  }
  loginScreen.hidden = true;
  adminPanel.hidden = false;
  if (!adminStarted) {
    adminStarted = true;
    initOrdersAdmin();
    initProductsAdmin();
    initAddonsAdmin();
    initDeliveryAdmin();
    initTablesAdmin();
    initStoreAdmin();
    initReportsAdmin();
    initDemoAdmin();
  }
  startOrdersListener();
});

document.getElementById("demo-login-btn").addEventListener("click", async e => {
  e.target.disabled = true;
  await auth.signInDemo();
  e.target.disabled = false;
});

document.getElementById("logout-btn").addEventListener("click", () => {
  stopOrdersListener();
  auth.signOut();
});

// Abas
document.querySelectorAll(".a-tab").forEach(btn =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".a-tab").forEach(b => b.classList.toggle("is-active", b === btn));
    document.querySelectorAll(".a-pane").forEach(p => p.classList.toggle("is-active", p.id === `tab-${btn.dataset.tab}`));
  })
);

// Fechar modais
document.querySelectorAll("[data-close-modal]").forEach(btn =>
  btn.addEventListener("click", () => btn.closest("dialog").close())
);

const ts = () => firebase.firestore.FieldValue.serverTimestamp();

/* ---------- Barra da demonstração: nicho, cardápio e restaurar ----------
 * Só o painel troca o nicho. Um clique: grava neste aparelho, avisa o
 * cardápio aberto em outra aba (que muda na hora) e recarrega o painel
 * com os dados daquele nicho (cada nicho tem cardápio e pedidos próprios).
 */
function initDemoAdmin() {
  escolherNicho(NICHO_ID); // o cardápio aberto neste aparelho segue o painel
  const wrap = document.getElementById("demo-niches");
  wrap.innerHTML = Object.entries(NICHOS).map(([id, n]) => `
    <button type="button" class="a-niche-chip${id === NICHO_ID ? " is-active" : ""}" role="radio" aria-checked="${id === NICHO_ID}" data-niche="${esc(id)}">${esc(n.nome)}</button>`).join("");
  wrap.addEventListener("click", e => {
    const id = e.target.closest("[data-niche]")?.dataset.niche;
    if (!id || id === NICHO_ID) return;
    escolherNicho(id);
    location.replace(adminUrl(id));
  });
  document.getElementById("demo-menu-link").href = nichoUrl(NICHO_ID);
  document.getElementById("demo-table-link").href = nichoUrl(NICHO_ID, "&mesa=7");
  document.getElementById("demo-reset-btn").addEventListener("click", () => {
    if (!confirm("Restaurar cardápio, configurações e pedidos de exemplo deste nicho? O que você mudou aqui será perdido.")) return;
    DemoStore.reset();
    location.reload();
  });
}
