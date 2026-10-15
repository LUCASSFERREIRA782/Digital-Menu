/**
 * admin-reports.js
 * -------------------------------------------------------
 * Aba "Relatórios e dados".
 *
 * Desempenho: pedidos e faturamento por dia ou por dia da
 * semana, com destaques (melhor dia, maior ticket médio e
 * dias que venderam menos mas faturaram mais).
 *
 * Fontes: pedidos ainda guardados + relatorios/{AAAA-MM-DD},
 * que recebe os TOTAIS do dia quando pedidos antigos são
 * apagados (nenhum dado de cliente vai para lá).
 *
 * Faturamento = soma dos pedidos não cancelados (com taxa de
 * entrega). Não é lucro: custos não são registrados.
 * -------------------------------------------------------
 */

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
let reportRows = [];

function initReportsAdmin() {
  document.getElementById("report-range").addEventListener("change", loadReport);
  document.querySelectorAll('input[name="reportGroup"]').forEach(r => r.addEventListener("change", renderReport));
  document.getElementById("purge-days").addEventListener("change", refreshPrivacy);
  document.getElementById("purge-orders-btn").addEventListener("click", purgeOrders);
  // Recarrega ao abrir a aba (os pedidos mudam o tempo todo)
  document.querySelector('[data-tab="relatorios"]').addEventListener("click", () => { loadReport(); refreshPrivacy(); });
  loadReport();
  refreshPrivacy();
}

const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const keyToDate = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const shortDate = k => { const d = keyToDate(k); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; };
const pct = (part, total) => (total ? Math.round((part / total) * 100) : 0);

/* ---------------- Dados ---------------- */

async function loadReport() {
  const days = Number(document.getElementById("report-range").value);
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  try {
    const [ordersSnap, aggSnap] = await Promise.all([
      db.collection("pedidos").where("criadoEm", ">=", since).get(),
      db.collection("relatorios").where("dia", ">=", dayKey(since)).get(),
    ]);

    // Um registro por dia do período, inclusive dias sem venda
    const byDay = new Map();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      byDay.set(dayKey(d), { key: dayKey(d), pedidos: 0, faturamento: 0 });
    }
    aggSnap.docs.forEach(doc => {
      const a = doc.data();
      const row = byDay.get(a.dia);
      if (row) { row.pedidos += a.pedidos || 0; row.faturamento += a.faturamento || 0; }
    });
    ordersSnap.docs.forEach(doc => {
      const o = doc.data();
      const created = o.criadoEm?.toDate?.();
      if (!created || o.status === "cancelado") return;
      const row = byDay.get(dayKey(created));
      if (row) { row.pedidos += 1; row.faturamento += Number(o.total || 0); }
    });
    reportRows = [...byDay.values()].map(r => ({ ...r, faturamento: Math.round(r.faturamento * 100) / 100 }));
    renderReport();
  } catch (err) {
    console.error(err);
    document.getElementById("report-insights").innerHTML = `<p class="a-error">Erro ao carregar o relatório: ${esc(err.message)}</p>`;
  }
}

function groupedRows() {
  const byWeekday = document.querySelector('input[name="reportGroup"]:checked').value === "semana";
  if (!byWeekday) return reportRows.map(r => ({ ...r, label: shortDate(r.key), long: `${shortDate(r.key)} (${WEEKDAY_LONG[keyToDate(r.key).getDay()]})` }));
  // Segunda a domingo
  return [1, 2, 3, 4, 5, 6, 0].map(wd => {
    const same = reportRows.filter(r => keyToDate(r.key).getDay() === wd);
    return {
      key: String(wd), label: WEEKDAY_SHORT[wd], long: `${WEEKDAY_LONG[wd]} (soma de ${same.length} dia${same.length === 1 ? "" : "s"})`,
      pedidos: same.reduce((s, r) => s + r.pedidos, 0),
      faturamento: Math.round(same.reduce((s, r) => s + r.faturamento, 0) * 100) / 100,
    };
  });
}

