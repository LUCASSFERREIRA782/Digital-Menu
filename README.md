# Ponto Expresso — cardápio digital de amostra (multi-nicho)

Amostra **funcional** para apresentar a futuros clientes. Nome, telefones, endereços e
pedidos são fictícios. Desenvolvido por **LP Studio**.

- Site: https://lucassferreira782.github.io/Digital-Menu/
- Painel: https://lucassferreira782.github.io/Digital-Menu/admin/ (botão "Entrar na demonstração")

## Nichos

`?nicho=` no link: `restaurante` (padrão), `pizzaria`, `hamburgueria`, `japones`,
`cafeteria`, `doceria`, `pastelaria`. Cada um tem cores, cardápio, opções e topo 3D próprios
(foto real com profundidade; a pastelaria usa a cena desenhada).

## O que dá para mostrar

- Pedido na mesa pelo QR Code (`?mesa=7`), retirada no balcão e entrega com taxa por bairro.
- Opções por nicho: meio a meio (cobra a metade mais cara), borda, ponto da carne, leite, sabores, prato do dia.
- Foto do produto em tela cheia com zoom.
- Painel: quadro de pedidos ao vivo (com som), cardápio, adicionais, entrega/retirada,
  QR Code por mesa para imprimir, horários e relatórios (45 dias de exemplo).
- `qr/gerador.html`: QR Code geral (balcão, vitrine, panfleto).

## Troca de nicho (só pelo painel)

- A página pública não tem botão de troca: o cliente vê só o cardápio.
- No painel, a barra "Demonstração" troca o nicho com um clique. O nicho fica lembrado neste
  aparelho e o cardápio aberto em outra aba muda na hora (BroadcastChannel).
- O QR Code físico (sem `?nicho=`) abre o restaurante no celular do cliente; os QR Codes gerados
  no painel levam o nicho escolhido.
- A amostra começa "aberta agora" para dar para pedir a qualquer hora.

## Atualizar o site

A cada envio, troque a versão `?v=` nos links de `index.html`, `admin/index.html` e
`qr/gerador.html`: o celular sempre baixa o conjunto novo (o GitHub Pages guarda arquivos por 10 min).

## Como a demonstração funciona (e por que é segura)

- **Firebase `ponto-expresso-demo`** (plano gratuito Spark, banco em São Paulo), **dados compartilhados**:
  o que o dono muda no painel aparece no celular do cliente; o pedido do cliente chega ao vivo no painel.
- **Painel com login de verdade** (e-mail e senha). Só o UID do dono, listado em `firebase/firestore.rules`,
  escreve no banco. O cliente só cria pedido, num formato rígido (campos, tamanhos, data do servidor,
  validade de 90 dias) — testado em `firebase/tests/regras.test.mjs`.
- Plano gratuito não tem Cloud Functions: a regra de preço roda em `js/servidor.js` (mesma de `js/precos.js`);
  na versão de cada cliente (plano Blaze) o preço é recalculado no servidor, como na açaiteria.
- **Nenhum Pix é gerado** e **nenhuma mensagem é enviada**: sem WhatsApp cadastrado, o endereço aparece só em prévia.
- CSP restrita (site, Firebase, fontes do Google e consulta de CEP), SDK com SRI, proteção contra iframe,
  textos sempre escapados; planilha protegida contra fórmulas.

## Painel de gestão e retenção (90 dias)

- Gráficos (aba Relatórios): vendas por dia por tipo de atendimento (linha), tempo médio de preparo × entrega
  (barras, com a meta de preparo), mais vendidos (rosca) e estoque (indicadores + mapa de calor, reposição "+10").
- Lê os **resumos diários** (`resumos/AAAA-MM-DD`, gravados quando o pedido é finalizado): no máximo
  90 leituras para o período todo.
- **Imprimir / salvar PDF** e **exportar planilha (CSV)** do período (até 90 dias).
- Pedidos e resumos têm `expiraEm` (+90 dias). No plano gratuito o banco não apaga sozinho (TTL exige
  cobrança ativada): o painel apaga os vencidos sempre que é aberto (e no botão "Apagar vencidos agora").
  Com o plano Blaze, a política TTL de `firebase/firestore.indexes.ttl.json` passa a apagar em segundo plano.

## Desempenho

- Cardápio ao vivo com cache local (segunda visita abre na hora) e um redesenho por lote de mudanças.
- Pedido gravado de uma vez (uma escrita, sem leituras extras); fotos de produto só carregam quando aparecem.
- Scripts com `defer`, conexão antecipada com o banco e cena 3D só depois do cardápio na tela.

## Testar no computador (sem tocar no banco real)

Emuladores do Firebase + `?emulador=1` no endereço (só em 127.0.0.1). Regras:
`cd firebase && FIREBASE_TEST_DEPS=<pasta com @firebase/rules-unit-testing> firebase emulators:exec --only firestore --project demo-ponto "node --test tests/regras.test.mjs"`

## Fotos

Fotos do topo: CC0 / domínio público, sem metadados — origem em `assets/hero/creditos-fotos.json`.
Ilustrações dos produtos: SVG próprios (`assets/ilustracoes/`).

## Rodar no computador

```bash
npx --yes http-server@14.1.1 . -a 127.0.0.1 -p 5176 -c-1
```
