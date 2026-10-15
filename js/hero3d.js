/**
 * hero3d.js
 * -------------------------------------------------------
 * Cena 3D do topo, uma por nicho, que reage ao cursor (no
 * celular, ao toque). Motor WebGL próprio e enxuto: nenhuma
 * biblioteca de fora, nenhum modelo baixado — tudo é desenhado
 * por código (formas de revolução, toros, superelipsoides).
 *
 *   cloche   restaurante  — a tampa se ergue quando o cursor chega perto
 *   pizza    pizzaria     — uma fatia sai puxando o queijo
 *   burger   hamburgueria — as camadas se separam
 *   sushi    japonês      — o hashi se aproxima e belisca
 *   coffee   cafeteria    — o vapor aumenta e a xícara gira
 *   cupcake  doceria      — pula e espalha confeitos
 *   pastel   pastelaria   — o pastel levanta e o caldo de cana gira
 *
 * Economia: só desenha quando o topo está visível e a aba está
 * aberta; com "reduzir movimento" ligado, fica parado (mas ainda
 * acompanha o cursor). Sem WebGL, mostra a ilustração do nicho.
 * -------------------------------------------------------
 */

/* ================= Matemática (matrizes 4×4 em coluna) ================= */

const M4 = {
  ident() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  persp(fovy, aspect, near, far) {
    const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
    o[0] = t / aspect; o[5] = t; o[10] = (far + near) / (near - far); o[11] = -1; o[14] = (2 * far * near) / (near - far);
    return o;
  },
  lookAt(e, c, up) {
    const z = V3.norm(V3.sub(e, c)), x = V3.norm(V3.cross(up, z)), y = V3.cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -V3.dot(x, e), -V3.dot(y, e), -V3.dot(z, e), 1]);
  },
  /** Translação · Ry · Rx · Rz · Escala */
  trs(p, r, s) {
    const [cx, sx, cy, sy, cz, sz] = [Math.cos(r[0]), Math.sin(r[0]), Math.cos(r[1]), Math.sin(r[1]), Math.cos(r[2]), Math.sin(r[2])];
    // R = Ry * Rx * Rz (colunas)
    const r00 = cy * cz + sy * sx * sz, r10 = cx * sz, r20 = -sy * cz + cy * sx * sz;
    const r01 = -cy * sz + sy * sx * cz, r11 = cx * cz, r21 = sy * sz + cy * sx * cz;
    const r02 = sy * cx, r12 = -sx, r22 = cy * cx;
    return new Float32Array([
      r00 * s[0], r10 * s[0], r20 * s[0], 0,
      r01 * s[1], r11 * s[1], r21 * s[1], 0,
      r02 * s[2], r12 * s[2], r22 * s[2], 0,
      p[0], p[1], p[2], 1,
    ]);
  },
  /** Matriz das normais = cofatores da parte 3×3 / determinante (inversa transposta). */
  normal(m) {
    const a = (r, c) => m[c * 4 + r];
    const cof = (r, c) => {
      const rs = [0, 1, 2].filter(i => i !== r), cs = [0, 1, 2].filter(i => i !== c);
      const d = a(rs[0], cs[0]) * a(rs[1], cs[1]) - a(rs[0], cs[1]) * a(rs[1], cs[0]);
      return (r + c) % 2 ? -d : d;
    };
    const det = a(0, 0) * cof(0, 0) + a(0, 1) * cof(0, 1) + a(0, 2) * cof(0, 2) || 1e-9;
    const o = new Float32Array(9);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[c * 3 + r] = cof(r, c) / det;
    return o;
  },
};

const V3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

/** Cor "#RRGGBB" → [r, g, b] de 0 a 1. */
function hexRGB(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
}

