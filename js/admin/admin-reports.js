/**
 * admin-reports.js
 * -------------------------------------------------------
 * Aba "Relatórios": painel de gestão (até 90 dias).
 *
 *   1. Linha — vendas por dia, separadas por mesa, retirada e entrega
 *   2. Barras agrupadas — tempo médio de preparo × entrega por dia da semana
 *      (com a meta de preparo como linha de referência)
 *   3. Rosca — pratos mais vendidos (quantidade ou faturamento)
 *   4. Estoque — indicadores e mapa de calor por produto, com reposição rápida
 *
 * Fonte: resumos diários (resumos/{AAAA-MM-DD}) — no máximo 90 leituras
 * para o período todo, em vez de milhares de pedidos. Imprimir/PDF e
 * planilha (CSV) saem dos mesmos números.
 *
 * Retenção: pedidos e resumos ficam 90 dias e depois são apagados.
 * -------------------------------------------------------
 */

const MODOS = [
  { id: "local", nome: "Mesa", cor: "var(--brand)" },
  { id: "retirada", nome: "Balcão (retirada)", cor: "var(--ok)" },
  { id: "entrega", nome: "Entrega", cor: "var(--accent)" },
];
const SEMANA = [1, 2, 3, 4, 5, 6, 0];
const SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const CORES_ROSCA = ["var(--brand)", "var(--ok)", "var(--accent)", "var(--ink)", "var(--danger)", "var(--ink-soft)", "var(--paper-deep)"];

let relatorio = { dias: [], produtos: [] };
let roscaPor = "q"; // q = quantidade, f = faturamento

function initReportsAdmin() {
  document.getElementById("report-range").addEventListener("change", loadReport);
  document.getElementById("report-print-btn").addEventListener("click", imprimirRelatorio);
  document.getElementById("report-csv-btn").addEventListener("click", exportarCsv);
  document.getElementById("purge-now-btn").addEventListener("click", async e => {
    e.currentTarget.disabled = true;
    const n = await apagarVencidos().catch(() => 0);
    showToast(n ? `${n} registro(s) vencido(s) apagado(s)` : "Nada vencido para apagar");
    e.currentTarget.disabled = false;
    refreshRetention();
  });
  document.getElementById("donut-toggle").addEventListener("change", e => { roscaPor = e.target.value; renderDonut(); });
  document.getElementById("stock-grid").addEventListener("click", e => {
    const id = e.target.closest("[data-restock]")?.dataset.restock;
    if (id) reporEstoque(id, 10).then(loadStock);
  });
  document.querySelector('[data-tab="relatorios"]').addEventListener("click", () => { loadReport(); refreshRetention(); });
  loadReport();
  refreshRetention();
}

const pct = (part, total) => (total ? Math.round((part / total) * 100) : 0);
const media = t => (t && t.n ? t.s / t.n : null);
const minTxt = v => (v == null ? "—" : `${Math.round(v)} min`);
const shortDate = k => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const keyToDate = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };

/* ---------------- Dados ---------------- */

async function loadReport() {
  const days = Math.min(90, Number(document.getElementById("report-range").value) || 30);
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  try {
    const snap = await db.collection("resumos").where("dia", ">=", diaChave(since)).get();
    const porDia = new Map(snap.docs.map(d => [d.id, d.data()]));
    relatorio.dias = Array.from({ length: days }, (_, i) => {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = diaChave(d), r = porDia.get(key) || {};
      return {
        key, label: shortDate(key), semana: d.getDay(),
        pedidos: r.pedidos || 0, faturamento: round2(r.faturamento || 0),
        modos: Object.fromEntries(MODOS.map(m => [m.id, { p: r.modos?.[m.id]?.p || 0, f: round2(r.modos?.[m.id]?.f || 0) }])),
        itens: r.itens || {},
        preparo: r.tempos?.preparo || { s: 0, n: 0 }, entrega: r.tempos?.entrega || { s: 0, n: 0 },
      };
    });
    renderKpis();
    renderSalesLine();
    renderTimesBars();
    renderDonut();
    renderTable();
    document.getElementById("report-print-period").textContent =
      `${shortDate(relatorio.dias[0].key)} a ${shortDate(relatorio.dias.at(-1).key)} (${days} dias)`;
  } catch (err) {
    console.error(err);
    document.getElementById("report-kpis").innerHTML = `<p class="a-error">Erro ao carregar o relatório: ${esc(err.code || err.message)}</p>`;
  }
  loadStock();
}

