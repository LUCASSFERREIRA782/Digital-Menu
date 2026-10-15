/**
 * hero-foto.js
 * -------------------------------------------------------
 * Foto real com profundidade ("foto 3D"). Usa o motor do
 * hero3d.js (matrizes, malha, shaders).
 *
 * A foto vira um cartão 3D. A profundidade é estimada aqui
 * mesmo, no navegador: o prato (o que mais difere da cor das
 * bordas e fica perto do centro) "salta" para frente e o fundo
 * fica atrás. O cartão se inclina com o cursor e, de perto, o
 * prato ganha mais volume. Borda grossa e sombra "carimbada"
 * na cor do nicho, como o resto do design.
 * -------------------------------------------------------
 */

const PHOTO_VS = `
attribute vec3 aPos; attribute vec2 aUV; attribute vec3 aNor;
uniform mat4 uProj, uView, uModel; uniform mat3 uNM;
varying vec2 vUV; varying vec3 vN; varying vec3 vW;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vUV = aUV; vN = uNM * aNor; vW = w.xyz;
  gl_Position = uProj * uView * w;
}`;
const PHOTO_FS = `
precision mediump float;
varying vec2 vUV; varying vec3 vN; varying vec3 vW;
uniform sampler2D uTex;
uniform vec3 uLight, uCam, uBorder, uSolid;
uniform float uAspect, uRadius, uBorderW, uUseSolid;
void main() {
  vec2 p = (vUV - 0.5) * vec2(uAspect, 1.0);
  vec2 h = vec2(0.5 * uAspect, 0.5);
  float d = length(max(abs(p) - (h - uRadius), 0.0)) - uRadius;
  float a = 1.0 - smoothstep(-0.003, 0.003, d);
  if (a <= 0.0) discard;
  if (uUseSolid > 0.5) { gl_FragColor = vec4(uSolid, a); return; }
  if (d > -uBorderW) { gl_FragColor = vec4(uBorder, a); return; }
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 L = normalize(uLight), V = normalize(uCam - vW), H = normalize(L + V);
  vec3 c = texture2D(uTex, vUV).rgb;
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(dot(n, H), 0.0), 40.0) * 0.16;
  gl_FragColor = vec4(c * (0.86 + 0.2 * diff) + spec, a);
}`;

/** Mapa de profundidade estimado (0 = fundo, 1 = mais perto). */
function estimateDepth(img, W = 128) {
  const H = Math.max(2, Math.round(W * img.height / img.width));
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;

  // Cor do fundo = média das bordas da foto
  let br = 0, bg = 0, bb = 0, n = 0;
  const addBorder = i => { br += px[i]; bg += px[i + 1]; bb += px[i + 2]; n++; };
  for (let x = 0; x < W; x++) for (const y of [0, 1, H - 2, H - 1]) addBorder((y * W + x) * 4);
  for (let y = 0; y < H; y++) for (const x of [0, 1, W - 2, W - 1]) addBorder((y * W + x) * 4);
  br /= n; bg /= n; bb /= n;

  let depth = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const diff = Math.hypot(px[i] - br, px[i + 1] - bg, px[i + 2] - bb) / 441;
    const lum = (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255;
    const cx = (x / (W - 1)) * 2 - 1, cy = (y / (H - 1)) * 2 - 1;
    const center = Math.max(0, 1 - (cx * cx * 0.8 + cy * cy));
    depth[y * W + x] = (Math.min(1, diff * 1.8) * 0.65 + lum * 0.15 + 0.2) * (0.35 + 0.65 * center);
  }

  // Suaviza (desfoque em caixa, 3 passadas) para o relevo não "rasgar" a foto
  const blur = (src, r) => {
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0, c = 0;
      for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < W) { s += src[y * W + xx]; c++; } }
      tmp[y * W + x] = s / c;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0, c = 0;
      for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < H) { s += tmp[yy * W + x]; c++; } }
      out[y * W + x] = s / c;
    }
    return out;
  };
  for (let k = 0; k < 3; k++) depth = blur(depth, 4);
  let max = 0;
  for (const v of depth) if (v > max) max = v;
  for (let i = 0; i < depth.length; i++) depth[i] /= max || 1;

  return (u, v) => { // amostragem bilinear
    const x = u * (W - 1), y = v * (H - 1), x0 = Math.floor(x), y0 = Math.floor(y);
    const x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1), fx = x - x0, fy = y - y0;
    const d = (xx, yy) => depth[yy * W + xx];
    return lerp(lerp(d(x0, y0), d(x1, y0), fx), lerp(d(x0, y1), d(x1, y1), fx), fy);
  };
}

