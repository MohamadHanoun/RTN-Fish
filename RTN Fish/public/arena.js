import * as T from "/vendor/three.module.js";

import { software } from "./software.js";
function makeScene(canvas) {
  let renderer,
    soft = false;
  const scene = new T.Scene(),
    cam = new T.PerspectiveCamera(35, 1, 0.1, 80);
  try {
    if (!globalThis.WebGLRenderingContext)
      throw new Error("software rendering");
    renderer = new T.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch {
    soft = true;
    renderer = software(canvas);
  }
  if (!soft) {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.setClearColor(0, 0);
  }
  const standard = (color, metalness = 0, roughness = 0.5) =>
    new T.MeshStandardMaterial({
      color,
      metalness: metalness * 0.55,
      roughness,
    });
  const aged = standard(0x976f45, 0.4),
    black = standard(0x28272c, 0.35);
  const lit = (color) =>
    new T.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1,
    });
  function obj(parent, geometry, mat, x = 0, y = 0, z = 0) {
    const m = new T.Mesh(geometry, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const group = (p) => {
    const g = new T.Group();
    p.add(g);
    return g;
  };
  const box = (p, w, h, d, m, x, y, z) =>
    obj(p, new T.BoxGeometry(w, h, d), m, x, y, z);
  const cyl = (p, a, b, h, m, x, y, z, n = 48) =>
    obj(p, new T.CylinderGeometry(a, b, h, n), m, x, y, z);
  const ball = (p, r, m, x, y, z) =>
    obj(p, new T.SphereGeometry(r, 18, 12), m, x, y, z);
  const ring = (p, r, t, m, x, y, z) =>
    obj(p, new T.TorusGeometry(r, t, 8, 48), m, x, y, z);
  const graphite = standard(0x191a20, 0.41, 0.58),
    rubber = standard(0x19171b, 0, 0.85),
    scarlet = standard(0xa72b30, 0.44, 0.36),
    trim = standard(0x715a60, 0.77, 0.34),
    hot = lit(0xff4031),
    spark = lit(0xffbf6c),
    cloth = standard(0x606069, 0.05, 0.86),
    visor = standard(0x151922, 0.83, 0.15);

  scene.add(new T.HemisphereLight(0xffe6da, 0x8a7782, 1.55));
  function light(col, intensity, x, y, z, shadow) {
    const l = new T.DirectionalLight(col, intensity);
    l.position.set(x, y, z);
    l.castShadow = shadow;
    if (shadow) {
      Object.assign(l.shadow.camera, {
        left: -7,
        right: 7,
        top: 7,
        bottom: -7,
      });
      l.shadow.mapSize.set(1024, 1024);
      l.shadow.normalBias = 0.02;
    }
    scene.add(l);
  }
  light(0xffede3, 3, -4, 8, 5, true);
  light(0xff302b, 3, 4, 3, -4, false);
  const base = group(scene);
  function horizontal(p, r, t, m, y, x = 0, z = 0) {
    let k = ring(p, r, t, m, x, y, z);
    k.rotation.x = -Math.PI / 2;
    return k;
  }
  const chairs = [],
    lamps = [];
  function capsule(p, a, b, r, mat) {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...b),
      v = end.clone().sub(start);
    const mid = start.addScaledVector(v, 0.5);
    const mesh = obj(
      p,
      new T.CapsuleGeometry(r, Math.max(0.01, v.length() - r * 1.2), 4, 12),
      mat,
      mid.x,
      mid.y,
      mid.z,
    );
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
    return mesh;
  }
  function makeChair() {
    const chair = group(base);
    chairs.push(chair);
    cyl(chair, 0.68, 0.73, 0.1, rubber, 0, 0.035, 0);
    cyl(chair, 0.16, 0.29, 0.54, trim, 0, 0.34, 0);
    box(chair, 0.93, 0.16, 0.88, graphite, 0, 0.65, 0);
    box(chair, 0.88, 0.13, 0.77, scarlet, 0, 0.75, 0.03);
    box(chair, 0.87, 0.97, 0.13, graphite, 0, 1.13, -0.37);
    box(chair, 0.79, 0.66, 0.085, scarlet, 0, 1.21, -0.29);
    for (let side of [-1, 1]) {
      box(chair, 0.09, 0.39, 0.1, trim, side * 0.52, 0.78, 0);
      box(chair, 0.16, 0.1, 0.51, black, side * 0.52, 1.02, 0.04);
    }
    const body = group(chair);
    const torso = ball(body, 0.49, cloth, 0, 1.27, -0.02);
    torso.scale.set(0.9, 1.1, 0.66);
    const head = ball(
      body,
      0.345,
      standard(0xa39899, 0.3, 0.47),
      0,
      1.97,
      -0.02,
    );
    head.scale.set(0.91, 1, 0.91);
    let face = ball(body, 0.29, visor, 0, 1.96, 0.115);
    face.scale.set(1, 0.54, 0.77);
    box(body, 0.22, 0.026, 0.037, hot, 0, 1.98, 0.329);
    for (let side of [-1, 1]) {
      let x = side * 0.225;
      capsule(body, [x, 0.91, -0.05], [x, 0.8, 0.62], 0.165, graphite);
      capsule(body, [x, 0.82, 0.6], [x, 0.24, 0.66], 0.128, cloth);
      let foot = ball(body, 0.18, black, x, 0.16, 0.75);
      foot.scale.set(0.93, 0.68, 1.55);
      capsule(
        body,
        [side * 0.34, 1.53, 0.0],
        [side * 0.44, 1.08, 0.05],
        0.115,
        cloth,
      );
      capsule(
        body,
        [side * 0.44, 1.07, 0.05],
        [side * 0.3, 1.01, 0.42],
        0.097,
        graphite,
      );
      ball(body, 0.105, cloth, side * 0.3, 1.02, 0.44);
    }
    const halo = horizontal(chair, 0.84, 0.042, hot, 0.078);
    lamps.push(halo);
    chair.rotation.x = 0.26;
  }
  const ballRoot = group(base),
    rolling = group(ballRoot),
    R = 0.8;
  ball(rolling, R, standard(0x29282e, 0.7, 0.3), 0, 0, 0);
  for (const offset of [-0.1, 0.1]) {
    let stripe = ring(
      rolling,
      Math.sqrt(R * R - offset * offset),
      0.038,
      scarlet,
      0,
      offset,
      0,
    );
    stripe.rotation.x = Math.PI / 2;
  }
  const band = ring(rolling, 0.8, 0.018, trim, 0, 0, 0);
  band.rotation.z = 0.45;
  cyl(rolling, 0.14, 0.18, 0.13, trim, 0, 0.8, 0);
  const fuse = new T.CatmullRomCurve3([
    new T.Vector3(0, 0.84, 0),
    new T.Vector3(0.035, 1.0, -0.01),
    new T.Vector3(0.16, 1.07, 0),
  ]);
  obj(rolling, new T.TubeGeometry(fuse, 12, 0.038, 6, false), aged);
  ball(rolling, 0.072, spark, 0.16, 1.07, 0);

  const track = 2.58,
    tau = 2 * Math.PI;
  cam.fov = 16;
  cam.position.set(0, 38, 0.001);
  cam.up.set(0, 0, -1);
  cam.lookAt(0, 0, 0);
  cam.updateProjectionMatrix();
  rolling.rotation.set(0.94, 0.32, 0.38);
  let angle = 0,
    target = null,
    motion = null,
    roomCode = null,
    layoutKey = null,
    frameId = 0,
    previousPaint = -Infinity;
  const axis = new T.Vector3(),
    rotation = new T.Quaternion();
  function frame(now) {
    frameId = 0;
    if (!canvas.clientWidth || document.hidden) return;
    if (soft && motion && now - previousPaint < 50) {
      schedule();
      return;
    }
    previousPaint = now;
    if (motion) {
      const u = Math.min(1, (now - motion.start) / 480),
        before = angle;
      angle = motion.from + (motion.to - motion.from) * u * u * (3 - 2 * u);
      axis.set(-Math.sin(angle), 0, -Math.cos(angle));
      rotation.setFromAxisAngle(axis, ((angle - before) * track) / R);
      rolling.quaternion.premultiply(rotation);
      if (u === 1) motion = null;
    }
    ballRoot.position.set(track * Math.sin(angle), R, track * Math.cos(angle));
    renderer.render(scene, cam);
    if (motion) schedule();
  }
  function schedule() {
    if (!frameId) frameId = requestAnimationFrame(frame);
  }
  function sync() {
    const state = window.tikTakArenaState;
    if (!state) return;
    const { players, anchorIndex, turnIndex, code } = state,
      count = players.length;
    if (!count) return;
    const key = players.map((p) => p.id).join("|") + "/" + anchorIndex;
    while (chairs.length < count) makeChair();
    chairs.forEach((chair, i) => {
      chair.visible = i < count;
      if (!chair.visible) return;
      const a = (-tau * (i - anchorIndex)) / count;
      chair.position.set(3.95 * Math.sin(a), 0, 3.95 * Math.cos(a));
      chair.rotation.order = "YXZ";
      chair.rotation.y = a + Math.PI;
      chair.scale.setScalar(players[i].hearts > 0 ? 1 : 0.68);
      lamps[i].visible = i === turnIndex;
    });
    ballRoot.visible = turnIndex >= 0;
    if (ballRoot.visible) {
      const next = (-tau * (turnIndex - anchorIndex)) / count;
      if (
        key !== layoutKey ||
        roomCode !== code ||
        target === null ||
        matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        angle = next;
        motion = null;
      } else if (next !== target) {
        const delta = Math.atan2(
          Math.sin(next - angle),
          Math.cos(next - angle),
        );
        motion = { from: angle, to: angle + delta, start: performance.now() };
      }
      target = next;
    }
    roomCode = code;
    layoutKey = key;
    schedule();
  }
  new ResizeObserver(() => {
    if (canvas.clientWidth) {
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      schedule();
    }
  }).observe(canvas);
  document.addEventListener("visibilitychange", schedule);
  window.addEventListener("tik-tak-state", sync);
  sync();
}
const start = () => makeScene(document.getElementById("models"));
if (window.tikTakArenaState) start();
else window.addEventListener("tik-tak-state", start, { once: true });
