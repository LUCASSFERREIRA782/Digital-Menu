/**
 * admin-mesas.js
 * -------------------------------------------------------
 * QR Code por mesa, com código próprio de cada mesa:
 *   ?mesa=7&c=<código aleatório>
 *
 *   config/mesas         (público)  { quantidade } — o cardápio confere o número
 *   config/mesasPrivado  (só dono)  { quantidade, codigos: { "1": "…", … } }
 *
 * As regras do banco só aceitam pedido "na mesa" com o código impresso
 * daquela mesa: ninguém pede "da mesa 5" de fora da loja, nem com QR
 * de mesa que não existe. "Gerar novos códigos" invalida QR copiado ou
 * trocado (é preciso imprimir de novo).
 *
 * Demonstração: os códigos são os mesmos nos 7 nichos (o nicho muda ao
 * vivo e o QR impresso continua valendo). Os QR Codes são gerados aqui
 * mesmo (js/qr.js), sem enviar o link a nenhum serviço de fora.
 * -------------------------------------------------------
 */

const MAX_MESAS = 80;
let mesasPrivado = { quantidade: 0, codigos: {} };

function initTablesAdmin() {
  document.getElementById("tables-form").addEventListener("submit", saveTables);
  document.getElementById("print-tables-btn").addEventListener("click", () => window.print());
  document.getElementById("tables-new-codes-btn").addEventListener("click", novosCodigos);
  loadTables();
}

/** Endereço público do cardápio (o mesmo que está aberto, sem a parte /admin). */
function menuBaseUrl() {
  return `${location.origin}${siteRoot()}`;
}

/** Código aleatório de 8 letras/números (sem caracteres parecidos). */
function codigoMesa() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return [...crypto.getRandomValues(new Uint8Array(8))].map(b => chars[b % chars.length]).join("");
}

/** Garante código para as mesas 1..n (mantém os que já existem: QR impresso continua valendo). */
function completarCodigos(n, codigos = {}) {
  const out = {};
  for (let i = 1; i <= n; i++) out[i] = codigos[i] || codigoMesa();
  return out;
}

/** Grava quantidade + códigos nos 7 nichos da demonstração (mesmos QR Codes em todos). */
async function gravarMesas(n, codigos) {
  const b = db.batch();
  Object.keys(NICHOS).forEach(id => {
    const conf = firestore.collection("nichos").doc(id).collection("config");
    b.set(conf.doc("mesas"), { quantidade: n, atualizadoEm: ts() });
    b.set(conf.doc("mesasPrivado"), { quantidade: n, codigos, atualizadoEm: ts() });
  });
  await b.commit();
  mesasPrivado = { quantidade: n, codigos };
}

async function loadTables() {
  const doc = await db.collection("config").doc("mesasPrivado").get();
  const d = doc.exists ? doc.data() : {};
  let n = Number(d.quantidade) || 0;
  if (!n || !d.codigos || Object.keys(d.codigos).length < n) {
    n = n || 12;
    await gravarMesas(n, completarCodigos(n, d.codigos)); // primeira vez: cria os códigos
  } else {
    mesasPrivado = { quantidade: n, codigos: d.codigos };
  }
  document.getElementById("tables-count").value = mesasPrivado.quantidade;
  renderTables();
  atualizarLinkMesaDemo();
}

/** Link "Ver como cliente na Mesa 7" da barra da demonstração (com o código da mesa). */
function atualizarLinkMesaDemo() {
  const a = document.getElementById("demo-table-link");
  const cod = mesasPrivado.codigos["7"] || mesasPrivado.codigos["1"];
  const mesa = mesasPrivado.codigos["7"] ? "7" : "1";
  if (a && cod) {
    a.href = nichoUrl(NICHO_ID, `&mesa=${mesa}&c=${encodeURIComponent(cod)}`);
    a.textContent = `Ver como cliente na Mesa ${mesa} ↗`;
  }
}

const urlDaMesa = mesa => `${menuBaseUrl()}?mesa=${encodeURIComponent(mesa)}&c=${encodeURIComponent(mesasPrivado.codigos[mesa])}`;

function renderTables() {
  const wrap = document.getElementById("tables-grid");
  const n = mesasPrivado.quantidade;
  wrap.innerHTML = Array.from({ length: n }, (_, i) => {
    const mesa = String(i + 1), url = urlDaMesa(mesa);
    return `
      <figure class="a-table-card">
        <div class="a-table-qr">${qrSvg(url)}</div>
        <figcaption>
          <strong>Mesa ${esc(mesa)}</strong>
          <span>Aponte a câmera e peça por aqui</span>
          <span class="a-table-url">${esc(url.replace(/^https?:\/\//, ""))}</span>
          <a class="a-table-link" href="${esc(url)}" target="_blank" rel="noopener">testar</a>
        </figcaption>
      </figure>`;
  }).join("");
  document.getElementById("tables-hint").textContent =
    `${n} mesa(s). Cada QR tem um código próprio: só ele faz o pedido entrar como "na mesa". ${/^(localhost|127\.)/.test(location.hostname) ? "Atenção: este é o endereço do seu computador — gere no site publicado antes de imprimir." : ""}`;
}

async function saveTables(e) {
  e.preventDefault();
  const n = Math.min(MAX_MESAS, Math.max(1, parseInt(document.getElementById("tables-count").value, 10) || 1));
  // Mesas que continuam mantêm o código (QR já impresso segue valendo); as novas ganham código
  await gravarMesas(n, completarCodigos(n, mesasPrivado.codigos));
  renderTables();
  atualizarLinkMesaDemo();
  showToast(`${n} mesa(s) prontas para imprimir`);
}

async function novosCodigos() {
  if (!confirm("Gerar códigos novos para TODAS as mesas?\n\nOs QR Codes impressos param de valer como mesa: será preciso imprimir de novo. Use se algum QR foi copiado, fotografado ou trocado.")) return;
  await gravarMesas(mesasPrivado.quantidade, completarCodigos(mesasPrivado.quantidade, {}));
  renderTables();
  atualizarLinkMesaDemo();
  showToast("Códigos novos gerados. Imprima os QR Codes de novo.");
}
