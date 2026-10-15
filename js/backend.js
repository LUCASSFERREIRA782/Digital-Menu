/**
 * backend.js
 * -------------------------------------------------------
 * Conexão com o Firebase da demonstração (projeto
 * ponto-expresso-demo, plano gratuito, banco em São Paulo).
 * Dados COMPARTILHADOS: o que o dono muda no painel aparece no
 * celular do cliente, e o pedido do cliente chega ao vivo no painel.
 *
 * Cada nicho tem seus dados em nichos/{nicho}/… e o código do
 * cardápio e do painel continua chamando db.collection("produtos"),
 * como na açaiteria — este arquivo aponta para o nicho atual.
 *
 * Desempenho: cache local (IndexedDB) — a segunda visita abre na
 * hora, mesmo com internet fraca, e as mudanças chegam em tempo real.
 * Segurança: quem protege os dados são as regras do banco
 * (firebase/firestore.rules); esta configuração é pública por natureza.
 * -------------------------------------------------------
 */

const firebaseConfig = {
  apiKey: "AIzaSyB85a_zActih7TKbAy3wISjYo3b4N1iAtA",
  authDomain: "ponto-expresso-demo.firebaseapp.com",
  projectId: "ponto-expresso-demo",
  storageBucket: "ponto-expresso-demo.firebasestorage.app",
  messagingSenderId: "887009275737",
  appId: "1:887009275737:web:39772b9695af047e532648",
};

firebase.initializeApp(firebaseConfig);
const firestore = firebase.firestore();
const auth = firebase.auth ? firebase.auth() : null;

// Testes no computador: 127.0.0.1 com ?emulador usa os emuladores do Firebase
// (banco e login locais). Nunca liga no site publicado.
if (location.hostname === "127.0.0.1" && new URLSearchParams(location.search).has("emulador")) {
  firestore.useEmulator("127.0.0.1", 8080);
  auth?.useEmulator("http://127.0.0.1:9099", { disableWarnings: true });
}

// Cache local (precisa vir antes de qualquer leitura). Sem sincronizar abas de
// propósito: com abas sincronizadas, só UMA aba fala com o banco e as outras
// esperam por ela (pedido levava ~20 s com o painel em segundo plano). Assim cada
// aba tem conexão própria; a primeira usa o cache em disco, as demais, em memória.
firestore.enablePersistence({ synchronizeTabs: false }).catch(err => console.info("Cache local só em memória nesta aba:", err.code));

/** Dados do nicho atual (o restante do código não precisa saber do nicho). */
const nichoDoc = id => firestore.collection("nichos").doc(id);
const db = {
  collection: name => nichoDoc(NICHO_ID).collection(name),
  batch: () => firestore.batch(),
  runTransaction: fn => firestore.runTransaction(fn),
};

/** Nicho escolhido no painel — todos os aparelhos seguem este documento. */
const estadoDemo = () => firestore.collection("demo").doc("estado");

/** Esta é a amostra (não a loja de um cliente): textos de demonstração na tela. */
const DEMONSTRACAO = true;

const RETENCAO_DIAS = 90;
const DIA_MS = 86_400_000;
/** Data em que o registro some sozinho (política TTL do banco no campo expiraEm). */
const expiraEm = (base = Date.now()) => firebase.firestore.Timestamp.fromMillis(base + RETENCAO_DIAS * DIA_MS);

/* "Funções do servidor": no plano gratuito não há Cloud Functions; a regra
 * de preço roda aqui (js/servidor.js) e as regras do banco limitam o que
 * um pedido pode conter. */
firebase.functions = () => ({
  httpsCallable: name => async data => {
    const fn = Servidor[name];
    if (!fn) throw Object.assign(new Error("Função indisponível."), { code: "functions/not-found" });
    return { data: await fn(JSON.parse(JSON.stringify(data ?? {}))) };
  },
});
