import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import {
  stations,
  sectionAt,
  gates,
  gap,
  inGap,
  railPoint,
} from "../src/route.js";
import { gains, trials } from "../src/audio.js";

test("五段沿卷顺序、留白和屏端几何净空", () => {
  stations.forEach((s, i) => assert.equal(sectionAt(s), i));
  assert.ok(inGap((gap[0] + gap[1]) / 2));
  for (const g of gates) {
    for (let s = g - 0.75; s <= g + 0.75; s += 0.01) {
      for (const d of [-1.65, 0, 1.8]) {
        const p = railPoint(s, d);
        if (Math.abs(p.x + g) < 0.28)
          assert.ok(p.z > 4.44, "靠近木屏只能从屏端外侧经过");
      }
    }
  }
});
test("乙在舞者共同揭帧时开鼓，与固定屏线解耦，转回遮挡时重新关闭", () => {
  for (const s of [3.65, 3.71, 4.2, 4.6]) {
    assert.equal(gains(s, ["乙", "甲"], false)[1], 0);
    assert.equal(
      gains(s, ["乙", "甲"], true)[1],
      gains(s, ["甲", "甲"], true)[1],
    );
    assert.ok(gains(s, ["甲", "甲"], false)[1] > 0);
  }
});
test("静默覆盖整个留白，延续版逐步衰减，固定实验段包含边界", () => {
  for (let s = gap[0]; s <= gap[1]; s += 0.1) {
    assert.deepEqual(gains(s, ["甲", "乙"]), [0, 0, 0]);
    assert.ok(gains(s, ["甲", "甲"])[2] > 0);
  }
  assert.ok(gains(gap[0], ["甲", "甲"])[2] > gains(gap[1], ["甲", "甲"])[2]);
  assert.ok(trials[0].from < gates[0] && trials[0].to > gates[0]);
  assert.ok(trials[1].from < gap[0] && trials[1].to > gap[1]);
});
test("每段图层与证据图均已随仓库提供", async () => {
  const manifest = JSON.parse(await readFile("public/art/art.json", "utf8"));
  assert.equal(manifest.sections.length, 5);
  for (const sec of manifest.sections) {
    assert.ok(sec.layers.length >= 4);
    assert.ok(new Set(sec.layers.map((l) => l.z)).size >= 4);
    for (const path of [sec.thumbnail, ...sec.layers.map((l) => l.file)])
      assert.ok((await stat("public/" + path)).size > 500);
  }
});
