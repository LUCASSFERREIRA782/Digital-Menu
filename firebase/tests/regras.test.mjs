// Testes das regras do Firestore no EMULADOR local (não toca o banco real).
// Rodar (precisa de Java e do firebase-tools):
//   FIREBASE_TEST_DEPS=<pasta com node_modules de @firebase/rules-unit-testing e firebase> \
//   firebase emulators:exec --only firestore --project demo-ponto "node --test tests/regras.test.mjs"
import { after, before, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const deps = createRequire(`${process.env.FIREBASE_TEST_DEPS}/package.json`);
const load = id => import(pathToFileURL(deps.resolve(id)).href);
const { assertFails, assertSucceeds, initializeTestEnvironment } = await load("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp, Timestamp } = await load("firebase/firestore");

const ADMIN = "admin-teste";
const DIA = 86_400_000;
const em = dias => Timestamp.fromMillis(Date.now() + dias * DIA);
const N = "nichos/pizzaria";

const item = (o = {}) => ({ id: "p1", nome: "Margherita", tamanho: "Broto", opcoes: [], adicionais: [], obs: "", qtd: 1, unit: 44, ...o });
const pedido = (o = {}) => ({
  codigo: "AB12", modo: "local", pagamento: "caixa_cartao", apelido: "Ana", mesa: "7", mesaCodigo: "k7Qx2a", bairro: "",
  itens: [item()], subtotal: 44, taxaEntrega: 0, total: 44, status: "novo", pago: false,
  criadoEm: serverTimestamp(), expiraEm: em(90), ...o,
});

let env;
before(async () => {
    // Troca a lista de donos real por um UID de teste
  const rules = readFileSync("firestore.rules", "utf8").replace(/request\.auth\.uid in \[[^\]]*\]/, `request.auth.uid in ['${ADMIN}']`);
  env = await initializeTestEnvironment({ projectId: "demo-ponto", firestore: { rules, host: "127.0.0.1", port: 8080 } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, `${N}/produtos/p1`), { name: "Margherita", price: 44 });
    await setDoc(doc(db, `${N}/config/loja`), { nome: "Ponto Expresso" });
    await setDoc(doc(db, `${N}/config/equipe`), { whatsapps: [{ nome: "Ana", numero: "5511900000000" }] });
    await setDoc(doc(db, `${N}/config/mesas`), { quantidade: 12 });
    await setDoc(doc(db, `${N}/config/mesasPrivado`), { quantidade: 12, codigos: { "7": "k7Qx2a", "8": "Zp93Lm" } });
    await setDoc(doc(db, `${N}/pedidos/existente`), { ...pedido({ criadoEm: Timestamp.now() }) });
    await setDoc(doc(db, `${N}/resumos/2026-10-15`), { pedidos: 3 });
  });
});

const visitante = () => env.unauthenticatedContext().firestore();
const estranho = () => env.authenticatedContext("qualquer-um").firestore();
const dono = () => env.authenticatedContext(ADMIN).firestore();

describe("leitura pública", () => {
  it("cardápio e configurações públicas", async () => {
    await assertSucceeds(getDoc(doc(visitante(), `${N}/produtos/p1`)));
    await assertSucceeds(getDoc(doc(visitante(), `${N}/config/loja`)));
  });
  it("equipe (WhatsApp privado) e resumos: negados", async () => {
    await assertFails(getDoc(doc(visitante(), `${N}/config/equipe`)));
    await assertFails(getDoc(doc(estranho(), `${N}/resumos/2026-10-15`)));
  });
  it("pedido: pega pelo id, mas não lista", async () => {
    await assertSucceeds(getDoc(doc(visitante(), `${N}/pedidos/existente`)));
    await assertFails(getDocs(collection(visitante(), `${N}/pedidos`)));
  });
  it("nicho inexistente e caminhos fora do mapa: negados", async () => {
    await assertFails(getDoc(doc(visitante(), "nichos/hacker/produtos/p1")));
    await assertFails(getDoc(doc(visitante(), "usuarios/x")));
  });
});

