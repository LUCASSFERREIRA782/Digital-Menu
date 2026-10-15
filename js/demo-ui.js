/**
 * demo-ui.js
 * -------------------------------------------------------
 * Troca de nicho da demonstração. Só o PAINEL troca; a página
 * pública não tem botão nenhum — o cliente vê só o cardápio.
 *
 * Ao trocar no painel:
 *   • neste aparelho, as outras abas mudam na hora (BroadcastChannel);
 *   • nos outros aparelhos (celular do cliente), a mudança chega pelo
 *     banco (documento demo/estado, que só o dono pode alterar).
 * Some na versão de cada cliente.
 * -------------------------------------------------------
 */

/** Pasta do site (funciona em /Digital-Menu/, /Digital-Menu/index.html e no painel). */
const siteRoot = () => location.pathname.replace(/[^/]*$/, "").replace(/admin\/$/, "");
// Testes locais: mantém o ?emulador nos links (ver js/backend.js)
const sufixoTeste = () => (new URLSearchParams(location.search).has("emulador") ? "&emulador=1" : "");
const nichoUrl = (id, extra = "") => `${siteRoot()}?nicho=${encodeURIComponent(id)}${extra}${sufixoTeste()}`;
const adminUrl = id => `${siteRoot()}admin/?nicho=${encodeURIComponent(id)}${sufixoTeste()}`;

let nichoCanal = null;
try { nichoCanal = new BroadcastChannel(NICHO_CHAVE); } catch {}
const lembrarNicho = id => { try { localStorage.setItem(NICHO_CHAVE, id); } catch {} };

/** Painel: grava o nicho escolhido (aparelho + banco) e avisa as outras abas. */
async function escolherNicho(id) {
  if (!nichoValido(id)) return;
  lembrarNicho(id);
  nichoCanal?.postMessage({ nicho: id });
  await estadoDemo().set({ nicho: id, atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() });
}

/** Cardápio: quando o painel troca o nicho, troca junto (mantém a mesa do QR). */
function seguirNichoDoPainel() {
  const trocar = id => {
    if (!nichoValido(id) || id === NICHO_ID) return;
    lembrarNicho(id); // próxima visita já abre direto no nicho certo
    const mesa = new URLSearchParams(location.search).get("mesa");
    location.replace(nichoUrl(id, mesa ? `&mesa=${encodeURIComponent(mesa)}` : ""));
  };
  if (nichoCanal) nichoCanal.onmessage = e => trocar(e.data?.nicho);
  window.addEventListener("storage", e => { if (e.key === NICHO_CHAVE) trocar(e.newValue); });
  // Outros aparelhos: só valores confirmados pelo servidor (o cache local pode estar velho)
  estadoDemo().onSnapshot(snap => {
    if (snap.metadata.fromCache) return;
    trocar(snap.data()?.nicho);
  }, err => console.info("Troca ao vivo indisponível:", err.code));
}
