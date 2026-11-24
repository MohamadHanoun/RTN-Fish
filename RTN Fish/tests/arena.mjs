import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const three = pathToFileURL(
  require.resolve("three").replace("three.cjs", "three.module.js"),
).href;
const source = (file) =>
  readFileSync(new URL("../public/" + file, import.meta.url), "utf8").replace(
    "/vendor/three.module.js",
    three,
  );
const moduleURL = (code) =>
  "data:text/javascript;base64," + Buffer.from(code).toString("base64");
const software = moduleURL(source("software.js"));
const size = 360;
let pixels, pending;
const context = {
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  putImageData: (image) => {
    pixels = image.data.slice();
  },
};
const canvas = {
  clientWidth: size,
  clientHeight: size,
  getContext: (type) => (type === "2d" ? context : null),
  addEventListener() {},
  removeEventListener() {},
};
globalThis.document = Object.assign(new EventTarget(), {
  getElementById: () => canvas,
});
globalThis.window = new EventTarget();
globalThis.ResizeObserver = class {
  constructor(fn) {
    this.fn = fn;
  }
  observe() {
    this.fn();
  }
};
globalThis.matchMedia = () => ({ matches: false });
globalThis.requestAnimationFrame = (fn) => {
  pending = fn;
  return 1;
};
await import(moduleURL(source("arena.js").replace("./software.js", software)));
let simulatedTime = performance.now();
function render(count, turnIndex, anchorIndex) {
  window.tikTakArenaState = {
    players: Array.from({ length: count }, (_, i) => ({
      id: String(i),
      hearts: 3,
    })),
    turnIndex,
    anchorIndex,
    code: "TEST",
  };
  window.dispatchEvent(new Event("tik-tak-state"));
  const start = performance.now();
  simulatedTime += 700;
  pending(simulatedTime);
  return Math.round(performance.now() - start);
}
function opaque(x, y) {
  return (
    pixels[4 * (Math.floor(y * size) * size + Math.floor(x * size)) + 3] > 0
  );
}
for (const count of [2, 10]) {
  const ms = render(count, 0, 0);
  assert(opaque(0.5, 0.75), "bomb should be in front of local seat");
  assert(!opaque(0.5, 0.5), "flat clock center must remain visible");
  render(count, count / 2, 0);
  assert(
    opaque(0.5, 0.25) && !opaque(0.5, 0.75),
    "bomb should move to opposite seat",
  );
  render(count, count / 2, count / 2);
  assert(
    opaque(0.5, 0.75),
    "active local viewer must see their seat at six o’clock",
  );
  console.log(
    "PASS: " +
      count +
      " seated models, clock transparency and turn transfer (" +
      ms +
      " ms software frame)",
  );
}
