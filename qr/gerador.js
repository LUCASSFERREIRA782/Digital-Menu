/**
 * gerador.js — QR Code geral (balcão, vitrine, panfleto).
 * Para QR por mesa, use o painel → "Mesas e QR".
 * Gerado aqui mesmo com js/qr.js: o link não é enviado a nenhum serviço.
 */
const urlInput = document.getElementById("url-input");
const labelInput = document.getElementById("label-input");
const output = document.getElementById("qr-output");
const labelEl = document.getElementById("qr-label");
const printBtn = document.getElementById("print-btn");

document.getElementById("generate-btn").addEventListener("click", () => {
  const url = urlInput.value.trim();
  if (!/^https?:\/\/[^\s]+$/i.test(url)) {
    alert("Cole o link completo do cardápio, começando com https://");
    return;
  }
  try {
    output.innerHTML = qrSvg(url); // preto no branco: lê bem mesmo em impressão simples
  } catch (err) {
    alert(err.message);
    return;
  }
  labelEl.textContent = labelInput.value.trim();
  labelEl.style.display = labelInput.value.trim() ? "block" : "none";
  printBtn.style.display = "block";
});

printBtn.addEventListener("click", () => window.print());
