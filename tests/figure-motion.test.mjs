import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as T from "three";
import { attachGesture, animateGesture } from "../src/figure-motion.js";

const manifest = JSON.parse(
  await readFile(new URL("../public/art/art.json", import.meta.url)),
);
const layers = manifest.sections.flatMap((section) => section.layers);
const byId = (id) => layers.find((layer) => layer.id === id);

function sourceToStage(layer, [x, y]) {
  const [x0, y0, x1, y1] = layer.sourceBox;
  const scale = layer.height / (y1 - y0);
  return new T.Vector3(
    layer.x + (x - (x0 + x1) / 2) * scale,
    0.045 + (y1 - y) * scale,
    0,
  );
}

test("关节转动独立于主画片，四个局部均有透明 WebP", async () => {
  for (const layer of layers.filter((piece) => piece.motion)) {
    const body = new T.Group();
    const part = attachGesture(body, layer, new T.MeshBasicMaterial());
    const data = await readFile(
      new URL("../public/" + layer.motion.file, import.meta.url),
    );
    assert.equal(data.toString("ascii", 8, 12), "WEBP");
    assert.ok((data[20] & 16) !== 0, layer.id + " 的 WebP 含透明通道");
    assert.equal(part.hinge.parent, body);
    const pivot = part.hinge.position.clone();
    animateGesture(part, 0, 0);
    const first = part.hinge.rotation.z;
    animateGesture(part, 0.25, 0.19);
    assert.notEqual(part.hinge.rotation.z, first, layer.id);
    assert.equal(body.rotation.z, 0);
    assert.ok(pivot.equals(part.hinge.position));
    assert.equal(part.gesture.userData.id, layer.id);
  }
  assert.equal(layers.filter((layer) => layer.motion).length, 4);
});

test("鼓轨拍头槌头到达鼓沿，休止拍抬槌；拨弦相位不重置鼓组", () => {
  const drummer = byId("drum-players"),
    drum = byId("red-drum");
  const body = new T.Group();
  body.position.set(drummer.x, drummer.height / 2 + 0.045, 0);
  const part = attachGesture(body, drummer, new T.MeshBasicMaterial());
  const { pivot, tip } = drummer.motion;
  const scale = drummer.height / (drummer.sourceBox[3] - drummer.sourceBox[1]);
  const localTip = new T.Vector3(
    (tip[0] - pivot[0]) * scale,
    (pivot[1] - tip[1]) * scale,
    0,
  );
  const lip = sourceToStage(drum, [565, 167]);
  animateGesture(part, 0.19, 0);
  assert.ok(part.hinge.localToWorld(localTip.clone()).distanceTo(lip) < 0.025);
  animateGesture(part, 0, 0.375 * 5);
  assert.ok(part.hinge.localToWorld(localTip.clone()).distanceTo(lip) > 0.28);
});
