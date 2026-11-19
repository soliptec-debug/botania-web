/* BotanIA · Modelos 3D de las macetas (three.js r160, global THREE).
   Cada .pot-img[data-model] recibe un canvas con el modelo girando; se puede arrastrar para rotar.
   Si WebGL no está disponible, queda la foto. */
(function () {
  'use strict';
  var T; // THREE

  // ---------- helpers ----------
  function M(color, rough, extra) {
    var o = { color: color, roughness: rough == null ? 0.55 : rough, metalness: 0 };
    if (extra) for (var k in extra) o[k] = extra[k];
    return new T.MeshStandardMaterial(o);
  }
  function mesh(geo, mat) { var m = new T.Mesh(geo, mat); return m; }
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  function place(obj, pos, normal, offset) {
    var p = pos.clone().add(normal.clone().multiplyScalar(offset || 0));
    obj.position.copy(p);
    obj.lookAt(p.clone().add(normal));
    return obj;
  }
  function rnd(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  // superficie de revolución: profile = [[r,y],...] exterior, y creciente
  function radiusAt(prof, y) {
    for (var i = 0; i < prof.length - 1; i++) {
      var a = prof[i], b = prof[i + 1];
      if (y >= a[1] && y <= b[1]) { var t = (y - a[1]) / ((b[1] - a[1]) || 1); return a[0] + (b[0] - a[0]) * t; }
    }
    return prof[prof.length - 1][0];
  }
  function lathePoint(prof, ang, y) {
    var r = radiusAt(prof, y), d = 0.01;
    var dr = (radiusAt(prof, Math.min(y + d, prof[prof.length - 1][1])) - radiusAt(prof, Math.max(y - d, prof[0][1]))) / (2 * d);
    var pos = V(Math.sin(ang) * r, y, Math.cos(ang) * r);
    var n = V(Math.sin(ang), -dr, Math.cos(ang)).normalize();
    return { pos: pos, n: n };
  }
  function smoothProfile(pts, steps) { // Catmull-Rom para perfiles suaves
    var c = new T.SplineCurve(pts.map(function (p) { return new T.Vector2(p[0], p[1]); }));
    return c.getPoints(steps || 48).map(function (p) { return [p.x, p.y]; });
  }
  function latheBody(outer, wall, mat, seg) {
    var top = outer[outer.length - 1];
    var base = outer[0][1] + 0.08, inner = [];
    for (var i = 0; i <= 40; i++) { var yy = top[1] - (top[1] - base) * i / 40; inner.push([Math.max(radiusAt(outer, yy) - wall, 0.01), yy]); }
    var pts = [[0, outer[0][1]]].concat(outer, [[top[0] - wall * 0.5, top[1] + 0.012]], inner, [[0, inner[inner.length - 1][1]]]);
    var g = new T.LatheGeometry(pts.map(function (p) { return new T.Vector2(p[0], p[1]); }), seg || 96);
    var m = mesh(g, mat); m.material.side = T.DoubleSide; return m;
  }
  function soil(r, y) {
    var g = new T.CircleGeometry(r, 40); g.rotateX(-Math.PI / 2);
    var m = mesh(g, M(0x5A3E2B, 0.95)); m.position.y = y; return m;
  }
  function eye(size, withRing, ringColor) {
    var g = new T.Group();
    var w = mesh(new T.SphereGeometry(size, 24, 16), M(0xFFFFFF, 0.3)); w.scale.z = 0.45; g.add(w);
    var p = mesh(new T.SphereGeometry(size * 0.62, 20, 14), M(0x1B1B1B, 0.25)); p.scale.z = 0.45; p.position.z = size * 0.22; g.add(p);
    var h = mesh(new T.SphereGeometry(size * 0.2, 12, 8), M(0xFFFFFF, 0.1, { emissive: 0xffffff, emissiveIntensity: 0.6 }));
    h.position.set(size * 0.22, size * 0.25, size * 0.5); g.add(h);
    if (withRing) {
      var r = mesh(new T.TorusGeometry(size * 1.25, size * 0.16, 10, 40), M(ringColor || 0xD9F1FF, 0.15, { transparent: true, opacity: 0.85 }));
      g.add(r);
    }
    return g;
  }
  function waterRing(r) { // ventana / aro de luz del nivel de agua
    var g = new T.Group();
    var ring = mesh(new T.TorusGeometry(r, r * 0.13, 12, 48), M(0xBFE6FF, 0.2, { emissive: 0x7CCBFF, emissiveIntensity: 0.9 }));
    var glass = mesh(new T.CircleGeometry(r * 0.9, 32), M(0xE8F6FF, 0.1, { transparent: true, opacity: 0.55, emissive: 0x9ED8FF, emissiveIntensity: 0.35 }));
    glass.position.z = -0.002; g.add(ring); g.add(glass); return g;
  }
  function sunOfMay(r) {
    var g = new T.Group(), mat = M(0xF2B82C, 0.35, { emissive: 0x8a5a00, emissiveIntensity: 0.15 });
    var c = mesh(new T.CircleGeometry(r, 28), mat); g.add(c);
    for (var i = 0; i < 12; i++) {
      var ray = mesh(new T.CircleGeometry(r * 0.28, 3), mat);
      var a = i / 12 * Math.PI * 2; ray.position.set(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35, 0); ray.rotation.z = a; ray.scale.set(1.6, 0.7, 1);
      g.add(ray);
    }
    return g;
  }

  // ---------- plantas ----------
  var leafGeo, bladeGeo;
  function leafGeometry() {
    if (leafGeo) return leafGeo;
    var s = new T.Shape(); s.moveTo(0, 0);
    s.bezierCurveTo(0.55, 0.2, 0.5, 0.75, 0, 1); s.bezierCurveTo(-0.5, 0.75, -0.55, 0.2, 0, 0);
    leafGeo = new T.ShapeGeometry(s, 10);
    // leve curvatura de la hoja
    var p = leafGeo.attributes.position;
    for (var i = 0; i < p.count; i++) { var x = p.getX(i); p.setZ(i, -x * x * 0.35); }
    leafGeo.computeVertexNormals();
    return leafGeo;
  }
  function bladeGeometry() {
    if (bladeGeo) return bladeGeo;
    var s = new T.Shape(); s.moveTo(-0.5, 0);
    s.bezierCurveTo(-0.6, 0.45, -0.35, 0.8, 0, 1); s.bezierCurveTo(0.35, 0.8, 0.6, 0.45, 0.5, 0); s.lineTo(-0.5, 0);
    bladeGeo = new T.ShapeGeometry(s, 10);
    var p = bladeGeo.attributes.position;
    for (var i = 0; i < p.count; i++) { var x = p.getX(i); p.setZ(i, -x * x * 0.5); }
    bladeGeo.computeVertexNormals();
    return bladeGeo;
  }
  var greens = [0x2E8B3E, 0x3FA34D, 0x4FB55A, 0x2A7A38, 0x5CBF63];
  function leafy(opts) { // potus / pilea: tallos con hojas
    var g = new T.Group(), R = rnd(opts.seed || 7);
    var lg = leafGeometry(), stemMat = M(0x3E8A3F, 0.7);
    for (var i = 0; i < opts.count; i++) {
      var ang = R() * Math.PI * 2, rad = opts.spread * (0.15 + R() * 0.85);
      var h = opts.height * (0.45 + R() * 0.55);
      var tip = V(Math.sin(ang) * rad, h, Math.cos(ang) * rad);
      var curve = new T.QuadraticBezierCurve3(V(0, 0, 0), V(tip.x * 0.2, h * 0.75, tip.z * 0.2), tip);
      g.add(mesh(new T.TubeGeometry(curve, 8, opts.stem || 0.008, 5), stemMat));
      var leaf = mesh(lg, M(greens[Math.floor(R() * greens.length)], 0.5, { side: T.DoubleSide }));
      var sc = opts.leaf * (0.75 + R() * 0.5); leaf.scale.set(sc, sc, sc);
      leaf.position.copy(tip); leaf.rotation.order = 'YXZ';
      leaf.rotation.y = ang + (R() - 0.5) * 0.6; leaf.rotation.x = 0.5 + R() * 0.7; leaf.rotation.z = (R() - 0.5) * 0.5;
      g.add(leaf);
    }
    return g;
  }
  function snakePlant(opts) {
    var g = new T.Group(), R = rnd(opts.seed || 3), bg = bladeGeometry();
    var cols = [0x2F6B3A, 0x3D7F45, 0x4A8F4E, 0x6E9F45];
    for (var i = 0; i < opts.count; i++) {
      var ang = i / opts.count * Math.PI * 2 + R() * 0.4, rad = opts.spread * (0.2 + R() * 0.8);
      var b = mesh(bg, M(cols[i % cols.length], 0.55, { side: T.DoubleSide }));
      var h = opts.height * (0.6 + R() * 0.4);
      b.scale.set(opts.width * (0.8 + R() * 0.4), h, opts.width);
      b.position.set(Math.sin(ang) * rad, 0, Math.cos(ang) * rad);
      b.rotation.order = 'YXZ'; b.rotation.y = ang + (R() - 0.5) * 1.2; b.rotation.x = 0.08 + R() * 0.3;
      g.add(b);
    }
    return g;
  }
  function aloe(opts) {
    var g = new T.Group(), R = rnd(opts.seed || 11);
    for (var i = 0; i < opts.count; i++) {
      var len = opts.height * (0.55 + R() * 0.45);
      var geo = new T.ConeGeometry(opts.width, len, 6); geo.translate(0, len / 2, 0);
      var c = mesh(geo, M(i % 2 ? 0x4E9460 : 0x5FA872, 0.5));
      var ang = i / opts.count * Math.PI * 2 * 2.618;
      var ring = i / opts.count;
      c.rotation.order = 'YXZ'; c.rotation.y = ang; c.rotation.x = 0.15 + ring * 0.75;
      c.scale.z = 0.55;
      g.add(c);
    }
    return g;
  }

  // ---------- grabados (línea Interior) ----------
  function engravingTexture(kind, ink) {
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
    var x = cv.getContext('2d'); x.strokeStyle = ink; x.fillStyle = ink; x.lineWidth = 7; x.lineCap = 'round'; x.lineJoin = 'round';
    x.translate(256, 256);
    if (kind === 'condor') {
      // cóndor con alas abiertas
      x.beginPath(); x.ellipse(0, 10, 40, 22, -0.15, 0, Math.PI * 2); x.stroke();
      x.beginPath(); x.arc(52, -12, 16, 0, Math.PI * 2); x.stroke(); // cabeza
      x.beginPath(); x.moveTo(66, -10); x.lineTo(84, -2); x.lineTo(66, -2); x.stroke(); // pico
      x.beginPath(); x.moveTo(30, -10); x.quadraticCurveTo(70, -2, 40, 4); x.stroke(); // collar
      // ala superior
      x.beginPath(); x.moveTo(-10, -5); x.quadraticCurveTo(-40, -120, -170, -150); x.quadraticCurveTo(-120, -90, -110, -40); x.quadraticCurveTo(-60, -20, -10, -5); x.stroke();
      for (var i = 0; i < 6; i++) { x.beginPath(); x.moveTo(-160 + i * 18, -140 + i * 16); x.lineTo(-185 + i * 18, -115 + i * 18); x.stroke(); }
      // ala inferior
      x.beginPath(); x.moveTo(-20, 25); x.quadraticCurveTo(-90, 90, -200, 80); x.quadraticCurveTo(-130, 50, -40, 18); x.stroke();
      // cola
      x.beginPath(); x.moveTo(-38, 14); x.lineTo(-95, 30); x.lineTo(-80, 6); x.stroke();
      x.beginPath(); x.moveTo(20, 30); x.lineTo(28, 60); x.moveTo(5, 30); x.lineTo(10, 58); x.stroke(); // patas
    } else if (kind === 'yaguarete') {
      x.beginPath(); x.ellipse(-10, 0, 110, 45, 0, 0, Math.PI * 2); x.stroke(); // cuerpo
      x.beginPath(); x.ellipse(118, -30, 36, 30, 0, 0, Math.PI * 2); x.stroke(); // cabeza
      x.beginPath(); x.arc(108, -60, 10, Math.PI, 0); x.moveTo(132, -58); x.arc(132, -58, 9, Math.PI, 0); x.stroke(); // orejas
      x.beginPath(); x.arc(140, -34, 3, 0, Math.PI * 2); x.fill();
      [[-80, 40], [-50, 42], [50, 40], [80, 38]].forEach(function (l) { x.beginPath(); x.moveTo(l[0], l[1]); x.lineTo(l[0] + 6, 100); x.lineTo(l[0] + 20, 100); x.stroke(); });
      x.beginPath(); x.moveTo(-118, -10); x.bezierCurveTo(-170, -10, -175, 60, -210, 40); x.stroke(); // cola
      for (var j = 0; j < 14; j++) { // rosetas
        var sx = -90 + (j % 7) * 30, sy = -18 + Math.floor(j / 7) * 28 + (j % 2) * 6;
        x.beginPath(); x.arc(sx, sy, 8, 0.3, Math.PI * 1.7); x.stroke();
      }
    } else { // armadillo
      x.beginPath(); x.moveTo(-130, 40); x.quadraticCurveTo(-120, -90, 20, -90); x.quadraticCurveTo(120, -85, 120, 40); x.closePath(); x.stroke(); // caparazón
      for (var k = -3; k <= 3; k++) { x.beginPath(); x.moveTo(k * 30 - 5, -86 + Math.abs(k) * 6); x.quadraticCurveTo(k * 34, -20, k * 36, 40); x.stroke(); }
      x.beginPath(); x.moveTo(120, 30); x.quadraticCurveTo(170, 10, 190, 34); x.quadraticCurveTo(170, 50, 120, 40); x.stroke(); // cabeza
      x.beginPath(); x.moveTo(140, 12); x.lineTo(146, -8); x.lineTo(154, 14); x.stroke(); // oreja
      x.beginPath(); x.moveTo(-130, 30); x.quadraticCurveTo(-180, 40, -200, 70); x.stroke(); // cola
      [[-90], [-40], [40], [90]].forEach(function (l) { x.beginPath(); x.moveTo(l[0], 40); x.lineTo(l[0] + 4, 70); x.stroke(); });
    }
    var tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    return tex;
  }

  // ---------- modelos ----------
  function interior(kind) {
    var cfg = {
      condor: { color: 0xE8E0D4, ink: 'rgba(110,92,70,0.85)', scale: 1.08, plant: 'pothos' },
      yaguarete: { color: 0xC9B59C, ink: 'rgba(95,75,52,0.85)', scale: 0.95, plant: 'snake' },
      armadillo: { color: 0x444649, ink: 'rgba(200,200,200,0.7)', scale: 0.8, plant: 'pothos' }
    }[kind];
    var g = new T.Group();
    var prof = [[0.36, 0], [0.385, 0.012], [0.392, 0.04], [0.47, 0.96], [0.48, 0.985], [0.475, 1.0]];
    g.add(latheBody(prof, 0.03, M(cfg.color, 0.82)));
    // grabado sobre la superficie (cono truncado)
    var y0 = 0.16, y1 = 0.84, r0 = radiusAt(prof, y0) + 0.003, r1 = radiusAt(prof, y1) + 0.003;
    var decal = mesh(new T.CylinderGeometry(r1, r0, y1 - y0, 48, 1, true, -0.85, 1.7),
      new T.MeshStandardMaterial({ map: engravingTexture(kind, cfg.ink), transparent: true, roughness: 0.9, depthWrite: false }));
    decal.position.y = (y0 + y1) / 2; g.add(decal);
    // ranura del nivel de agua (iluminada)
    var sp = lathePoint(prof, 0.95, 0.5);
    var slotFrame = mesh(new T.BoxGeometry(0.06, 0.4, 0.02), M(new T.Color(cfg.color).multiplyScalar(0.8).getHex(), 0.7));
    g.add(place(slotFrame, sp.pos, sp.n, 0.002));
    var slot = mesh(new T.BoxGeometry(0.036, 0.36, 0.02), M(0xA8DDFF, 0.2, { emissive: 0x3FA9F5, emissiveIntensity: 1.6 }));
    g.add(place(slot, sp.pos, sp.n, 0.008));
    var led = mesh(new T.SphereGeometry(0.012, 10, 8), M(0xBDE6FF, 0.2, { emissive: 0x6EC6FF, emissiveIntensity: 1.5 }));
    var lp = lathePoint(prof, 0.95, 0.76); g.add(place(led, lp.pos, lp.n, 0.006));
    g.add(soil(0.43, 0.94));
    var plant = cfg.plant === 'snake'
      ? snakePlant({ count: 9, spread: 0.18, height: 1.05, width: 0.16, seed: 5 })
      : leafy({ count: kind === 'armadillo' ? 16 : 24, spread: 0.55, height: 0.55, leaf: 0.22, seed: kind === 'armadillo' ? 21 : 9 });
    plant.position.y = 0.94; g.add(plant);
    g.scale.setScalar(cfg.scale);
    return g;
  }

  function ballena() {
    var g = new T.Group();
    var a = 0.68, b = 0.4, c = 0.44; // semiejes del cuerpo
    var geo = new T.SphereGeometry(1, 64, 40);
    var pos = geo.attributes.position, cols = [], blue = new T.Color(0x5B8FD6), white = new T.Color(0xF4F6F8), tmp = new T.Color();
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i), x = pos.getX(i);
      var line = -0.15 + x * 0.12; // la panza blanca sube hacia la cabeza
      var t = T.MathUtils.smoothstep(y, line - 0.06, line + 0.06);
      tmp.copy(white).lerp(blue, t); cols.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    var body = mesh(geo, M(0xffffff, 0.32, { vertexColors: true })); body.scale.set(a, b, c); body.position.y = b;
    g.add(body);
    function surf(dx, dy, dz) {
      var d = V(dx, dy, dz).normalize();
      return { pos: V(d.x * a, d.y * b + b, d.z * c), n: V(d.x / a, d.y / b, d.z / c).normalize() };
    }
    // estrías de la panza
    for (var k = 0; k < 5; k++) {
      var s1 = surf(0.75 - k * 0.12, -0.55, 0.5), groove = mesh(new T.TorusGeometry(0.09, 0.006, 6, 20, Math.PI), M(0xC9D3DD, 0.4));
      place(groove, s1.pos, s1.n, 0.002); groove.rotateZ(Math.PI); g.add(groove);
    }
    // ojos, mejillas y sonrisa (cabeza hacia +x)
    [1, -1].forEach(function (side) {
      var se = surf(0.72, 0.15, 0.62 * side); var e = eye(0.055); g.add(place(e, se.pos, se.n, 0.01));
      var sc = surf(0.78, -0.12, 0.55 * side); var ch = mesh(new T.CircleGeometry(0.04, 20), M(0xF2A3A8, 0.6)); ch.scale.x = 1.4; g.add(place(ch, sc.pos, sc.n, 0.004));
      var sf = surf(0.25, -0.35, 0.95 * side);
      var fl = mesh(new T.SphereGeometry(0.16, 20, 12), M(0x5B8FD6, 0.35)); fl.scale.set(1, 0.3, 0.55);
      place(fl, sf.pos, sf.n, 0.03); fl.rotateX(0.9 * side); g.add(fl);
    });
    var sm = surf(0.98, -0.05, 0); var smile = mesh(new T.TorusGeometry(0.12, 0.008, 6, 24, Math.PI * 0.8), M(0x2F4A7A, 0.4));
    place(smile, sm.pos, sm.n, 0.004); smile.rotateZ(Math.PI * 1.1); g.add(smile);
    // sol de mayo y ventana de agua en el flanco
    var ss = surf(-0.05, 0.35, 0.95); var sun = sunOfMay(0.05); g.add(place(sun, ss.pos, ss.n, 0.006));
    var sw = surf(-0.3, -0.25, 0.9); var wr = waterRing(0.07); g.add(place(wr, sw.pos, sw.n, 0.008));
    // cola curva con aleta
    var tailCurve = new T.CatmullRomCurve3([V(-a * 0.85, b * 0.9, 0), V(-a * 1.12, b * 1.05, 0), V(-a * 1.28, b * 1.6, 0), V(-a * 1.22, b * 2.25, 0)]);
    g.add(mesh(new T.TubeGeometry(tailCurve, 30, 0.07, 14), M(0x5B8FD6, 0.35)));
    [1, -1].forEach(function (side) {
      var f = mesh(new T.SphereGeometry(0.2, 24, 12), M(0x5B8FD6, 0.35)); f.scale.set(0.45, 0.12, 1);
      f.position.set(-a * 1.2, b * 2.28, side * 0.16); f.rotation.set(0, side * 0.45, 0.25); g.add(f);
    });
    // abertura con plantas en el lomo
    var top = mesh(new T.TorusGeometry(0.22, 0.03, 10, 40), M(0x5B8FD6, 0.35)); top.rotation.x = Math.PI / 2; top.scale.set(1.2, 1, 1); top.position.set(0.05, 2 * b - 0.02, 0); g.add(top);
    var so = soil(0.22, 2 * b - 0.01); so.scale.set(1.2, 1, 1); so.position.x = 0.05; g.add(so);
    var plant = leafy({ count: 40, spread: 0.42, height: 0.32, leaf: 0.12, stem: 0.006, seed: 13 }); plant.position.set(0.05, 2 * b - 0.01, 0); g.add(plant);
    // chorro celeste
    var spout = new T.CatmullRomCurve3([V(0.35, 2 * b - 0.02, 0), V(0.42, 2 * b + 0.2, 0), V(0.55, 2 * b + 0.33, 0), V(0.68, 2 * b + 0.28, 0)]);
    var wmat = M(0x9ED4F5, 0.2, { emissive: 0x4FA9E0, emissiveIntensity: 0.3 });
    g.add(mesh(new T.TubeGeometry(spout, 20, 0.024, 8), wmat));
    var spout2 = new T.CatmullRomCurve3([V(0.35, 2 * b - 0.02, 0), V(0.3, 2 * b + 0.22, 0.04), V(0.18, 2 * b + 0.3, 0.06), V(0.1, 2 * b + 0.24, 0.06)]);
    g.add(mesh(new T.TubeGeometry(spout2, 20, 0.018, 8), wmat));
    [[0.7, 2 * b + 0.24], [0.08, 2 * b + 0.2]].forEach(function (d) { var drop = mesh(new T.SphereGeometry(0.03, 12, 10), wmat); drop.position.set(d[0], d[1], 0.03); drop.scale.y = 1.3; g.add(drop); });
    g.position.x = 0.12;
    var wrap = new T.Group(); wrap.add(g); wrap.scale.setScalar(1.05);
    return wrap;
  }

  function aguara() {
    var g = new T.Group(), orange = 0xE0782F;
    var prof = smoothProfile([[0.3, 0.12], [0.44, 0.22], [0.52, 0.45], [0.5, 0.7], [0.43, 0.86], [0.38, 0.92]], 40);
    g.add(latheBody(prof, 0.03, M(orange, 0.4)));
    // base con franjas celeste y blanco (pañuelo)
    var bands = [[0x7FB1DE, 0.0, 0.04], [0xF4F6F8, 0.04, 0.08], [0x7FB1DE, 0.08, 0.12]];
    bands.forEach(function (bd) {
      var cyl = mesh(new T.CylinderGeometry(0.3 + bd[2] * 0.4, 0.28 + bd[1] * 0.4, bd[2] - bd[1], 48), M(bd[0], 0.45));
      cyl.position.y = (bd[1] + bd[2]) / 2; g.add(cyl);
    });
    // máscara crema: hocico y mejillas
    var mz = lathePoint(prof, 0, 0.36);
    var muz = mesh(new T.SphereGeometry(0.2, 32, 20), M(0xF6E6CF, 0.45)); muz.scale.set(1.15, 0.72, 0.6); g.add(place(muz, mz.pos, mz.n, -0.04));
    [1, -1].forEach(function (side) {
      var cp = lathePoint(prof, 0.55 * side, 0.4); var ch = mesh(new T.SphereGeometry(0.13, 24, 16), M(0xF6E6CF, 0.45)); ch.scale.set(1, 0.8, 0.35); g.add(place(ch, cp.pos, cp.n, 0));
      var ep = lathePoint(prof, 0.33 * side, 0.6); g.add(place(eye(0.055), ep.pos, ep.n, 0.012));
      var bp = lathePoint(prof, 0.33 * side, 0.7); var brow = mesh(new T.CircleGeometry(0.03, 16), M(0xF6E6CF, 0.5)); brow.scale.x = 1.6; g.add(place(brow, bp.pos, bp.n, 0.004));
      var pk = lathePoint(prof, 0.62 * side, 0.46); var blush = mesh(new T.CircleGeometry(0.035, 16), M(0xF0A08F, 0.6)); blush.scale.x = 1.4; g.add(place(blush, pk.pos, pk.n, 0.03));
      // orejas grandes
      var ear = new T.Group();
      var outerEar = mesh(new T.ConeGeometry(0.17, 0.5, 4), M(orange, 0.4)); outerEar.scale.z = 0.45; outerEar.rotation.y = Math.PI / 4; ear.add(outerEar);
      var tip = mesh(new T.ConeGeometry(0.06, 0.16, 4), M(0x2A1A12, 0.45)); tip.scale.z = 0.5; tip.rotation.y = Math.PI / 4; tip.position.y = 0.18; ear.add(tip);
      var inner = mesh(new T.ConeGeometry(0.09, 0.28, 3), M(0xF6E6CF, 0.5)); inner.scale.z = 0.2; inner.position.set(0, -0.03, 0.05); ear.add(inner);
      ear.position.set(0.36 * side, 1.0, 0.04); ear.rotation.z = -0.42 * side; g.add(ear);
    });
    var np = lathePoint(prof, 0, 0.42); var nose = mesh(new T.SphereGeometry(0.045, 20, 14), M(0x1B1B1B, 0.25)); nose.scale.set(1.3, 0.85, 0.8); g.add(place(nose, np.pos, np.n, 0.07));
    var mouth = mesh(new T.TorusGeometry(0.04, 0.006, 6, 16, Math.PI), M(0x3A2418, 0.5)); g.add(place(mouth, np.pos.clone().add(V(0, -0.07, 0)), np.n, 0.055)); mouth.rotateZ(Math.PI);
    var wp = lathePoint(prof, 1.25, 0.42); g.add(place(waterRing(0.07), wp.pos, wp.n, 0.01));
    g.add(soil(0.36, 0.89));
    var plant = aloe({ count: 18, height: 0.62, width: 0.05, seed: 4 }); plant.position.y = 0.89; g.add(plant);
    return g;
  }

  function hornero() {
    var g = new T.Group(), clay = 0xA8693A;
    var prof = smoothProfile([[0.22, 0.03], [0.4, 0.14], [0.47, 0.38], [0.43, 0.6], [0.32, 0.74], [0.26, 0.78]], 40);
    g.add(latheBody(prof, 0.03, M(clay, 0.5)));
    // pecho crema
    var cp = lathePoint(prof, 0, 0.36); var chest = mesh(new T.SphereGeometry(0.2, 28, 18), M(0xD9B98F, 0.5)); chest.scale.set(0.9, 1, 0.3); g.add(place(chest, cp.pos, cp.n, -0.04));
    // puerta de la casita (ventana del nivel de agua)
    var dp = lathePoint(prof, 0, 0.22);
    var ds = new T.Shape(); ds.moveTo(-0.07, 0); ds.lineTo(-0.07, 0.1); ds.absarc(0, 0.1, 0.07, Math.PI, 0, true); ds.lineTo(0.07, 0); ds.lineTo(-0.07, 0);
    var door = mesh(new T.ShapeGeometry(ds, 16), M(0x3B2416, 0.6)); place(door, dp.pos.clone().add(V(0, -0.08, 0)), dp.n, 0.035); g.add(door);
    var water = mesh(new T.PlaneGeometry(0.1, 0.06), M(0xBFE6FF, 0.2, { emissive: 0x6EC6FF, emissiveIntensity: 0.9 }));
    place(water, dp.pos.clone().add(V(0, -0.04, 0)), dp.n, 0.04); g.add(water);
    // ojo con aro, pico, ala y cola (cabeza hacia -x)
    var ep = lathePoint(prof, -1.25, 0.52); g.add(place(eye(0.05, true), ep.pos, ep.n, 0.012));
    var ep2 = lathePoint(prof, -1.9, 0.52); g.add(place(eye(0.05, true), ep2.pos, ep2.n, 0.012));
    var bp = lathePoint(prof, -Math.PI / 2, 0.46);
    var beak = mesh(new T.ConeGeometry(0.05, 0.22, 12), M(0x8C5A2B, 0.5)); beak.position.copy(bp.pos).add(V(-0.08, 0, 0)); beak.rotation.z = Math.PI / 2 + 0.12; g.add(beak);
    [1, -1].forEach(function (side) {
      var wa = side > 0 ? 0.75 : Math.PI - 0.75;
      var wp = lathePoint(prof, wa, 0.46);
      var wing = mesh(new T.SphereGeometry(0.2, 24, 16), M(0x7E4A24, 0.5)); wing.scale.set(1, 0.55, 0.22); place(wing, wp.pos, wp.n, -0.01); wing.rotateZ(-0.35); g.add(wing);
      var st = mesh(new T.TorusGeometry(0.11, 0.012, 6, 20, Math.PI), M(0x7FB1DE, 0.4)); place(st, wp.pos, wp.n, 0.04); st.rotateZ(Math.PI - 0.35); g.add(st);
    });
    var tail = mesh(new T.ConeGeometry(0.1, 0.3, 4), M(0x8C5A2B, 0.5)); tail.scale.set(1, 1, 0.35);
    tail.position.set(0.5, 0.14, 0); tail.rotation.z = Math.PI / 2 + 0.45; g.add(tail);
    [[0x7FB1DE, 0.56], [0xF4F6F8, 0.62]].forEach(function (b2) { var band = mesh(new T.TorusGeometry(0.045, 0.012, 6, 16), M(b2[0], 0.4)); band.position.set(b2[1], 0.14 + (b2[1] - 0.5) * 0.48, 0); band.rotation.y = Math.PI / 2; band.rotation.x = 0.45; g.add(band); });
    var tsun = sunOfMay(0.03); var tp = lathePoint(prof, Math.PI / 2 - 0.35, 0.2); g.add(place(tsun, tp.pos, tp.n, 0.01));
    g.add(soil(0.25, 0.75));
    var plant = leafy({ count: 16, spread: 0.32, height: 0.34, leaf: 0.15, seed: 31 }); plant.position.y = 0.75; g.add(plant);
    g.scale.setScalar(0.92);
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