/* ---------------- Render ---------------- */

function renderReport() {
  const rows = groupedRows().map(r => ({ ...r, ticket: r.pedidos ? r.faturamento / r.pedidos : 0 }));
  const totalPedidos = rows.reduce((s, r) => s + r.pedidos, 0);
  const totalFat = rows.reduce((s, r) => s + r.faturamento, 0);
  const comVenda = rows.filter(r => r.pedidos > 0);

  document.getElementById("report-kpis").innerHTML = [
    ["Pedidos", totalPedidos.toLocaleString("pt-BR")],
    ["Faturamento", money(totalFat)],
    ["Ticket médio", money(totalPedidos ? totalFat / totalPedidos : 0)],
    [document.querySelector('input[name="reportGroup"]:checked').value === "semana" ? "Dias da semana com venda" : "Dias com venda", `${comVenda.length} de ${rows.length}`],
  ].map(([label, value]) => `<div class="a-kpi"><span>${label}</span><strong>${value}</strong></div>`).join("");

  document.getElementById("report-insights").innerHTML = insightsHTML(rows, totalPedidos, totalFat);

  renderColumnChart(document.getElementById("chart-revenue"), rows, {
    title: "Faturamento", value: r => r.faturamento, format: v => money(v), color: "var(--brand)", total: totalFat,
  });
  renderColumnChart(document.getElementById("chart-orders"), rows, {
    title: "Pedidos", value: r => r.pedidos, format: v => v.toLocaleString("pt-BR"), color: "var(--ok)", total: totalPedidos,
  });

  document.getElementById("report-table").innerHTML = `
    <table class="a-table">
      <thead><tr><th>Dia</th><th>Pedidos</th><th>% dos pedidos</th><th>Faturamento</th><th>% do faturamento</th><th>Ticket médio</th></tr></thead>
      <tbody>${rows.map(r => `
        <tr>
          <td>${esc(r.long)}</td><td>${r.pedidos}</td><td>${pct(r.pedidos, totalPedidos)}%</td>
          <td>${money(r.faturamento)}</td><td>${pct(r.faturamento, totalFat)}%</td><td>${r.pedidos ? money(r.ticket) : "—"}</td>
        </tr>`).join("")}</tbody>
    </table>`;
}

function insightsHTML(rows, totalPedidos, totalFat) {
  const sold = rows.filter(r => r.pedidos > 0);
  if (!sold.length) return `<p class="a-empty">Ainda não há pedidos neste período. Os destaques aparecem assim que houver vendas.</p>`;

  const best = (fn) => sold.reduce((a, b) => (fn(b) > fn(a) ? b : a));
  const topFat = best(r => r.faturamento);
  const topPed = best(r => r.pedidos);
  const topTicket = best(r => r.ticket);
  const cards = [
    ["Maior faturamento", topFat.long, `${money(topFat.faturamento)} · ${pct(topFat.faturamento, totalFat)}% do período`],
    ["Mais pedidos", topPed.long, `${topPed.pedidos} pedidos · ${pct(topPed.pedidos, totalPedidos)}% do período`],
    ["Maior ticket médio", topTicket.long, `${money(topTicket.ticket)} por pedido`],
  ];

  // "Vendeu menos, faturou mais": A com menos pedidos que B e faturamento maior.
  let pair = null;
  for (const a of sold) for (const b of sold) {
    if (a.pedidos < b.pedidos && a.faturamento > b.faturamento) {
      const gap = a.faturamento - b.faturamento;
      if (!pair || gap > pair.gap) pair = { a, b, gap };
    }
  }

  return `
    <div class="a-insight-cards">
      ${cards.map(([t, who, detail]) => `<div class="a-insight"><span>${t}</span><strong>${esc(who)}</strong><small>${esc(detail)}</small></div>`).join("")}
    </div>
    ${pair ? `
      <p class="a-insight-note">
        <strong>Menos pedidos, mais faturamento:</strong> ${esc(pair.a.long)} teve <strong>${pair.a.pedidos}</strong> pedido(s) e faturou <strong>${money(pair.a.faturamento)}</strong>,
        mais que ${esc(pair.b.long)}, com <strong>${pair.b.pedidos}</strong> pedido(s) e ${money(pair.b.faturamento)}.
        O ticket médio foi ${money(pair.a.ticket)} contra ${money(pair.b.ticket)}: pedidos maiores compensaram o movimento menor.
      </p>` : ""}`;
}

