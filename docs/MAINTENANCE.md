# Manutenção

Este documento é pra você (o desenvolvedor) consultar sempre que o cliente pedir uma mudança no cardápio.

## Regra de ouro
**Você nunca edita `index.html` pra mudar produto, preço ou categoria.** Toda alteração de conteúdo acontece em `data/menu.js`. Editar HTML só é necessário se for mudar a estrutura da página em si (algo raro, e não deveria acontecer por pedido de cliente).

## Alterar o preço de um produto
Abra `data/menu.js`, encontre o produto pelo `name`, e altere o campo `price` (é um número, sem "R$" e com ponto decimal):

```js
price: 27.9,
```

## Adicionar um produto novo
Dentro da categoria certa, em `data/menu.js`, adicione um novo objeto na lista `produtos`:

```js
{
  name: "Nome do Produto",
  description: "Descrição curta, 1-2 linhas.",
  price: 25.0,
  image: "assets/images/products/nome-do-arquivo.webp",
  available: true,
  featured: false,
}
```

## Remover um produto
Apague o objeto correspondente dentro da lista `produtos`. Não precisa reorganizar nada mais — a numeração é automática.

## Marcar produto como indisponível
Troque `available: true` para `available: false`. O produto continua visível no cardápio, mas com selo "Indisponível" e sem preço clicável — isso evita que o cliente peça algo que não tem no momento, sem precisar apagar o produto inteiro.

## Marcar/desmarcar produto em destaque
Troque `featured` entre `true`/`false`. Produtos com `featured: true` E `available: true` aparecem também na seção "Destaques", no topo da página.

## Adicionar uma categoria nova
Em `data/menu.js`, adicione um novo objeto na lista `categorias`, no mesmo nível das existentes:

```js
{
  nome: "Nome da Categoria",
  slug: "nome-da-categoria", // sem espaços/acentos — usado internamente pra navegação
  produtos: [ /* ... */ ],
}
```

## Remover uma categoria
Apague o objeto inteiro da categoria em `data/menu.js`. Se ela tiver produtos com `featured: true`, eles somem da seção de destaques automaticamente também.

## Trocar foto de um produto
1. Coloque o arquivo de imagem em `assets/images/products/`
2. No produto correspondente em `data/menu.js`, ajuste o campo `image` com o caminho do arquivo

Sem imagem (`image: ""`), o card mostra um gradiente de cor no lugar da foto — não quebra o layout.

## Depois de qualquer alteração
Não precisa "buildar" nada — é HTML/CSS/JS puro. Só salvar o arquivo, testar localmente (abrir `index.html` ou usar Live Server) e, quando estiver certo, subir de novo pra hospedagem.