function startPhoto3D(container, url, onFail) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false, powerPreference: "low-power" });
  if (!gl) { onFail(); return; }

  const img = new Image();
  img.decoding = "async";
  img.onerror = onFail;
  img.onload = () => {
    let prog;
    try { prog = compile(gl, PHOTO_VS, PHOTO_FS); } catch (err) { console.warn(err.message); onFail(); return; }
    const aspect = img.width / img.height;
    const depthAt0 = estimateDepth(img);

    // Malha do cartão: grade com o relevo da foto (bordas planas)
    const NX = 96, NY = Math.max(24, Math.round(NX / aspect));
    const depthAt = (u, v, amount) => depthAt0(u, v) * amount * clamp(Math.min(u, 1 - u, v, 1 - v) * 10, 0, 1);
    const build = amount => paramGeo(NX, NY, (u, v) => [(u - 0.5) * aspect, 0.5 - v, depthAt(u, v, amount)]);
    const geo = build(0.3);
    const uvGrid = (nx, ny) => {
      const a = new Float32Array((nx + 1) * (ny + 1) * 2);
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const k = (j * (nx + 1) + i) * 2; a[k] = i / nx; a[k + 1] = j / ny; }
      return a;
    };
    const buf = (data, target = gl.ARRAY_BUFFER, usage = gl.STATIC_DRAW) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, usage); return b; };
    const card = { pos: buf(geo.pos, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW), nor: buf(geo.nor, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW), uv: buf(uvGrid(NX, NY)), idx: buf(geo.idx, gl.ELEMENT_ARRAY_BUFFER), count: geo.idx.length };
    const flatGeo = paramGeo(8, 8, (u, v) => [(u - 0.5) * aspect, 0.5 - v, 0]);
    const flat = { pos: buf(flatGeo.pos), nor: buf(flatGeo.nor), uv: buf(uvGrid(8, 8)), idx: buf(flatGeo.idx, gl.ELEMENT_ARRAY_BUFFER), count: flatGeo.idx.length };

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    container.prepend(canvas);
    const hint = document.createElement("span");
    hint.className = "hero-stage-hint";
    hint.textContent = matchMedia("(hover: hover)").matches ? "Passe o mouse na foto" : "Toque e arraste a foto";
    container.appendChild(hint);

    const css = getComputedStyle(document.documentElement);
    const accent = hexRGB(css.getPropertyValue("--accent").trim() || "#E8A93B");
    const onInk = hexRGB(css.getPropertyValue("--on-ink").trim() || "#FBF7EF");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const st = { px: 0, py: 0, tx: 0, ty: 0, hover: 0, thover: 0, depth: 0.3, drag: 0, dragYaw: 0 };

    const onPointer = e => {
      const r = container.getBoundingClientRect();
      if (!r.width) return;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      st.tx = clamp((e.clientX - cx) / (r.width / 2), -1.3, 1.3);
      st.ty = clamp((e.clientY - cy) / (r.height / 2), -1.3, 1.3);
      st.thover = clamp(1.25 - Math.hypot((e.clientX - cx) / (r.width * 0.55), (e.clientY - cy) / (r.height * 0.6)), 0, 1);
      requestFrame();
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    canvas.addEventListener("pointerdown", e => { st.drag = e.clientX; if (e.pointerType !== "mouse") onPointer(e); });
    window.addEventListener("pointerup", () => { st.drag = 0; });
    canvas.addEventListener("pointermove", e => {
      if (st.drag && e.pointerType !== "mouse") { st.dragYaw = clamp(st.dragYaw + (e.clientX - st.drag) * 0.006, -0.6, 0.6); st.drag = e.clientX; requestFrame(); }
    });
    container.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") { st.thover = 0; st.tx = 0; st.ty = 0; requestFrame(); } });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(container.clientWidth * dpr)), h = Math.max(1, Math.round(container.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      requestFrame();
    };
    new ResizeObserver(resize).observe(container);
    let visible = true, raf = 0, last = performance.now(), time = 0;
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) requestFrame(); }, { threshold: 0.01 }).observe(container);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { last = performance.now(); requestFrame(); } });
    canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); cancelAnimationFrame(raf); canvas.remove(); onFail(); });
    function requestFrame() { if (!raf) raf = requestAnimationFrame(frame); }

    function frame(now) {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduce) time += dt;
      const k = reduce ? 1 : 1 - Math.pow(0.003, dt);
      st.px = lerp(st.px, st.tx, k); st.py = lerp(st.py, st.ty, k);
      st.hover = lerp(st.hover, st.thover, reduce ? 1 : 1 - Math.pow(0.02, dt));
      // De perto o prato "salta" mais: refaz o relevo quando muda o bastante
      const want = 0.26 + st.hover * 0.24;
      if (Math.abs(want - st.depth) > 0.012) {
        st.depth = want;
        const g = build(st.depth);
        gl.bindBuffer(gl.ARRAY_BUFFER, card.pos); gl.bufferSubData(gl.ARRAY_BUFFER, 0, g.pos);
        gl.bindBuffer(gl.ARRAY_BUFFER, card.nor); gl.bufferSubData(gl.ARRAY_BUFFER, 0, g.nor);
      }
      render();
      const moving = Math.abs(st.px - st.tx) + Math.abs(st.py - st.ty) + Math.abs(st.hover - st.thover) > 0.002;
      if (visible && !document.hidden && (!reduce || moving)) requestFrame();
    }

    function drawMesh(L, m, model) {
      gl.uniformMatrix4fv(L.uModel, false, model);
      gl.uniformMatrix3fv(L.uNM, false, M4.normal(model));
      gl.bindBuffer(gl.ARRAY_BUFFER, m.pos); gl.enableVertexAttribArray(L.aPos); gl.vertexAttribPointer(L.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.nor); gl.enableVertexAttribArray(L.aNor); gl.vertexAttribPointer(L.aNor, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.uv); gl.enableVertexAttribArray(L.aUV); gl.vertexAttribPointer(L.aUV, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
      gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
    }

    function render() {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(prog.p);
      const L = prog.loc, viewAspect = canvas.width / canvas.height;

      // Câmera que enquadra o cartão inteiro, com folga para inclinar
      const fov = 0.6, margin = 1.3 - st.hover * 0.08;
      const fitH = Math.max(1, aspect / viewAspect) * margin;
      const eye = [0, 0, fitH / 2 / Math.tan(fov / 2)];
      gl.uniformMatrix4fv(L.uProj, false, M4.persp(fov, viewAspect, 0.05, 50));
      gl.uniformMatrix4fv(L.uView, false, M4.lookAt(eye, [0, 0, 0], [0, 1, 0]));
      gl.uniform3fv(L.uLight, [-st.px * 0.8 + 0.3, st.py * 0.6 + 0.6, 1.0]);
      gl.uniform3fv(L.uCam, eye);
      gl.uniform1f(L.uAspect, aspect); gl.uniform1f(L.uRadius, 0.06); gl.uniform1f(L.uBorderW, 0.012);
      gl.uniform3fv(L.uBorder, onInk);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(L.uTex, 0);

      const yaw = st.px * 0.42 + st.dragYaw + (reduce ? 0 : Math.sin(time * 0.6) * 0.06);
      const pitch = st.py * 0.3 + (reduce ? 0 : Math.cos(time * 0.5) * 0.04);
      const model = M4.trs([0, reduce ? 0 : Math.sin(time * 1.1) * 0.015, 0], [pitch, yaw, 0], [1, 1, 1]);

      // Sombra "carimbada" (deslocada, na cor de destaque do nicho) e depois a foto
      gl.uniform1f(L.uUseSolid, 1); gl.uniform3fv(L.uSolid, accent);
      drawMesh(L, flat, M4.mul(model, M4.trs([0.035, -0.035, -0.03], [0, 0, 0], [1, 1, 1])));
      gl.uniform1f(L.uUseSolid, 0);
      drawMesh(L, card, model);
    }
    resize();
  };
  img.src = url;
}