/** Ruído simples e repetível (para manchas de queijo, tostado da massa…). */
function noise3(x, y, z) {
  const h = (i, j, k) => { const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (i, j, k) => h(xi + i, yi + j, zi + k);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

/* ================= Geometria ================= */

/** Superfície paramétrica (u, v em 0..1) com normais suaves. */
function paramGeo(nu, nv, f, { wrapU = false, color = null, poleNormals = false } = {}) {
  const pos = [], col = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const p = f(i / nu, j / nv);
    pos.push(p[0], p[1], p[2]);
    const c = color ? color(p, i / nu, j / nv) : [1, 1, 1];
    col.push(c[0], c[1], c[2]);
  }
  const row = nu + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const nor = computeNormals(pos, idx);
  if (wrapU) for (let j = 0; j <= nv; j++) {
    const a = j * row * 3, b = (j * row + nu) * 3;
    const n = V3.norm([nor[a] + nor[b], nor[a + 1] + nor[b + 1], nor[a + 2] + nor[b + 2]]);
    nor.set(n, a); nor.set(n, b);
  }
  if (poleNormals) [[0, -1], [nv, 1]].forEach(([j, sign]) => {
    for (let i = 0; i <= nu; i++) {
      const k = (j * row + i) * 3;
      if (Math.hypot(pos[k], pos[k + 2]) < 1e-6) nor.set([0, sign, 0], k);
    }
  });
  return { pos: new Float32Array(pos), nor, col: new Float32Array(col), idx: new Uint16Array(idx) };
}

function computeNormals(pos, idx) {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
    const e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const fn = V3.cross(e1, e2);
    if (Math.hypot(fn[0], fn[1], fn[2]) < 1e-12) continue; // triângulo degenerado (polo, vinco)
    for (const v of [a, b, c]) { n[v] += fn[0]; n[v + 1] += fn[1]; n[v + 2] += fn[2]; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  return n;
}

/** Sólido de revolução: perfil [[raio, altura], …] de baixo para cima. Pontos repetidos = quina viva. */
function lathe(profile, seg = 48, opts = {}) {
  const n = profile.length - 1;
  const rr = opts.radius || (() => 1);
  return paramGeo(seg, n, (u, v) => {
    const k = Math.round(v * n);
    const [r, y] = profile[k];
    const a = u * TAU, m = rr(a, y);
    return [Math.cos(a) * r * m, y, Math.sin(a) * r * m];
  }, { wrapU: true, poleNormals: true, color: opts.color });
}

const sphereGeo = (r = 1, seg = 32, rings = 18, color) =>
  lathe(Array.from({ length: rings + 1 }, (_, i) => { const a = -Math.PI / 2 + (i / rings) * Math.PI; return [Math.cos(a) * r, Math.sin(a) * r]; }), seg, { color });

const cylinderGeo = (r, h, seg = 40, color) =>
  lathe([[0, 0], [r, 0], [r, 0], [r, h], [r, h], [0, h]], seg, { color });

function torusGeo(R, r, nu = 48, nv = 16, arc = TAU, color) {
  return paramGeo(nu, nv, (u, v) => {
    const a = u * arc, b = v * TAU;
    return [Math.cos(a) * (R + r * Math.cos(b)), r * Math.sin(b), Math.sin(a) * (R + r * Math.cos(b))];
  }, { wrapU: arc >= TAU, color });
}

/** Superelipsoide: caixa arredondada (e≈0,2), almofada, grão de arroz… */
function superGeo(rx, ry, rz, e1 = 0.3, e2 = 0.3, nu = 36, nv = 20, color, bend) {
  const sp = (w, e) => Math.sign(Math.sin(w)) * Math.abs(Math.sin(w)) ** e;
  const cp = (w, e) => Math.sign(Math.cos(w)) * Math.abs(Math.cos(w)) ** e;
  return paramGeo(nu, nv, (u, v) => {
    const th = u * TAU, ph = -Math.PI / 2 + v * Math.PI;
    let p = [rx * cp(ph, e1) * cp(th, e2), ry * sp(ph, e1), rz * cp(ph, e1) * sp(th, e2)];
    if (bend) p = bend(p);
    return p;
  }, { wrapU: true, color });
}

/** Fatia (cunha) com tampa, fundo, borda e laterais — quinas vivas. */
function wedgeGeo(r, h, a0, a1, seg = 12, topColor, sideColor) {
  const pos = [], nor = [], col = [], idx = [];
  const push = (p, n, c) => { pos.push(...p); nor.push(...n); col.push(...c); return pos.length / 3 - 1; };
  const tc = p => (topColor ? topColor(p) : [1, 1, 1]);
  const sc = sideColor || [1, 1, 1];
  // tampa e fundo (leque a partir do centro)
  for (const [y, ny] of [[h, 1], [0, -1]]) {
    const c = push([0, y, 0], [0, ny, 0], ny > 0 ? tc([0, y, 0]) : sc);
    const ring = [];
    for (let i = 0; i <= seg; i++) {
      const a = lerp(a0, a1, i / seg), p = [Math.cos(a) * r, y, Math.sin(a) * r];
      ring.push(push(p, [0, ny, 0], ny > 0 ? tc(p) : sc));
    }
    for (let i = 0; i < seg; i++) idx.push(c, ring[i], ring[i + 1]);
  }
  // borda externa
  for (let i = 0; i <= seg; i++) {
    const a = lerp(a0, a1, i / seg), n = [Math.cos(a), 0, Math.sin(a)];
    push([n[0] * r, 0, n[2] * r], n, sc); push([n[0] * r, h, n[2] * r], n, sc);
  }
  const base = pos.length / 3 - (seg + 1) * 2;
  for (let i = 0; i < seg; i++) { const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  // laterais
  for (const a of [a0, a1]) {
    const n = V3.norm(V3.cross([Math.cos(a), 0, Math.sin(a)], [0, 1, 0]));
    const k = push([0, 0, 0], n, sc); push([Math.cos(a) * r, 0, Math.sin(a) * r], n, sc);
    push([Math.cos(a) * r, h, Math.sin(a) * r], n, sc); push([0, h, 0], n, sc);
    idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), col: new Float32Array(col), idx: new Uint16Array(idx) };
}

/** Tubo ao longo de uma curva (hashi, canudo, cobertura em espiral, borda do pastel). */
function tubeGeo(curve, radius, nu = 64, nv = 12, color, closed = false) {
  return paramGeo(nu, nv, (u, v) => {
    const p = curve(u), e = 1e-3;
    const q = curve(closed ? (u + e) % 1 : Math.min(1, u + e)), o = curve(closed ? (u - e + 1) % 1 : Math.max(0, u - e));
    const t = V3.norm(V3.sub(q, o));
    let ref = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const nx = V3.norm(V3.cross(t, ref)), ny = V3.cross(nx, t);
    const rad = typeof radius === "function" ? radius(u) : radius;
    const a = v * TAU;
    return [p[0] + (nx[0] * Math.cos(a) + ny[0] * Math.sin(a)) * rad,
            p[1] + (nx[1] * Math.cos(a) + ny[1] * Math.sin(a)) * rad,
            p[2] + (nx[2] * Math.cos(a) + ny[2] * Math.sin(a)) * rad];
  }, { color, wrapU: closed });
}

/* ================= Motor ================= */

const VS = `
attribute vec3 aPos; attribute vec3 aNor; attribute vec3 aCol;
uniform mat4 uProj, uView, uModel; uniform mat3 uNM;
varying vec3 vN; varying vec3 vC; varying vec3 vW;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vW = w.xyz; vN = uNM * aNor; vC = aCol;
  gl_Position = uProj * uView * w;
}`;
const FS = `
precision mediump float;
varying vec3 vN; varying vec3 vC; varying vec3 vW;
uniform vec3 uTint, uLight, uCam, uSky, uGround, uRim;
uniform float uShine, uSpec, uAlpha;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 base = vC * uTint;
  vec3 L = normalize(uLight), V = normalize(uCam - vW), H = normalize(L + V);
  float wrap = max((dot(n, L) + 0.4) / 1.4, 0.0);
  vec3 hemi = mix(uGround, uSky, n.y * 0.5 + 0.5);
  float spec = pow(max(dot(n, H), 0.0), uShine) * uSpec;
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  vec3 c = base * (hemi * 0.5 + wrap * 0.9) + vec3(spec) + uRim * rim * 0.45;
  c = c / (c + vec3(0.75)) * 1.75;
  gl_FragColor = vec4(c, uAlpha);
}`;
const FX_VS = `
attribute vec3 aPos; attribute float aA;
uniform mat4 uProj, uView, uModel; uniform float uSize;
varying float vA;
void main() {
  vA = aA;
  gl_Position = uProj * uView * uModel * vec4(aPos, 1.0);
  gl_PointSize = uSize / gl_Position.w;
}`;
const FX_FS = `
precision mediump float;
uniform vec3 uColor; uniform float uAlpha, uPoint;
varying float vA;
void main() {
  float a = vA;
  if (uPoint > 0.5) { vec2 d = gl_PointCoord - 0.5; a *= smoothstep(0.5, 0.05, length(d)); }
  gl_FragColor = vec4(uColor, a * uAlpha);
}`;

function compile(gl, vs, fs) {
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const loc = {};
  const nA = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES), nU = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < nA; i++) { const a = gl.getActiveAttrib(p, i); loc[a.name] = gl.getAttribLocation(p, a.name); }
  for (let i = 0; i < nU; i++) { const u = gl.getActiveUniform(p, i); loc[u.name] = gl.getUniformLocation(p, u.name); }
  return { p, loc };
}

