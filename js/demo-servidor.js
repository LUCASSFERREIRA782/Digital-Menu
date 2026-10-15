/**
 * demo-servidor.js
 * -------------------------------------------------------
 * As "Cloud Functions" da demonstração: mesma lógica do
 * servidor da açaiteria (functions/pedidos.js), rodando no
 * navegador. O cliente manda só ESCOLHAS; preço, taxa e
 * código do pedido saem daqui, lidos do cardápio salvo.
 *
 * Também gera a amostra inicial de cada nicho, com um
 * histórico de pedidos fictícios para o relatório não
 * começar vazio na apresentação.
 * -------------------------------------------------------
 */

const PAGAMENTOS_POR_MODO = {
  local: ["caixa_cartao", "caixa_pix"],
  retirada: ["caixa_cartao", "caixa_pix"],
  entrega: ["pix", "maquininha"],
};
const MAX_LINHAS = 10, MAX_QTD = 20;

function demoFail(msg, code = "invalid-argument") {
  throw Object.assign(new Error(msg), { code: `functions/${code}` });
}
const demoText = (v, max) => String(v ?? "").trim().slice(0, max);

function demoOrderCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return [...crypto.getRandomValues(new Uint8Array(4))].map(b => chars[b % chars.length]).join("");
}

/** Mesma regra do site (utils.js → openStatus), com o "abrir/fechar agora" do painel. */
function demoLojaAberta(loja) {
  if (loja.statusManual === "aberto") return true;
  if (loja.statusManual === "fechado") return false;
  const hours = Array.isArray(loja.horarios) && loja.horarios.length ? loja.horarios : restaurantConfig.hours;
  return openStatus(hours).open;
}

const DemoServer = {
  criarPedido(d) {
    const cols = DemoStore.state.cols;
    const cfg = id => decodeValue(cols.config?.[id] || {});

    // ---- 1. Dados do cliente ----
    const modo = Object.prototype.hasOwnProperty.call(PAGAMENTOS_POR_MODO, d.modo) ? d.modo : demoFail("Escolha como vai receber o pedido.");
    const pagamento = PAGAMENTOS_POR_MODO[modo].includes(d.pagamento) ? d.pagamento : demoFail("Forma de pagamento inválida para essa modalidade.");
    const apelido = demoText(d.apelido, 30);
    if (apelido.length < 2) demoFail("Diga como podemos te chamar.");
    const mesa = modo === "local" ? demoText(d.mesa, 10) : "";
    const linhas = Array.isArray(d.itens) ? d.itens : [];
    if (!linhas.length || linhas.length > MAX_LINHAS) demoFail(`A comanda precisa ter de 1 a ${MAX_LINHAS} itens.`);

    const loja = cfg("loja");
    if (!demoLojaAberta(loja)) demoFail("A loja está fechada agora.", "failed-precondition");

    const entrega = cfg("deliveryFees");
    if (modo === "retirada" && !entrega.retirada) demoFail("A retirada no balcão está pausada.", "failed-precondition");

    // ---- 2. Preços sempre do cardápio salvo ----
    const produtos = new Map(Object.entries(cols.produtos || {}).map(([id, p]) => [id, { id, ...decodeValue(p) }]));
    const ctx = { produtos, adicionais: cfg("adicionais").itens || [] };
    const itens = linhas.map(l => {
      const qtd = Number(l?.qtd);
      if (!Number.isInteger(qtd) || qtd < 1 || qtd > MAX_QTD) demoFail("Quantidade inválida.");
      let calc;
      try {
        calc = calcularItem(produtos.get(demoText(l.productId, 80)), {
          tamanho: demoText(l.tamanho, 40),
          metade: demoText(l.metade, 80),
          opcoes: Array.isArray(l.opcoes) ? l.opcoes.slice(0, 10).map(g => (Array.isArray(g) ? g.slice(0, 12).map(n => demoText(n, 40)) : [])) : [],
          adicionais: Array.isArray(l.adicionais) ? l.adicionais.slice(0, 21).map(n => demoText(n, 40)) : [],
        }, ctx);
      } catch (err) {
        demoFail(err.message, "failed-precondition");
      }
      return { ...calc, obs: demoText(l.obs, 120), qtd };
    });

    // ---- 3. Taxa sempre da configuração do painel ----
    let bairro = "", taxaEntrega = 0;
    if (modo === "entrega") {
      if (!entrega.ativo) demoFail("A entrega está pausada no momento.", "failed-precondition");
      if (entrega.modo === "bairro") {
        const b = (entrega.bairros || []).find(x => x.nome === d.bairro);
        if (!b) demoFail("Escolha um bairro da lista de entrega.");
        bairro = b.nome;
        taxaEntrega = round2(Number(b.taxa || 0));
      } else {
        bairro = demoText(d.bairro, 40);
        taxaEntrega = round2(Number(entrega.taxaFixa || 0));
      }
    }

    const subtotal = round2(itens.reduce((s, i) => s + i.unit * i.qtd, 0));
    const total = round2(subtotal + taxaEntrega);

    // ---- 4. WhatsApp que recebe o endereço (sorteado na equipe) ----
    const whats = Array.isArray(loja.whatsapps) ? loja.whatsapps : [];
    const atendente = modo === "entrega" && whats.length ? whats[Math.floor(Math.random() * whats.length)] : null;

    const id = newId();
    const codigo = demoOrderCode();
    const order = {
      codigo, modo, pagamento, apelido, mesa, bairro, itens,
      subtotal, taxaEntrega, total, status: "novo", pago: false,
      criadoEm: SERVER_TS,
    };
    if (atendente?.nome) order.atendente = demoText(atendente.nome, 30);
    DemoStore.commit(s => demoApplySet(s, "pedidos", id, order));

    return {
      id, codigo, itens, subtotal, taxaEntrega, total, bairro,
      atendente: atendente ? { nome: atendente.nome, numero: atendente.numero } : null,
    };
  },

  // Pix copia e cola: na demonstração NÃO existe chave Pix (nem de exemplo),
  // para nenhum código "pagável" circular por aí. A tela explica isso.
  gerarPix() {
    demoFail("Na demonstração o Pix não é gerado. Na versão da sua loja, o código com o valor certo aparece aqui.", "failed-precondition");
  },
};

