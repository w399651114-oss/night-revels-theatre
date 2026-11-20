import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import { preview } from "vite";

// 旁接分析器读取实际 PCM，不更改网页使用的增益或控制时钟。
const remote = process.env.CHECK_URL;
const base = "/night-revels-theatre/";
const server = remote
  ? null
  : await preview({ base, preview: { host: "127.0.0.1", port: 0 } });
const url =
  remote || `http://127.0.0.1:${server.httpServer.address().port}${base}`;
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || undefined,
  args: ["--enable-unsafe-swiftshader"],
});
const results = [];
const report = {
  网页: url,
  日期: new Date().toISOString(),
  浏览器: browser.version(),
  方法: "逐帧旁接声部增益后、空间声像前的 Web Audio PCM。RMS 阈值 0.0001；揭帧以 GPU 查询并提交显示的程序事件为准。时间不含扬声器和听者延迟。",
  回放: results,
};
try {
  for (const mobile of [false, true]) {
    const view = mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 900 };
    const ctx = await browser.newContext({
      viewport: view,
      hasTouch: mobile,
      deviceScaleFactor: 1,
    });
    await ctx.addInitScript(() => {
      const probes = [],
        samples = [];
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (...args) {
        if (this instanceof GainNode && args[0] instanceof PannerNode) {
          const analyser = this.context.createAnalyser();
          analyser.fftSize = 512;
          connect.call(this, analyser);
          probes.push({ analyser, pcm: new Float32Array(analyser.fftSize) });
        }
        return connect.apply(this, args);
      };
      function sample() {
        if (
          document.querySelector("#trial-bar:not([hidden])") &&
          probes.length === 3
        ) {
          const rms = probes.map(({ analyser, pcm }) => {
            analyser.getFloatTimeDomainData(pcm);
            return Math.sqrt(
              pcm.reduce((sum, x) => sum + x * x, 0) / pcm.length,
            );
          });
          samples.push([performance.timeOrigin + performance.now(), ...rms]);
        }
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
      window.readStudySamples = () => samples.splice(0);
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url);
    await page.locator('#app[data-ready="true"]').waitFor({ timeout: 90000 });
    const click = (id) =>
      page.locator(`[data-do="${id}"]:visible`).first().click();
    await click("experiment");
    for (const slice of mobile ? [0] : [0, 1]) {
      await click("slice-" + slice);
      for (const condition of ["甲", "乙"]) {
        await click("version-" + condition);
        await page.evaluate(() => window.readStudySamples());
        await click("replay");
        await page.locator("#trial-bar:visible").waitFor();
        const overlap = await page.evaluate(() => {
          const a = document
              .querySelector("#trial-bar")
              .getBoundingClientRect(),
            b = document.querySelector("#world").getBoundingClientRect();
          return (
            Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
            Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
          );
        });
        assert.equal(overlap, 0);
        if (
          mobile &&
          condition === "乙" &&
          process.argv.includes("--screens")
        ) {
          await page.waitForTimeout(1250);
          await page.screenshot({
            path: "docs/images/手机试听.jpg",
            quality: 92,
          });
        }
        await page
          .locator("#trial-bar")
          .waitFor({ state: "hidden", timeout: 45000 });
        const [download] = await Promise.all([
          page.waitForEvent("download"),
          click("export-log"),
        ]);
        const data = JSON.parse(
          await fs.readFile(await download.path(), "utf8"),
        );
        const run = data.回合.at(-1);
        assert.equal(run.状态, "抵达终点");
        const samples = (
          await page.evaluate(() => window.readStudySamples())
        ).map(([t, ...rms]) => [t - Date.parse(run.开始时间), ...rms]);
        const event = (name, val = true) =>
          run.事件.find((e) => e.事件 === name && e.值 === val);
        const result = {
          视口: view,
          切片: slice + 1,
          条件: condition,
          采样帧: samples.length,
          遮盖面积: overlap,
          终点米: run.事件.at(-1).位置米,
        };
        assert.ok(samples.length > 35);
        if (!slice) {
          const reveal = event("舞者揭帧"),
            gate = event("鼓轨开放");
          assert.ok(reveal && gate);
          const first = samples.find((s) => s[2] > 0.0001);
          assert.ok(first, "应读到鼓声 PCM");
          const before = samples.filter((s) => s[0] < reveal.毫秒 - 60);
          assert.ok(before.length > 10);
          const peak = Math.max(...before.map((s) => s[2]));
          Object.assign(result, {
            揭帧米: reveal.位置米,
            揭帧毫秒: reveal.毫秒,
            开放鼓轨毫秒: gate.毫秒,
            鼓声首次检出毫秒: Math.round(first[0]),
            揭帧前鼓声最高RMS: peak,
          });
          if (condition === "乙") {
            assert.equal(gate.毫秒, reveal.毫秒);
            assert.equal(peak, 0);
            assert.ok(
              Math.abs(first[0] - reveal.毫秒) < 145,
              "乙版鼓声 PCM 应在揭帧附近起音",
            );
          } else assert.ok(first[0] + 500 < reveal.毫秒 && peak > 0.01);
        } else {
          const enter = event("留白区");
          const exit = event("留白区", false);
          assert.ok(enter && exit);
          const interior = samples.filter(
            (s) => s[0] > enter.毫秒 + 250 && s[0] < exit.毫秒 - 100,
          );
          assert.ok(interior.length > 15);
          const rms = Math.sqrt(
            interior.reduce((sum, s) => sum + s[3] ** 2, 0) / interior.length,
          );
          Object.assign(result, {
            留白入口米: enter.位置米,
            留白窗口管声RMS: rms,
          });
          if (condition === "乙") assert.ok(rms < 0.00001);
          else assert.ok(rms > 0.01);
        }
        results.push(result);
        console.log(JSON.stringify(result));
      }
    }
    if (mobile) {
      // 实际操作一次自主回合，确认版本顺序、回退、手动驻足、自报与刷新恢复。
      await click("replay");
      await click("hold-trial");
      await click("heard");
      await click("version-甲");
      await page.keyboard.down("d");
      await page.waitForTimeout(500);
      await page.keyboard.up("d");
      await page.waitForTimeout(220);
      await click("seen");
      await click("replay");
      await page.reload();
      await page.locator('#app[data-ready="true"]').waitFor({ timeout: 90000 });
      await click("experiment");
      const [d] = await Promise.all([
        page.waitForEvent("download"),
        click("export-log"),
      ]);
      const run = JSON.parse(await fs.readFile(await d.path(), "utf8")).回合.at(
        -1,
      );
      const names = run.事件.map((e) => e.事件);
      for (const name of [
        "手动驻足",
        "回退",
        "切换条件",
        "自报：听到",
        "自报：看到",
        "手动结束",
      ])
        assert.ok(names.includes(name), name);
      assert.ok(run.轨迹.some((t) => t.方向 === -1));
      report.刷新后完整自主回合 = true;
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  if (process.env.REPORT_PATH)
    await fs.writeFile(
      process.env.REPORT_PATH,
      JSON.stringify(report, null, 2) + "\n",
    );
} finally {
  await browser.close();
  await server?.close();
}
