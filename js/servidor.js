/**
 * servidor.js
 * -------------------------------------------------------
 * Criação do pedido na demonstração (plano gratuito, sem Cloud
 * Functions). Mesma regra da açaiteria: o pedido é montado a partir
 * do cardápio carregado ao vivo (precos.js) e gravado de uma vez —
 * 1 escrita, sem leituras extras, para o envio ser imediato.
 *
 * As regras do banco recusam qualquer pedido fora do formato
 * (campos, tamanhos, quantidades, status inicial, data do servidor
 * e validade de 90 dias). Na versão de cada cliente (plano Blaze)
 * o preço é recalculado numa Cloud Function, como na açaiteria.
 * -------------------------------------------------------
 */

const PAGAMENTOS_POR_MODO = {
  local: ["caixa_cartao", "caixa_pix"],
  retirada: ["caixa_cartao", "caixa_pix"],
  entrega: ["pix", "maquininha"],
};
const MAX_LINHAS = 10, MAX_QTD = 20;

function servidorFalha(msg, code = "invalid-argument") {
  throw Object.assign(new Error(msg), { code: `functions/${code}` });
}
const texto = (v, max) => String(v ?? "").trim().slice(0, max);

function codigoPedido() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return [...crypto.getRandomValues(new Uint8Array(4))].map(b => chars[b % chars.length]).join("");
}

const Servidor = {
  async criarPedido(d) {
    if (!catalog.online) servidorFalha("O cardápio ainda está carregando. Tente de novo.", "failed-precondition");

    // ---- 1. Dados do cliente ----
    const modo = Object.prototype.hasOwnProperty.call(PAGAMENTOS_POR_MODO, d.modo) ? d.modo : servidorFalha("Escolha como vai receber o pedido.");
    const pagamento = PAGAMENTOS_POR_MODO[modo].includes(d.pagamento) ? d.pagamento : servidorFalha("Forma de pagamento inválida para essa modalidade.");
    const apelido = texto(d.apelido, 30);
    if (apelido.length < 2) servidorFalha("Diga como podemos te chamar.");
    const mesa = modo === "local" ? texto(d.mesa, 6) : "";
    const linhas = Array.isArray(d.itens) ? d.itens : [];
    if (!linhas.length || linhas.length > MAX_LINHAS) servidorFalha(`A comanda precisa ter de 1 a ${MAX_LINHAS} itens.`);

    if (!storeStatus().open) servidorFalha("A loja está fechada agora.", "failed-precondition");
    const entrega = catalog.delivery;
    if (modo === "retirada" && !entrega.retirada) servidorFalha("A retirada no balcão está pausada.", "failed-precondition");

    // ---- 2. Preços do cardápio carregado ao vivo ----
    const ctx = { produtos: catalog.todos, adicionais: catalog.adicionais };
    const itens = linhas.map(l => {
      const qtd = Number(l?.qtd);
      if (!Number.isInteger(qtd) || qtd < 1 || qtd > MAX_QTD) servidorFalha("Quantidade inválida.");
      const id = texto(l.productId, 80);
      let calc;
      try {
        calc = calcularItem(catalog.todos.get(id), {
          tamanho: texto(l.tamanho, 40),
          metade: texto(l.metade, 80),
          opcoes: Array.isArray(l.opcoes) ? l.opcoes.slice(0, 10).map(g => (Array.isArray(g) ? g.slice(0, 12).map(n => texto(n, 40)) : [])) : [],
          adicionais: Array.isArray(l.adicionais) ? l.adicionais.slice(0, 20).map(n => texto(n, 40)) : [],
        }, ctx);
      } catch (err) {
        servidorFalha(err.message, "failed-precondition");
      }
      return { id, nome: texto(calc.nome, 120), tamanho: calc.tamanho, opcoes: calc.opcoes.map(o => texto(o, 120)).slice(0, 10), adicionais: calc.adicionais, obs: texto(l.obs, 120), qtd, unit: calc.unit };
    });

    // ---- 3. Taxa da configuração do painel ----
    let bairro = "", taxaEntrega = 0;
    if (modo === "entrega") {
      if (!entrega.ativo) servidorFalha("A entrega está pausada no momento.", "failed-precondition");
      if (entrega.modo === "bairro") {
        const b = (entrega.bairros || []).find(x => x.nome === d.bairro);
        if (!b) servidorFalha("Escolha um bairro da lista de entrega.");
        bairro = b.nome;
        taxaEntrega = round2(Number(b.taxa || 0));
      } else {
        bairro = texto(d.bairro, 40);
        taxaEntrega = round2(Number(entrega.taxaFixa || 0));
      }
    }

    const subtotal = round2(itens.reduce((s, i) => s + i.unit * i.qtd, 0));
    const total = round2(subtotal + taxaEntrega);

    // ---- 4. WhatsApp que recebe o endereço (sorteado na equipe) ----
    const whats = restaurantConfig.whatsapps || [];
    const atendente = modo === "entrega" && whats.length ? whats[Math.floor(Math.random() * whats.length)] : null;

    const ref = db.collection("pedidos").doc();
    const codigo = codigoPedido();
    const order = {
      codigo, modo, pagamento, apelido, mesa, bairro, itens,
      subtotal, taxaEntrega, total, status: "novo", pago: false,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      expiraEm: expiraEm(),
    };
    if (atendente?.nome) order.atendente = texto(atendente.nome, 30);
    try {
      await ref.set(order);
    } catch (err) {
      console.error("Pedido recusado:", err.code, err.message);
      servidorFalha("Não conseguimos registrar o pedido. Confira os itens e tente de novo.", "failed-precondition");
    }
    return {
      id: ref.id, codigo, itens, subtotal, taxaEntrega, total, bairro,
      atendente: atendente ? { nome: atendente.nome, numero: atendente.numero } : null,
    };
  },

  // Pix copia e cola: na demonstração NÃO existe chave Pix (nem de exemplo).
  gerarPix() {
    servidorFalha("Na demonstração o Pix não é gerado. Na versão da sua loja, o código com o valor certo aparece aqui.", "failed-precondition");
  },
};
