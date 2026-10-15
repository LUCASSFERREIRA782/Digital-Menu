/**
 * admin-delivery.js
 * Lê e grava config/deliveryFees: { ativo, modo: "fixo"|"bairro", taxaFixa, bairros }
 */

function initDeliveryAdmin() {
  document.getElementById("delivery-modo").addEventListener("change", toggleDeliveryFields);
  document.getElementById("delivery-form").addEventListener("submit", saveDeliveryConfig);
  document.getElementById("add-bairro-btn").addEventListener("click", () => addBairroRow());
  loadDeliveryConfig();

  // Pix: na demonstração não existe chave (ver demo-servidor.js). O formulário
  // fica visível só para mostrar ao cliente como funciona na versão dele.
  document.getElementById("pix-form").addEventListener("submit", e => {
    e.preventDefault();
    showToast("Na demonstração a chave Pix não é salva");
  });
  document.getElementById("pix-key-type").addEventListener("change", updatePixHint);
  updatePixHint();
}

/* ---------- Pix (config/pix — só admin lê, ver firestore.rules) ---------- */

const PIX_HINTS = {
  telefone: "Só números com DDD, ex.: 11977777777 (o +55 é colocado automaticamente).",
  email: "O e-mail cadastrado como chave no banco.",
  cpf: "Só os 11 números.",
  cnpj: "Só os 14 números.",
  aleatoria: "Cole a chave aleatória do app do banco (32 letras/números, com ou sem hífens). Também pode colar o código Pix copia e cola inteiro.",
};

function updatePixHint() {
  document.getElementById("pix-key-hint").textContent = PIX_HINTS[document.getElementById("pix-key-type").value];
}

async function loadPixConfig() {
  const doc = await db.collection("config").doc("pix").get();
  const p = doc.exists ? doc.data() : {};
  const type = p.keyType || "telefone";
  document.getElementById("pix-key-type").value = type;
  document.getElementById("pix-key").value = type === "telefone" ? String(p.key || "").replace(/^\+55/, "") : p.key || "";
  document.getElementById("pix-name").value = p.receiverName || "";
  document.getElementById("pix-city").value = p.city || "";
  updatePixHint();
}

/** Tira o "lixo" que vem ao copiar do app do banco: espaços, quebras de
 *  linha, caracteres invisíveis e hífens tipográficos (– — ‐ −). */
function cleanPixInput(raw) {
  return String(raw)
    .replace(/[​-‍⁠﻿]/g, "")
    .replace(/[‐-―−﹘﹣－]/g, "-")
    .replace(/\s+/g, "");
}

/** Se colaram o "copia e cola" inteiro, extrai chave, nome e cidade do BR Code. */
function parseBrCode(code) {
  const fields = {};
  const read = (str, into) => {
    for (let i = 0; i + 4 <= str.length;) {
      const id = str.slice(i, i + 2), len = Number(str.slice(i + 2, i + 4));
      if (!Number.isInteger(len)) break;
      into[id] = str.slice(i + 4, i + 4 + len);
      i += 4 + len;
    }
    return into;
  };
  read(code, fields);
  const account = read(fields["26"] || "", {});
  if (!/^br\.gov\.bcb\.pix$/i.test(account["00"] || "") || !account["01"]) return null;
  return { key: account["01"], receiverName: fields["59"] || "", city: fields["60"] || "" };
}

/** Descobre o tipo pela aparência da chave (para corrigir seleção errada). */
function detectPixType(key) {
  const digits = key.replace(/\D/g, "");
  if (/^[^@]+@[^@]+\.[^@]+$/.test(key)) return "email";
  if (/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(key)) return "aleatoria";
  if (key.startsWith("+55") || ((digits.length === 10 || digits.length === 11) && /^[1-9]{2}9?\d{8}$/.test(digits) && !/[.\/]/.test(key))) return "telefone";
  if (digits.length === 14) return "cnpj";
  if (digits.length === 11) return "cpf";
  return null;
}

