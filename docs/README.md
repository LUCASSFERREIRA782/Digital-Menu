# Digital Menu LP — Ponto Expresso (demo)

Cardápio digital de página única, acessado via QR Code. Sem backend, sem login, sem pedido online — o cliente só consulta o cardápio e paga via Pix informado na própria página.

Este é um **template reutilizável**: para outro restaurante, edite `js/config.js` (identidade) e `data/menu.js` (produtos) — nenhum outro arquivo precisa mudar.

## Estrutura

```
digital-menu/
├── index.html
├── css/
│   ├── variables.css   → cores, tipografia, espaçamentos
│   ├── style.css       → layout e componentes
│   ├── responsive.css  → ajustes por breakpoint
│   └── animations.css  → transições e microinterações
├── js/
│   ├── config.js        → identidade do restaurante (editar por cliente)
│   ├── menu-render.js   → lê os dados e monta o HTML
│   ├── ui.js             → bottom sheet, navegação, copiar Pix
│   └── app.js            → inicializa tudo, na ordem certa
├── data/
│   └── menu.js           → produtos e categorias (editar por cliente)
├── assets/
│   ├── images/products/  → fotos reais dos produtos
│   └── logo/
└── docs/
    ├── MAINTENANCE.md
    └── CUSTOMIZATION.md
```

## Como visualizar

Não precisa de build. Abra `index.html` num navegador, ou sirva a pasta com uma extensão tipo Live Server (VSCode) pra garantir que os módulos carreguem corretamente.

## Como publicar

O projeto é 100% estático — funciona em GitHub Pages, Netlify, Vercel, Cloudflare Pages ou qualquer hospedagem tradicional. Basta subir a pasta inteira.

## Antes de apresentar a um cliente real

Veja `docs/CUSTOMIZATION.md` para trocar nome, cores, cardápio e Pix, e `docs/MAINTENANCE.md` para o fluxo de manutenção contínua (trocar preço, adicionar produto, etc.).
