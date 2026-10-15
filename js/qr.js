/**
 * qr.js
 * -------------------------------------------------------
 * Gerador de QR Code (padrão ISO/IEC 18004) sem biblioteca
 * de fora: modo byte (UTF-8), correção de erro nível M
 * (aguenta ~15% do código sujo ou riscado), versões 1 a 10
 * (links de até ~210 caracteres) e máscara escolhida pela
 * pontuação oficial. Usado nos QR Codes das mesas.
 *
 *   qrSvg("https://…/?mesa=7")  → string <svg> pronta para imprimir
 * -------------------------------------------------------
 */

const QR = (() => {
  // Nível M — blocos e códigos de correção por bloco (versões 1..10)
  const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  const NUM_BLOCKS    = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  const ECL_BITS_M = 0;

  const getBit = (x, i) => ((x >>> i) & 1) !== 0;

  function rawDataModules(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  const dataCodewords = ver => Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];

  function alignmentPositions(ver) {
    if (ver === 1) return [];
    const n = Math.floor(ver / 7) + 2;
    const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    const out = [6];
    for (let pos = ver * 4 + 10; out.length < n; pos -= step) out.splice(1, 0, pos);
    return out;
  }

  // Reed–Solomon em GF(256), polinômio 0x11D
  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
    return z & 0xff;
  }
  function rsDivisor(degree) {
    const r = new Array(degree).fill(0);
    r[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < r.length; j++) { r[j] = gfMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      root = gfMul(root, 0x02);
    }
    return r;
  }
  function rsRemainder(data, div) {
    const r = div.map(() => 0);
    for (const b of data) {
      const f = b ^ r.shift();
      r.push(0);
      div.forEach((c, i) => { r[i] ^= gfMul(c, f); });
    }
    return r;
  }

  function encode(text, { mask } = {}) {
    const bytes = [...new TextEncoder().encode(text)];
    let ver = 1;
    for (; ver <= 10; ver++) {
      const capBits = dataCodewords(ver) * 8;
      const need = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
      if (need <= capBits) break;
    }
    if (ver > 10) throw new Error("Link longo demais para o QR Code.");

    // ---- Bits de dados ----
    const bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(0b0100, 4);
    push(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(b => push(b, 8));
    const cap = dataCodewords(ver) * 8;
    push(0, Math.min(4, cap - bits.length));
    push(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) push(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));

    // ---- Blocos com correção de erro, intercalados ----
    const nBlocks = NUM_BLOCKS[ver], eccLen = ECC_PER_BLOCK[ver];
    const raw = Math.floor(rawDataModules(ver) / 8);
    const nShort = nBlocks - (raw % nBlocks), shortLen = Math.floor(raw / nBlocks);
    const div = rsDivisor(eccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < nBlocks; i++) {
      const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const codewords = [];
    for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => {
      if (i !== shortLen - eccLen || j >= nShort) codewords.push(b[i]);
    });

    // ---- Matriz ----
    const size = ver * 4 + 17;
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, dark) => { mod[y][x] = dark; fn[y][x] = true; };

    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const al = alignmentPositions(ver), last = al.length - 1;
    al.forEach((ax, i) => al.forEach((ay, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));

    const drawFormat = mask => {
      const d = (ECL_BITS_M << 3) | mask;
      let rem = d;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const b = ((d << 10) | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i++) set(8, i, getBit(b, i));
      set(8, 7, getBit(b, 6)); set(8, 8, getBit(b, 7)); set(7, 8, getBit(b, 8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, getBit(b, i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, getBit(b, i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, getBit(b, i));
      set(8, size - 8, true);
    };
    drawFormat(0); // reserva a área

    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const b = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = getBit(b, i), a = size - 11 + (i % 3), c = Math.floor(i / 3);
        set(a, c, bit); set(c, a, bit);
      }
    }

    // Dados em zigue-zague
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
        const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - v : v;
        if (!fn[y][x] && bi < codewords.length * 8) { mod[y][x] = getBit(codewords[bi >>> 3], 7 - (bi & 7)); bi++; }
      }
    }

    const MASKS = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ];
    const applyMask = m => {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] = !mod[y][x];
    };

    let best = 0, bestScore = Infinity;
    for (let m = 0; m < 8; m++) {
      if (mask !== undefined && m !== mask) continue; // máscara fixa (usado nos testes)
      applyMask(m); drawFormat(m);
      const sc = penalty(mod, size);
      if (sc < bestScore) { bestScore = sc; best = m; }
      applyMask(m); // desfaz (XOR)
    }
    applyMask(best); drawFormat(best);
    return mod;
  }

  /** Pontuação oficial simplificada: quanto menor, mais fácil de ler. */
  function penalty(m, size) {
    let p = 0;
    const lines = [];
    for (let i = 0; i < size; i++) { lines.push(m[i]); lines.push(m.map(r => r[i])); }
    for (const line of lines) {
      let run = 1;
      for (let i = 1; i <= size; i++) {
        if (i < size && line[i] === line[i - 1]) run++;
        else { if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      const s = line.map(v => (v ? 1 : 0)).join("");
      p += 40 * ((s.match(/(?=10111010000|00001011101)/g) || []).length);
    }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
    }
    const dark = m.flat().filter(Boolean).length, total = size * size;
    p += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
    return p;
  }

  return { encode };
})();

/** SVG do QR Code com margem de 4 módulos (exigida pelo padrão). */
function qrSvg(text, { dark = "#000", light = "#fff" } = {}) {
  const m = QR.encode(text), n = m.length, q = 4, size = n + q * 2;
  let path = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) path += `M${x + q} ${y + q}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img"><rect width="${size}" height="${size}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
}