/* ---------------- Indicadores ---------------- */

function totais() {
  const d = relatorio.dias;
  const soma = (f) => d.reduce((s, x) => s + f(x), 0);
  const prep = { s: soma(x => x.preparo.s), n: soma(x => x.preparo.n) };
  const ent = { s: soma(x => x.entrega.s), n: soma(x => x.entrega.n) };
  return { pedidos: soma(x => x.pedidos), faturamento: round2(soma(x => x.faturamento)), preparo: media(prep), entrega: media(ent) };
}

function renderKpis() {
  const t = totais(), meta = Number(storeCache?.metaPreparo) || 20;
  document.getElementById("report-kpis").innerHTML = [
    ["Pedidos", t.pedidos.toLocaleString("pt-BR"), ""],
    ["Faturamento", money(t.faturamento), ""],
    ["Ticket médio", money(t.pedidos ? t.faturamento / t.pedidos : 0), ""],
    ["Preparo médio", minTxt(t.preparo), t.preparo != null ? (t.preparo <= meta ? `dentro da meta de ${meta} min` : `acima da meta de ${meta} min`) : ""],
    ["Entrega/serviço médio", minTxt(t.entrega), "de pronto até o cliente"],
  ].map(([label, value, note]) => `<div class="a-kpi"><span>${label}</span><strong>${value}</strong>${note ? `<small>${esc(note)}</small>` : ""}</div>`).join("");
}

/* ---------------- 1. Linha: vendas por modo ---------------- */

function renderSalesLine() {
  const fig = document.getElementById("chart-sales");
  const rows = relatorio.dias;
  const W = 680, H = 240, L = 64, R = 12, T = 18, B = 30;
  const max = Math.max(1, ...rows.flatMap(r => MODOS.map(m => r.modos[m.id].f)));
  const step = niceStep(max / 4), top = step * 4;
  const x = i => L + (rows.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (rows.length - 1));
  const y = v => T + (H - T - B) * (1 - v / top);
  const every = Math.ceil(rows.length / 10);

  const grid = [0, 1, 2, 3, 4].map(i => `<line x1="${L}" x2="${W - R}" y1="${y(step * i)}" y2="${y(step * i)}" class="c-grid"/>
    <text x="${L - 8}" y="${y(step * i) + 4}" class="c-tick" text-anchor="end">${esc(money(step * i))}</text>`).join("");
  const lines = MODOS.map(m => `<polyline fill="none" stroke="${m.cor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"
    points="${rows.map((r, i) => `${x(i).toFixed(1)},${y(r.modos[m.id].f).toFixed(1)}`).join(" ")}"/>`).join("");
  const hits = rows.map((r, i) => {
    const tip = `${r.label}\n${MODOS.map(m => `${m.nome}: ${money(r.modos[m.id].f)} (${r.modos[m.id].p} ped.)`).join("\n")}\nTotal: ${money(r.faturamento)}`;
    const w = (W - L - R) / rows.length;
    return `<g class="c-col" data-tip="${esc(tip)}"><rect x="${x(i) - w / 2}" y="${T}" width="${w}" height="${H - T - B}" class="c-hit"/>
      ${i % every === 0 ? `<text x="${x(i)}" y="${H - 10}" class="c-tick" text-anchor="middle">${esc(r.label)}</text>` : ""}</g>`;
  }).join("");

  fig.innerHTML = `
    <figcaption class="c-title">Vendas por dia e tipo de atendimento</figcaption>
    ${legendaHTML(MODOS.map(m => [m.nome, m.cor, money(round2(rows.reduce((s, r) => s + r.modos[m.id].f, 0)))]))}
    <div class="c-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Linha de faturamento diário por mesa, retirada e entrega. Valores na tabela do relatório.">
      ${grid}<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" class="c-axis"/>${lines}${hits}</svg><div class="c-tooltip" hidden></div></div>`;
  ligarTooltip(fig);
}

/* ---------------- 2. Barras agrupadas: preparo × entrega ---------------- */

