/**
 * admin-auth.js
 * Login do painel (Firebase Auth, e-mail e senha) + abas.
 *
 * Quem decide o acesso são as regras do banco (lista de donos por UID).
 * Ao entrar, o painel testa uma leitura que só o dono consegue; se a conta
 * não for do dono, é desconectada na hora.
 */

const loginScreen = document.getElementById("login-screen");
const adminPanel = document.getElementById("admin-panel");
let adminStarted = false;

document.querySelectorAll("[data-brand-name]").forEach(el => (el.textContent = restaurantConfig.name));
document.querySelectorAll("[data-niche-name]").forEach(el => (el.textContent = NICHO.nome));
document.title = `Painel — ${restaurantConfig.name} (${NICHO.nome})`;

const AUTH_ERROS = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/invalid-login-credentials": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/user-disabled": "Esta conta está desativada.",
  "auth/too-many-requests": "Muitas tentativas. Espere alguns minutos e tente de novo.",
  "auth/operation-not-allowed": "O login por e-mail ainda não foi ativado no Firebase (Authentication → Sign-in method).",
  "auth/network-request-failed": "Sem conexão. Verifique a internet.",
};

function mostrarLogin(msg = "") {
  loginScreen.hidden = false;
  adminPanel.hidden = true;
  document.getElementById("login-error").textContent = msg;
}

auth.onAuthStateChanged(async user => {
  if (!user) { mostrarLogin(); return; }
  try {
    await db.collection("config").doc("equipe").get({ source: "server" }); // só o dono consegue
  } catch (err) {
    await auth.signOut();
    mostrarLogin(err.code === "permission-denied"
      ? "Esta conta não tem acesso ao painel da demonstração."
      : "Não foi possível conferir o acesso. Verifique a internet.");
    return;
  }
  loginScreen.hidden = true;
  adminPanel.hidden = false;
  if (!adminStarted) {
    adminStarted = true;
    initDemoAdmin();
    initOrdersAdmin();
    initProductsAdmin();
    initAddonsAdmin();
    initDeliveryAdmin();
    initTablesAdmin();
    initStoreAdmin();
    initReportsAdmin();
    apagarVencidos().then(n => { if (n) showToast(`${n} registro(s) com mais de 90 dias apagados`); })
      .catch(err => console.warn("Limpeza dos vencidos:", err.code || err.message));
  }
  startOrdersListener();
});

document.getElementById("login-form").addEventListener("submit", async e => {
  e.preventDefault();
  const errorEl = document.getElementById("login-error");
  const btn = document.getElementById("login-btn");
  errorEl.textContent = "";
  btn.disabled = true;
  try {
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION); // fechou o navegador = saiu
    await auth.signInWithEmailAndPassword(document.getElementById("email").value.trim(), document.getElementById("password").value);
  } catch (err) {
    errorEl.textContent = AUTH_ERROS[err.code] || "Não foi possível entrar.";
  } finally {
    btn.disabled = false;
    document.getElementById("password").value = "";
  }
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
 * Só o painel troca o nicho. Um clique grava no banco (todos os aparelhos
 * com o cardápio aberto mudam juntos) e recarrega o painel com os dados
 * daquele nicho (cada nicho tem cardápio e pedidos próprios).
 */
function initDemoAdmin() {
  escolherNicho(NICHO_ID).catch(err => console.warn("Nicho ao vivo:", err.code));
  const wrap = document.getElementById("demo-niches");
  wrap.innerHTML = Object.entries(NICHOS).map(([id, n]) => `
    <button type="button" class="a-niche-chip${id === NICHO_ID ? " is-active" : ""}" role="radio" aria-checked="${id === NICHO_ID}" data-niche="${esc(id)}">${esc(n.nome)}</button>`).join("");
  wrap.addEventListener("click", async e => {
    const id = e.target.closest("[data-niche]")?.dataset.niche;
    if (!id || id === NICHO_ID) return;
    wrap.querySelectorAll("button").forEach(b => (b.disabled = true));
    try { await escolherNicho(id); } catch { showToast("Não foi possível avisar os outros aparelhos"); }
    location.replace(adminUrl(id));
  });
  document.getElementById("demo-menu-link").href = nichoUrl(NICHO_ID);
  document.getElementById("demo-table-link").href = nichoUrl(NICHO_ID, "&mesa=7");
  document.getElementById("demo-reset-btn").addEventListener("click", async e => {
    if (!confirm(`Restaurar o exemplo de ${NICHO.nome}? Cardápio, configurações e pedidos deste nicho voltam ao original.`)) return;
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await restaurarExemplo(msg => (btn.textContent = msg));
      location.reload();
    } catch (err) {
      alert("Não foi possível restaurar: " + (err.code || err.message));
      btn.disabled = false;
      btn.textContent = "Restaurar exemplo";
    }
  });
}
