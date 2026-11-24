import * as T from "/vendor/three.module.js";
// Software depth buffer for browsers where WebGL is disabled.
export function software(canvas) {
  const ctx = canvas.getContext("2d", { alpha: true }),
    textures = new WeakMap(),
    mats = new WeakMap(),
    buffers = new WeakMap();
  let frame, depth, w, h;
  function setSize(width, height) {
    const k = Math.min(1, 670 / Math.max(width, height));
    w = canvas.width = Math.max(1, Math.round(width * k));
    h = canvas.height = Math.max(1, Math.round(height * k));
    frame = ctx.createImageData(w, h);
    depth = new Float32Array(w * h);
  }
  function rgb(c) {
    let k = c.getHex();
    return [k >> 16, (k >> 8) & 255, k & 255];
  }
  function material(m) {
    if (mats.has(m)) return mats.get(m);
    let map = m.map,
      tex = null;
    if (map) {
      if (!textures.has(map)) {
        let im = map.image;
        const d = im.getContext("2d").getImageData(0, 0, im.width, im.height);
        textures.set(map, d);
      }
      tex = textures.get(map);
    }
    let data = {
      color: rgb(m.color),
      metal: m.metalness || 0,
      rough: m.roughness ?? 0.5,
      flat: m.isMeshBasicMaterial,
      glow: m.emissive?.getHex() > 0,
      tex,
      sx: map?.repeat.x || 1,
      sy: map?.repeat.y || 1,
    };
    mats.set(m, data);
    return data;
  }
  const V = new T.Matrix4(),
    M = new T.Matrix4(),
    N = new T.Matrix3(),
    normal = new T.Vector3(),
    lamp = new T.Vector3(-0.45, 0.81, 0.42),
    half = new T.Vector3(),
    eye = new T.Vector3(),
    pos = new T.Vector3();
  return {
    setSize,
    render(scene, camera) {
      if (!frame) return;
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
      V.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const out = frame.data;
      out.fill(0);
      depth.fill(-Infinity);
      scene.traverseVisible((o) => {
        if (!o.isMesh) return;
        const g = o.geometry,
          p = g.attributes.position,
          ns = g.attributes.normal,
          uv = g.attributes.uv,
          ix = g.index?.array;
        if (!ns) return;
        const mat = material(o.material);
        M.multiplyMatrices(V, o.matrixWorld);
        const e = M.elements;
        N.getNormalMatrix(o.matrixWorld);
        pos.setFromMatrixPosition(o.matrixWorld);
        eye.copy(camera.position).sub(pos).normalize();
        half.copy(lamp).add(eye).normalize();
        let verts = buffers.get(g);
        if (!verts) {
          verts = new Float32Array(p.count * 4);
          buffers.set(g, verts);
        }
        for (let i = 0; i < p.count; i++) {
          let x = p.getX(i),
            y = p.getY(i),
            z = p.getZ(i),
            j = i * 4,
            inv = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
          verts[j] =
            (((e[0] * x + e[4] * y + e[8] * z + e[12]) * inv + 1) * w) / 2;
          verts[j + 1] =
            ((1 - (e[1] * x + e[5] * y + e[9] * z + e[13]) * inv) * h) / 2;
          verts[j + 2] = inv;
          normal.fromBufferAttribute(ns, i).applyMatrix3(N).normalize();
          let l = Math.max(0, normal.dot(lamp)),
            spec = Math.pow(Math.max(0, normal.dot(half)), mat.metal ? 16 : 30);
          verts[j + 3] =
            mat.flat || mat.glow
              ? 1
              : 0.48 +
                0.55 * l +
                spec * (mat.metal ? 1.65 : 0.22) +
                mat.metal * 0.3 * Math.pow(1 - Math.abs(normal.dot(eye)), 2);
        }
        for (let i = 0, count = ix ? ix.length : p.count; i < count; i += 3) {
          let ia = ix ? ix[i] : i,
            ib = ix ? ix[i + 1] : i + 1,
            ic = ix ? ix[i + 2] : i + 2,
            A = ia * 4,
            B = ib * 4,
            C = ic * 4,
            ax = verts[A],
            ay = verts[A + 1],
            bx = verts[B],
            by = verts[B + 1],
            cx = verts[C],
            cy = verts[C + 1];
          let az = verts[A + 2],
            bz = verts[B + 2],
            cz = verts[C + 2];
          if (Math.min(az, bz, cz) <= 0) continue;
          let det = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
          if (det > -0.005) continue;
          let x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))),
            x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx))),
            y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))),
            y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
          let u0, v0, u1, v1, u2, v2;
          if (mat.tex) {
            u0 = uv.getX(ia) * az;
            v0 = uv.getY(ia) * az;
            u1 = uv.getX(ib) * bz;
            v1 = uv.getY(ib) * bz;
            u2 = uv.getX(ic) * cz;
            v2 = uv.getY(ic) * cz;
          }
          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
              let b =
                  ((x + 0.5 - ax) * (cy - ay) - (y + 0.5 - ay) * (cx - ax)) /
                  det,
                c =
                  ((bx - ax) * (y + 0.5 - ay) - (by - ay) * (x + 0.5 - ax)) /
                  det,
                a = 1 - b - c;
              if (a < 0 || b < 0 || c < 0) continue;
              let z = a * az + b * bz + c * cz,
                j = y * w + x;
              if (z <= depth[j]) continue;
              depth[j] = z;
              let light =
                  a * verts[A + 3] + b * verts[B + 3] + c * verts[C + 3],
                t = mat.tex,
                red = mat.color[0],
                green = mat.color[1],
                blue = mat.color[2];
              if (t) {
                let uu = ((a * u0 + b * u1 + c * u2) / z) * mat.sx,
                  vv = (1 - (a * v0 + b * v1 + c * v2) / z) * mat.sy;
                let off =
                  4 *
                  (Math.floor((vv - Math.floor(vv)) * t.height) * t.width +
                    Math.floor((uu - Math.floor(uu)) * t.width));
                red *= t.data[off] / 255;
                green *= t.data[off + 1] / 255;
                blue *= t.data[off + 2] / 255;
              }
              out[j * 4 + 3] = 255;
              out[j * 4] = red * light;
              out[j * 4 + 1] = green * light;
              out[j * 4 + 2] = blue * light;
            }
          }
        }
      });
      ctx.putImageData(frame, 0, 0);
    },
  };
}
