/**
 * admin-addons.js
 * Lista de adicionais em config/adicionais → { itens: [{ name, price, group }] }
 */

function initAddonsAdmin() {
  document.getElementById("add-addon-btn").addEventListener("click", () => addAddonRow());
  document.getElementById("addons-form").addEventListener("submit", saveAddons);
  loadAddons();
}

async function loadAddons() {
  const doc = await db.collection("config").doc("adicionais").get();
  const list = document.getElementById("addons-list");
  list.innerHTML = "";
  (doc.exists ? doc.data().itens || [] : []).forEach(a => addAddonRow(a.name, a.group, a.price));
  if (!list.children.length) addAddonRow();
}

function addAddonRow(name = "", group = "", price = "") {
  const row = document.createElement("div");
  row.className = "a-row a-addon-grid";
  row.innerHTML = `
    <input class="f-input" placeholder="Ex.: Morango" maxlength="40" data-a-name value="${esc(name)}">
    <input class="f-input" placeholder="Ex.: Frutas" maxlength="30" data-a-group value="${esc(group)}" list="addon-groups">
    <input class="f-input" type="number" step="0.50" min="0" placeholder="0" data-a-price value="${esc(price)}">
    <button type="button" class="a-icon-btn" aria-label="Remover adicional">✕</button>`;
  row.querySelector("button").addEventListener("click", () => row.remove());
  document.getElementById("addons-list").appendChild(row);
  refreshGroupSuggestions();
}

function refreshGroupSuggestions() {
  let dl = document.getElementById("addon-groups");
  if (!dl) { dl = document.createElement("datalist"); dl.id = "addon-groups"; document.body.appendChild(dl); }
  const groups = new Set([...document.querySelectorAll("[data-a-group]")].map(i => i.value.trim()).filter(Boolean));
  dl.innerHTML = [...groups].map(g => `<option value="${esc(g)}">`).join("");
}

async function saveAddons(e) {
  e.preventDefault();
  const itens = [...document.querySelectorAll("#addons-list .a-row")]
    .map(r => ({
      name: r.querySelector("[data-a-name]").value.trim(),
      group: r.querySelector("[data-a-group]").value.trim() || "Adicionais",
      price: Math.max(0, parseFloat(r.querySelector("[data-a-price]").value) || 0),
    }))
    .filter(a => a.name);
  await db.collection("config").doc("adicionais").set({ itens, atualizadoEm: ts() });
  showToast(`${itens.length} adicionais salvos`);
  refreshGroupSuggestions();
}
