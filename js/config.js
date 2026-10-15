/**
 * config.js
 * -------------------------------------------------------
 * Identidade da loja de exemplo. O painel (Loja e equipe)
 * pode sobrescrever nome, frase, endereço e horários.
 * Nenhum dado real: telefone e endereço são fictícios e,
 * enquanto nenhum WhatsApp for cadastrado no painel, as
 * mensagens só aparecem em prévia (nada é enviado).
 * -------------------------------------------------------
 */

const restaurantConfig = {
  name: "Ponto Expresso",
  slogan: NICHO.kicker,
  whatsapp: "",                       // vazio = prévia da mensagem, sem abrir o WhatsApp
  instagram: "",
  address: "Rua do Exemplo, 100 · Centro",
  hours: NICHO.horarios,
  seo: {
    title: `Ponto Expresso — ${NICHO.nome}`,
    description: `Cardápio digital de exemplo (${NICHO.nome.toLowerCase()}): peça na mesa, retire no balcão ou receba em casa.`,
  },
};
