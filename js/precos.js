/**
 * precos.js
 * -------------------------------------------------------
 * Regra ÚNICA de preço de um item (tamanho, meio a meio,
 * opções e adicionais). A tela usa para mostrar o valor; o
 * servidor usa para COBRAR — ele recalcula tudo a partir do
 * cardápio e ignora qualquer valor vindo do navegador.
 *
 * escolha = { tamanho, metade, opcoes: [[nomes por grupo]], adicionais: [nomes] }
 * ctx     = { produtos: Map(id → produto), adicionais: [{ name, price }] }
 * Lança Error com a mensagem para o cliente quando algo não vale.
 * -------------------------------------------------------
 */

const round2 = n => Math.round(n * 100) / 100;

/** Prato do dia: o produto só é servido nos dias marcados (0 = domingo). */
function servidoHoje(p, now = new Date()) {
  return !Array.isArray(p.dias) || !p.dias.length || p.dias.includes(now.getDay());
}

const NOMES_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
function diasTexto(dias) {
  return (dias || []).map(d => NOMES_DIAS[d]).join(", ");
}

function precoDoTamanho(p, label) {
  if (Array.isArray(p.sizes) && p.sizes.length) {
    const s = p.sizes.find(x => x.label === label);
    return s ? Number(s.price) : null;
  }
  return Number(p.price);
}

function calcularItem(p, escolha, ctx) {
  const fail = msg => { throw new Error(msg); };
  if (!p) fail("Um dos produtos não existe mais. Atualize a página.");
  if (!p.available) fail(`${p.name} está esgotado.`);
  if (!servidoHoje(p)) fail(`${p.name} só é servido ${diasTexto(p.dias)}.`);

  // ---- Tamanho ----
  const temTamanhos = Array.isArray(p.sizes) && p.sizes.length > 0;
  const tamanho = temTamanhos ? String(escolha.tamanho || "") : "";
  let base = precoDoTamanho(p, tamanho);
  if (base === null || Number.isNaN(base)) fail(`Escolha um tamanho válido para ${p.name}.`);

  // ---- Meio a meio: cobra a metade mais cara ----
  let nome = p.name;
  const metadeId = String(escolha.metade || "");
  if (metadeId) {
    const outra = ctx.produtos.get(metadeId);
    if (!p.meioAMeio || !outra || !outra.meioAMeio || outra.categoriaSlug !== p.categoriaSlug || outra.id === p.id) {
      fail("Combinação meio a meio inválida.");
    }
    if (!outra.available) fail(`${outra.name} está esgotado.`);
    const precoOutra = precoDoTamanho(outra, tamanho);
    if (precoOutra === null || Number.isNaN(precoOutra)) fail(`${outra.name} não tem o tamanho ${tamanho}.`);
    base = Math.max(base, precoOutra);
    nome = `½ ${p.name} + ½ ${outra.name}`;
  }

  // ---- Opções do nicho (ponto, borda, leite…) ----
  const grupos = Array.isArray(p.opcoes) ? p.opcoes : [];
  const escolhidas = Array.isArray(escolha.opcoes) ? escolha.opcoes : [];
  let extras = 0;
  const opcoesTexto = [];
  grupos.forEach((g, gi) => {
    const nomes = [...new Set((Array.isArray(escolhidas[gi]) ? escolhidas[gi] : []).map(String))];
    const min = Number(g.min) || 0, max = Math.max(1, Number(g.max) || 1);
    if (nomes.length < min) fail(min === 1 && max === 1 ? `Escolha: ${g.titulo}.` : `${g.titulo}: escolha pelo menos ${min}.`);
    if (nomes.length > max) fail(`${g.titulo}: no máximo ${max}.`);
    const itens = nomes.map(n => g.itens.find(i => i.nome === n) || fail(`Opção indisponível: ${n}.`));
    extras += itens.reduce((s, i) => s + Number(i.preco || 0), 0);
    if (itens.length) opcoesTexto.push(`${g.titulo}: ${itens.map(i => i.nome).join(", ")}`);
  });
  if (escolhidas.length > grupos.length) fail("Opções inválidas.");

  // ---- Adicionais (lista do nicho) ----
  const nomesAd = Array.isArray(escolha.adicionais) ? [...new Set(escolha.adicionais.map(String))] : [];
  if (nomesAd.length && !p.addons) fail(`${p.name} não aceita adicionais.`);
  if (nomesAd.length > 20) fail("Adicionais demais.");
  const adicionais = nomesAd.map(n => ctx.adicionais.find(a => a.name === n) || fail(`Adicional indisponível: ${n}.`));
  extras += adicionais.reduce((s, a) => s + Number(a.price || 0), 0);

  const unit = round2(base + extras);
  if (!(unit >= 0 && unit <= 10000)) fail("Preço inválido no cardápio.");
  return { nome, tamanho, opcoes: opcoesTexto, adicionais: adicionais.map(a => a.name), unit };
}