function upload(gl, geo) {
  const buf = (data, target = gl.ARRAY_BUFFER) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b; };
  return { pos: buf(geo.pos), nor: buf(geo.nor), col: buf(geo.col), idx: buf(geo.idx, gl.ELEMENT_ARRAY_BUFFER), count: geo.idx.length };
}

/** Nó da cena. */
function N(geo, o = {}) {
  return {
    geo, mesh: null,
    color: o.color ? hexRGB(o.color) : [1, 1, 1],
    pos: o.pos || [0, 0, 0], rot: o.rot || [0, 0, 0],
    scale: typeof o.scale === "number" ? [o.scale, o.scale, o.scale] : o.scale || [1, 1, 1],
    spec: o.spec ?? 0.15, shine: o.shine ?? 24, alpha: o.alpha ?? 1,
    children: o.children || [], update: o.update || null, hidden: false,
  };
}
const G = (children, o = {}) => N(null, { ...o, children });

/* ================= Cenas ================= */

const SCENES = {
  /* ---------- Restaurante: prato com cloche ---------- */
  cloche() {
    const plate = N(lathe([[0, 0], [0.9, 0], [0.98, 0.04], [1.25, 0.13], [1.3, 0.16], [1.26, 0.17], [1.0, 0.09], [0, 0.09]], 64), { color: "#F7F3EC", spec: 0.35, shine: 50 });
    const rim = N(torusGeo(1.27, 0.018, 64, 8), { color: "#E8A93B", pos: [0, 0.165, 0], spec: 0.8, shine: 60 });
    const steak = N(superGeo(0.46, 0.11, 0.32, 0.35, 0.6, 36, 18, p => {
      const n = noise3(p[0] * 9, p[1] * 9, p[2] * 9);
      return p[1] > 0.06 ? [0.42 + n * 0.12, 0.2 + n * 0.06, 0.1] : [0.55, 0.26, 0.12];
    }), { pos: [0.18, 0.2, 0.08], rot: [0, 0.35, 0], spec: 0.5, shine: 30 });
    const grill = [-0.2, 0, 0.2].map(x => N(superGeo(0.04, 0.012, 0.28, 0.3, 0.3, 12, 8), { color: "#2B1308", pos: [0.18 + x, 0.31, 0.08], rot: [0, 0.35 + 0.6, 0] }));
    const rice = N(superGeo(0.34, 0.17, 0.3, 0.7, 0.8, 32, 16, p => { const n = noise3(p[0] * 30, p[1] * 30, p[2] * 30); return [0.95 - n * 0.08, 0.93 - n * 0.08, 0.86 - n * 0.06]; }),
      { pos: [-0.42, 0.18, 0.22], spec: 0.1 });
    const greens = Array.from({ length: 7 }, (_, i) => N(sphereGeo(0.1 + (i % 3) * 0.02, 14, 10), {
      color: i % 2 ? "#4E8A3A" : "#6BA34A", pos: [-0.15 + Math.cos(i * 0.9) * 0.22, 0.17, -0.48 + Math.sin(i * 0.9) * 0.12], scale: [1, 0.7, 1],
    }));
    const tomatoes = [0, 1].map(i => N(cylinderGeo(0.11, 0.05, 20), { color: "#D23A2A", pos: [0.62 - i * 0.12, 0.12, -0.32 + i * 0.16], spec: 0.6, shine: 40 }));

    const dome = N(lathe(Array.from({ length: 21 }, (_, i) => { const a = (i / 20) * (Math.PI / 2); return [Math.cos(a) * 1.08, Math.sin(a) * 0.95]; }).concat([[0, 0.95]]), 64, {
      // reflexo de inox: faixas claras e escuras conforme a altura
      color: p => { const y = p[1] / 0.95, band = 0.5 + 0.5 * Math.sin(y * 7.5 + 1.2); return [0.42 + band * 0.42, 0.45 + band * 0.42, 0.5 + band * 0.42]; },
    }), { spec: 1.1, shine: 70 });
    const domeRim = N(torusGeo(1.08, 0.035, 64, 10), { color: "#B4BAC3", spec: 1.2, shine: 80 });
    const knob = N(sphereGeo(0.12, 20, 12), { color: "#E8A93B", pos: [0, 1.02, 0], scale: [1, 0.75, 1], spec: 1.2, shine: 80 });
    const stem = N(cylinderGeo(0.04, 0.1, 12), { color: "#B4BAC3", pos: [0, 0.93, 0] });
    const cloche = G([dome, domeRim, stem, knob], { pos: [0, 0.12, 0] });
    cloche.update = (t, s) => {
      const lift = 0.06 + s.hover * 0.95 + Math.sin(t * 1.6) * 0.025;
      cloche.pos = [-s.hover * 0.55, 0.12 + lift, -s.hover * 0.25];
      cloche.rot = [-s.hover * 0.55, 0, s.hover * 0.45];
      s.steamRate = clamp(s.hover * 1.4, 0.15, 1);
    };
    return {
      root: G([plate, rim, steak, ...grill, rice, ...greens, ...tomatoes, cloche]),
      cam: { dist: 4.4, height: 2.3, target: [0, 0.35, 0] },
      shadow: 1.45, steam: { at: [0, 0.35, 0], spread: 0.5 },
    };
  },

  /* ---------- Pizzaria: fatia puxando o queijo ---------- */
  pizza() {
    const board = N(lathe([[0, 0], [1.42, 0], [1.42, 0], [1.42, 0.08], [1.38, 0.1], [0, 0.1]], 64, {
      color: p => { const g = noise3(p[0] * 2, 0, p[2] * 18) * 0.15; return [0.73 - g, 0.52 - g, 0.31 - g]; },
    }), { spec: 0.2 });
    const cheese = p => {
      const n = noise3(p[0] * 6, 7, p[2] * 6), d = Math.hypot(p[0], p[2]);
      const burnt = clamp((n - 0.62) * 4, 0, 1) * 0.35;
      return d > 0.98 ? [0.85, 0.6, 0.32] : [0.98 - burnt, 0.8 - burnt * 1.2, 0.36 - burnt * 0.6];
    };
    const slices = [], SL = 8;
    for (let i = 0; i < SL; i++) {
      const a0 = (i / SL) * TAU + 0.004, a1 = ((i + 1) / SL) * TAU - 0.004, mid = (a0 + a1) / 2;
      const kids = [N(wedgeGeo(1.08, 0.07, a0, a1, 10, cheese, [0.86, 0.62, 0.35]), { spec: 0.35, shine: 20 }),
        N(torusGeo(1.06, 0.085, 10, 10, a1 - a0, p => { const n = noise3(p[0] * 8, p[1] * 8, p[2] * 8); return [0.84 - n * 0.14, 0.56 - n * 0.14, 0.27 - n * 0.08]; }),
          { pos: [0, 0.06, 0], rot: [0, -a0, 0] })];
      // pepperoni e manjericão em posições fixas dentro da fatia
      [[0.58, 0.35], [0.82, 0.62], [0.33, 0.68]].forEach(([r, f], k) => {
        const a = lerp(a0, a1, f);
        kids.push(N(cylinderGeo(0.13, 0.025, 20, p => { const d = Math.hypot(p[0], p[2]); return d > 0.1 ? [0.5, 0.1, 0.07] : [0.72, 0.15, 0.1]; }),
          { pos: [Math.cos(a) * r, 0.07, Math.sin(a) * r], spec: 0.7, shine: 40, scale: k === 2 ? 0.8 : 1 }));
      });
      if (i % 2 === 0) kids.push(N(superGeo(0.09, 0.012, 0.05, 0.5, 0.5, 12, 8), { color: "#3F7A3A", pos: [Math.cos(mid) * 0.6, 0.1, Math.sin(mid) * 0.6], rot: [0, -mid, 0] }));
      const slice = G(kids);
      slice.mid = mid;
      slices.push(slice);
    }
    const pulled = slices[1];
    const strings = [0, 1, 2].map(k => N(cylinderGeo(0.018 - k * 0.004, 1, 8), { color: "#F7D77A", spec: 0.4 }));
    const pie = G([...slices, ...strings], { pos: [0, 0.1, 0] });
    pie.update = (t, s) => {
      const out = s.hover * 0.85 + Math.max(0, Math.sin(t * 0.8)) * 0.06;
      pulled.pos = [Math.cos(pulled.mid) * out, out * 0.45, Math.sin(pulled.mid) * out];
      pulled.rot = [0, 0, 0];
      // fios de queijo do miolo até a fatia
      strings.forEach((st, k) => {
        const a = pulled.mid + (k - 1) * 0.12, r0 = 0.22 + k * 0.1;
        const from = [Math.cos(a) * r0, 0.07, Math.sin(a) * r0];
        const to = [from[0] + pulled.pos[0], from[1] + pulled.pos[1], from[2] + pulled.pos[2]];
        const d = V3.sub(to, from), len = Math.hypot(...d);
        st.hidden = len < 0.08;
        const yaw = Math.atan2(d[0], d[2]), pitch = Math.acos(clamp(d[1] / (len || 1), -1, 1));
        st.pos = from; st.rot = [pitch, yaw, 0]; st.scale = [1, len, 1];
      });
    };
    return { root: G([board, pie]), cam: { dist: 4.3, height: 2.8, target: [0, 0.1, 0] }, shadow: 1.55 };
  },

  /* ---------- Hamburgueria: camadas que se separam ---------- */
  burger() {
    const bunCol = p => { const n = noise3(p[0] * 5, p[1] * 5, p[2] * 5); return [0.88 - n * 0.1, 0.55 - n * 0.12, 0.22 - n * 0.06]; };
    const bottom = N(lathe([[0, 0], [0.9, 0], [1.0, 0.07], [1.02, 0.2], [0.98, 0.26], [0, 0.26]], 48, { color: bunCol }), { spec: 0.2 });
    const patty = N(lathe([[0, 0], [1.02, 0], [1.08, 0.08], [1.06, 0.17], [1.0, 0.24], [0, 0.24]], 48, {
      radius: a => 1 + Math.sin(a * 9) * 0.015 + Math.sin(a * 23) * 0.01,
      color: p => { const n = noise3(p[0] * 12, p[1] * 12, p[2] * 12); return [0.33 + n * 0.1, 0.16 + n * 0.06, 0.08]; },
    }), { spec: 0.6, shine: 25 });
    const cheese = N(paramGeo(24, 24, (u, v) => {
      const x = (u - 0.5) * 1.85, z = (v - 0.5) * 1.85, d = Math.max(0, Math.hypot(x, z) - 0.9);
      return [x, -d * d * 0.9, z];
    }), { color: "#FFC93C", rot: [0, 0.7, 0], spec: 0.7, shine: 35 });
    const tomato = N(cylinderGeo(0.98, 0.07, 40, p => (Math.hypot(p[0], p[2]) > 0.85 ? [0.8, 0.16, 0.12] : [0.92, 0.3, 0.24])), { spec: 0.7, shine: 40 });
    const lettuce = N(paramGeo(64, 6, (u, v) => {
      const a = u * TAU, r = 0.3 + v * 0.85 + Math.sin(a * 11) * 0.04 * v;
      return [Math.cos(a) * r, Math.sin(a * 9) * 0.06 * v * v + v * 0.02, Math.sin(a) * r];
    }, { wrapU: true }), { color: "#5FA342", spec: 0.4 });
    const topBun = N(lathe(Array.from({ length: 19 }, (_, i) => { const a = (i / 18) * (Math.PI / 2); return [Math.cos(a) * 1.04, Math.sin(a) * 0.72]; }).concat([[0, 0.72]]), 56, { color: bunCol }),
      { spec: 0.45, shine: 30 });
    const seeds = [];
    for (let i = 0; i < 26; i++) {
      const a = i * 2.39996, ring = 0.25 + (i / 26) * 0.95; // espiral áurea
      const lat = Math.acos(clamp(ring, 0, 0.98));
      const x = Math.cos(a) * Math.cos(lat) * 1.04, z = Math.sin(a) * Math.cos(lat) * 1.04, y = Math.sin(lat) * 0.72;
      seeds.push(N(sphereGeo(0.05, 8, 6), { color: "#FFF4DC", pos: [x, y, z], scale: [1, 0.5, 0.6], rot: [0, -a, 0] }));
    }
    const top = G([topBun, ...seeds]);
    const layers = [bottom, patty, cheese, tomato, lettuce, top];
    const baseY = [0, 0.26, 0.5, 0.52, 0.6, 0.66];
    const stack = G(layers);
    stack.update = (t, s) => {
      const e = s.hover;
      layers.forEach((L, i) => { L.pos = [0, baseY[i] + i * e * 0.16 + (i === 5 ? Math.sin(t * 2) * 0.02 : 0), 0]; });
      top.rot = [e * 0.25, 0, -e * 0.15];
      cheese.rot = [0, 0.7 + Math.sin(t * 0.7) * 0.05, 0];
    };
    return { root: stack, cam: { dist: 5.4, height: 2.0, target: [0, 0.9, 0] }, shadow: 1.35 };
  },

  /* ---------- Japonês: niguiri, maki e hashi ---------- */
  sushi() {
    const board = N(superGeo(1.75, 0.08, 0.85, 0.12, 0.12, 40, 12, p => { const g = noise3(p[0] * 1.5, 0, p[2] * 20) * 0.12; return [0.8 - g, 0.63 - g, 0.45 - g]; }), { spec: 0.15 });
    const rice = (x, z) => N(superGeo(0.42, 0.17, 0.24, 0.55, 0.45, 32, 16, p => { const n = noise3(p[0] * 40, p[1] * 40, p[2] * 40); return [0.97 - n * 0.09, 0.96 - n * 0.09, 0.92 - n * 0.08]; }),
      { pos: [x, 0.24, z], spec: 0.1 });
    const salmon = (x, z) => N(superGeo(0.5, 0.075, 0.29, 0.25, 0.3, 36, 14, p => {
      const band = Math.sin(p[0] * 14 + p[2] * 7) > 0.55 ? 1 : 0;
      return band ? [1, 0.86, 0.78] : [0.98, 0.55, 0.38];
    }, p => [p[0], p[1] - p[0] * p[0] * 0.22, p[2]]), { pos: [x, 0.45, z], spec: 0.9, shine: 45 });
    const nigiri = [G([rice(0, 0), salmon(0, 0)], { pos: [-0.75, 0, 0.1], rot: [0, 0.25, 0] }),
                    G([rice(0, 0), salmon(0, 0)], { pos: [-0.25, 0, -0.35], rot: [0, 0.25, 0] })];
    const maki = [[0.45, 0.25], [0.95, 0.05], [0.7, -0.4]].map(([x, z], i) => G([
      N(cylinderGeo(0.3, 0.34, 32), { color: "#1E2A22", spec: 0.3 }),
      N(cylinderGeo(0.27, 0.345, 32, p => { const n = noise3(p[0] * 40, 3, p[2] * 40); return [0.97 - n * 0.1, 0.96 - n * 0.1, 0.92 - n * 0.08]; }), { spec: 0.1 }),
      N(cylinderGeo(0.11, 0.35, 20), { color: i === 1 ? "#6BA34A" : "#F4A27B", spec: 0.6 }),
    ], { pos: [x, 0.08, z] }));
    const stick = taper => tubeGeo(u => [lerp(-1.5, 1.4, u), 0, 0], u => lerp(0.05, taper, u), 24, 8);
    const sticks = [N(stick(0.022), { color: "#8A5A3C", spec: 0.5 }), N(stick(0.022), { color: "#8A5A3C", spec: 0.5 })];
    const hashi = G(sticks, { pos: [0.4, 1.0, 0.55] });
    hashi.update = (t, s) => {
      const pinch = 0.12 * (1 - s.hover) + 0.02;
      sticks[0].rot = [0, 0, -0.18 - pinch]; sticks[1].rot = [0, pinch * 0.6, -0.18 + pinch * 0.3]; sticks[1].pos = [0, 0, 0.08];
      hashi.pos = [lerp(0.6, 0.15, s.hover), lerp(1.05, 0.72, s.hover) + Math.sin(t * 1.5) * 0.03, lerp(0.75, 0.25, s.hover)];
      hashi.rot = [0, -0.6, 0];
      maki[0].pos[1] = 0.08 + s.hover * 0.25;
    };
    return { root: G([board, ...nigiri, ...maki, hashi]), cam: { dist: 4.6, height: 2.6, target: [0, 0.25, 0] }, shadow: 1.8 };
  },

  /* ---------- Cafeteria: xícara com vapor ---------- */
  coffee() {
    const saucer = N(lathe([[0, 0], [0.55, 0], [0.62, 0.03], [1.15, 0.1], [1.2, 0.13], [1.14, 0.13], [0.6, 0.07], [0, 0.07]], 64), { color: "#FFFCF8", spec: 0.5, shine: 60 });
    const cup = N(lathe([[0, 0.07], [0.42, 0.07], [0.48, 0.12], [0.68, 0.5], [0.8, 0.95], [0.82, 1.0], [0.76, 1.0], [0.74, 0.96], [0.62, 0.5], [0.42, 0.18], [0, 0.18]], 64, {
      color: p => (p[1] > 0.55 && p[1] < 0.6 && Math.hypot(p[0], p[2]) > 0.65 ? [0.85, 0.63, 0.4] : [1, 0.99, 0.97]),
    }), { spec: 0.7, shine: 70 });
    const coffee = N(cylinderGeo(0.75, 0.02, 48, p => {
      const x = p[0] / 0.75, z = p[2] / 0.75;
      // coração de latte art: (x²+y²-1)³ - x²y³ < 0
      const hx = x * 1.9, hy = -z * 1.9 + 0.3, heart = (hx * hx + hy * hy - 1) ** 3 - hx * hx * hy ** 3 < 0;
      const ring = Math.hypot(x, z) > 0.9;
      return heart ? [0.95, 0.86, 0.72] : ring ? [0.62, 0.42, 0.26] : [0.42, 0.26, 0.15];
    }), { pos: [0, 0.86, 0], spec: 0.8, shine: 60 });
    const handle = N(torusGeo(0.27, 0.06, 32, 12, Math.PI * 1.25), { color: "#FFFCF8", pos: [0.8, 0.62, 0], rot: [Math.PI / 2, 0, Math.PI * 0.62], spec: 0.7, shine: 70 });
    const cupG = G([cup, coffee, handle], { pos: [0, 0.06, 0] });
    const beans = [[-1.25, 0.55], [-1.05, 0.95], [1.3, -0.5]].map(([x, z], i) => N(superGeo(0.13, 0.07, 0.09, 0.6, 0.8, 18, 12, p => (Math.abs(p[2]) < 0.012 && p[1] > 0 ? [0.15, 0.08, 0.05] : [0.4, 0.22, 0.12])),
      { pos: [x, 0.07, z], rot: [0, i * 1.3, 0], spec: 0.8, shine: 50 }));
    const root = G([saucer, cupG, ...beans]);
    root.update = (t, s) => {
      cupG.rot = [0, -0.5 + s.hover * 1.1 + Math.sin(t * 0.6) * 0.08, 0];
      s.steamRate = 0.35 + s.hover * 0.9;
    };
    return { root, cam: { dist: 4.3, height: 2.4, target: [0, 0.6, 0] }, shadow: 1.3, steam: { at: [0, 0.95, 0], spread: 0.45 } };
  },

  /* ---------- Doceria: cupcake com confeitos ---------- */
  cupcake() {
    const wrapper = N(lathe([[0, 0], [0.62, 0], [0.62, 0], [0.82, 0.78], [0.82, 0.78], [0, 0.78]], 72, {
      radius: a => 1 + Math.abs(Math.sin(a * 12)) * 0.05,
      color: (p, u) => (Math.sin(u * TAU * 12) > 0 ? [0.72, 0.24, 0.41] : [0.62, 0.18, 0.34]),
    }), { spec: 0.4, shine: 40 });
    const cake = N(superGeo(0.84, 0.25, 0.84, 0.6, 1, 40, 14), { color: "#C98A4E", pos: [0, 0.8, 0] });
    const turns = 3.2;
    const swirl = N(tubeGeo(u => {
      const a = u * TAU * turns, r = lerp(0.72, 0.05, u);
      return [Math.cos(a) * r, 0.95 + u * 0.75, Math.sin(a) * r];
    }, u => lerp(0.25, 0.1, u), 160, 16, p => { const n = noise3(p[0] * 6, p[1] * 6, p[2] * 6); return [0.98, 0.72 - n * 0.06, 0.8 - n * 0.06]; }), { spec: 0.5, shine: 30 });
    const cherry = N(sphereGeo(0.17, 24, 16), { color: "#B3261E", pos: [0, 1.86, 0], spec: 1.4, shine: 90 });
    const stem = N(tubeGeo(u => [Math.sin(u * 1.2) * 0.15, 1.98 + u * 0.3, 0], 0.015, 16, 6), { color: "#4D7A5A" });
    const colors = ["#FFF7F9", "#F4C542", "#4D7A5A", "#6BB6E8", "#FFFFFF"];
    const sprinkles = Array.from({ length: 36 }, (_, i) => {
      const u = (i + 0.5) / 36, a = u * TAU * turns + 0.6, r = lerp(0.72, 0.1, u) + 0.2 * (1 - u * 0.6);
      return N(superGeo(0.05, 0.016, 0.016, 0.6, 0.6, 10, 6), {
        color: colors[i % colors.length], pos: [Math.cos(a) * r, 1.0 + u * 0.75 + 0.12, Math.sin(a) * r], rot: [i * 0.7, i * 1.3, i * 0.4],
      });
    });
    sprinkles.forEach(sp => { sp.home = sp.pos.slice(); });
    const cup = G([wrapper, cake, swirl, cherry, stem, ...sprinkles]);
    cup.update = (t, s) => {
      const bounce = Math.abs(Math.sin(t * 2.4)) * 0.08 * (0.3 + s.hover);
      cup.pos = [0, bounce, 0];
      const squash = 1 - bounce * 0.5;
      cup.scale = [1 + bounce * 0.25, squash, 1 + bounce * 0.25];
      sprinkles.forEach((sp, i) => {
        const k = s.hover * (0.35 + (i % 5) * 0.06);
        sp.pos = [sp.home[0] * (1 + k), sp.home[1] + k * 0.6 + Math.sin(t * 3 + i) * 0.02 * s.hover, sp.home[2] * (1 + k)];
        sp.rot = [sp.rot[0] + 0.02 * s.hover, sp.rot[1], sp.rot[2]];
      });
    };
    return { root: cup, cam: { dist: 4.6, height: 2.0, target: [0, 0.95, 0] }, shadow: 1.05 };
  },

  /* ---------- Pastelaria: pastel e caldo de cana ---------- */
  pastel() {
    // Contorno em "D": arco + reta (s de 0 a 1 percorre a borda)
    const edge = s => {
      if (s < 0.72) { const a = (s / 0.72) * Math.PI; return [Math.cos(a) * 1.05, Math.sin(a) * 0.8 - 0.3]; }
      const k = (s - 0.72) / 0.28; return [lerp(-1.05, 1.05, k), -0.3];
    };
    const crust = p => { const n = noise3(p[0] * 7, p[1] * 7, p[2] * 7), b = noise3(p[0] * 22, 1, p[2] * 22) > 0.72 ? 0.12 : 0; return [0.93 - n * 0.12 - b, 0.68 - n * 0.14 - b, 0.3 - n * 0.08]; };
    const shell = (h, sign) => N(paramGeo(72, 10, (u, v) => {
      const [x, z] = edge(u), cx = 0, cz = 0.05;
      const px = cx + (x - cx) * v, pz = cz + (z - cz) * v;
      return [px, sign * h * Math.pow(Math.max(0, 1 - v * v), 0.55), pz];
    }, { wrapU: true, color: crust }), { spec: 0.65, shine: 28 });
    const rope = N(tubeGeo(u => { const [x, z] = edge(u); return [x, 0, z]; }, u => 0.06 + Math.abs(Math.sin(u * TAU * 22)) * 0.025, 220, 8,
      p => { const n = noise3(p[0] * 9, p[1] * 9, p[2] * 9); return [0.82 - n * 0.1, 0.54 - n * 0.1, 0.22]; }, true), { spec: 0.5, shine: 25 });
    const pastel = G([shell(0.34, 1), shell(0.1, -1), rope], { pos: [-0.35, 0.16, 0.1], rot: [0, 0.35, 0] });
    const paper = N(superGeo(1.45, 0.02, 1.0, 0.1, 0.1, 24, 8), { color: "#FFF9EA", pos: [-0.35, 0.02, 0.1], rot: [0, 0.35, 0] });

    const glass = N(lathe([[0, 0], [0.32, 0], [0.38, 1.25], [0.36, 1.25], [0.3, 0.06], [0, 0.06]], 40), { color: "#FFFFFF", alpha: 0.28, spec: 1.6, shine: 120 });
    const juice = N(lathe([[0, 0.06], [0.3, 0.06], [0.35, 1.0], [0, 1.0]], 40), { color: "#C9C25A", spec: 0.7, shine: 60 });
    const foam = N(cylinderGeo(0.35, 0.05, 40), { color: "#EFE7B0", pos: [0, 0.98, 0] });
    const lime = N(cylinderGeo(0.2, 0.05, 24, p => (Math.hypot(p[0], p[2]) > 0.17 ? [0.25, 0.55, 0.2] : [0.7, 0.85, 0.35])), { pos: [0.3, 1.18, 0], rot: [0, 0, 1.2] });
    const straw = N(tubeGeo(u => [lerp(0.05, 0.25, u), lerp(0.2, 1.7, u), 0], 0.035, 12, 8), { color: "#3E7B3E", spec: 0.6 });
    const drink = G([juice, foam, straw, lime, glass], { pos: [1.15, 0, -0.45] });

    const root = G([paper, pastel, drink]);
    root.update = (t, s) => {
      pastel.pos = [-0.35, 0.16 + s.hover * 0.45 + Math.sin(t * 1.7) * 0.02, 0.1];
      pastel.rot = [s.hover * 0.45, 0.35 + Math.sin(t * 0.5) * 0.08, -s.hover * 0.2];
      drink.rot = [0, t * 0.25 + s.hover * 1.2, 0];
      s.steamRate = 0.2 + s.hover * 0.8;
    };
    return { root, cam: { dist: 4.5, height: 2.4, target: [0.2, 0.45, 0] }, shadow: 1.7, steam: { at: [-0.35, 0.5, 0.1], spread: 0.7 } };
  },
};

