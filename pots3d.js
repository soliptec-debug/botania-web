/* BotanIA · Modelos 3D de las macetas (three.js r160, global THREE).
   Cada .pot-img[data-model] recibe un canvas con el modelo girando; se puede arrastrar para rotar.
   Si WebGL no está disponible, queda la foto. */
(function () {
  'use strict';
  var T; // THREE
  var TAU = Math.PI * 2;

  // ---------- helpers ----------
  function M(color, rough, extra) {
    var o = { color: color, roughness: rough == null ? 0.55 : rough, metalness: 0 };
    if (extra) for (var k in extra) o[k] = extra[k];
    return new T.MeshStandardMaterial(o);
  }
  function mesh(geo, mat) { return new T.Mesh(geo, mat); }
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  function place(obj, pos, normal, offset) {
    var p = pos.clone().add(normal.clone().multiplyScalar(offset || 0));
    obj.position.copy(p);
    var up = Math.abs(normal.y) > 0.95 ? V(0, 0, 1) : V(0, 1, 0);
    var m = new T.Matrix4().lookAt(p.clone().add(normal), p, up); // +z hacia afuera
    obj.quaternion.setFromRotationMatrix(m);
    return obj;
  }
  function rnd(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function tex(canvas) { var t = new T.CanvasTexture(canvas); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t; }
  function canvas2d(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function hexCss(h) { return '#' + ('000000' + h.toString(16)).slice(-6); }

  // ---------- superficies de revolución ----------
  function radiusAt(prof, y) {
    if (y <= prof[0][1]) return prof[0][0];
    for (var i = 0; i < prof.length - 1; i++) {
      var a = prof[i], b = prof[i + 1];
      if (y >= a[1] && y <= b[1]) { var t = (y - a[1]) / ((b[1] - a[1]) || 1); return a[0] + (b[0] - a[0]) * t; }
    }
    return prof[prof.length - 1][0];
  }
  function smooth(pts, n) {
    var c = new T.SplineCurve(pts.map(function (p) { return new T.Vector2(p[0], p[1]); }));
    return c.getPoints(n || 60).map(function (p) { return [p.x, p.y]; });
  }
  function lathePoint(prof, ang, y) {
    var r = radiusAt(prof, y), d = 0.01, y0 = prof[0][1], y1 = prof[prof.length - 1][1];
    var dr = (radiusAt(prof, Math.min(y + d, y1)) - radiusAt(prof, Math.max(y - d, y0))) / (2 * d);
    return { pos: V(Math.sin(ang) * r, y, Math.cos(ang) * r), n: V(Math.sin(ang), -dr, Math.cos(ang)).normalize() };
  }
  // pinta la piel de una maceta torneada: ctx con helpers para dibujar por (ángulo, altura)
  function lathePainter(prof, W, H, base) {
    var c = canvas2d(W, H), x = c.getContext('2d'), y0 = prof[0][1], y1 = prof[prof.length - 1][1];
    x.fillStyle = base; x.fillRect(0, 0, W, H);
    function P(ang, y) { var u = ang / TAU + 0.5; return [u * W, (1 - (y - y0) / (y1 - y0)) * H]; }
    return {
      canvas: c, ctx: x, P: P,
      // largo de 1 unidad de mundo en píxeles (horizontal, a cierta altura) y vertical
      sx: function (y) { return W / (TAU * radiusAt(prof, y)); }, sy: H / (y1 - y0),
      ellipse: function (ang, y, rw, rh, color) { var p = P(ang, y), k = this.sx(y); x.fillStyle = color; x.beginPath(); x.ellipse(p[0], p[1], rw * k, rh * this.sy, 0, 0, TAU); x.fill(); },
      band: function (ya, yb, color) { var a = P(0, ya)[1], b = P(0, yb)[1]; x.fillStyle = color; x.fillRect(0, Math.min(a, b), W, Math.abs(a - b)); },
      poly: function (pts, color, smoothIt) {
        x.fillStyle = color; x.beginPath();
        var q = pts.map(function (p) { return P(p[0], p[1]); });
        x.moveTo(q[0][0], q[0][1]);
        if (smoothIt) {
          for (var i = 0; i < q.length; i++) { var a = q[i], b = q[(i + 1) % q.length]; x.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
        } else q.slice(1).forEach(function (p) { x.lineTo(p[0], p[1]); });
        x.closePath(); x.fill();
      }
    };
  }
  function potLathe(prof, opts) {
    var seg = opts.seg || 96, g = new T.Group();
    var y0 = prof[0][1], y1 = prof[prof.length - 1][1], N = 70, pts = [new T.Vector2(0.0001, y0)];
    for (var i = 0; i <= N; i++) { var yy = y0 + (y1 - y0) * i / N; pts.push(new T.Vector2(radiusAt(prof, yy), yy)); }
    var geo = new T.LatheGeometry(pts, seg, -Math.PI, TAU);
    var pos = geo.attributes.position, uv = geo.attributes.uv;
    for (var j = 0; j < pos.count; j++) uv.setY(j, (pos.getY(j) - y0) / (y1 - y0));
    if (opts.flat) { geo = geo.toNonIndexed(); geo.computeVertexNormals(); } else geo.computeVertexNormals();
    var mat = M(0xffffff, opts.rough, { map: opts.map || null, flatShading: !!opts.flat });
    if (!opts.map) mat.color.setHex(opts.color);
    g.add(mesh(geo, mat));
    // labio y pared interior
    var r1 = prof[prof.length - 1][0], w = opts.wall || 0.03, inner = [new T.Vector2(r1, y1), new T.Vector2(r1 - w * 0.5, y1 + 0.01), new T.Vector2(r1 - w, y1)];
    for (var k = 1; k <= 20; k++) { var yk = y1 - (y1 - y0 - 0.1) * k / 20; inner.push(new T.Vector2(Math.max(radiusAt(prof, yk) - w, 0.01), yk)); }
    inner.push(new T.Vector2(0.0001, y0 + 0.1));
    var ig = new T.LatheGeometry(inner, seg, -Math.PI, TAU);
    g.add(mesh(ig, M(opts.rimColor != null ? opts.rimColor : opts.color, opts.rough, { side: T.DoubleSide, flatShading: !!opts.flat })));
    return g;
  }
  function soil(rx, rz, y) {
    var c = canvas2d(256, 256), x = c.getContext('2d'), R = rnd(99);
    x.fillStyle = '#4E3524'; x.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 900; i++) { x.fillStyle = R() > 0.5 ? 'rgba(30,18,10,0.5)' : 'rgba(120,88,60,0.45)'; x.fillRect(R() * 256, R() * 256, 2 + R() * 3, 2 + R() * 3); }
    var g = new T.CircleGeometry(1, 48); g.rotateX(-Math.PI / 2);
    var m = mesh(g, M(0xffffff, 0.95, { map: tex(c) })); m.scale.set(rx, 1, rz); m.position.y = y; return m;
  }
  function glossyEye(r) { // ojo negro brillante (estilo cerámica)
    var g = new T.Group();
    var b = mesh(new T.SphereGeometry(r, 28, 18), M(0x141414, 0.12)); b.scale.z = 0.5; g.add(b);
    var h = mesh(new T.SphereGeometry(r * 0.3, 14, 10), M(0xffffff, 0.1, { emissive: 0xffffff, emissiveIntensity: 0.8 }));
    h.position.set(r * 0.3, r * 0.32, r * 0.42); g.add(h);
    var h2 = mesh(new T.SphereGeometry(r * 0.13, 10, 8), M(0xffffff, 0.1, { emissive: 0xffffff, emissiveIntensity: 0.6 }));
    h2.position.set(-r * 0.28, -r * 0.3, r * 0.44); g.add(h2);
    return g;
  }
  function waterRing(r) {
    var g = new T.Group();
    g.add(mesh(new T.TorusGeometry(r, r * 0.12, 14, 56), M(0xDDF3FF, 0.15, { emissive: 0x58B8FF, emissiveIntensity: 1.3 })));
    var glass = mesh(new T.CircleGeometry(r * 0.92, 40), M(0xEAF7FF, 0.05, { transparent: true, opacity: 0.45, emissive: 0x9ED8FF, emissiveIntensity: 0.25 }));
    glass.position.z = -0.004; g.add(glass);
    return g;
  }
  function drawSun(x, cx, cy, r) {
    x.fillStyle = '#F2B629'; x.strokeStyle = '#F2B629'; x.lineWidth = r * 0.22; x.lineCap = 'round';
    for (var i = 0; i < 12; i++) { var a = i / 12 * TAU; x.beginPath(); x.moveTo(cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 1.25); x.lineTo(cx + Math.cos(a) * r * 1.9, cy + Math.sin(a) * r * 1.9); x.stroke(); }
    x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
  }

  // ---------- hojas y plantas ----------
  function shapeLeaf(kind) {
    var s = new T.Shape();
    if (kind === 'coin') { s.absellipse(0, 0.52, 0.5, 0.48, 0, TAU, false); }
    else if (kind === 'heart') {
      s.moveTo(0, 0.08); s.bezierCurveTo(0.22, -0.06, 0.58, 0.06, 0.5, 0.42); s.bezierCurveTo(0.44, 0.7, 0.18, 0.86, 0, 1);
      s.bezierCurveTo(-0.18, 0.86, -0.44, 0.7, -0.5, 0.42); s.bezierCurveTo(-0.58, 0.06, -0.22, -0.06, 0, 0.08);
    } else { s.moveTo(0, 0); s.bezierCurveTo(0.5, 0.2, 0.45, 0.75, 0, 1); s.bezierCurveTo(-0.45, 0.75, -0.5, 0.2, 0, 0); }
    var g = new T.ShapeGeometry(s, 14), p = g.attributes.position;
    for (var i = 0; i < p.count; i++) { var x = p.getX(i), y = p.getY(i); p.setZ(i, -x * x * 0.55 - (kind === 'coin' ? 0 : y * y * 0.12)); }
    g.computeVertexNormals();
    return g;
  }
  var leafCache = {};
  function leafGeo(k) { return leafCache[k] || (leafCache[k] = shapeLeaf(k)); }
  function leafMat(color) { return M(color, 0.38, { side: T.DoubleSide }); }
  function bushy(o) { // potus / pilea
    var g = new T.Group(), R = rnd(o.seed || 7), geo = leafGeo(o.kind), stem = M(o.stemColor || 0x4A8E3A, 0.6);
    var cols = o.colors || [0x3E9A3A, 0x4CAF45, 0x5CBF52, 0x379035, 0x67C35A];
    var mats = cols.map(leafMat);
    for (var i = 0; i < o.count; i++) {
      var ang = R() * TAU, t = Math.sqrt(R()), rad = o.spread * t;
      var h = o.height * (1 - t * t * o.dome) * (0.75 + R() * 0.3);
      var tip = V(Math.sin(ang) * rad, h, Math.cos(ang) * rad);
      var curve = new T.QuadraticBezierCurve3(V(Math.sin(ang) * rad * 0.1, 0, Math.cos(ang) * rad * 0.1), V(tip.x * 0.35, h * 0.95, tip.z * 0.35), tip);
      g.add(mesh(new T.TubeGeometry(curve, 8, o.stem || 0.006, 5), stem));
      var leaf = mesh(geo, mats[Math.floor(R() * mats.length)]);
      var sc = o.leaf * (0.7 + R() * 0.55); leaf.scale.set(sc, sc, sc);
      leaf.position.copy(tip); leaf.rotation.order = 'YXZ';
      leaf.rotation.y = ang + (R() - 0.5) * 0.9;
      leaf.rotation.x = o.flatUp ? (1.15 + t * 0.35 + (R() - 0.5) * 0.5) : o.kind === 'coin' ? (0.9 + t * 0.6 + (R() - 0.5) * 0.5) : ((o.tilt || 0.7) + t * 0.8 + (R() - 0.5) * 0.4);
      leaf.rotation.z = (R() - 0.5) * 0.6;
      g.add(leaf);
    }
    return g;
  }
  // hoja larga en tira (sansevieria, haworthia), con UV a lo ancho para pintar bordes
  function stripGeo(widthFn, bend, rows) {
    rows = rows || 16; var pos = [], uv = [], idx = [];
    for (var i = 0; i <= rows; i++) {
      var t = i / rows, w = widthFn(t), z = bend * t * t;
      pos.push(-w / 2, t, z, 0, t, z + w * 0.18, w / 2, t, z); uv.push(0, t, 0.5, t, 1, t);
    }
    for (var j = 0; j < rows; j++) { var a = j * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  function snakeTexture() {
    var c = canvas2d(128, 512), x = c.getContext('2d'), R = rnd(17);
    x.fillStyle = '#2E5E2E'; x.fillRect(0, 0, 128, 512);
    for (var i = 0; i < 28; i++) { var y = i * 19 + R() * 8; x.strokeStyle = R() > 0.5 ? 'rgba(150,190,120,0.45)' : 'rgba(25,60,30,0.6)'; x.lineWidth = 4 + R() * 5; x.beginPath(); x.moveTo(14, y); x.bezierCurveTo(44, y - 10, 84, y + 10, 114, y); x.stroke(); }
    var gr = x.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, '#D8C85A'); gr.addColorStop(0.1, '#C7C45A'); gr.addColorStop(0.16, 'rgba(199,196,90,0)'); gr.addColorStop(0.84, 'rgba(199,196,90,0)'); gr.addColorStop(0.9, '#C7C45A'); gr.addColorStop(1, '#D8C85A');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 512);
    return tex(c);
  }
  function haworthiaTexture() {
    var c = canvas2d(128, 512), x = c.getContext('2d'), R = rnd(23);
    var gr = x.createLinearGradient(0, 512, 0, 0); gr.addColorStop(0, '#2F6B3E'); gr.addColorStop(1, '#3F8550'); x.fillStyle = gr; x.fillRect(0, 0, 128, 512);
    x.fillStyle = 'rgba(235,245,235,0.85)';
    for (var i = 0; i < 120; i++) { x.beginPath(); x.ellipse(10 + R() * 108, R() * 500, 3 + R() * 3, 2 + R() * 2, 0, 0, TAU); x.fill(); }
    return tex(c);
  }
  function snakePlant(o) {
    var g = new T.Group(), R = rnd(o.seed || 3), mat = M(0xffffff, 0.45, { map: snakeTexture(), side: T.DoubleSide });
    for (var i = 0; i < o.count; i++) {
      var len = o.height * (0.62 + R() * 0.38), w = o.width * (0.8 + R() * 0.4);
      var geo = stripGeo(function (t) { return w * (t < 0.75 ? 0.8 + 0.2 * Math.sin(t / 0.75 * Math.PI / 2) : (1 - t) / 0.25); }, 0.05 + R() * 0.08);
      var b = mesh(geo, mat), ang = i / o.count * TAU + R() * 0.5, rad = o.spread * (0.2 + R() * 0.8);
      b.scale.set(1, len, 1); b.position.set(Math.sin(ang) * rad, 0, Math.cos(ang) * rad);
      b.rotation.order = 'YXZ'; b.rotation.y = ang + (R() - 0.5) * 1.6; b.rotation.x = 0.05 + rad / o.spread * 0.28;
      g.add(b);
    }
    return g;
  }
  function haworthia(o) {
    var g = new T.Group(), R = rnd(o.seed || 11), mat = M(0xffffff, 0.5, { map: haworthiaTexture(), side: T.DoubleSide });
    for (var i = 0; i < o.count; i++) {
      var ring = i / o.count, len = o.height * (1 - ring * 0.5) * (0.85 + R() * 0.25), w = o.width * (0.8 + ring * 0.5);
      var geo = stripGeo(function (t) { return w * Math.pow(1 - t, 0.85); }, 0.12 + ring * 0.15, 12);
      var b = mesh(geo, mat), ang = i * 2.39996;
      b.scale.set(1, len, 1);
      b.rotation.order = 'YXZ'; b.rotation.y = ang; b.rotation.x = 0.05 + ring * 0.85;
      g.add(b);
    }
    return g;
  }

  // ---------- línea Interior ----------
  // grabados: máscaras tomadas de la lámina de la línea Interior (engr-*.png)
  var ENGR = {
    condor: { ang: -0.165, y: 0.53, scale: 1.376 },
    yaguarete: { ang: -0.155, y: 0.5, scale: 0.9725 },
    armadillo: { ang: -0.2, y: 0.49, scale: 1.185 }
  };
  function engrave(P, kind, ink, texture) {
    var e = ENGR[kind], img = new Image();
    img.onload = function () {
      var t = canvas2d(img.width, img.height), tx = t.getContext('2d');
      tx.fillStyle = ink; tx.fillRect(0, 0, t.width, t.height);
      tx.globalCompositeOperation = 'destination-in'; tx.drawImage(img, 0, 0);
      var at = P.P(e.ang, e.y), kx = P.sx(e.y) / P.sy, x = P.ctx;
      x.save(); x.translate(at[0], at[1]); x.scale(e.scale * kx, e.scale); x.drawImage(t, -t.width / 2, -t.height / 2); x.restore();
      texture.needsUpdate = true;
    };
    img.src = 'engr-' + kind + '.png';
  }
  function interior(kind) {
    var cfg = {
      condor: { color: '#ECE4D6', ink: 'rgba(112,94,74,0.95)', plant: 'pothos', scale: 1.1 },
      yaguarete: { color: '#DACBAE', ink: 'rgba(96,76,54,1)', plant: 'snake', scale: 0.95 },
      armadillo: { color: '#5F6164', ink: 'rgba(34,35,37,0.95)', plant: 'pothos', scale: 0.82 }
    }[kind];
    var prof = [[0.4, 0], [0.475, 1.0]];
    var P = lathePainter(prof, 4096, 1280, cfg.color), x = P.ctx;
    // leve degradé de impresión 3D (líneas de capa)
    for (var i = 0; i < 1280; i += 6) { x.fillStyle = i % 12 ? 'rgba(0,0,0,0.018)' : 'rgba(255,255,255,0.03)'; x.fillRect(0, i, 4096, 3); }
    var skin = tex(P.canvas); engrave(P, kind, cfg.ink, skin);
    var body = potLathe(prof, { map: skin, rough: 0.78, seg: 18, flat: true, color: parseInt(cfg.color.slice(1), 16), wall: 0.035 });
    var g = new T.Group(); g.add(body);
    // ranura de nivel de agua (cápsula iluminada) y LED
    var sp = lathePoint(prof, 0.62, 0.5);
    var frame = mesh(new T.CapsuleGeometry(0.03, 0.44, 8, 16), M(new T.Color(cfg.color).multiplyScalar(0.72).getHex(), 0.6)); frame.scale.z = 0.35;
    g.add(place(frame, sp.pos, sp.n, -0.002));
    var glowC = canvas2d(16, 128), gx = glowC.getContext('2d'), gr = gx.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#E8F6FF'); gr.addColorStop(0.35, '#BFE6FF'); gr.addColorStop(1, '#58B4FF'); gx.fillStyle = gr; gx.fillRect(0, 0, 16, 128);
    var glow = mesh(new T.CapsuleGeometry(0.019, 0.42, 8, 16), M(0xffffff, 0.2, { map: tex(glowC), emissive: 0x4AB0FF, emissiveIntensity: 1.25 })); glow.scale.z = 0.35;
    g.add(place(glow, sp.pos, sp.n, 0.006));
    var lp = lathePoint(prof, -0.38, 0.92);
    g.add(place(mesh(new T.SphereGeometry(0.014, 12, 10), M(0xBDE6FF, 0.2, { emissive: 0x4AB0FF, emissiveIntensity: 2 })), lp.pos, lp.n, 0.004));
    g.add(soil(0.44, 0.44, 0.955));
    var plant = cfg.plant === 'snake'
      ? snakePlant({ count: 11, spread: 0.2, height: 1.15, width: 0.15, seed: 5 })
      : bushy({ kind: 'heart', count: kind === 'armadillo' ? 34 : 44, spread: 0.6, height: 0.42, dome: 0.35, leaf: 0.29, tilt: 0.35, seed: kind === 'armadillo' ? 21 : 9 });
    plant.position.y = 0.955; g.add(plant);
    g.scale.setScalar(cfg.scale);
    return g;
  }

  // ---------- ballena franca austral ----------
  function ballena() {
    var g = new T.Group();
    var A = 0.78, B = 0.44, C = 0.42, TOP = 0.84; // semiejes y corte superior
    function F(d) { // dirección unitaria -> punto de la superficie (cuerpo tipo "pan", base plana, angosto hacia la cola +x)
      var sg = function (v, e) { return (v < 0 ? -1 : 1) * Math.pow(Math.abs(v), e); };
      var taper = 1 - 0.34 * T.MathUtils.smoothstep(d.x, -0.1, 1);
      var x = sg(d.x, 0.78) * A, z = sg(d.z, 0.7) * C * taper;
      var y = d.y < 0 ? -Math.pow(-d.y, 0.5) * B * 0.92 : Math.pow(d.y, 0.72) * B * (taper * 0.9 + 0.1);
      y = Math.min(y, B * TOP);
      return V(x, y + B * 0.92, z);
    }
    function S(dx, dy, dz) {
      var d = V(dx, dy, dz).normalize(), p = F(d), e = 0.002;
      var t1 = Math.abs(d.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0);
      var u = new T.Vector3().crossVectors(d, t1).normalize(), w = new T.Vector3().crossVectors(d, u).normalize();
      var pu = F(d.clone().addScaledVector(u, e).normalize()), pw = F(d.clone().addScaledVector(w, e).normalize());
      var n = new T.Vector3().crossVectors(pu.sub(p), pw.sub(p)).normalize();
      if (n.dot(d) < 0) n.negate();
      return { pos: p, n: n };
    }
    var geo = new T.SphereGeometry(1, 128, 80), pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) { var p = F(V(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize()); pos.setXYZ(i, p.x, p.y, p.z); }
    geo.computeVertexNormals();
    // textura: lomo azul, panza blanca con estrías, mejillas, sonrisa, sol
    var W = 2048, H = 1024, cv = canvas2d(W, H), x = cv.getContext('2d'), img = x.createImageData(W, H), dta = img.data;
    var blue = [92, 142, 212], white = [246, 247, 248], groove = [205, 214, 224];
    for (var py = 0; py < H; py++) {
      var th = py / H * Math.PI, st = Math.sin(th), cy = Math.cos(th);
      for (var px = 0; px < W; px++) {
        var ph = px / W * TAU, dx = -Math.cos(ph) * st, dz = Math.sin(ph) * st;
        var line = -0.02 - 0.05 * dx + (dx < -0.6 ? (dx + 0.6) * 0.45 : 0);
        var t = T.MathUtils.smoothstep(cy, line - 0.015, line + 0.015), col = blue;
        if (t < 0.5) { col = white; var gx = (dx + 1) * 9; if (cy < line - 0.08 && cy > -0.85 && Math.abs(gx - Math.round(gx)) < 0.045 && Math.abs(dz) > 0.25) col = groove; }
        var o = (py * W + px) * 4, k = t;
        dta[o] = col === blue ? blue[0] : col[0]; dta[o + 1] = col === blue ? blue[1] : col[1]; dta[o + 2] = col === blue ? blue[2] : col[2]; dta[o + 3] = 255;
        if (k > 0 && k < 1) { dta[o] = white[0] + (blue[0] - white[0]) * k; dta[o + 1] = white[1] + (blue[1] - white[1]) * k; dta[o + 2] = white[2] + (blue[2] - white[2]) * k; }
      }
    }
    x.putImageData(img, 0, 0);
    function UV(dx, dy, dz) { var d = V(dx, dy, dz).normalize(), ph = Math.atan2(d.z, -d.x); if (ph < 0) ph += TAU; return [ph / TAU * W, Math.acos(d.y) / Math.PI * H]; }
    [1, -1].forEach(function (s) {
      var ck = UV(-0.78, 0.12, 0.62 * s); x.fillStyle = 'rgba(240,150,160,0.85)'; x.beginPath(); x.ellipse(ck[0], ck[1], 24, 15, 0, 0, TAU); x.fill();
      x.strokeStyle = '#2A3D63'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath();
      for (var a = 0; a <= 20; a++) { var tt = a / 20, q = UV(-1 + tt * 0.42, 0.02 - tt * 0.02 + tt * tt * 0.06, (0.1 + tt * 0.8) * s); if (a === 0) x.moveTo(q[0], q[1]); else x.lineTo(q[0], q[1]); }
      x.stroke();
      var su = UV(0.55, 0.35, 0.78 * s); drawSun(x, su[0], su[1], 26);
    });
    var body = mesh(geo, M(0xffffff, 0.22, { map: tex(cv) }));
    g.add(body);
    [1, -1].forEach(function (s) {
      var e = S(-0.8, 0.3, 0.6 * s); g.add(place(glossyEye(0.075), e.pos, e.n, 0.008));
      var f = S(-0.12, -0.22, 1 * s), fl = mesh(new T.SphereGeometry(0.17, 28, 16), M(0x5C8ED4, 0.22));
      fl.scale.set(1, 0.42, 0.22); place(fl, f.pos, f.n, 0.03); fl.rotateZ(-0.35 * s); fl.rotateY(0.25 * s); g.add(fl);
      var r = S(0.6, -0.12, 0.82 * s); g.add(place(waterRing(0.075), r.pos, r.n, 0.006));
    });
    // cola: sube desde atrás y termina en aleta horizontal
    var tail = new T.CatmullRomCurve3([V(A * 0.78, B * 1.1, 0), V(A * 1.02, B * 1.45, 0), V(A * 1.1, B * 2.05, 0), V(A * 1.02, B * 2.55, 0)]);
    var tg = new T.TubeGeometry(tail, 40, 0.15, 24, false), tp = tg.attributes.position, rs = 25;
    for (var j = 0; j < tp.count; j++) {
      var ti = Math.floor(j / rs) / 40, cp = tail.getPointAt(Math.min(ti, 1)), sc = 1 - ti * 0.6;
      var v = V(tp.getX(j), tp.getY(j), tp.getZ(j)).sub(cp).multiplyScalar(sc).add(cp); tp.setXYZ(j, v.x, v.y, v.z);
    }
    tg.computeVertexNormals(); g.add(mesh(tg, M(0x5C8ED4, 0.22)));
    var tipP = tail.getPointAt(1);
    [1, -1].forEach(function (s) {
      var lobe = mesh(new T.SphereGeometry(1, 32, 18), M(0x5C8ED4, 0.22));
      lobe.scale.set(0.2, 0.06, 0.07); lobe.position.copy(tipP).add(V(0.13 * s, 0.05, 0)); lobe.rotation.z = 0.5 * s; g.add(lobe);
    });
    // abertura en el lomo con tierra y pilea
    var topY = B * TOP + B * 0.92;
    var rim = mesh(new T.TorusGeometry(1, 0.03, 10, 64), M(0x5C8ED4, 0.22)); rim.rotation.x = Math.PI / 2; rim.scale.set(A * 0.66, C * 0.62, 1); rim.position.set(-0.04, topY, 0); g.add(rim);
    var so = soil(A * 0.66, C * 0.62, topY + 0.004); so.position.x = -0.04; g.add(so);
    var plant = bushy({ kind: 'coin', count: 85, spread: 0.62, height: 0.34, dome: 0.5, leaf: 0.17, flatUp: true, stem: 0.0035, seed: 13, colors: [0x4FAE45, 0x5CBB50, 0x6CC65A, 0x449E3C, 0x78CC63] });
    plant.scale.set(1.15, 1, 0.75); plant.position.set(-0.04, topY, 0); g.add(plant);
    return g;
  }

  // ---------- aguará guazú ----------
  function aguara() {
    var g = new T.Group();
    var prof = smooth([[0.4, 0], [0.48, 0.05], [0.55, 0.2], [0.575, 0.4], [0.555, 0.6], [0.51, 0.78], [0.47, 0.88]], 60);
    var P = lathePainter(prof, 2048, 768, '#E97B2F'), x = P.ctx;
    // franjas del pañuelo
    P.band(0, 0.2, '#F5F3EE'); P.band(0, 0.035, '#5B93D6'); P.band(0.07, 0.1, '#7FB1E3'); P.band(0.14, 0.165, '#7FB1E3');
    // máscara crema
    P.poly([[-0.1, 0.6], [0.1, 0.6], [0.28, 0.5], [0.55, 0.44], [0.85, 0.36], [0.95, 0.26], [0.8, 0.205], [-0.8, 0.205], [-0.95, 0.26], [-0.85, 0.36], [-0.55, 0.44], [-0.28, 0.5]], '#F8E8D2', true);
    P.ellipse(0, 0.62, 0.06, 0.06, '#F8E8D2');
    [1, -1].forEach(function (s) { P.ellipse(0.68 * s, 0.4, 0.07, 0.04, 'rgba(238,140,130,0.75)'); P.ellipse(0.3 * s, 0.74, 0.045, 0.025, '#F8E8D2'); });
    // boca
    var m0 = P.P(0, 0.385); x.strokeStyle = '#3A2418'; x.lineWidth = 6; x.lineCap = 'round';
    x.beginPath(); x.moveTo(m0[0], m0[1] - 18); x.lineTo(m0[0], m0[1]); x.quadraticCurveTo(m0[0] - 22, m0[1] + 18, m0[0] - 40, m0[1] + 2); x.moveTo(m0[0], m0[1]); x.quadraticCurveTo(m0[0] + 22, m0[1] + 18, m0[0] + 40, m0[1] + 2); x.stroke();
    g.add(potLathe(prof, { map: tex(P.canvas), rough: 0.25, color: 0xE97B2F, wall: 0.03 }));
    [1, -1].forEach(function (s) {
      var e = lathePoint(prof, 0.3 * s, 0.6); g.add(place(glossyEye(0.065), e.pos, e.n, 0.01));
      // orejas grandes con borde oscuro e interior claro
      var ear = new T.Group();
      function tri(w, h, color, z, bev) {
        var sh = new T.Shape(); sh.moveTo(-w / 2, 0); sh.quadraticCurveTo(-w * 0.3, h * 0.6, 0, h); sh.quadraticCurveTo(w * 0.3, h * 0.6, w / 2, 0); sh.lineTo(-w / 2, 0);
        var gg = new T.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 12 });
        var mm = mesh(gg, M(color, 0.3)); mm.position.z = z; return mm;
      }
      ear.add(tri(0.33, 0.46, 0xE97B2F, -0.045, 0.01));
      ear.add(tri(0.36, 0.5, 0x2B1C14, -0.02, 0.012));
      ear.add(tri(0.31, 0.44, 0xE97B2F, 0.0, 0.01));
      var inner = tri(0.2, 0.32, 0xF6D9BF, 0.018, 0.006); inner.position.y = 0.03; ear.add(inner);
      var ep = lathePoint(prof, 0.62 * s, 0.84);
      ear.position.copy(ep.pos).add(V(0, -0.02, 0)); ear.rotation.order = 'YXZ'; ear.rotation.y = 0.62 * s; ear.rotation.z = -0.16 * s; ear.rotation.x = -0.08;
      g.add(ear);
    });
    var np = lathePoint(prof, 0, 0.45), nose = mesh(new T.SphereGeometry(0.055, 28, 18), M(0x141414, 0.15));
    nose.scale.set(1.25, 0.85, 0.75); g.add(place(nose, np.pos, np.n, 0.025));
    var wr = lathePoint(prof, 0.82, 0.4); g.add(place(waterRing(0.075), wr.pos, wr.n, 0.006));
    g.add(soil(0.45, 0.45, 0.865));
    var plant = haworthia({ count: 40, height: 0.86, width: 0.09, seed: 4 }); plant.position.y = 0.865; g.add(plant);
    return g;
  }

  // ---------- hornero ----------
  function hornero() {
    var g = new T.Group();
    var prof = smooth([[0.34, 0], [0.42, 0.04], [0.48, 0.18], [0.5, 0.38], [0.47, 0.56], [0.4, 0.7], [0.32, 0.8]], 60);
    var P = lathePainter(prof, 2048, 768, '#A9693B'), x = P.ctx;
    P.band(0, 0.05, '#C99A68');
    P.ellipse(0.05, 0.2, 0.42, 0.22, '#DDB98E');       // barriga de la casita
    P.ellipse(-0.78, 0.56, 0.24, 0.17, '#E2C39A');     // cara
    P.ellipse(-0.45, 0.38, 0.17, 0.13, '#E8CFA8');     // pecho
    var su = P.P(1.95, 0.24); drawSun(x, su[0], su[1], 12);
    g.add(potLathe(prof, { map: tex(P.canvas), rough: 0.3, color: 0xA9693B, wall: 0.03 }));
    // ojo grande con aro oscuro
    var ep = lathePoint(prof, -0.78, 0.58), eye = new T.Group();
    var wht = mesh(new T.SphereGeometry(0.08, 28, 18), M(0xFFFFFF, 0.2)); wht.scale.z = 0.4; eye.add(wht);
    eye.add(mesh(new T.TorusGeometry(0.08, 0.013, 10, 40), M(0x3A2416, 0.4)));
    var pu = glossyEye(0.045); pu.position.z = 0.016; eye.add(pu);
    g.add(place(eye, ep.pos, ep.n, 0.01));
    // pico
    var bp = lathePoint(prof, -1.3, 0.6), beak = mesh(new T.ConeGeometry(0.045, 0.32, 18), M(0x6E4426, 0.4));
    beak.position.copy(bp.pos).add(bp.n.clone().multiplyScalar(0.1)); beak.lookAt(bp.pos.clone().add(bp.n.clone().multiplyScalar(2))); beak.rotateX(Math.PI / 2); g.add(beak);
    // burbuja de agua (ventana) en el pecho
    var wp = lathePoint(prof, -0.45, 0.38), bub = new T.Group();
    var sph = mesh(new T.SphereGeometry(0.1, 32, 20), M(0xE9F6FF, 0.05, { transparent: true, opacity: 0.55, emissive: 0x9ED8FF, emissiveIntensity: 0.35 })); sph.scale.z = 0.55; bub.add(sph);
    var arc = mesh(new T.TorusGeometry(0.065, 0.008, 8, 30, Math.PI * 0.7), M(0xffffff, 0.1, { emissive: 0xffffff, emissiveIntensity: 0.7 })); arc.position.z = 0.05; arc.rotation.z = 2.2; bub.add(arc);
    g.add(place(bub, wp.pos, wp.n, 0.02));
    // puerta de la casita con el nivel de agua
    var dp = lathePoint(prof, 0.1, 0.17), door = new T.Group();
    var ds = new T.Shape(); ds.moveTo(-0.085, -0.11); ds.lineTo(-0.085, 0.03); ds.absarc(0, 0.03, 0.085, Math.PI, 0, true); ds.lineTo(0.085, -0.11); ds.lineTo(-0.085, -0.11);
    door.add(mesh(new T.ExtrudeGeometry(ds, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 2 }), M(0x6B3E1F, 0.5)));
    var hole = new T.Shape(); hole.moveTo(-0.06, -0.09); hole.lineTo(-0.06, 0.03); hole.absarc(0, 0.03, 0.06, Math.PI, 0, true); hole.lineTo(0.06, -0.09); hole.lineTo(-0.06, -0.09);
    var hm = mesh(new T.ShapeGeometry(hole, 16), M(0x2A1A10, 0.8)); hm.position.z = 0.032; door.add(hm);
    var wat = mesh(new T.PlaneGeometry(0.12, 0.07), M(0x8FD0FF, 0.15, { emissive: 0x4AA8F0, emissiveIntensity: 0.9 })); wat.position.set(0, -0.052, 0.034); door.add(wat);
    g.add(place(door, dp.pos, dp.n, 0.0));
    // ala con franjas celeste y blanca
    var wingC = canvas2d(256, 256), wx = wingC.getContext('2d'); wx.fillStyle = '#8B5129'; wx.fillRect(0, 0, 256, 256);
    wx.fillStyle = '#7FB1E3'; wx.fillRect(0, 62, 256, 20); wx.fillStyle = '#F5F3EE'; wx.fillRect(0, 88, 256, 14);
    wx.strokeStyle = 'rgba(60,30,12,0.5)'; wx.lineWidth = 4; for (var f = 0; f < 5; f++) { wx.beginPath(); wx.moveTo(30 + f * 45, 150); wx.lineTo(50 + f * 45, 250); wx.stroke(); }
    var wpp = lathePoint(prof, 0.72, 0.44), wing = mesh(new T.SphereGeometry(0.22, 32, 20), M(0xffffff, 0.35, { map: tex(wingC) }));
    wing.scale.set(1, 0.68, 0.3); place(wing, wpp.pos, wpp.n, -0.012); wing.rotateZ(-0.3); g.add(wing);
    // cola
    var tsh = new T.Shape(); tsh.moveTo(0, -0.06); tsh.quadraticCurveTo(0.2, -0.08, 0.3, -0.02); tsh.quadraticCurveTo(0.2, 0.06, 0, 0.06); tsh.lineTo(0, -0.06);
    var tail = mesh(new T.ExtrudeGeometry(tsh, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 }), M(0x8B5129, 0.35));
    var tp = lathePoint(prof, 1.95, 0.14); tail.position.copy(tp.pos).add(tp.n.clone().multiplyScalar(-0.05)).add(V(0, 0, 0));
    tail.rotation.y = 1.95 - Math.PI / 2; tail.rotateZ(-0.35); g.add(tail);
    g.add(soil(0.3, 0.3, 0.785));
    var plant = bushy({ kind: 'heart', count: 22, spread: 0.42, height: 0.42, dome: 0.5, leaf: 0.15, seed: 31, colors: [0x4FAE45, 0x5CBB50, 0x3E9A3A, 0x67C35A] });
    plant.position.y = 0.785; g.add(plant);
    g.scale.setScalar(0.95);
    return g;
  }

  var BUILD = { ballena: ballena, aguara: aguara, hornero: hornero,
    condor: function () { return interior('condor'); }, yaguarete: function () { return interior('yaguarete'); }, armadillo: function () { return interior('armadillo'); } };

  // ---------- escena por tarjeta ----------
  function shadowTexture() {
    var cv = document.createElement('canvas'); cv.width = cv.height = 128;
    var x = cv.getContext('2d'), gr = x.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(40,30,20,0.38)'); gr.addColorStop(1, 'rgba(40,30,20,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(cv);
  }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var viewers = [];

  function Viewer(box) {
    var kind = box.getAttribute('data-model');
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', 'Modelo 3D de la maceta. Arrastrá para girarla.');
    canvas.setAttribute('role', 'img');
    var renderer;
    try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    var scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xffffff, 0xcdbfa8, 1.4));
    var key = new T.DirectionalLight(0xffffff, 2.2); key.position.set(2, 3, 3); scene.add(key);
    var fill = new T.DirectionalLight(0xfff2e0, 0.7); fill.position.set(-3, 1.5, 1); scene.add(fill);
    var rim = new T.DirectionalLight(0xffffff, 0.8); rim.position.set(0, 2, -3); scene.add(rim);
    var model = BUILD[kind]();
    var pivot = new T.Group(); pivot.add(model); scene.add(pivot);
    var bb = new T.Box3().setFromObject(model), size = bb.getSize(V()), center = bb.getCenter(V());
    model.position.x -= center.x; model.position.z -= center.z; model.position.y -= bb.min.y;
    var sh = mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.002; sh.scale.set(Math.max(size.x, size.z) * 1.5, Math.max(size.x, size.z) * 1.1, 1); scene.add(sh);
    var camera = new T.PerspectiveCamera(30, 1, 0.1, 50);
    var target = V(0, size.y * 0.48, 0);
    box.appendChild(canvas); box.classList.add('is3d');
    var hint = document.createElement('span'); hint.className = 'hint3d'; hint.textContent = '3D · arrastrá para girar'; box.appendChild(hint);

    var w = 0, h = 0;
    function resize() {
      var r = box.getBoundingClientRect(); w = Math.max(1, r.width); h = Math.max(1, r.height);
      renderer.setSize(w, h, false); camera.aspect = w / h;
      var fov = camera.fov * Math.PI / 180, ext = Math.max(size.y * 0.98, Math.max(size.x, size.z) * 1.02 / camera.aspect);
      var dist = ext / 2 / Math.tan(fov / 2) + Math.max(size.x, size.z) * 0.5;
      camera.position.set(0, target.y + dist * 0.28, dist); camera.lookAt(target); camera.updateProjectionMatrix();
    }
    resize();

    var rotY = kind === 'ballena' || kind === 'hornero' ? 0.6 : -0.3, vel = 0, dragging = false, lastX = 0, idleUntil = 0, visible = false, last = performance.now();
    canvas.addEventListener('pointerdown', function (e) { dragging = true; lastX = e.clientX; vel = 0; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
    canvas.addEventListener('pointermove', function (e) { if (!dragging) return; var dx = e.clientX - lastX; lastX = e.clientX; rotY += dx * 0.012; vel = dx * 0.012; idleUntil = performance.now() + 2500; hint.style.opacity = '0'; });
    function up() { dragging = false; canvas.style.cursor = 'grab'; }
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

    this.setVisible = function (v) { visible = v; if (v) { last = performance.now(); } };
    this.resize = resize;
    this.tick = function (now) {
      if (!visible) return;
      var dt = Math.min((now - last) / 1000, 0.05); last = now;
      if (!dragging) {
        if (now > idleUntil && !reduce) rotY += dt * 0.55;
        rotY += vel; vel *= 0.92;
      }
      pivot.rotation.y = rotY;
      renderer.render(scene, camera);
    };
    this.box = box;
  }

  function start() {
    T = window.THREE;
    var boxes = document.querySelectorAll('.pot-img[data-model]');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { var v = en.target.__viewer; if (v) v.setVisible(en.isIntersecting); });
    }, { rootMargin: '100px' });
    boxes.forEach(function (b) {
      var v = null;
      try { v = new Viewer(b); } catch (e) { if (window.console) console.warn('BotanIA 3D', e); }
      if (v && v.tick) { b.__viewer = v; viewers.push(v); io.observe(b); }
    });
    window.addEventListener('resize', function () { viewers.forEach(function (v) { v.resize(); }); });
    (function loop(now) { viewers.forEach(function (v) { v.tick(now); }); requestAnimationFrame(loop); })(performance.now());
  }

  function hasWebGL() { try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } }

  window.__pots3d = { build: function (k) { T = window.THREE; return BUILD[k](); }, shadow: function(){ return shadowTexture(); } };
  if (window.__pots3dDebug) return;
  // carga perezosa: three.js se baja recién cuando la sección de líneas está cerca
  var section = document.getElementById('lineas');
  if (!section || !hasWebGL() || !('IntersectionObserver' in window)) return;
  var loaded = false;
  var pre = new IntersectionObserver(function (en) {
    if (loaded || !en.some(function (e) { return e.isIntersecting; })) return;
    loaded = true; pre.disconnect();
    if (window.THREE) return start();
    var s = document.createElement('script'); s.src = 'three.min.js'; s.onload = start; document.head.appendChild(s);
  }, { rootMargin: '600px' });
  pre.observe(section);
})();
