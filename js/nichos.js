/**
 * nichos.js
 * -------------------------------------------------------
 * Amostra multi-nicho do "Ponto Expresso" (nome fictício).
 * Cada nicho define: textos do topo, cena 3D, cardápio de
 * exemplo, adicionais, bairros de entrega e horários.
 * As cores e a fonte de cada nicho ficam em css/tokens.css.
 *
 * Produto:
 *   name, description, price         — básico
 *   sizes: [{ label, price }]         — tamanhos (substituem o preço)
 *   addons: true                      — aceita os adicionais do nicho
 *   opcoes: [{ titulo, min, max, itens: [{ nome, preco }] }]
 *                                     — escolhas do nicho (ponto da carne, borda…)
 *                                       min ≥ 1 = obrigatório; max 1 = escolha única
 *   (nicho) foto: "assets/hero/…" — foto real do topo; créditos em assets/hero/creditos-fotos.json
 *   meioAMeio: true                   — pizza: pode ter metade de outro sabor
 *                                       (cobra o maior preço entre as metades)
 *   dias: [1, 3]                      — prato do dia: só aparece nesses dias (0 = domingo)
 *   available, featured
 *
 * Nenhum dado real: nomes, telefones e endereços são de exemplo.
 * -------------------------------------------------------
 */

const HORARIO_ALMOCO_JANTAR = [
  { label: "Segunda", day: 1, open: "11:00", close: "23:00" },
  { label: "Terça",   day: 2, open: "11:00", close: "23:00" },
  { label: "Quarta",  day: 3, open: "11:00", close: "23:00" },
  { label: "Quinta",  day: 4, open: "11:00", close: "23:00" },
  { label: "Sexta",   day: 5, open: "11:00", close: "23:59" },
  { label: "Sábado",  day: 6, open: "11:00", close: "23:59" },
  { label: "Domingo", day: 0, open: "11:00", close: "22:00" },
];

const HORARIO_NOITE = [
  { label: "Segunda", day: 1 },
  { label: "Terça",   day: 2, open: "18:00", close: "23:30" },
  { label: "Quarta",  day: 3, open: "18:00", close: "23:30" },
  { label: "Quinta",  day: 4, open: "18:00", close: "23:30" },
  { label: "Sexta",   day: 5, open: "18:00", close: "01:00" },
  { label: "Sábado",  day: 6, open: "18:00", close: "01:00" },
  { label: "Domingo", day: 0, open: "18:00", close: "23:30" },
];

const HORARIO_DIA = [
  { label: "Segunda", day: 1, open: "07:00", close: "20:00" },
  { label: "Terça",   day: 2, open: "07:00", close: "20:00" },
  { label: "Quarta",  day: 3, open: "07:00", close: "20:00" },
  { label: "Quinta",  day: 4, open: "07:00", close: "20:00" },
  { label: "Sexta",   day: 5, open: "07:00", close: "21:00" },
  { label: "Sábado",  day: 6, open: "08:00", close: "21:00" },
  { label: "Domingo", day: 0, open: "08:00", close: "18:00" },
];

const BAIRROS_EXEMPLO = [
  { nome: "Centro", taxa: 5 },
  { nome: "Vila Nova", taxa: 6 },
  { nome: "Jardim das Flores", taxa: 7.5 },
  { nome: "Parque Industrial", taxa: 9 },
];

const PONTO_CARNE = { titulo: "Ponto da carne", min: 1, max: 1, itens: [
  { nome: "Mal passado", preco: 0 }, { nome: "Ao ponto", preco: 0 }, { nome: "Bem passado", preco: 0 },
] };

