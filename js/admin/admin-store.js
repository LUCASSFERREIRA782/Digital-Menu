/**
 * admin-store.js
 * -------------------------------------------------------
 * Aba "Loja e equipe": horários, abrir/fechar agora,
 * WhatsApp da equipe e dados da loja.
 *
 *   config/loja   (público)  nome, slogan, endereço, instagram,
 *                            horarios, statusManual e só os
 *                            WhatsApp que recebem pedidos
 *   config/equipe (privado)  lista completa de WhatsApp
 * -------------------------------------------------------
 */

const WEEK = [
  { day: 1, label: "Segunda" }, { day: 2, label: "Terça" }, { day: 3, label: "Quarta" },
  { day: 4, label: "Quinta" }, { day: 5, label: "Sexta" }, { day: 6, label: "Sábado" }, { day: 0, label: "Domingo" },
];

let storeCache = {};

function initStoreAdmin() {
  document.getElementById("hours-form").addEventListener("submit", saveHours);
  document.getElementById("copy-hours-btn").addEventListener("click", copyMondayToWeekdays);
  document.getElementById("hours-list").addEventListener("change", e => {
    if (e.target.matches("[data-h-open-toggle]")) toggleHourRow(e.target.closest(".a-hour-row"));
  });
  document.querySelectorAll('input[name="statusManual"]').forEach(r => r.addEventListener("change", saveStatusManual));

  document.getElementById("whats-form").addEventListener("submit", saveWhatsapps);
  document.getElementById("add-whats-btn").addEventListener("click", () => addWhatsRow());

  document.getElementById("store-form").addEventListener("submit", saveStoreData);
  loadStore();
}

async function loadStore() {
  const [lojaDoc, equipeDoc] = await Promise.all([
    db.collection("config").doc("loja").get(),
    db.collection("config").doc("equipe").get(),
  ]);
  storeCache = lojaDoc.exists ? lojaDoc.data() : {};

  // Horários (sem nada salvo, parte do config.js)
  const hours = storeCache.horarios?.length ? storeCache.horarios : restaurantConfig.hours;
  document.getElementById("hours-list").innerHTML = WEEK.map(w => {
    const h = hours.find(x => x.day === w.day) || {};
    const open = Boolean(h.open);
    return `
      <div class="a-hour-row${open ? "" : " is-closed"}" data-day="${w.day}" data-label="${w.label}">
        <label class="a-switch"><input type="checkbox" data-h-open-toggle ${open ? "checked" : ""}><span>${w.label}</span></label>
        <input class="f-input f-input--sm" type="time" data-h-open value="${esc(h.open || "13:00")}" ${open ? "" : "disabled"} aria-label="${w.label}: abre">
        <span class="a-hour-sep">até</span>
        <input class="f-input f-input--sm" type="time" data-h-close value="${esc(h.close || "22:00")}" ${open ? "" : "disabled"} aria-label="${w.label}: fecha">
        <span class="a-hour-closed">Fechado</span>
      </div>`;
  }).join("");

  const manual = storeCache.statusManual || "auto";
  document.querySelector(`input[name="statusManual"][value="${manual}"]`).checked = true;
  renderStoreStatusNow();

  // WhatsApp: lista privada completa (ou o número do config.js)
  const team = equipeDoc.exists ? equipeDoc.data().whatsapps || [] : [];
  document.getElementById("whats-list").innerHTML = "";
  team.forEach(w => addWhatsRow(w.nome, w.numero, w.recebePedidos));
  if (!team.length) addWhatsRow("", "", true);

  // Dados da loja
  document.getElementById("store-name").value = storeCache.nome || restaurantConfig.name;
  document.getElementById("store-slogan").value = storeCache.slogan || restaurantConfig.slogan;
  document.getElementById("store-address").value = storeCache.endereco || restaurantConfig.address;
  document.getElementById("store-instagram").value = storeCache.instagram || restaurantConfig.instagram;
}

/* ---------- Horários ---------- */

function toggleHourRow(row) {
  const open = row.querySelector("[data-h-open-toggle]").checked;
  row.classList.toggle("is-closed", !open);
  row.querySelectorAll('input[type="time"]').forEach(i => (i.disabled = !open));
}

function copyMondayToWeekdays() {
  const rows = [...document.querySelectorAll(".a-hour-row")];
  const monday = rows.find(r => r.dataset.day === "1");
  rows.filter(r => ["2", "3", "4", "5"].includes(r.dataset.day)).forEach(r => {
    r.querySelector("[data-h-open-toggle]").checked = monday.querySelector("[data-h-open-toggle]").checked;
    r.querySelector("[data-h-open]").value = monday.querySelector("[data-h-open]").value;
    r.querySelector("[data-h-close]").value = monday.querySelector("[data-h-close]").value;
    toggleHourRow(r);
  });
  showToast("Horário de segunda copiado para terça a sexta (falta salvar)");
}

function readHours() {
  return [...document.querySelectorAll(".a-hour-row")].map(r => {
    const open = r.querySelector("[data-h-open-toggle]").checked;
    const h = { label: r.dataset.label, day: Number(r.dataset.day) };
    if (open) {
      h.open = r.querySelector("[data-h-open]").value;
      h.close = r.querySelector("[data-h-close]").value;
    }
    return h;
  });
}