function renderTimesBars() {
  const fig = document.getElementById("chart-times");
  const meta = Number(storeCache?.metaPreparo) || 20;
  const grupos = SEMANA.map(wd => {
    const ds = relatorio.dias.filter(d => d.semana === wd);
    const soma = k => ({ s: ds.reduce((a, d) => a + d[k].s, 0), n: ds.reduce((a, d) => a + d[k].n, 0) });
    return { label: SEMANA_CURTO[wd], preparo: media(soma("preparo")), entrega: media(soma("entrega")), n: soma("preparo").n };
  });
  const W = 680, H = 240, L = 48, R = 12, T = 18, B = 30;
  const max = Math.max(meta, ...grupos.flatMap(g => [g.preparo || 0, g.entrega || 0]));
  const step = niceStep(max / 4), top = step * 4;
  const y = v => T + (H - T - B) * (1 - v / top);
  const slot = (W - L - R) / grupos.length, bw = Math.min(26, slot / 3);
  const series = [["preparo", "Preparo", "var(--brand)"], ["entrega", "Entrega/serviço", "var(--accent)"]];

  const grid = [0, 1, 2, 3, 4].map(i => `<line x1="${L}" x2="${W - R}" y1="${y(step * i)}" y2="${y(step * i)}" class="c-grid"/>
    <text x="${L - 8}" y="${y(step * i) + 4}" class="c-tick" text-anchor="end">${step * i} min</text>`).join("");
  const bars = grupos.map((g, i) => {
    const cx = L + slot * i + slot / 2;
    const tip = `${g.label} (${g.n} pedidos)\nPreparo: ${minTxt(g.preparo)}\nEntrega/serviço: ${minTxt(g.entrega)}`;
    return `<g class="c-col" data-tip="${esc(tip)}"><rect x="${L + slot * i}" y="${T}" width="${slot}" height="${H - T - B}" class="c-hit"/>
      ${series.map(([k, , cor], j) => {
        const v = g[k] || 0, h = Math.max(0, y(0) - y(v)), x0 = cx - bw - 1 + j * (bw + 2);
        return v ? `<path d="M${x0},${y(0)}V${y(v) + 3}q0,-3 3,-3h${bw - 6}q3,0 3,3V${y(0)}Z" fill="${cor}"/>` : "";
      }).join("")}
      <text x="${cx}" y="${H - 10}" class="c-tick" text-anchor="middle">${g.label}</text></g>`;
  }).join("");
  const metaLine = `<line x1="${L}" x2="${W - R}" y1="${y(meta)}" y2="${y(meta)}" class="c-meta"/>
    <text x="${W - R}" y="${y(meta) - 6}" class="c-tick c-meta-label" text-anchor="end">meta de preparo: ${meta} min</text>`;

  fig.innerHTML = `
    <figcaption class="c-title">Tempo médio por pedido: preparo × entrega</figcaption>
    ${legendaHTML(series.map(([, nome, cor]) => [nome, cor, ""]))}
    <div class="c-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Barras do tempo médio de preparo e de entrega por dia da semana, com a meta de preparo.">
      ${grid}<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" class="c-axis"/>${bars}${metaLine}</svg><div class="c-tooltip" hidden></div></div>
    <p class="a-hint">Preparo: do pedido até ficar pronto (ou sair para entrega). Entrega/serviço: de pronto até chegar ao cliente.</p>`;
  ligarTooltip(fig);
}

/* ---------------- 3. Rosca: mais vendidos ---------------- */

function maisVendidos() {
  const soma = new Map();
  relatorio.dias.forEach(d => Object.entries(d.itens).forEach(([nome, v]) => {
    const s = soma.get(nome) || { q: 0, f: 0 };
    s.q += v.q || 0; s.f += v.f || 0;
    soma.set(nome, s);
  }));
  return [...soma.entries()].map(([nome, v]) => ({ nome, q: v.q, f: round2(v.f) })).sort((a, b) => b[roscaPor] - a[roscaPor]);
}