const NICHOS = {
  restaurante: {
    nome: "Restaurante",
    resumo: "Pratos executivos e prato do dia",
    cena: "cloche",
    foto: "assets/hero/restaurante.webp",   // foto real (CC0) com profundidade; sem ela, usa a cena desenhada
    kicker: "Cozinha de verdade, sem enrolação",
    titulo: "Comida de <em>casa</em>, no ritmo do seu dia.",
    tags: ["Prato do dia", "Peça na mesa", "Entrega e retirada"],
    horarios: HORARIO_ALMOCO_JANTAR,
    adicionais: [
      { name: "Ovo frito", price: 3, group: "Acompanhamentos" },
      { name: "Porção extra de arroz", price: 4, group: "Acompanhamentos" },
      { name: "Farofa da casa", price: 3.5, group: "Acompanhamentos" },
      { name: "Vinagrete", price: 2.5, group: "Acompanhamentos" },
    ],
    categorias: [
      { nome: "Prato do dia", produtos: [
        { name: "Feijoada completa", description: "Com arroz, couve, farofa, torresmo e laranja.", price: 39.9, dias: [3, 6], featured: true, addons: true },
        { name: "Virado à paulista", description: "Bisteca, tutu, couve, ovo, banana e torresmo.", price: 36.9, dias: [1], addons: true },
        { name: "Macarrão com frango", description: "Molho de tomate fresco e parmesão.", price: 31.9, dias: [2], addons: true },
        { name: "Bife à rolê", description: "Com purê de batata e arroz soltinho.", price: 37.9, dias: [4], addons: true },
        { name: "Peixe ao molho de coco", description: "Arroz branco e pirão.", price: 41.9, dias: [5], addons: true },
        { name: "Lasanha da casa", description: "Bolonhesa com bechamel, salada verde.", price: 38.9, dias: [0], addons: true },
      ] },
      { nome: "Pratos executivos", produtos: [
        { name: "Parmegiana de frango", description: "Arroz, fritas e salada.", price: 34.9, featured: true, addons: true },
        { name: "Contra-filé acebolado", description: "Arroz, feijão, fritas e salada.", price: 42.9, opcoes: [PONTO_CARNE], addons: true },
        { name: "Strogonoff de carne", description: "Arroz branco e batata palha.", price: 36.9, addons: true },
        { name: "Salmão grelhado", description: "Legumes salteados e arroz de brócolis.", price: 54.9, addons: true },
        { name: "Omelete da casa", description: "Queijo, tomate e ervas. Com salada.", price: 26.9, available: false },
      ] },
      { nome: "Saladas", produtos: [
        { name: "Caesar com frango", description: "Alface americana, croutons e molho caesar.", price: 29.9,
          opcoes: [{ titulo: "Molho", min: 1, max: 1, itens: [{ nome: "Caesar", preco: 0 }, { nome: "Mostarda e mel", preco: 0 }, { nome: "Azeite e limão", preco: 0 }] }] },
        { name: "Salada tropical", description: "Folhas, manga, palmito e castanhas.", price: 27.9 },
      ] },
      { nome: "Sobremesas", produtos: [
        { name: "Pudim de leite", description: "Fatia generosa com calda de caramelo.", price: 12.9 },
        { name: "Mousse de maracujá", description: "Feito no dia.", price: 11.9 },
      ] },
      { nome: "Bebidas", produtos: [
        { name: "Suco natural", description: "Laranja, limão ou abacaxi com hortelã.", price: 9.9,
          sizes: [{ label: "300 ml", price: 9.9 }, { label: "500 ml", price: 13.9 }] },
        { name: "Refrigerante lata", description: "350 ml.", price: 6.5 },
        { name: "Água mineral", description: "500 ml, com ou sem gás.", price: 4.5 },
      ] },
    ],
  },

  pizzaria: {
    nome: "Pizzaria",
    resumo: "Meio a meio, bordas e tamanhos",
    cena: "pizza",
    foto: "assets/hero/pizzaria.webp",   // foto real (CC0) com profundidade; sem ela, usa a cena desenhada
    kicker: "Forno a lenha · massa de longa fermentação",
    titulo: "Pizza de <em>verdade</em>, meio a meio se quiser.",
    tags: ["Meio a meio", "Borda recheada", "Entrega e retirada"],
    horarios: HORARIO_NOITE,
    adicionais: [
      { name: "Bacon", price: 6, group: "Extras" },
      { name: "Catupiry extra", price: 6, group: "Extras" },
      { name: "Azeitona", price: 3, group: "Extras" },
      { name: "Cebola caramelizada", price: 4, group: "Extras" },
    ],
    categorias: [
      { nome: "Pizzas tradicionais", produtos: [
        { name: "Margherita", description: "Molho de tomate, muçarela, tomate e manjericão.", featured: true, meioAMeio: true, addons: true, sizes: PIZZA(44, 58, 72) },
        { name: "Calabresa", description: "Calabresa fatiada, cebola e azeitona.", meioAMeio: true, addons: true, sizes: PIZZA(42, 56, 69) },
        { name: "Portuguesa", description: "Presunto, ovos, cebola, ervilha e azeitona.", meioAMeio: true, addons: true, sizes: PIZZA(46, 61, 76) },
        { name: "Frango com catupiry", description: "Frango desfiado temperado e catupiry.", meioAMeio: true, addons: true, sizes: PIZZA(46, 61, 76) },
        { name: "Quatro queijos", description: "Muçarela, provolone, parmesão e gorgonzola.", meioAMeio: true, addons: true, sizes: PIZZA(49, 65, 81) },
      ] },
      { nome: "Pizzas especiais", produtos: [
        { name: "Pepperoni", description: "Pepperoni artesanal e muçarela.", featured: true, meioAMeio: true, addons: true, sizes: PIZZA(52, 69, 86) },
        { name: "Burrata e pesto", description: "Burrata inteira, pesto de manjericão e tomate-cereja.", meioAMeio: true, sizes: PIZZA(58, 76, 95) },
        { name: "Camarão", description: "Camarão ao alho, catupiry e salsinha.", meioAMeio: true, sizes: PIZZA(62, 82, 102), available: false },
      ] },
      { nome: "Pizzas doces", produtos: [
        { name: "Chocolate com morango", description: "Chocolate ao leite e morangos frescos.", meioAMeio: true, sizes: PIZZA(44, 58, 72) },
        { name: "Romeu e Julieta", description: "Goiabada cremosa e muçarela.", meioAMeio: true, sizes: PIZZA(42, 55, 68) },
      ] },
      { nome: "Bebidas", produtos: [
        { name: "Refrigerante 2 L", description: "Cola, guaraná ou laranja.", price: 14.9 },
        { name: "Suco natural 1 L", description: "Laranja ou uva integral.", price: 16.9 },
        { name: "Água com gás", description: "500 ml.", price: 5 },
      ] },
    ],
  },

  hamburgueria: {
    nome: "Hamburgueria",
    resumo: "Ponto da carne e adicionais",
    cena: "burger",
    foto: "assets/hero/hamburgueria.webp",   // foto real (CC0) com profundidade; sem ela, usa a cena desenhada
    kicker: "Blend da casa · pão brioche na chapa",
    titulo: "Burger <em>suculento</em> do seu jeito.",
    tags: ["Ponto da carne", "Monte com adicionais", "Entrega e retirada"],
    horarios: HORARIO_NOITE,
    adicionais: [
      { name: "Bacon crocante", price: 5, group: "Turbine" },
      { name: "Cheddar extra", price: 4, group: "Turbine" },
      { name: "Hambúrguer extra", price: 12, group: "Turbine" },
      { name: "Ovo", price: 3, group: "Turbine" },
      { name: "Picles", price: 2, group: "Turbine" },
    ],
    categorias: [
      { nome: "Burgers", produtos: [
        { name: "Clássico da casa", description: "Blend 160 g, queijo prato, alface, tomate e maionese da casa.", price: 32.9, featured: true, addons: true, opcoes: [PONTO_CARNE] },
        { name: "Cheddar & bacon", description: "Blend 160 g, cheddar cremoso, bacon e cebola crispy.", price: 38.9, featured: true, addons: true, opcoes: [PONTO_CARNE] },
        { name: "Duplo smash", description: "Dois smash de 90 g, queijo americano e picles.", price: 36.9, addons: true },
        { name: "Chicken crispy", description: "Frango empanado, coleslaw e molho picante.", price: 31.9, addons: true },
        { name: "Veggie de grão-de-bico", description: "Burger vegetal, rúcula, tomate e maionese verde.", price: 33.9, addons: true },
      ] },
      { nome: "Combos", produtos: [
        { name: "Combo clássico", description: "Clássico da casa + fritas + refrigerante.", price: 46.9, addons: true,
          opcoes: [PONTO_CARNE, { titulo: "Bebida", min: 1, max: 1, itens: [{ nome: "Cola", preco: 0 }, { nome: "Guaraná", preco: 0 }, { nome: "Suco de laranja", preco: 3 }] }] },
      ] },
      { nome: "Porções", produtos: [
        { name: "Batata frita", description: "Crocante, com sal e páprica.", sizes: [{ label: "Individual", price: 14.9 }, { label: "Para dividir", price: 24.9 }] },
        { name: "Onion rings", description: "Anéis de cebola empanados.", price: 22.9 },
        { name: "Batata com cheddar e bacon", description: "Para dividir.", price: 32.9 },
      ] },
      { nome: "Bebidas", produtos: [
        { name: "Milkshake", description: "Chocolate, morango ou baunilha.", sizes: [{ label: "300 ml", price: 17.9 }, { label: "500 ml", price: 22.9 }] },
        { name: "Refrigerante lata", description: "350 ml.", price: 6.5 },
      ] },
    ],
  },

  japones: {
    nome: "Japonês",
    resumo: "Combinados, temakis e hots",
    cena: "sushi",
    foto: "assets/hero/japones.webp",   // foto real (CC0) com profundidade; sem ela, usa a cena desenhada
    kicker: "Peixe fresco todo dia",
    titulo: "Sushi <em>fresquinho</em> na sua mesa.",
    tags: ["Combinados", "Temaki na hora", "Entrega e retirada"],
    horarios: HORARIO_NOITE,
    adicionais: [
      { name: "Cream cheese extra", price: 4, group: "Extras" },
      { name: "Gengibre", price: 0, group: "Extras" },
      { name: "Wasabi", price: 0, group: "Extras" },
      { name: "Molho tarê", price: 2, group: "Extras" },
    ],
    categorias: [
      { nome: "Combinados", produtos: [
        { name: "Combinado 20 peças", description: "Sashimi, niguiri, uramaki e hossomaki do chef.", price: 69.9, featured: true, addons: true },
        { name: "Combinado salmão 30 peças", description: "Só salmão: sashimi, niguiri, uramaki e hot.", price: 99.9, featured: true, addons: true },
        { name: "Combinado vegetariano", description: "16 peças com pepino, manga, shiitake e cream cheese.", price: 54.9, addons: true },
      ] },
      { nome: "Temakis", produtos: [
        { name: "Temaki salmão", description: "Salmão picado e cebolinha.", price: 32.9, addons: true,
          opcoes: [{ titulo: "Estilo", min: 1, max: 1, itens: [{ nome: "Tradicional", preco: 0 }, { nome: "Com cream cheese", preco: 3 }, { nome: "Hot (empanado)", preco: 4 }] }] },
        { name: "Temaki skin", description: "Pele de salmão crocante e molho tarê.", price: 26.9, addons: true },
      ] },
      { nome: "Hot rolls", produtos: [
        { name: "Hot philadelphia", description: "10 peças empanadas, salmão e cream cheese.", price: 34.9, addons: true },
        { name: "Hot banana com doce de leite", description: "8 peças, para a sobremesa.", price: 24.9 },
      ] },
      { nome: "Pratos quentes", produtos: [
        { name: "Yakisoba", description: "Macarrão, legumes e molho shoyu.", sizes: [{ label: "Individual", price: 36.9 }, { label: "Para dois", price: 58.9 }],
          opcoes: [{ titulo: "Proteína", min: 1, max: 1, itens: [{ nome: "Frango", preco: 0 }, { nome: "Carne", preco: 4 }, { nome: "Misto", preco: 6 }] }] },
        { name: "Missoshiru", description: "Sopa de missô com tofu e cebolinha.", price: 12.9 },
      ] },
      { nome: "Bebidas", produtos: [
        { name: "Chá verde gelado", description: "500 ml, sem açúcar.", price: 9.9 },
        { name: "Refrigerante lata", description: "350 ml.", price: 6.5 },
      ] },
    ],
  },

  cafeteria: {
    nome: "Cafeteria e padaria",
    resumo: "Cafés, leites e fornadas",
    cena: "coffee",
    foto: "assets/hero/cafeteria.webp",   // foto real (CC0) com profundidade; sem ela, usa a cena desenhada
    kicker: "Grãos especiais · fornada a cada hora",
    titulo: "Um <em>café</em> que vale a pausa.",
    tags: ["Leite vegetal", "Fornadas do dia", "Retirada no balcão"],
    horarios: HORARIO_DIA,
    adicionais: [
      { name: "Dose extra de espresso", price: 4, group: "Extras" },
      { name: "Chantilly", price: 3, group: "Extras" },
      { name: "Calda de caramelo", price: 2.5, group: "Extras" },
    ],
    categorias: [
      { nome: "Cafés", produtos: [
        { name: "Espresso", description: "Blend da casa, notas de chocolate.", sizes: [{ label: "Curto", price: 6.9 }, { label: "Duplo", price: 9.9 }] },
        { name: "Cappuccino", description: "Espresso, leite vaporizado e cacau.", featured: true, addons: true,
          sizes: [{ label: "200 ml", price: 12.9 }, { label: "300 ml", price: 15.9 }],
          opcoes: [{ titulo: "Leite", min: 1, max: 1, itens: [{ nome: "Integral", preco: 0 }, { nome: "Sem lactose", preco: 0 }, { nome: "Aveia", preco: 3 }, { nome: "Amêndoas", preco: 3.5 }] }] },
        { name: "Latte de caramelo", description: "Espresso, leite e caramelo salgado.", addons: true,
          sizes: [{ label: "300 ml", price: 17.9 }, { label: "400 ml", price: 20.9 }],
          opcoes: [{ titulo: "Leite", min: 1, max: 1, itens: [{ nome: "Integral", preco: 0 }, { nome: "Sem lactose", preco: 0 }, { nome: "Aveia", preco: 3 }] }] },
        { name: "Coado na hora", description: "Método V60, grão do dia.", price: 11.9 },
      ] },
      { nome: "Fornadas", produtos: [
        { name: "Pão de queijo", description: "Porção com 6 unidades.", price: 12.9, featured: true },
        { name: "Croissant", description: "Manteiga francesa, folhado na casa.", price: 11.9,
          opcoes: [{ titulo: "Recheio", min: 0, max: 1, itens: [{ nome: "Presunto e queijo", preco: 6 }, { nome: "Chocolate", preco: 4 }] }] },
        { name: "Pão na chapa", description: "Pão francês com manteiga.", price: 7.9 },
        { name: "Bolo de cenoura", description: "Fatia com cobertura de chocolate.", price: 10.9 },
      ] },
      { nome: "Lanches", produtos: [
        { name: "Misto quente", description: "Pão de forma, presunto e queijo.", price: 14.9 },
        { name: "Tostex de peito de peru", description: "Peito de peru, queijo branco e tomate.", price: 18.9 },
      ] },
      { nome: "Bebidas geladas", produtos: [
        { name: "Cold brew", description: "Extração a frio por 18 horas.", price: 14.9 },
        { name: "Suco de laranja", description: "Espremido na hora, 300 ml.", price: 10.9 },
      ] },
    ],
  },

  doceria: {
    nome: "Doceria",
    resumo: "Bolos, fatias e encomendas",
    cena: "cupcake",
    foto: "assets/hero/doceria.webp",   // foto real (CC0) com profundidade; sem ela, usa a cena desenhada
    kicker: "Feito à mão, todo dia",
    titulo: "Doce <em>bonito</em> e mais gostoso ainda.",
    tags: ["Fatia ou inteiro", "Encomendas", "Retirada na loja"],
    horarios: HORARIO_DIA,
    adicionais: [
      { name: "Vela de aniversário", price: 2, group: "Para presentear" },
      { name: "Cartão com mensagem", price: 5, group: "Para presentear" },
      { name: "Caixa de presente", price: 8, group: "Para presentear" },
    ],
    categorias: [
      { nome: "Bolos", produtos: [
        { name: "Red velvet", description: "Massa aveludada e cream cheese.", featured: true, addons: true,
          sizes: [{ label: "Fatia", price: 16.9 }, { label: "Inteiro (1,5 kg)", price: 149.9 }] },
        { name: "Chocolate belga", description: "Brigadeiro de chocolate 54%.", addons: true,
          sizes: [{ label: "Fatia", price: 15.9 }, { label: "Inteiro (1,5 kg)", price: 139.9 }] },
        { name: "Cenoura com brigadeiro", description: "Clássico de vó.", addons: true,
          sizes: [{ label: "Fatia", price: 12.9 }, { label: "Inteiro (1,2 kg)", price: 99.9 }] },
      ] },
      { nome: "Docinhos", produtos: [
        { name: "Brigadeiros gourmet", description: "Sabores sortidos.", featured: true,
          sizes: [{ label: "Caixa com 4", price: 16.9 }, { label: "Caixa com 12", price: 44.9 }],
          opcoes: [{ titulo: "Sabores (até 3)", min: 1, max: 3, itens: [{ nome: "Tradicional", preco: 0 }, { nome: "Pistache", preco: 0 }, { nome: "Ninho com Nutella", preco: 0 }, { nome: "Maracujá", preco: 0 }, { nome: "Café", preco: 0 }] }] },
        { name: "Cupcake", description: "Massa fofinha com cobertura de buttercream.", price: 11.9,
          opcoes: [{ titulo: "Cobertura", min: 1, max: 1, itens: [{ nome: "Baunilha", preco: 0 }, { nome: "Chocolate", preco: 0 }, { nome: "Morango", preco: 0 }] }] },
        { name: "Macarons", description: "Caixa com 6.", price: 32.9, available: false },
      ] },
      { nome: "Tortas", produtos: [
        { name: "Torta de limão", description: "Merengue maçaricado.", sizes: [{ label: "Fatia", price: 14.9 }, { label: "Inteira", price: 109.9 }] },
        { name: "Banoffee", description: "Banana, doce de leite e chantilly.", sizes: [{ label: "Fatia", price: 15.9 }, { label: "Inteira", price: 119.9 }] },
      ] },
      { nome: "Bebidas", produtos: [
        { name: "Chocolate quente", description: "Cremoso, com chantilly.", price: 13.9 },
        { name: "Café espresso", description: "Para acompanhar o doce.", price: 6.9 },
      ] },
    ],
  },

  pastelaria: {
    nome: "Pastelaria",
    resumo: "Pastéis, caldo de cana e combos",
    cena: "pastel",
    kicker: "Massa fininha · frito na hora",
    titulo: "Pastel <em>crocante</em> e caldo de cana gelado.",
    tags: ["Frito na hora", "Caldo de cana", "Entrega e retirada"],
    horarios: HORARIO_DIA,
    adicionais: [
      { name: "Catupiry", price: 3, group: "Turbine o recheio" },
      { name: "Cheddar", price: 3, group: "Turbine o recheio" },
      { name: "Bacon", price: 4, group: "Turbine o recheio" },
      { name: "Milho", price: 2, group: "Turbine o recheio" },
    ],
    categorias: [
      { nome: "Pastéis salgados", produtos: [
        { name: "Carne", description: "Carne moída temperada com cheiro-verde.", featured: true, addons: true, sizes: PASTEL(9.9, 14.9) },
        { name: "Queijo", description: "Muçarela derretendo.", addons: true, sizes: PASTEL(9.9, 14.9) },
        { name: "Pizza", description: "Muçarela, presunto, tomate e orégano.", addons: true, sizes: PASTEL(10.9, 15.9) },
        { name: "Frango com catupiry", description: "Frango desfiado e catupiry.", featured: true, addons: true, sizes: PASTEL(11.9, 16.9) },
        { name: "Palmito", description: "Palmito com molho branco.", addons: true, sizes: PASTEL(11.9, 16.9) },
        { name: "Bauru", description: "Presunto, queijo, tomate e orégano.", addons: true, sizes: PASTEL(10.9, 15.9), available: false },
      ] },
      { nome: "Pastéis doces", produtos: [
        { name: "Banana com canela", description: "Açúcar e canela por cima.", sizes: PASTEL(9.9, 13.9) },
        { name: "Chocolate", description: "Chocolate ao leite cremoso.", sizes: PASTEL(10.9, 14.9) },
      ] },
      { nome: "Combos", produtos: [
        { name: "Combo feira", description: "2 pastéis grandes + caldo de cana 500 ml.", price: 39.9,
          opcoes: [{ titulo: "Sabores dos pastéis (escolha 2)", min: 2, max: 2, itens: [{ nome: "Carne", preco: 0 }, { nome: "Queijo", preco: 0 }, { nome: "Pizza", preco: 0 }, { nome: "Frango com catupiry", preco: 0 }, { nome: "Palmito", preco: 0 }] }] },
      ] },
      { nome: "Bebidas", produtos: [
        { name: "Caldo de cana", description: "Moído na hora.", featured: true,
          sizes: [{ label: "300 ml", price: 8.9 }, { label: "500 ml", price: 11.9 }],
          opcoes: [{ titulo: "Sabor", min: 1, max: 1, itens: [{ nome: "Puro", preco: 0 }, { nome: "Com limão", preco: 0 }, { nome: "Com abacaxi", preco: 1.5 }] }] },
        { name: "Refrigerante lata", description: "350 ml.", price: 6.5 },
      ] },
    ],
  },
};

function PIZZA(broto, media, grande) {
  return [{ label: "Broto (4 fatias)", price: broto }, { label: "Média (6 fatias)", price: media }, { label: "Grande (8 fatias)", price: grande }];
}
function PASTEL(medio, grande) {
  return [{ label: "Médio", price: medio }, { label: "Grande", price: grande }];
}

/** Nicho atual: ?nicho=… na URL (padrão: restaurante). */
const NICHO_ID = (() => {
  const q = new URLSearchParams(location.search).get("nicho");
  return q && Object.prototype.hasOwnProperty.call(NICHOS, q) ? q : "restaurante";
})();
const NICHO = NICHOS[NICHO_ID];
document.documentElement.dataset.nicho = NICHO_ID;
