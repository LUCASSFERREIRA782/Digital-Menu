/**
 * admin-exemplo.js
 * -------------------------------------------------------
 * Dados de exemplo da demonstração (botão "Restaurar exemplo")
 * e limpeza dos registros vencidos.
 *
 * Exemplo: cardápio do nicho + 45 dias de pedidos fictícios
 * coerentes (horários, tempos de preparo/entrega, modos de
 * atendimento) e os resumos diários de cada dia — os gráficos
 * já aparecem cheios na apresentação. Repetível: os mesmos
 * números a cada restauração.
 *
 * Retenção: pedidos e resumos valem 90 dias (campo expiraEm).
 * No plano gratuito o banco não apaga sozinho; o painel apaga
 * os vencidos toda vez que é aberto.
 * -------------------------------------------------------
 */

const PAGAMENTOS_EXEMPLO = { local: ["caixa_cartao", "caixa_pix"], retirada: ["caixa_cartao", "caixa_pix"], entrega: ["pix", "maquininha"] };
const exemploSlug = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const diaChave = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Números "aleatórios" repetíveis (mesma amostra toda vez). */
function exemploRng(seedText) {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) { h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Monta tudo em memória: { categorias, produtos, config, pedidos, resumos } (id → dados). */
function montarExemplo() {
  const rand = exemploRng(NICHO_ID);
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const ts = ms => firebase.firestore.Timestamp.fromMillis(ms);
  const out = { categorias: {}, produtos: {}, config: {}, pedidos: {}, resumos: {} };

  let ordem = 0;
  NICHO.categorias.forEach((cat, ci) => {
    const slug = exemploSlug(cat.nome);
    out.categorias[slug] = { nome: cat.nome, slug, ordem: ci };
    cat.produtos.forEach((p, pi) => {
      // Estoque controlado no 1º produto de cada categoria (melhoria A); os demais sem controle
      const controla = pi === 0;
      const estoque = controla ? [32, 4, 0, 18, 9, 25, 2][ci % 7] : null;
      out.produtos[`${slug}-${exemploSlug(p.name)}`] = {
        name: p.name, description: p.description || "",
        price: p.sizes?.length ? Math.min(...p.sizes.map(s => s.price)) : p.price,
        sizes: p.sizes || [], addons: Boolean(p.addons), opcoes: p.opcoes || [], meioAMeio: Boolean(p.meioAMeio), dias: p.dias || [],
        available: p.available !== false && estoque !== 0, featured: Boolean(p.featured), image: "", foto: 0,
        estoque, estoqueMin: controla ? 5 : null,
        categoriaSlug: slug, ordem: ordem++,
      };
    });
  });

  out.config.adicionais = { itens: NICHO.adicionais };
  out.config.deliveryFees = { ativo: true, retirada: true, modo: "bairro", taxaFixa: 6, bairros: BAIRROS_EXEMPLO };
  out.config.loja = {
    nome: "Ponto Expresso", slogan: NICHO.kicker, endereco: "Rua do Exemplo, 100 · Centro", instagram: "",
    horarios: NICHO.horarios, whatsapps: [], metaPreparo: 20,
    statusManual: "aberto", // aberto na apresentação a qualquer hora; "Seguir horários" mostra o automático
  };
  out.config.equipe = { whatsapps: [] };
  out.config.mesas = { quantidade: 12 };

  // ---- 45 dias de pedidos finalizados + resumos do dia ----
  const vendaveis = Object.entries(out.produtos).filter(([, p]) => p.available && !p.dias.length);
  const apelidos = ["Ana", "Bruno", "Carla", "Diego", "Eva", "Felipe", "Gabi", "Hugo", "Iris", "João", "Lia", "Marcos", "Nina", "Otávio", "Paula", "Rafa", "Sofia", "Téo"];
  const modos = ["local", "local", "retirada", "entrega", "entrega"];
  const codigo = () => Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(rand() * 32)]).join("");
  const minutos = (a, b) => (a + rand() * (b - a)) * 60_000;

  const pedidoFicticio = (quando, status) => {
    const modo = pick(modos);
    const itens = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => {
      const [id, p] = pick(vendaveis);
      const s = p.sizes.length ? pick(p.sizes) : null;
      return { id, nome: p.name, tamanho: s ? s.label : "", opcoes: [], adicionais: [], obs: "", qtd: rand() < 0.75 ? 1 : 2, unit: s ? s.price : p.price };
    });
    const subtotal = round2(itens.reduce((s, i) => s + i.unit * i.qtd, 0));
    const b = modo === "entrega" ? pick(BAIRROS_EXEMPLO) : null;
    const taxaEntrega = b ? b.taxa : 0;
    const o = {
      codigo: codigo(), modo, pagamento: pick(PAGAMENTOS_EXEMPLO[modo]), apelido: pick(apelidos),
      mesa: modo === "local" ? String(1 + Math.floor(rand() * 12)) : "", bairro: b ? b.nome : "",
      itens, subtotal, taxaEntrega, total: round2(subtotal + taxaEntrega),
      status, pago: status !== "novo", criadoEm: ts(quando), expiraEm: ts(quando + RETENCAO_DIAS * DIA_MS),
    };
    // Linha do tempo realista: fila + preparo, depois servir/retirar/entregar
    if (status !== "novo") {
      const comeca = quando + minutos(1, 6);
      const pronto = comeca + minutos(8, modo === "entrega" ? 24 : 18);
      const fim = pronto + (modo === "entrega" ? minutos(12, 35) : minutos(2, 8));
      o.preparoEm = ts(comeca);
      if (["pronto", "saiu", "concluido"].includes(status)) o[modo === "entrega" ? "saiuEm" : "prontoEm"] = ts(pronto);
      if (status === "concluido") o.concluidoEm = ts(fim);
      if (status === "cancelado") { delete o.preparoEm; o.canceladoEm = ts(comeca); }
    }
    return o;
  };

  const hoje = new Date();
  for (let diasAtras = 45; diasAtras >= 1; diasAtras--) {
    const dia = new Date(hoje);
    dia.setDate(hoje.getDate() - diasAtras);
    const fimDeSemana = [5, 6, 0].includes(dia.getDay());
    const n = Math.round((fimDeSemana ? 9 : 4) + rand() * (fimDeSemana ? 8 : 6));
    for (let i = 0; i < n; i++) {
      const quando = new Date(dia);
      quando.setHours(11 + Math.floor(rand() * 11), Math.floor(rand() * 60), 0, 0);
      const o = pedidoFicticio(quando.getTime(), rand() < 0.05 ? "cancelado" : "concluido");
      out.pedidos[`exemplo-${diaChave(dia)}-${i}`] = o;
      if (o.status === "concluido") somarNoResumo(out.resumos, o);
    }
  }
  // Três pedidos em andamento para o quadro não começar vazio
  const agora = Date.now();
  [["novo", 3], ["preparo", 11], ["pronto", 19]].forEach(([status, minAtras], i) => {
    const o = pedidoFicticio(agora - minAtras * 60_000, status);
    if (status === "pronto" && o.modo === "entrega") { o.status = "saiu"; o.saiuEm = o.prontoEm; delete o.prontoEm; }
    out.pedidos[`exemplo-hoje-${i}`] = o;
  });
  return out;
}

