/**
 * demo-ui.js
 * -------------------------------------------------------
 * Troca de nicho da demonstração. Só o PAINEL troca; a página
 * pública não tem botão nenhum — o cliente vê só o cardápio.
 *
 * Ao trocar no painel, o nicho é lembrado neste aparelho e
 * avisado às outras abas abertas (BroadcastChannel): o cardápio
 * aberto em outra aba muda na hora, sem recarregar à mão.
 * Some na versão de cada cliente.
 * -------------------------------------------------------
 */

/** Pasta do site (funciona em /Digital-Menu/, /Digital-Menu/index.html e no painel). */
const siteRoot = () => location.pathname.replace(/[^/]*$/, "").replace(/admin\/$/, "");
const nichoUrl = (id, extra = "") => `${siteRoot()}?nicho=${encodeURIComponent(id)}${extra}`;
const adminUrl = id => `${siteRoot()}admin/?nicho=${encodeURIComponent(id)}`;

let nichoCanal = null;
try { nichoCanal = new BroadcastChannel(NICHO_CHAVE); } catch {}

/** Painel: grava o nicho escolhido e avisa as outras abas. */
function escolherNicho(id) {
  if (!nichoValido(id)) return;
  try { localStorage.setItem(NICHO_CHAVE, id); } catch {}
  nichoCanal?.postMessage({ nicho: id });
}

/** Cardápio: quando o painel troca o nicho, troca junto (mantém a mesa do QR). */
function seguirNichoDoPainel() {
  const trocar = id => {
    if (!nichoValido(id) || id === NICHO_ID) return;
    const mesa = new URLSearchParams(location.search).get("mesa");
    location.replace(nichoUrl(id, mesa ? `&mesa=${encodeURIComponent(mesa)}` : ""));
  };
  if (nichoCanal) nichoCanal.onmessage = e => trocar(e.data?.nicho);
  // Reserva para navegadores sem BroadcastChannel
  window.addEventListener("storage", e => { if (e.key === NICHO_CHAVE) trocar(e.newValue); });
}
