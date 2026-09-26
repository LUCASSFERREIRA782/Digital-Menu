# Customização (troca de cliente)

Este documento cobre a troca de **identidade** — nome, cores, contato. Para conteúdo do cardápio (produtos/preços), veja `MAINTENANCE.md`.

## Como alterar o nome do restaurante
Em `js/config.js`, altere:
```js
name: "Nome do Restaurante",
shortMark: "XX", // 2 letras usadas no ícone circular do header
```

## Como alterar o slogan/descrição
```js
slogan: "Frase curta que resume a proposta.",
description: "Uma linha um pouco mais completa, usada também no SEO.",
```

## Como alterar a logo
Esta V1 usa um ícone de texto (as iniciais em `shortMark`) em vez de imagem de logo, pra manter simplicidade e performance. Se o cliente tiver uma logo real em imagem, coloque o arquivo em `assets/logo/` e ajuste o CSS de `#header .brand-mark` em `css/style.css` pra usar `background-image` em vez do texto.

## Como alterar as cores
Tudo em `css/variables.css`, dentro de `:root`. As variáveis mais importantes:

```css
--background: #14120F;   /* fundo geral */
--surface:    #1E1B17;   /* cards */
--accent:     #D9873B;   /* cor principal — botões, destaques */
--accent-secondary: #8C2F26; /* cor secundária — badges */
--text:       #F2EDE4;   /* texto principal */
```

Trocar essas 5 variáveis já reformula a identidade visual inteira, sem tocar em nenhum outro CSS.

## Como alterar contato (telefone, WhatsApp, Instagram)
Em `js/config.js`:
```js
phone: "(11) 90000-0000",
whatsapp: "5511900000000", // formato internacional, sem espaços ou símbolos
instagram: "https://instagram.com/usuario",
```

## Como alterar endereço e horário
```js
address: "Rua Exemplo, 123 — Bairro, Cidade",
hours: [
  { day: "Segunda a Sexta", time: "11h às 22h" },
  { day: "Sábado e Domingo", time: "12h às 23h" },
],
```

## Como alterar a chave Pix
```js
pix: {
  key: "chave-pix-real-aqui",
  keyType: "CPF", // ou "Telefone", "E-mail", "Aleatória"
  receiverName: "Nome que aparece no Pix",
},
```

## Como gerar o QR Code físico
O QR Code deve apontar pra URL onde a página está publicada (ex: `https://seurestaurante.com.br/`) — nunca para o conteúdo do cardápio em si. Isso permite atualizar preços e produtos sem trocar o QR impresso nas mesas.

Qualquer gerador de QR Code confiável serve (inclusive gratuitos). Ao gerar, confirme:
- Contraste alto (preto sobre branco funciona melhor que cores)
- Tamanho mínimo de 3×3cm se for impresso em mesa
- Teste o scan antes de imprimir em quantidade