async function saveHours(e) {
  e.preventDefault();
  const horarios = readHours();
  const bad = horarios.find(h => h.open && (!h.close || h.open === h.close));
  if (bad) { alert(`Confira o horário de ${bad.label}: abertura e fechamento não podem ser iguais.`); return; }
  await db.collection("config").doc("loja").set({ horarios, atualizadoEm: ts() }, { merge: true });
  storeCache.horarios = horarios;
  renderStoreStatusNow();
  showToast("Horários salvos");
}

async function saveStatusManual(e) {
  const statusManual = e.target.value;
  await db.collection("config").doc("loja").set({ statusManual, atualizadoEm: ts() }, { merge: true });
  storeCache.statusManual = statusManual;
  renderStoreStatusNow();
  showToast({ auto: "Seguindo os horários", aberto: "Loja aberta agora", fechado: "Loja fechada agora: o site não aceita pedidos" }[statusManual]);
}

function renderStoreStatusNow() {
  const el = document.getElementById("store-status-now");
  const manual = storeCache.statusManual || "auto";
  const st = manual === "auto" ? openStatus(storeCache.horarios?.length ? storeCache.horarios : restaurantConfig.hours) : { open: manual === "aberto" };
  el.className = `a-store-status ${st.open ? "is-open" : "is-closed"}`;
  el.textContent = manual === "auto"
    ? (st.open ? `Aberta agora · até ${st.until}` : `Fechada · ${openStatusText(st).toLowerCase()}`)
    : (st.open ? "Aberta agora (manual)" : "Fechada agora (manual)");
}

/* ---------- WhatsApp da equipe ---------- */

function addWhatsRow(nome = "", numero = "", recebe = true) {
  const row = document.createElement("div");
  row.className = "a-row a-whats-grid";
  const shown = String(numero || "").replace(/^55(?=\d{10,11}$)/, "");
  row.innerHTML = `
    <input class="f-input" placeholder="Ex.: Ana" maxlength="30" data-w-nome value="${esc(nome)}">
    <input class="f-input" inputmode="tel" placeholder="11 98888-7777" maxlength="20" data-w-numero value="${esc(shown)}">
    <label class="a-switch a-switch--compact"><input type="checkbox" data-w-recebe ${recebe ? "checked" : ""}><span>Sim</span></label>
    <button type="button" class="a-icon-btn" aria-label="Remover WhatsApp">✕</button>`;
  row.querySelector("button").addEventListener("click", () => row.remove());
  document.getElementById("whats-list").appendChild(row);
}

/** Aceita "11 98888-7777", "(11)98888-7777" ou "5511988887777". */
function normalizeWhatsapp(raw) {
  const d = String(raw).replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return "55" + d;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
}

async function saveWhatsapps(e) {
  e.preventDefault();
  const errorEl = document.getElementById("whats-error");
  errorEl.textContent = "";

  const rows = [...document.querySelectorAll("#whats-list .a-row")];
  const team = [];
  for (const r of rows) {
    const nome = r.querySelector("[data-w-nome]").value.trim();
    const raw = r.querySelector("[data-w-numero]").value.trim();
    if (!nome && !raw) continue;
    const numero = normalizeWhatsapp(raw);
    if (!nome) { errorEl.textContent = "Dê um nome para cada WhatsApp."; return; }
    if (!numero) { errorEl.textContent = `Número inválido para ${nome}. Use DDD + número, ex.: 11 98888-7777.`; return; }
    team.push({ nome, numero, recebePedidos: r.querySelector("[data-w-recebe]").checked });
  }
  const publicList = team.filter(w => w.recebePedidos).map(w => ({ nome: w.nome, numero: w.numero }));
  if (team.length && !publicList.length) { errorEl.textContent = "Marque pelo menos um WhatsApp para receber pedidos."; return; }

  const batch = db.batch();
  batch.set(db.collection("config").doc("equipe"), { whatsapps: team, atualizadoEm: ts() });
  batch.set(db.collection("config").doc("loja"), { whatsapps: publicList, atualizadoEm: ts() }, { merge: true });
  await batch.commit();
  showToast(!publicList.length ? "Sem WhatsApp: as mensagens ficam só em prévia" : publicList.length > 1 ? `${publicList.length} WhatsApp vão dividir os pedidos` : "WhatsApp salvo");
}

/* ---------- Dados da loja ---------- */

async function saveStoreData(e) {
  e.preventDefault();
  const instagram = document.getElementById("store-instagram").value.trim();
  if (instagram && !safeUrl(instagram)) { alert("O Instagram precisa ser um link começando com https://"); return; }
  const data = {
    nome: document.getElementById("store-name").value.trim(),
    slogan: document.getElementById("store-slogan").value.trim(),
    endereco: document.getElementById("store-address").value.trim(),
    instagram,
    atualizadoEm: ts(),
  };
  await db.collection("config").doc("loja").set(data, { merge: true });
  document.querySelectorAll("[data-brand-name]").forEach(el => (el.textContent = data.nome));
  showToast("Dados da loja salvos");
}