function renderDonut() {
  const fig = document.getElementById("chart-donut");
  const todos = maisVendidos();
  const topo = todos.slice(0, 6);
  const resto = todos.slice(6).reduce((s, x) => ({ q: s.q + x.q, f: s.f + x.f }), { q: 0, f: 0 });
  if (resto[roscaPor] > 0) topo.push({ nome: "Outros", ...resto });
  const total = topo.reduce((s, x) => s + x[roscaPor], 0);
  const fmt = v => (roscaPor === "q" ? `${v.toLocaleString("pt-BR")} un.` : money(v));

  if (!total) {
    fig.innerHTML = `<figcaption class="c-title">Pratos mais vendidos</figcaption><p class="a-empty">Sem vendas finalizadas no período.</p>`;
    return;
  }
  const R = 80, r = 50, C = 100;
  let ang = -Math.PI / 2;
  const fatias = topo.map((x, i) => {
    const a = (x[roscaPor] / total) * Math.PI * 2, a2 = ang + a, big = a > Math.PI ? 1 : 0;
    const p = (rad, ra) => `${(C + Math.cos(rad) * ra).toFixed(2)},${(C + Math.sin(rad) * ra).toFixed(2)}`;
    const d = topo.length === 1
      ? `M${C},${C - R}A${R},${R} 0 1 1 ${C - 0.01},${C - R}L${C - 0.01},${C - r}A${r},${r} 0 1 0 ${C},${C - r}Z`
      : `M${p(ang, R)}A${R},${R} 0 ${big} 1 ${p(a2, R)}L${p(a2, r)}A${r},${r} 0 ${big} 0 ${p(ang, r)}Z`;
    ang = a2;
    return `<path d="${d}" fill="${CORES_ROSCA[i % CORES_ROSCA.length]}" stroke="var(--white)" stroke-width="2"><title>${esc(x.nome)}: ${esc(fmt(x[roscaPor]))} (${pct(x[roscaPor], total)}%)</title></path>`;
  }).join("");

  fig.innerHTML = `
    <figcaption class="c-title">Pratos mais vendidos</figcaption>
    <div class="c-donut">
      <svg viewBox="0 0 200 200" role="img" aria-label="Rosca com a participação dos pratos mais vendidos no período.">
        ${fatias}
        <text x="${C}" y="${C - 4}" text-anchor="middle" class="c-donut-total">${esc(roscaPor === "q" ? total.toLocaleString("pt-BR") : money(total))}</text>
        <text x="${C}" y="${C + 14}" text-anchor="middle" class="c-tick">${roscaPor === "q" ? "unidades" : "faturamento"}</text>
      </svg>
      <ol class="c-donut-legend">
        ${topo.map((x, i) => `<li><i style="background:${CORES_ROSCA[i % CORES_ROSCA.length]}"></i><span>${esc(x.nome)}</span><b>${pct(x[roscaPor], total)}%</b><small>${esc(fmt(x[roscaPor]))}</small></li>`).join("")}
      </ol>
    </div>`;
}

/* ---------------- 4. Estoque: indicadores + mapa de calor ---------------- */

async function loadStock() {
  const wrap = document.getElementById("stock-grid");
  try {
    const snap = await db.collection("produtos").orderBy("ordem").get();
    relatorio.produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    wrap.innerHTML = `<p class="a-error">${esc(err.code || err.message)}</p>`;
    return;
  }
  const comControle = relatorio.produtos.filter(p => p.estoque != null);
  const nivel = p => (Number(p.estoque) <= 0 ? "zerado" : Number(p.estoque) <= Number(p.estoqueMin || 0) ? "baixo" : "ok");
  const conta = n => comControle.filter(p => nivel(p) === n).length;
  document.getElementById("stock-kpis").innerHTML = [
    ["Em estoque", conta("ok"), "ok"], ["Estoque baixo", conta("baixo"), "baixo"], ["Zerados (esgotados)", conta("zerado"), "zerado"],
    ["Sem controle", relatorio.produtos.length - comControle.length, "sem"],
  ].map(([l, v, c]) => `<div class="a-stock-kpi a-stock-kpi--${c}"><strong>${v}</strong><span>${l}</span></div>`).join("");

  wrap.innerHTML = comControle.length
    ? comControle.map(p => {
        const n = nivel(p), cap = Math.max(Number(p.estoqueMin || 0) * 4, 20);
        const calor = Math.min(1, Number(p.estoque) / cap); // 0 = vazio … 1 = cheio
        return `<div class="a-stock-cell a-stock-cell--${n}" style="--calor:${calor.toFixed(2)}">
          <strong>${esc(p.name)}</strong>
          <span>${Number(p.estoque)} un.${p.estoqueMin ? ` · alerta em ${Number(p.estoqueMin)}` : ""}</span>
          <button type="button" class="a-btn a-btn--xs" data-restock="${esc(p.id)}">+10</button>
        </div>`;
      }).join("")
    : `<p class="a-empty">Nenhum produto com controle de estoque. Ative em Cardápio → Editar → Estoque.</p>`;
}

/* ---------------- Tabela, legenda e tooltip ---------------- */

