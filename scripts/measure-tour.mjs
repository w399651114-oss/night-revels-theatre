import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import { chromium } from "playwright";
import { preview } from "vite";

const base = "/night-revels-theatre/";
const remote = process.env.CHECK_URL;
const server = remote
  ? null
  : await preview({ base, preview: { host: "127.0.0.1", port: 0 } });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || undefined,
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const url =
    remote || `http://127.0.0.1:${server.httpServer.address().port}${base}`;
  await page.goto(url);
  await page.locator('#app[data-ready="true"]').waitFor({ timeout: 90000 });
  await page.locator('[data-do="audio"]').click();
  const measurement = page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const intervals = [],
          chapters = new Set();
        const canvas = document.querySelector("#world"),
          gl = canvas.getContext("webgl2");
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        const graphics = ext
          ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER);
        let start = null,
          previous = null;
        const tick = (time) => {
          if (start === null) {
            if (
              document
                .querySelector('[data-do="tour"]')
                .getAttribute("aria-pressed") !== "true"
            ) {
              requestAnimationFrame(tick);
              return;
            }
            start = time;
          }
          if (previous !== null) intervals.push(time - previous);
          previous = time;
          chapters.add(document.querySelector("#scene-title").innerText);
          if (time - start > 150000) {
            reject(new Error("巡游未抵达卷末"));
            return;
          }
          if (
            document
              .querySelector('[data-do="tour"]')
              .getAttribute("aria-pressed") === "true"
          ) {
            requestAnimationFrame(tick);
            return;
          }
          const sorted = intervals.toSorted((a, b) => a - b);
          const round = (x) => Number(x.toFixed(2));
          const quantile = (q) =>
            round(sorted[Math.ceil(sorted.length * q) - 1]);
          resolve({
            渲染器: graphics,
            画质: "标准",
            音频: "开启",
            视口: [innerWidth, innerHeight],
            绘图像素: [canvas.width, canvas.height],
            起点米: 1.5,
            终点米: parseFloat(document.querySelector("#meter").innerText),
            经过: [...chapters],
            巡游秒: round((time - start) / 1000),
            帧间隔数: sorted.length,
            平均帧每秒: round((1000 * sorted.length) / (time - start)),
            中位毫秒: quantile(0.5),
            P95毫秒: quantile(0.95),
            P99毫秒: quantile(0.99),
            最慢毫秒: round(sorted.at(-1)),
            超过50毫秒: sorted.filter((x) => x > 50).length,
          });
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.locator('[data-do="tour"]').click();
  const result = await measurement;
  assert.equal(result.终点米, 27);
  assert.equal(result.经过.length, 6);
  const data = {
    日期: new Date().toISOString(),
    处理器: os.cpus()[0].model,
    物理内存GiB: os.totalmem() / 2 ** 30,
    浏览器: browser.version(),
    ...result,
  };
  console.log(JSON.stringify(data, null, 2));
  if (process.env.REPORT_PATH)
    await fs.writeFile(
      process.env.REPORT_PATH,
      JSON.stringify(data, null, 2) + "\n",
    );
} finally {
  await browser.close();
  await server?.close();
}
