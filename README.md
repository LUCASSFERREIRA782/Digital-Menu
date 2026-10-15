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

- **Sem banco na nuvem:** tudo fica no navegador de quem usa (`js/demo-backend.js`).
  Nenhum visitante altera o que outro vê, não há custo e não há senha.
- O "servidor" da demonstração (`js/demo-servidor.js`) recalcula preços e taxas a partir do
  cardápio salvo; valores vindos da tela são ignorados (mesma regra da versão real).
- **Nenhum Pix é gerado** e **nenhuma mensagem é enviada**: sem WhatsApp cadastrado no painel,
  o endereço aparece só em prévia.
- CSP só com o próprio site (+ fontes do Google e consulta de CEP), proteção contra iframe,
  textos sempre escapados antes de ir para a tela.
- 3D e QR Code feitos em código próprio, sem bibliotecas de fora.

## Fotos

Fotos do topo: CC0 / domínio público, sem metadados — origem em `assets/hero/creditos-fotos.json`.
Ilustrações dos produtos: SVG próprios (`assets/ilustracoes/`).

## Rodar no computador

```bash
npx --yes http-server@14.1.1 . -a 127.0.0.1 -p 5176 -c-1
```
