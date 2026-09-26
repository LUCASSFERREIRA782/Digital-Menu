/**
 * config.js
 * -------------------------------------------------------
 * Tudo que identifica o restaurante fica aqui. Nada disso
 * deve aparecer hardcoded em nenhum outro arquivo — o app.js
 * lê este objeto e preenche o HTML.
 * -------------------------------------------------------
 */

const restaurantConfig = {
  name: "Ponto Expresso",
  shortMark: "PE", // iniciais usadas no ícone do header
  slogan: "No ponto certo, na velocidade certa.",
  description: "Pratos executivos, lanches e bebidas — pedido rápido, sabor de verdade.",

  phone: "(11) 97777-7777",
  whatsapp: "5511977777777",
  instagram: "https://instagram.com/pontoexpresso",

  address: "Vila Luzita, Santo André — SP",
  hours: [
    { day: "Segunda a Sexta", time: "11h às 15h · 18h às 22h" },
    { day: "Sábado", time: "11h às 16h" },
    { day: "Domingo", time: "Fechado" },
  ],

  pix: {
    key: "11977777777", // exemplo — trocar pela chave real do restaurante
    keyType: "Telefone",
    receiverName: "Ponto Expresso Ltda",
  },

  seo: {
    title: "Ponto Expresso — Cardápio Digital",
    description: "Cardápio digital do Ponto Expresso — pratos executivos, lanches e bebidas em Santo André.",
  },
};