/** Normaliza a chave no formato que o Banco Central exige no BR Code. */
function normalizePixKey(type, raw) {
  const v = cleanPixInput(raw);
  const digits = v.replace(/\D/g, "");
  if (type === "telefone") return digits.length === 10 || digits.length === 11 ? "+55" + digits : digits.length === 13 && digits.startsWith("55") ? "+" + digits : null;
  if (type === "cpf") return digits.length === 11 ? digits : null;
  if (type === "cnpj") return digits.length === 14 ? digits : null;
  if (type === "email") return /^[^@]+@[^@]+\.[^@]+$/.test(v) ? v.toLowerCase() : null;
  // Aleatória (EVP): 32 caracteres hexadecimais, com ou sem hífens → 8-4-4-4-12
  const hex = v.replace(/-/g, "").toLowerCase();
  return /^[0-9a-f]{32}$/.test(hex) ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` : null;
}

async function savePixConfig(e) {
  e.preventDefault();
  const errorEl = document.getElementById("pix-error");
  const typeEl = document.getElementById("pix-key-type");
  const keyEl = document.getElementById("pix-key");
  const nameEl = document.getElementById("pix-name");
  const cityEl = document.getElementById("pix-city");
  errorEl.textContent = "";

  let raw = keyEl.value;
  let keyType = typeEl.value;
  const notes = [];

  // Colou o código copia e cola inteiro? Aproveita chave, nome e cidade.
  const cleaned = cleanPixInput(raw);
  if (/br\.gov\.bcb\.pix/i.test(cleaned)) {
    // No BR Code os espaços fazem parte do nome: tira só quebras de linha e invisíveis
    const parsed = parseBrCode(String(raw).replace(/[​-‍⁠﻿\r\n]/g, "").trim());
    if (!parsed) { errorEl.textContent = "Não consegui ler esse código Pix. Cole só a chave."; return; }
    raw = parsed.key;
    if (!nameEl.value.trim() && parsed.receiverName) nameEl.value = parsed.receiverName.slice(0, 25);
    if (!cityEl.value.trim() && parsed.city) cityEl.value = parsed.city.slice(0, 15);
    notes.push("chave extraída do código copia e cola");
  }

  let key = normalizePixKey(keyType, raw);
  if (!key) {
    // Tipo selecionado errado? Tenta pelo formato da chave.
    const guess = detectPixType(cleanPixInput(raw));
    const alt = guess && normalizePixKey(guess, raw);
    if (alt) {
      key = alt;
      keyType = guess;
      typeEl.value = guess;
      updatePixHint();
      notes.push(`tipo ajustado para "${typeEl.selectedOptions[0].textContent}"`);
    }
  }
  if (!key) { errorEl.textContent = "Chave inválida para o tipo escolhido. " + PIX_HINTS[keyType]; return; }

  const receiverName = nameEl.value.trim();
  const city = cityEl.value.trim();
  if (!receiverName || !city) { errorEl.textContent = "Preencha o nome do recebedor e a cidade."; return; }

  keyEl.value = keyType === "telefone" ? key.replace(/^\+55/, "") : key;
  await db.collection("config").doc("pix").set({ keyType, key, receiverName, city, atualizadoEm: ts() });
  showToast(notes.length ? `Pix salvo (${notes.join("; ")})` : "Pix salvo");
}

async function loadDeliveryConfig() {
  const doc = await db.collection("config").doc("deliveryFees").get();
  const cfg = doc.exists ? doc.data() : { ativo: true, modo: "fixo", taxaFixa: 5, bairros: [] };

  document.getElementById("delivery-ativo").checked = Boolean(cfg.ativo);
  document.getElementById("pickup-ativo").checked = Boolean(cfg.retirada);
  // "distancia" (versão antiga) não existe mais — cai para taxa fixa
  document.getElementById("delivery-modo").value = cfg.modo === "bairro" ? "bairro" : "fixo";
  document.getElementById("taxa-fixa").value = cfg.taxaFixa ?? 0;
  document.getElementById("bairros-list").innerHTML = "";
  (cfg.bairros || []).forEach(b => addBairroRow(b.nome, b.taxa));
  toggleDeliveryFields();
}

function toggleDeliveryFields() {
  const modo = document.getElementById("delivery-modo").value;
  document.getElementById("delivery-fixo-fields").hidden = modo !== "fixo";
  document.getElementById("delivery-bairro-fields").hidden = modo !== "bairro";
  if (modo === "bairro" && !document.querySelector("#bairros-list .a-row")) addBairroRow();
}

function addBairroRow(nome = "", taxa = "") {
  const row = document.createElement("div");
  row.className = "a-row";
  row.innerHTML = `
    <input class="f-input" placeholder="Nome do bairro" maxlength="40" data-b-nome value="${esc(nome)}">
    <input class="f-input" type="number" step="0.50" min="0" placeholder="Taxa R$" data-b-taxa value="${esc(taxa)}">
    <button type="button" class="a-icon-btn" aria-label="Remover bairro">✕</button>`;
  row.querySelector("button").addEventListener("click", () => row.remove());
  document.getElementById("bairros-list").appendChild(row);
}

async function saveDeliveryConfig(e) {
  e.preventDefault();
  const bairros = [...document.querySelectorAll("#bairros-list .a-row")]
    .map(r => ({
      nome: r.querySelector("[data-b-nome]").value.trim(),
      taxa: Math.max(0, parseFloat(r.querySelector("[data-b-taxa]").value) || 0),
    }))
    .filter(b => b.nome);

  const modo = document.getElementById("delivery-modo").value;
  if (modo === "bairro" && !bairros.length) { alert("Cadastre pelo menos um bairro."); return; }

  await db.collection("config").doc("deliveryFees").set({
    ativo: document.getElementById("delivery-ativo").checked,
    retirada: document.getElementById("pickup-ativo").checked,
    modo,
    taxaFixa: Math.max(0, parseFloat(document.getElementById("taxa-fixa").value) || 0),
    bairros,
    atualizadoEm: ts(),
  });
  showToast("Entrega e retirada salvas");
}
