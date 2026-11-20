import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

const remote = process.env.CHECK_URL;
const screens = process.argv.includes("--screens");
const media = process.argv.includes("--media");
const prefix = "/night-revels-theatre/";
const server = remote
  ? null
  : await preview({
      base: prefix,
      preview: { host: "127.0.0.1", port: 0, open: false },
    });
const port = server?.httpServer.address().port;
const url = remote || "http://127.0.0.1:" + port + prefix;
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || undefined,
  args: ["--enable-unsafe-swiftshader"],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await ctx.newPage();
page.setDefaultTimeout(45000);
const errors = [],
  failures = [],
  origins = new Set();
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) failures.push([r.status(), r.url()]);
  if (/^https?:/.test(r.url())) origins.add(new URL(r.url()).origin);
});
async function ready(p) {
  await p.waitForSelector('#app[data-ready="true"]', { timeout: 90000 });
  await p.evaluate(() => document.fonts.ready);
}
const click = (id) =>
  page
    .locator('[data-do="' + id + '"]:visible')
    .first()
    .click();
const selected = async (id) =>
  assert.equal(
    await page
      .locator('[data-do="' + id + '"]')
      .first()
      .getAttribute("aria-pressed"),
    "true",
  );
const shot = async (name) => {
  if (!screens) return;
  await page.waitForTimeout(700);
  await page.screenshot({ path: "docs/images/" + name + ".jpg", quality: 90 });
};
async function getDownload(action) {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 90000 }),
    action(),
  ]);
  assert.equal(await download.failure(), null);
  return fs.readFile(await download.path());
}
try {
  await page.goto(url);
  await ready(page);
  await page.waitForSelector(".spot:visible");
  assert.equal(await page.locator("#chapters button").count(), 5);
  await shot("听乐剧场");
  await page
    .locator(".spot:visible")
    .filter({ hasText: "琵琶" })
    .first()
    .click();
  await click("scroll");
  await page.locator('.scroll-reader[data-mode="object"]').waitFor();
  await page.locator("[data-scroll-section='2']").click();
  await page.locator("[data-scroll-object]").selectOption({ index: 1 });
  await page.locator("[data-scroll-gap]").click();
  await page.locator('.scroll-reader[data-mode="gap"]').waitFor();
  await shot("原卷对照");
  await click("close");
  await page
    .locator(".spot:visible")
    .filter({ hasText: "琵琶" })
    .first()
    .click();
  await click("approach");
  await click("help");
  await click("reset");
  for (const [i, name] of [
    [1, "观舞"],
    [2, "暂歇"],
    [3, "清吹"],
    [4, "散宴"],
    [0, "听乐"],
  ]) {
    await click("chapter-" + i);
    await page.waitForFunction(
      (name) => document.querySelector("#scene-title").textContent === name,
      name,
    );
  }
  await click("experiment");
  await click("version-乙");
  await selected("version-乙");
  await click("slice-1");
  await click("version-乙");
  await click("replay");
  await page.waitForFunction(
    () => document.querySelector("#scene-title").textContent === "素绢留白",
    null,
    { timeout: 90000 },
  );
  await shot("留白实验");
  if (await page.locator("#trial-bar").isVisible()) await click("replay");
  await click("evidence");
  for (const id of ["L1", "L2", "L3"])
    assert.ok((await page.locator("#drawer").innerText()).includes(id));
  await shot("证据面板");
  const params = JSON.parse(
    (await getDownload(() => click("export"))).toString(),
  );
  assert.deepEqual(
    params.切片.map((t) => t.版本),
    ["乙", "乙"],
  );
  assert.ok(
    params.试验记录.回合.some(
      (run) =>
        run.切片 === 2 &&
        run.轨迹.length > 0 &&
        run.事件.some((e) => e.事件 === "留白区"),
    ),
  );
  await click("close");
  await click("labels");
  assert.equal(await page.locator("#annotations").isVisible(), false);
  await click("labels");
  await click("wire");
  await selected("wire");
  await click("wire");
  await click("tour");
  await selected("tour");
  await click("tour");
  await click("settings");
  await click("quality-节能");
  await selected("quality-节能");
  const png = await getDownload(() => click("still"));
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [3840, 2160]);
  if (media) {
    await click("chapter-0");
    await page.waitForFunction(
      () => parseFloat(document.querySelector("#meter").textContent) < 1.8,
    );
    await click("settings");
    await click("record");
    await page.waitForTimeout(2000);
    const bytes = await getDownload(() => page.locator("#stop-record").click());
    assert.ok(bytes.length > 10000);
    const sample = await page.evaluate(async (data) => {
      const blob = await (await fetch("data:video/webm;base64," + data)).blob();
      const v = document.createElement("video");
      v.src = URL.createObjectURL(blob);
      v.muted = true;
      await new Promise((resolve, reject) => {
        v.onloadedmetadata = resolve;
        v.onerror = reject;
      });
      const audio = new AudioContext(),
        buffer = await audio.decodeAudioData(await blob.arrayBuffer());
      const power =
        buffer.getChannelData(0).reduce((s, x) => s + x * x, 0) / buffer.length;
      const result = {
        尺寸: [v.videoWidth, v.videoHeight],
        声道: buffer.numberOfChannels,
        均方根: Math.sqrt(power),
      };
      await audio.close();
      URL.revokeObjectURL(v.src);
      return result;
    }, bytes.toString("base64"));
    assert.deepEqual(sample.尺寸, [3840, 2160]);
    assert.ok(sample.均方根 > 0.00001);
    console.log("实录文件", sample);
  } else await click("close");
  await click("hide");
  await click("hide");
  await click("chapter-0");
  await page.waitForFunction(
    () => document.querySelector("#scene-title").textContent === "听乐",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.waitForSelector("#toast:visible", { state: "hidden" });
  await shot("移动端");
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  assert.deepEqual([...origins], [new URL(url).origin]);
  console.log(
    "子路径、五段定位、甲乙、留白、三层证据、画质、巡游、移动布局与浏览器下载通过",
  );
  if (!remote) {
    const bad = await ctx.newPage();
    await bad.route("**/art/pipa-player.webp", (r) => r.abort());
    await bad.goto(url);
    await bad.getByRole("alert").waitFor();
    assert.ok(
      (await bad.getByRole("alert").innerText()).includes("pipa-player"),
    );
    await bad.unroute("**/art/pipa-player.webp");
    await bad.getByRole("button", { name: "重新加载" }).click();
    await ready(bad);
    await bad.close();
    const local = await ctx.newPage(),
      requests = [];
    await local.route(/^https?:/, (r) => {
      requests.push(r.request().url());
      return r.abort();
    });
    await local.goto(pathToFileURL(path.resolve("dist/index.html")).href);
    await ready(local);
    assert.equal(await local.locator("#scene-title").innerText(), "听乐");
    assert.deepEqual(requests, []);
    await local.getByRole("button", { name: "证据溯源" }).click();
    await local.locator('[data-do="scroll"]').click();
    assert.equal(
      await local.locator(".scroll-paper").evaluate(async (img) => {
        await img.decode();
        return img.naturalWidth;
      }),
      3840,
    );
    console.log("缺图提示、重试、离线双击与离线全卷对照通过");
  }
} finally {
  await browser.close();
  await server?.close();
}