/** Colunas de uma única série: sem legenda (o título diz o que é), tooltip por coluna. */
function renderColumnChart(fig, rows, { title, value, format, color, total }) {
  const W = 640, H = 220, padL = 56, padR = 8, padT = 24, padB = 28;
  const max = Math.max(...rows.map(value), 0);
  const step = niceStep(max / 4 || 1);
  const top = Math.max(step * 4, step);
  const slot = (W - padL - padR) / rows.length;
  const barW = Math.max(2, Math.min(24, slot - 2)); // ≤ 24px, 2px de respiro entre colunas
  const y = v => padT + (H - padT - padB) * (1 - v / top);
  const labelEvery = Math.ceil(rows.length / 10);
  const maxIdx = rows.findIndex(r => value(r) === max && max > 0);

  const grid = [0, 1, 2, 3, 4].map(i => {
    const v = step * i;
    return `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" class="c-grid"/>
            <text x="${padL - 8}" y="${y(v) + 4}" class="c-tick" text-anchor="end">${esc(format(v))}</text>`;
  }).join("");

  const bars = rows.map((r, i) => {
    const v = value(r);
    const x = padL + slot * i + (slot - barW) / 2;
    const h = Math.max(0, y(0) - y(v));
    const rTop = Math.min(4, barW / 2, h);
    // retângulo com cantos arredondados só em cima (base reta)
    const path = h > 0
      ? `M${x},${y(0)} V${y(v) + rTop} Q${x},${y(v)} ${x + rTop},${y(v)} H${x + barW - rTop} Q${x + barW},${y(v)} ${x + barW},${y(v) + rTop} V${y(0)} Z`
      : "";
    const tip = `${r.long}\n${title}: ${format(v)} (${pct(v, total)}%)\nPedidos: ${r.pedidos} · Ticket médio: ${r.pedidos ? money(r.ticket) : "—"}`;
    return `
      <g class="c-col" data-tip="${esc(tip)}">
        <rect x="${padL + slot * i}" y="${padT}" width="${slot}" height="${H - padT - padB}" class="c-hit"/>
        ${path ? `<path d="${path}" fill="${color}"/>` : ""}
        ${i === maxIdx ? `<text x="${x + barW / 2}" y="${y(v) - 6}" class="c-value" text-anchor="middle">${esc(format(v))}</text>` : ""}
        ${i % labelEvery === 0 ? `<text x="${x + barW / 2}" y="${H - 8}" class="c-tick" text-anchor="middle">${esc(r.label)}</text>` : ""}
      </g>`;
  }).join("");

  fig.innerHTML = `
    <figcaption class="c-title">${title} <small>${esc(format(total))} no período</small></figcaption>
    <div class="c-wrap">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title} por ${rows.length > 7 ? "dia" : "dia da semana"}. Detalhes na tabela abaixo.">
        ${grid}
        <line x1="${padL}" x2="${W - padR}" y1="${y(0)}" y2="${y(0)}" class="c-axis"/>
        ${bars}
      </svg>
      <div class="c-tooltip" hidden></div>
    </div>`;

  const tooltip = fig.querySelector(".c-tooltip");
  const wrap = fig.querySelector(".c-wrap");
  fig.querySelectorAll(".c-col").forEach(g => {
    g.addEventListener("pointerenter", () => { g.classList.add("is-hover"); tooltip.hidden = false; tooltip.textContent = g.dataset.tip; });
    g.addEventListener("pointermove", ev => {
      const box = wrap.getBoundingClientRect();
      const left = Math.min(ev.clientX - box.left + 12, box.width - tooltip.offsetWidth - 4);
      tooltip.style.left = `${Math.max(4, left)}px`;
      tooltip.style.top = `${ev.clientY - box.top - tooltip.offsetHeight - 10}px`;
    });
    g.addEventListener("pointerleave", () => { g.classList.remove("is-hover"); tooltip.hidden = true; });
  });
}

