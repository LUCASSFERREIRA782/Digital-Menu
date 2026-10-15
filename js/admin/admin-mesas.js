/**
 * admin-mesas.js
 * -------------------------------------------------------
 * QR Code por mesa. Cada QR abre o cardápio com ?mesa=N:
 * o cliente pede direto da mesa e o pedido chega no quadro
 * com o número dela (sem precisar digitar).
 *
 * config/mesas: { quantidade }
 * Os QR Codes são gerados aqui mesmo (js/qr.js), sem enviar
 * o link para nenhum serviço de fora.
 * -------------------------------------------------------
 */

const MAX_MESAS = 80;

function initTablesAdmin() {
  document.getElementById("tables-form").addEventListener("submit", saveTables);
  document.getElementById("print-tables-btn").addEventListener("click", () => window.print());
  loadTables();
}

/** Endereço público do cardápio (o mesmo que está aberto, sem a parte /admin). */
function menuBaseUrl() {
  return `${location.origin}${siteRoot()}`;
}

async function loadTables() {
  const doc = await db.collection("config").doc("mesas").get();
  const n = doc.exists ? Number(doc.data().quantidade) || 0 : 0;
  document.getElementById("tables-count").value = n || 10;
  renderTables(n || 10);
}

function renderTables(n) {
  const wrap = document.getElementById("tables-grid");
  const base = menuBaseUrl();
  wrap.innerHTML = Array.from({ length: n }, (_, i) => {
    const mesa = String(i + 1);
    const url = `${base}?nicho=${encodeURIComponent(NICHO_ID)}&mesa=${encodeURIComponent(mesa)}`;
    return `
      <figure class="a-table-card">
        <div class="a-table-qr">${qrSvg(url)}</div>
        <figcaption>
          <strong>Mesa ${esc(mesa)}</strong>
          <span>Aponte a câmera e peça por aqui</span>
          <a class="a-table-link" href="${esc(url)}" target="_blank" rel="noopener">testar</a>
        </figcaption>
      </figure>`;
  }).join("");
  document.getElementById("tables-hint").textContent =
    `${n} QR Code(s) apontando para ${base}. ${/^(localhost|127\.)/.test(location.hostname) ? "Atenção: este é o endereço do seu computador — gere de novo no site publicado antes de imprimir." : ""}`;
}

async function saveTables(e) {
  e.preventDefault();
  const n = Math.min(MAX_MESAS, Math.max(1, parseInt(document.getElementById("tables-count").value, 10) || 1));
  await db.collection("config").doc("mesas").set({ quantidade: n, atualizadoEm: ts() });
  renderTables(n);
  showToast(`${n} mesa(s) prontas para imprimir`);
}