/** Soma um pedido finalizado no resumo do dia (em memória, para o exemplo). */
function somarNoResumo(resumos, o) {
  const criado = o.criadoEm.toMillis();
  const dia = diaChave(new Date(criado));
  const r = resumos[dia] ||= {
    dia, pedidos: 0, faturamento: 0, modos: {}, itens: {}, tempos: { preparo: { s: 0, n: 0 }, entrega: { s: 0, n: 0 } },
    expiraEm: firebase.firestore.Timestamp.fromMillis(new Date(`${dia}T12:00:00`).getTime() + RETENCAO_DIAS * DIA_MS),
  };
  r.pedidos += 1;
  r.faturamento = round2(r.faturamento + o.total);
  const m = r.modos[o.modo] ||= { p: 0, f: 0 };
  m.p += 1; m.f = round2(m.f + o.total);
  o.itens.forEach(i => {
    const it = r.itens[i.nome] ||= { q: 0, f: 0 };
    it.q += i.qtd; it.f = round2(it.f + i.unit * i.qtd);
  });
  const t = temposDoPedido(o);
  if (t.preparo != null) { r.tempos.preparo.s += t.preparo; r.tempos.preparo.n += 1; }
  if (t.entrega != null) { r.tempos.entrega.s += t.entrega; r.tempos.entrega.n += 1; }
}

/**
 * Tempos do pedido, em minutos:
 *   preparo = do pedido até ficar pronto (mesa/retirada) ou sair (entrega);
 *   entrega = de pronto/saiu até servido/retirado/entregue.
 */
function temposDoPedido(o) {
  const ms = v => v?.toMillis?.() ?? null;
  const criado = ms(o.criadoEm), pronto = ms(o.prontoEm) ?? ms(o.saiuEm), fim = ms(o.concluidoEm);
  return {
    preparo: criado && pronto ? Math.round((pronto - criado) / 60_000) : null,
    entrega: pronto && fim ? Math.round((fim - pronto) / 60_000) : null,
  };
}

/** Apaga todos os documentos de uma subcoleção do nicho (em lotes). */
async function apagarColecao(nome) {
  for (;;) {
    const snap = await db.collection(nome).limit(400).get();
    if (snap.empty) return;
    const b = db.batch();
    snap.docs.forEach(d => b.delete(d.ref));
    await b.commit();
  }
}

/** "Restaurar exemplo": apaga o nicho atual e grava a amostra de novo. */
async function restaurarExemplo(onProgress = () => {}) {
  onProgress("Apagando dados atuais…");
  for (const c of ["pedidos", "resumos", "produtos", "categorias", "fotos", "config"]) await apagarColecao(c);
  const dados = montarExemplo();
  const ops = [];
  for (const [col, docs] of Object.entries(dados)) for (const [id, d] of Object.entries(docs)) ops.push([col, id, d]);
  for (let i = 0; i < ops.length; i += 400) {
    onProgress(`Gravando exemplo… ${Math.min(100, Math.round(((i + 400) / ops.length) * 100))}%`);
    const b = db.batch();
    ops.slice(i, i + 400).forEach(([col, id, d]) => b.set(db.collection(col).doc(id), d));
    await b.commit();
  }
  await firestore.collection("nichos").doc(NICHO_ID).set({ nome: NICHO.nome, restauradoEm: firebase.firestore.FieldValue.serverTimestamp() });
}

/** Retenção de 90 dias: apaga pedidos e resumos vencidos deste nicho. */
async function apagarVencidos() {
  const agora = firebase.firestore.Timestamp.now();
  let total = 0;
  for (const col of ["pedidos", "resumos"]) {
    for (;;) {
      const snap = await db.collection(col).where("expiraEm", "<", agora).limit(400).get();
      if (snap.empty) break;
      const b = db.batch();
      snap.docs.forEach(d => b.delete(d.ref));
      await b.commit();
      total += snap.size;
    }
  }
  return total;
}