describe("cliente criando pedido", () => {
  const limpo = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  const novo = (o) => setDoc(doc(visitante(), `${N}/pedidos/novo1`), limpo(pedido(o)));
  it("pedido válido", async () => { await assertSucceeds(novo()); });
  it("entrega com pagamento no caixa: recusado", async () => { await assertFails(novo({ modo: "entrega", mesa: "", mesaCodigo: undefined, pagamento: "caixa_cartao" })); });
  it("mesa: só com o código do QR daquela mesa", async () => {
    await assertSucceeds(novo({ mesa: "", mesaCodigo: undefined }));                 // comer no local, sem mesa
    await assertFails(novo({ mesaCodigo: "errado" }));                             // código inventado
    await assertFails(novo({ mesa: "8" }));                                        // código de outra mesa
    await assertFails(novo({ mesa: "99", mesaCodigo: "k7Qx2a" }));                 // mesa que não existe
    await assertFails(novo({ mesaCodigo: undefined }));                            // mesa digitada, sem QR
    await assertFails(novo({ modo: "retirada", mesa: "7" }));                      // mesa só no salão
  });
  it("códigos das mesas não são públicos", async () => {
    await assertFails(getDoc(doc(visitante(), `${N}/config/mesasPrivado`)));
    await assertSucceeds(getDoc(doc(visitante(), `${N}/config/mesas`)));
    await assertSucceeds(getDoc(doc(dono(), `${N}/config/mesasPrivado`)));
  });
  it("já pago ou com status adiantado: recusado", async () => {
    await assertFails(novo({ pago: true }));
    await assertFails(novo({ status: "concluido" }));
  });
  it("data do pedido inventada ou validade fora dos 90 dias: recusado", async () => {
    await assertFails(novo({ criadoEm: Timestamp.fromMillis(Date.now() - 5 * DIA) }));
    await assertFails(novo({ expiraEm: em(365) }));
    await assertFails(novo({ expiraEm: em(1) }));
  });
  it("total que não fecha com subtotal + taxa: recusado", async () => { await assertFails(novo({ total: 1 })); });
  it("campo extra, itens demais ou quantidade absurda: recusado", async () => {
    await assertFails(novo({ hack: true }));
    await assertFails(novo({ itens: Array.from({ length: 11 }, () => item()) }));
    await assertFails(novo({ itens: [item({ qtd: 999 })] }));
    await assertFails(novo({ itens: [item({ extra: "x" })] }));
    await assertFails(novo({ itens: [item(), item({ unit: -5 })] }));
  });
  it("cliente não altera nem apaga pedido", async () => {
    await assertFails(updateDoc(doc(visitante(), `${N}/pedidos/existente`), { status: "concluido" }));
    await assertFails(deleteDoc(doc(estranho(), `${N}/pedidos/existente`)));
  });
});

describe("dono", () => {
  it("avança status e marca pago, mas não mexe no valor", async () => {
    await assertSucceeds(updateDoc(doc(dono(), `${N}/pedidos/existente`), { status: "preparo", preparoEm: serverTimestamp(), pago: true }));
    await assertFails(updateDoc(doc(dono(), `${N}/pedidos/existente`), { total: 1 }));
  });
  it("edita cardápio e lê resumos; estranho não", async () => {
    await assertSucceeds(setDoc(doc(dono(), `${N}/produtos/p2`), { name: "Calabresa" }));
    await assertSucceeds(getDoc(doc(dono(), `${N}/resumos/2026-10-15`)));
    await assertFails(setDoc(doc(estranho(), `${N}/produtos/p3`), { name: "Hack" }));
  });
  it("grava pedido de exemplo (já finalizado); estranho não", async () => {
    const ex = pedido({ status: "concluido", pago: true, criadoEm: Timestamp.fromMillis(Date.now() - 3 * DIA), expiraEm: em(87) });
    await assertSucceeds(setDoc(doc(dono(), `${N}/pedidos/exemplo-1`), ex));
    await assertFails(setDoc(doc(estranho(), `${N}/pedidos/exemplo-2`), ex));
  });
  it("foto: só imagem dentro do limite", async () => {
    await assertSucceeds(setDoc(doc(dono(), `${N}/fotos/p1`), { data: "data:image/webp;base64,UklGRg==", atualizadoEm: serverTimestamp() }));
    await assertFails(setDoc(doc(dono(), `${N}/fotos/p1`), { data: "data:text/html;base64,PHNjcmlwdD4=" }));
    await assertFails(setDoc(doc(dono(), `${N}/fotos/p1`), { data: "data:image/webp;base64," + "A".repeat(460000) }));
  });
  it("troca de nicho: só o dono e só nichos válidos", async () => {
    await assertSucceeds(setDoc(doc(dono(), "demo/estado"), { nicho: "japones", atualizadoEm: serverTimestamp() }));
    await assertFails(setDoc(doc(dono(), "demo/estado"), { nicho: "hacker", atualizadoEm: serverTimestamp() }));
    await assertFails(setDoc(doc(estranho(), "demo/estado"), { nicho: "pizzaria", atualizadoEm: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(visitante(), "demo/estado")));
  });
});