/* ---------------- Amostra inicial ---------------- */

const demoSlug = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Números "aleatórios" repetíveis: a mesma amostra toda vez que restaurar. */
function demoRng(seedText) {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) { h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function demoSeed() {
  const cols = { categorias: {}, produtos: {}, config: {}, pedidos: {}, relatorios: {} };
  const ts = ms => ({ __ts: ms });
  let ordem = 0;

  NICHO.categorias.forEach((cat, ci) => {
    const slug = demoSlug(cat.nome);
    cols.categorias[slug] = { nome: cat.nome, slug, ordem: ci };
    cat.produtos.forEach(p => {
      const id = `${slug}-${demoSlug(p.name)}`;
      cols.produtos[id] = {
        name: p.name, description: p.description || "", price: p.sizes?.length ? Math.min(...p.sizes.map(s => s.price)) : p.price,
        sizes: p.sizes || [], addons: Boolean(p.addons), opcoes: p.opcoes || [], meioAMeio: Boolean(p.meioAMeio), dias: p.dias || [],
        available: p.available !== false, featured: Boolean(p.featured), image: "",
        categoriaSlug: slug, ordem: ordem++,
      };
    });
  });

  cols.config.adicionais = { itens: NICHO.adicionais };
  cols.config.deliveryFees = { ativo: true, retirada: true, modo: "bairro", taxaFixa: 6, bairros: BAIRROS_EXEMPLO };
  cols.config.loja = {
    nome: restaurantConfig.name, slogan: NICHO.kicker, endereco: restaurantConfig.address,
    instagram: "", horarios: NICHO.horarios, whatsapps: [],
    // Demonstração começa "aberta agora" para dar para pedir a qualquer hora na apresentação.
    // Para mostrar o abre/fecha automático: painel → Loja e equipe → "Seguir horários".
    statusManual: "aberto",
  };
  cols.config.equipe = { whatsapps: [] };
  cols.config.mesas = { quantidade: 12 };

  // ---- Histórico fictício: 45 dias de pedidos finalizados ----
  const rand = demoRng(NICHO_ID);
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const vendaveis = Object.values(cols.produtos).filter(p => p.available && !p.dias.length);
  const apelidos = ["Ana", "Bruno", "Carla", "Diego", "Eva", "Felipe", "Gabi", "Hugo", "Iris", "João", "Lia", "Marcos", "Nina", "Otávio", "Paula", "Rafa", "Sofia", "Téo"];
  const modos = ["local", "local", "retirada", "entrega", "entrega"];

  const linhaFicticia = () => {
    const p = pick(vendaveis);
    const s = p.sizes.length ? pick(p.sizes) : null;
    const qtd = rand() < .75 ? 1 : 2;
    const unit = s ? s.price : p.price;
    return { nome: p.name, tamanho: s ? s.label : "", opcoes: [], adicionais: [], obs: "", qtd, unit };
  };
  const pedidoFicticio = (quando, status) => {
    const modo = pick(modos);
    const itens = Array.from({ length: 1 + Math.floor(rand() * 3) }, linhaFicticia);
    const subtotal = round2(itens.reduce((s, i) => s + i.unit * i.qtd, 0));
    const b = modo === "entrega" ? pick(BAIRROS_EXEMPLO) : null;
    const taxaEntrega = b ? b.taxa : 0;
    return {
      codigo: Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(rand() * 32)]).join(""),
      modo, pagamento: pick(PAGAMENTOS_POR_MODO[modo]), apelido: pick(apelidos),
      mesa: modo === "local" ? String(1 + Math.floor(rand() * 12)) : "", bairro: b ? b.nome : "",
      itens, subtotal, taxaEntrega, total: round2(subtotal + taxaEntrega),
      status, pago: status !== "novo", criadoEm: ts(quando),
    };
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
      cols.pedidos[newId()] = pedidoFicticio(quando.getTime(), rand() < .05 ? "cancelado" : "concluido");
    }
  }

  // ---- Três pedidos em andamento para o quadro não começar vazio ----
  const agora = Date.now();
  [["novo", 3], ["preparo", 11], ["pronto", 19]].forEach(([status, minAtras]) => {
    cols.pedidos[newId()] = pedidoFicticio(agora - minAtras * 60000, status);
  });
  Object.values(cols.pedidos).forEach(o => { if (o.status === "pronto" && o.modo === "entrega") o.status = "saiu"; });

  return { versao: 1, criadoEm: Date.now(), cols };
}