function renderTable() {
  const rows = relatorio.dias.filter(d => d.pedidos);
  document.getElementById("report-table").innerHTML = rows.length ? `
    <table class="a-table">
      <thead><tr><th>Dia</th><th>Pedidos</th><th>Faturamento</th>${MODOS.map(m => `<th>${m.nome}</th>`).join("")}<th>Preparo</th><th>Entrega</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${r.label}</td><td>${r.pedidos}</td><td>${money(r.faturamento)}</td>
        ${MODOS.map(m => `<td>${money(r.modos[m.id].f)}</td>`).join("")}<td>${minTxt(media(r.preparo))}</td><td>${minTxt(media(r.entrega))}</td></tr>`).join("")}</tbody>
    </table>` : `<p class="a-empty">Sem vendas finalizadas no período.</p>`;
}

function legendaHTML(itens) {
  return `<ul class="c-legend">${itens.map(([nome, cor, valor]) => `<li><i style="background:${cor}"></i>${esc(nome)}${valor ? ` <b>${esc(valor)}</b>` : ""}</li>`).join("")}</ul>`;
}

function ligarTooltip(fig) {
  const tooltip = fig.querySelector(".c-tooltip"), wrap = fig.querySelector(".c-wrap");
  fig.querySelectorAll(".c-col").forEach(g => {
    g.addEventListener("pointerenter", () => { g.classList.add("is-hover"); tooltip.hidden = false; tooltip.textContent = g.dataset.tip; });
    g.addEventListener("pointermove", ev => {
      const box = wrap.getBoundingClientRect();
      tooltip.style.left = `${Math.max(4, Math.min(ev.clientX - box.left + 12, box.width - tooltip.offsetWidth - 4))}px`;
      tooltip.style.top = `${ev.clientY - box.top - tooltip.offsetHeight - 10}px`;
    });
    g.addEventListener("pointerleave", () => { g.classList.remove("is-hover"); tooltip.hidden = true; });
  });
}

function niceStep(raw) {
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

/* ---------------- Imprimir / PDF e planilha ---------------- */

function imprimirRelatorio() {
  document.getElementById("report-print-store").textContent = `${restaurantConfig.name} · ${NICHO.nome}`;
  document.getElementById("report-print-date").textContent = new Date().toLocaleString("pt-BR");
  document.body.classList.add("is-printing-report");
  window.print();
  setTimeout(() => document.body.classList.remove("is-printing-report"), 500);
}

function exportarCsv() {
  const num = v => String(round2(v)).replace(".", ","); // Excel em português
  // Texto que começa com = + - @ vira fórmula no Excel: o apóstrofo o mantém como texto
  const cel = v => {
    let t = String(v);
    if (/^[=+\-@\t\r]/.test(t) && !/^-?\d/.test(t)) t = `'${t}`;
    return `"${t.replace(/"/g, '""')}"`;
  };
  const linhas = [
    ["Dia", "Pedidos", "Faturamento", ...MODOS.flatMap(m => [`${m.nome} (pedidos)`, `${m.nome} (R$)`]), "Preparo médio (min)", "Entrega média (min)"],
    ...relatorio.dias.map(r => [r.key, r.pedidos, num(r.faturamento), ...MODOS.flatMap(m => [r.modos[m.id].p, num(r.modos[m.id].f)]),
      media(r.preparo) == null ? "" : Math.round(media(r.preparo)), media(r.entrega) == null ? "" : Math.round(media(r.entrega))]),
    [],
    ["Prato", "Quantidade", "Faturamento"],
    ...maisVendidos().map(x => [x.nome, x.q, num(x.f)]),
  ];
  const csv = "﻿" + linhas.map(l => l.map(cel).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `relatorio-${NICHO_ID}-${relatorio.dias[0]?.key}-a-${relatorio.dias.at(-1)?.key}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------------- Retenção de 90 dias ---------------- */

async function refreshRetention() {
  const el = document.getElementById("retention-summary");
  try {
    const em7 = firebase.firestore.Timestamp.fromMillis(Date.now() + 7 * DIA_MS);
    const snap = await db.collection("pedidos").where("expiraEm", "<", em7).limit(500).get();
    el.innerHTML = snap.size
      ? `<p class="a-alert"><strong>${snap.size}${snap.size === 500 ? "+" : ""} pedido(s)</strong> completam 90 dias nos próximos 7 dias e serão apagados. Imprima ou exporte o relatório antes.</p>`
      : `<p>Nenhum pedido vence nos próximos 7 dias.</p>`;
  } catch (err) {
    el.textContent = `Não foi possível conferir: ${err.code || err.message}`;
  }
}
