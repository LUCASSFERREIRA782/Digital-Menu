/**
 * data/menu.js
 * -------------------------------------------------------
 * ÚNICO arquivo que precisa ser editado pra adicionar, remover
 * ou alterar produtos. A interface lê esta estrutura e gera os
 * cards automaticamente — nunca duplique HTML manualmente aqui
 * nem em nenhum outro lugar do projeto.
 *
 * Campos de cada produto:
 *   name        — nome do produto
 *   description — descrição curta (1-2 linhas)
 *   price       — número, sem "R$" (ex: 29.90)
 *   image       — caminho da imagem (opcional — sem imagem, mostra um gradiente)
 *   available   — false esconde o preço e mostra "Indisponível"
 *   featured    — true faz o produto aparecer também na seção de destaques
 * -------------------------------------------------------
 */

const menu = {
  categorias: [
    {
      nome: "Aperitivos",
      slug: "aperitivos",
      produtos: [
        { name: "Batata Rústica", description: "Com alecrim e páprica defumada.", price: 18.9, image: "", available: true, featured: false },
        { name: "Isca de Frango", description: "Empanada, com molho barbecue.", price: 21.9, image: "", available: true, featured: false },
        { name: "Bolinho de Bacalhau", description: "6 unidades, com limão siciliano.", price: 26.9, image: "", available: true, featured: true },
        { name: "Pão de Alho na Brasa", description: "4 fatias, queijo derretido.", price: 15.9, image: "", available: true, featured: false },
        { name: "Anéis de Cebola", description: "Empanados, molho da casa.", price: 17.9, image: "", available: false, featured: false },
      ],
    },
    {
      nome: "Pratos Executivos",
      slug: "pratos-executivos",
      produtos: [
        {
          name: "Executivo Frango Grelhado",
          description: "Frango grelhado, arroz, feijão, salada e batata rústica.",
          price: 24.9,
          image: "",
          available: true,
          featured: true,
        },
        {
          name: "Executivo Carne de Panela",
          description: "Carne cozida lentamente, arroz, feijão e legumes salteados.",
          price: 27.9,
          image: "",
          available: true,
          featured: false,
        },
        {
          name: "Executivo Vegetariano",
          description: "Grão-de-bico ao curry, arroz integral e salada colorida.",
          price: 22.9,
          image: "",
          available: true,
          featured: false,
        },
      ],
    },
    {
      nome: "Lanches",
      slug: "lanches",
      produtos: [
        {
          name: "Sanduíche Natural de Frango",
          description: "Pão integral, frango desfiado, cream cheese e folhas.",
          price: 16.9,
          image: "",
          available: true,
          featured: true,
        },
        {
          name: "Wrap de Carne",
          description: "Tortilha, tiras de carne grelhada, queijo e molho especial.",
          price: 18.9,
          image: "",
          available: false,
          featured: false,
        },
      ],
    },
    {
      nome: "Bebidas",
      slug: "bebidas",
      produtos: [
        { name: "Suco Natural 400ml", description: "Sabores do dia — consulte no balcão.", price: 8.5, image: "", available: true, featured: false },
        { name: "Refrigerante Lata", description: "", price: 6.0, image: "", available: true, featured: false },
        { name: "Água com Gás", description: "", price: 4.5, image: "", available: true, featured: false },
      ],
    },
    {
      nome: "Sobremesas",
      slug: "sobremesas",
      produtos: [
        { name: "Pudim de Leite", description: "Receita da casa, calda de caramelo.", price: 9.9, image: "", available: true, featured: true },
        { name: "Brownie com Sorvete", description: "Brownie quente com bola de sorvete de creme.", price: 12.9, image: "", available: true, featured: false },
      ],
    },
  ],
};