/* ================= Execução ================= */

function startHero3D(container, sceneName) {
  if (!container || !SCENES[sceneName]) return;
  const showFallback = () => {
    container.innerHTML = `<div class="hero-stage-fallback" aria-hidden="true"></div>`;
  };

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false, powerPreference: "low-power" });
  if (!gl) { showFallback(); return; }

  let prog, fx, scene;
  try {
    prog = compile(gl, VS, FS);
    fx = compile(gl, FX_VS, FX_FS);
    scene = SCENES[sceneName]();
  } catch (err) {
    console.warn("3D indisponível:", err.message);
    showFallback();
    return;
  }
  container.prepend(canvas);
  const hint = document.createElement("span");
  hint.className = "hero-stage-hint";
  hint.textContent = matchMedia("(hover: hover)").matches ? "Passe o mouse aqui" : "Toque e arraste";
  container.appendChild(hint);

  // Envia as malhas para a placa de vídeo (uma vez)
  const meshes = new Map();
  (function prepare(n) {
    if (n.geo) { if (!meshes.has(n.geo)) meshes.set(n.geo, upload(gl, n.geo)); n.mesh = meshes.get(n.geo); }
    n.children.forEach(prepare);
  })(scene.root);

  // Sombra suave: disco com transparência que some na borda
  const shadowGeo = (() => {
    const p = [0, 0, 0], a = [0.5], seg = 40;
    for (let r = 1; r <= 4; r++) for (let i = 0; i <= seg; i++) {
      const ang = (i / seg) * TAU, rr = r / 4;
      p.push(Math.cos(ang) * rr, 0, Math.sin(ang) * rr); a.push(0.5 * (1 - rr) ** 1.6);
    }
    const idx = [];
    for (let i = 0; i < seg; i++) idx.push(0, 1 + i, 2 + i);
    for (let r = 1; r < 4; r++) for (let i = 0; i < seg; i++) {
      const A = 1 + (r - 1) * (seg + 1) + i, B = A + seg + 1;
      idx.push(A, B, A + 1, A + 1, B, B + 1);
    }
    const b = { pos: gl.createBuffer(), a: gl.createBuffer(), idx: gl.createBuffer(), count: idx.length };
    gl.bindBuffer(gl.ARRAY_BUFFER, b.pos); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(p), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.a); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(a), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    return b;
  })();

  // Vapor (partículas)
  const STEAM_N = 70;
  const steam = scene.steam ? {
    p: Array.from({ length: STEAM_N }, () => ({ life: Math.random(), x: 0, y: 0, z: 0, seed: Math.random() * 100 })),
    pos: new Float32Array(STEAM_N * 3), a: new Float32Array(STEAM_N),
    bPos: gl.createBuffer(), bA: gl.createBuffer(),
  } : null;

  // Cores do tema (a borda de luz usa o destaque do nicho)
  const css = getComputedStyle(document.documentElement);
  const accent = hexRGB((css.getPropertyValue("--accent").trim() || "#E8A93B"));
  const inkCol = hexRGB((css.getPropertyValue("--ink").trim() || "#1F2A24"));

  // Estado da interação
  const st = { px: 0, py: 0, tx: 0, ty: 0, hover: 0, thover: 0, steamRate: 0.3, drag: 0, dragYaw: 0 };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const onPointer = e => {
    const r = container.getBoundingClientRect();
    if (!r.width) return;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    st.tx = clamp((e.clientX - cx) / (r.width / 2), -1.4, 1.4);
    st.ty = clamp((e.clientY - cy) / (r.height / 2), -1.4, 1.4);
    const d = Math.hypot((e.clientX - cx) / (r.width * 0.55), (e.clientY - cy) / (r.height * 0.6));
    st.thover = clamp(1.25 - d, 0, 1);
    if (reduce) requestFrame();
  };
  window.addEventListener("pointermove", onPointer, { passive: true });
  // Toque: arrastar na horizontal gira a cena; tocar "chega perto"
  canvas.addEventListener("pointerdown", e => { st.drag = e.clientX; st.thover = 1; if (e.pointerType !== "mouse") onPointer(e); });
  window.addEventListener("pointerup", () => { if (st.drag) { st.drag = 0; setTimeout(() => { if (!matchMedia("(hover: hover)").matches) st.thover = 0; }, 1200); } });
  canvas.addEventListener("pointermove", e => { if (st.drag && e.pointerType !== "mouse") { st.dragYaw += (e.clientX - st.drag) * 0.01; st.drag = e.clientX; } });
  container.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") st.thover = 0; });

  // Tamanho do canvas acompanha o palco (nitidez até 2×)
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(container.clientWidth * dpr)), h = Math.max(1, Math.round(container.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    requestFrame();
  };
  new ResizeObserver(resize).observe(container);

  // Só anima quando visível
  let visible = true, raf = 0, last = performance.now(), time = 0;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) requestFrame(); }, { threshold: 0.01 }).observe(container);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { last = performance.now(); requestFrame(); } });
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); cancelAnimationFrame(raf); showFallback(); });

  function requestFrame() { if (!raf) raf = requestAnimationFrame(frame); }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduce) time += dt;
    const k = reduce ? 1 : 1 - Math.pow(0.0025, dt);
    st.px = lerp(st.px, st.tx, k); st.py = lerp(st.py, st.ty, k);
    st.hover = lerp(st.hover, st.thover, reduce ? 1 : 1 - Math.pow(0.02, dt));
    render(time, dt);
    const settling = Math.abs(st.px - st.tx) + Math.abs(st.hover - st.thover) > 0.002;
    if (visible && !document.hidden && (!reduce || settling)) requestFrame();
  }

  function draw(node, parent, view, proj, cam, passAlpha) {
    if (node.hidden) return;
    const model = M4.mul(parent, M4.trs(node.pos, node.rot, node.scale));
    if (node.mesh && (node.alpha < 1) === passAlpha) {
      const L = prog.loc, m = node.mesh;
      gl.uniformMatrix4fv(L.uModel, false, model);
      gl.uniformMatrix3fv(L.uNM, false, M4.normal(model));
      gl.uniform3fv(L.uTint, node.color);
      gl.uniform1f(L.uShine, node.shine); gl.uniform1f(L.uSpec, node.spec); gl.uniform1f(L.uAlpha, node.alpha);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.pos); gl.vertexAttribPointer(L.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.nor); gl.vertexAttribPointer(L.aNor, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.col); gl.vertexAttribPointer(L.aCol, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
      gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
    }
    node.children.forEach(c => draw(c, model, view, proj, cam, passAlpha));
  }

  function runUpdates(node, t) {
    node.update?.(t, st);
    node.children.forEach(c => runUpdates(c, t));
  }

  function render(t, dt) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    runUpdates(scene.root, t);

    // Câmera: gira devagar sozinha + segue o cursor
    const c = scene.cam, aspect = canvas.width / canvas.height;
    const yaw = Math.sin(t * 0.25) * 0.25 + st.px * 0.7 + st.dragYaw;
    const pitch = clamp(st.py * 0.25, -0.3, 0.35);
    const dist = c.dist * (aspect < 1 ? 1.25 : 1);
    const eye = [c.target[0] + Math.sin(yaw) * dist, c.height + pitch * dist + c.target[1] * 0.4, c.target[2] + Math.cos(yaw) * dist];
    const view = M4.lookAt(eye, c.target, [0, 1, 0]);
    const proj = M4.persp(0.62, aspect, 0.1, 50);

    // Sombra
    gl.useProgram(fx.p);
    gl.depthMask(false);
    gl.uniformMatrix4fv(fx.loc.uProj, false, proj); gl.uniformMatrix4fv(fx.loc.uView, false, view);
    gl.uniformMatrix4fv(fx.loc.uModel, false, M4.trs([0, -0.002, 0], [0, 0, 0], [scene.shadow, 1, scene.shadow * 0.85]));
    gl.uniform3fv(fx.loc.uColor, [0, 0, 0]); gl.uniform1f(fx.loc.uAlpha, 0.85); gl.uniform1f(fx.loc.uPoint, 0); gl.uniform1f(fx.loc.uSize, 1);
    gl.enableVertexAttribArray(fx.loc.aPos); gl.enableVertexAttribArray(fx.loc.aA);
    gl.bindBuffer(gl.ARRAY_BUFFER, shadowGeo.pos); gl.vertexAttribPointer(fx.loc.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, shadowGeo.a); gl.vertexAttribPointer(fx.loc.aA, 1, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shadowGeo.idx);
    gl.drawElements(gl.TRIANGLES, shadowGeo.count, gl.UNSIGNED_SHORT, 0);
    gl.disableVertexAttribArray(fx.loc.aA);
    gl.depthMask(true);

    // Objetos: primeiro os opacos, depois os transparentes (vidro)
    gl.useProgram(prog.p);
    const L = prog.loc;
    [L.aPos, L.aNor, L.aCol].forEach(a => gl.enableVertexAttribArray(a));
    gl.uniformMatrix4fv(L.uProj, false, proj); gl.uniformMatrix4fv(L.uView, false, view);
    gl.uniform3fv(L.uLight, [0.55, 1.0, 0.75]); gl.uniform3fv(L.uCam, eye);
    gl.uniform3fv(L.uSky, [1.0, 0.97, 0.92]); gl.uniform3fv(L.uGround, inkCol.map(v => v * 0.6 + 0.12));
    gl.uniform3fv(L.uRim, accent);
    draw(scene.root, M4.ident(), view, proj, eye, false);
    gl.depthMask(false);
    draw(scene.root, M4.ident(), view, proj, eye, true);
    gl.depthMask(true);
    [L.aNor, L.aCol].forEach(a => gl.disableVertexAttribArray(a));

    // Vapor
    if (steam && !reduce) {
      const s = scene.steam;
      steam.p.forEach((q, i) => {
        q.life += dt * (0.28 + st.steamRate * 0.25);
        if (q.life >= 1) {
          if (Math.random() > st.steamRate) { q.life = 1; steam.a[i] = 0; return; }
          q.life = 0; q.x = (Math.random() - 0.5) * s.spread; q.z = (Math.random() - 0.5) * s.spread;
        }
        const y = s.at[1] + q.life * 1.6, wob = Math.sin(q.seed + q.life * 6) * 0.12 * q.life;
        steam.pos.set([s.at[0] + q.x + wob, y, s.at[2] + q.z + wob * 0.5], i * 3);
        steam.a[i] = Math.sin(q.life * Math.PI) * 0.35;
      });
      gl.useProgram(fx.p);
      gl.depthMask(false);
      gl.uniformMatrix4fv(fx.loc.uModel, false, M4.ident());
      gl.uniform3fv(fx.loc.uColor, [1, 1, 1]); gl.uniform1f(fx.loc.uAlpha, 1); gl.uniform1f(fx.loc.uPoint, 1);
      gl.uniform1f(fx.loc.uSize, 90 * (canvas.height / 400));
      gl.enableVertexAttribArray(fx.loc.aA);
      gl.bindBuffer(gl.ARRAY_BUFFER, steam.bPos); gl.bufferData(gl.ARRAY_BUFFER, steam.pos, gl.DYNAMIC_DRAW); gl.vertexAttribPointer(fx.loc.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, steam.bA); gl.bufferData(gl.ARRAY_BUFFER, steam.a, gl.DYNAMIC_DRAW); gl.vertexAttribPointer(fx.loc.aA, 1, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.POINTS, 0, STEAM_N);
      gl.disableVertexAttribArray(fx.loc.aA);
      gl.depthMask(true);
    }
  }

  resize();
}