function niceStep(raw) {
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

/* ---------------- Dados e privacidade ---------------- */

function purgeCutoff() {
  const days = Number(document.getElementById("purge-days").value);
  return days === 0 ? new Date() : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function purgeCandidates() {
  const snap = await db.collection("pedidos").where("criadoEm", "<", purgeCutoff()).get();
  return snap.docs.filter(d => ["concluido", "cancelado"].includes(d.data().status));
}

async function refreshPrivacy() {
  const summary = document.getElementById("privacy-summary");
  try {
    const [all, aggs, candidates] = await Promise.all([
      db.collection("pedidos").orderBy("criadoEm").get(),
      db.collection("relatorios").get(),
      purgeCandidates(),
    ]);
    const docs = all.docs.map(d => d.data());
    const open = docs.filter(o => !["concluido", "cancelado"].includes(o.status)).length;
    const oldest = docs[0]?.criadoEm?.toDate?.();
    summary.innerHTML = `
      <div class="a-privacy-grid">
        <div><strong>${docs.length}</strong><span>pedidos guardados</span></div>
        <div><strong>${open}</strong><span>em andamento (nunca são apagados aqui)</span></div>
        <div><strong>${oldest ? oldest.toLocaleDateString("pt-BR") : "—"}</strong><span>pedido mais antigo</span></div>
        <div><strong>${aggs.size}</strong><span>dias só com totais no relatório</span></div>
      </div>`;

    const n = candidates.length;
    document.getElementById("purge-preview").textContent = n
      ? `${n} pedido(s) serão apagados.`
      : "Nenhum pedido finalizado ou cancelado nesse prazo.";
    document.getElementById("purge-orders-btn").disabled = n === 0;

  } catch (err) {
    console.error(err);
    summary.innerHTML = `<p class="a-error">Erro ao ler os dados: ${esc(err.message)}</p>`;
  }
}

/** Antes de apagar, soma os pedidos (não cancelados) nos totais do dia. */
async function purgeOrders() {
  const docs = await purgeCandidates();
  if (!docs.length) return;
  if (!confirm(`Apagar definitivamente ${docs.length} pedido(s) finalizado(s)/cancelado(s)?\n\nOs totais de pedidos e faturamento continuam no relatório.`)) return;

  const btn = document.getElementById("purge-orders-btn");
  btn.disabled = true;
  try {
    const inc = firebase.firestore.FieldValue.increment;
    for (let i = 0; i < docs.length; i += 200) {
      const chunk = docs.slice(i, i + 200);
      const totals = new Map();
      chunk.forEach(d => {
        const o = d.data();
        const created = o.criadoEm?.toDate?.();
        if (created && o.status !== "cancelado") {
          const k = dayKey(created);
          const t = totals.get(k) || { pedidos: 0, faturamento: 0 };
          t.pedidos += 1;
          t.faturamento += Number(o.total || 0);
          totals.set(k, t);
        }
      });
      const batch = db.batch();
      totals.forEach((t, k) => batch.set(db.collection("relatorios").doc(k),
        { dia: k, pedidos: inc(t.pedidos), faturamento: inc(Math.round(t.faturamento * 100) / 100) }, { merge: true }));
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit(); // totais e exclusão juntos: ou tudo, ou nada
    }
    showToast(`${docs.length} pedido(s) apagado(s); totais mantidos no relatório`);
  } catch (err) {
    alert("Erro ao apagar: " + err.message);
  }
  refreshPrivacy();
  loadReport();
}

