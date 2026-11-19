import fs from "node:fs/promises";
import path from "node:path";

// 网站采用相对子路径，离线副本内嵌同一构建的脚本、字形和原画。
const dist = path.resolve("dist");
const indexPath = path.join(dist, "index.html");
const original = await fs.readFile(indexPath, "utf8");
const files = await fs.readdir(path.join(dist, "art"));
const map = {};
for (const f of files) {
  const bytes = await fs.readFile(path.join(dist, "art", f));
  const type = f.endsWith(".json") ? "application/json" : "image/webp";
  map["art/" + f] = "data:" + type + ";base64," + bytes.toString("base64");
}
const scriptTag = original.match(
  /<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/,
);
const styleTag = original.match(/<link\b[^>]*\bhref="([^"]+\.css)"[^>]*>/);
if (!scriptTag || !styleTag) throw new Error("未识别 Vite 构建入口");
const js = await fs.readFile(path.join(dist, scriptTag[1]), "utf8");
const cssFile = path.join(dist, styleTag[1]);
let css = await fs.readFile(cssFile, "utf8");
for (const m of [...css.matchAll(/url\((['"]?)([^)'"]+\.woff2)\1\)/g)]) {
  const bytes = await fs.readFile(path.resolve(path.dirname(cssFile), m[2]));
  css = css.replace(
    m[0],
    () => "url(data:font/woff2;base64," + bytes.toString("base64") + ")",
  );
}
const legal = await Promise.all(
  (await fs.readdir(path.join(dist, "notices"))).map((name) =>
    fs.readFile(path.join(dist, "notices", name), "utf8"),
  ),
);
const notices =
  '<script type="text/plain" id="third-party-notices">' +
  legal.join("\n\n") +
  "</script>";
const pre =
  notices +
  "<script>globalThis.__卷内资源=" +
  JSON.stringify(map) +
  "</script>";
const embedded =
  '<script type="module">' +
  js.replace(/<\/script/gi, "<\\/script") +
  "</script>";
const standalone = original
  .replace(scriptTag[0], () => pre + embedded)
  .replace(styleTag[0], () => "<style>" + css + "</style>");
await fs.writeFile(path.join(dist, "离线画卷.html"), standalone);
const localBridge =
  "<script>if(location.protocol==='file:')location.replace('./离线画卷.html')</script>";
await fs.writeFile(
  indexPath,
  original.replace("<head>", "<head>" + localBridge),
);
console.log(
  "生成静态网站与独立离线画卷，离线文件 " +
    (Buffer.byteLength(standalone) / 1048576).toFixed(2) +
    " MiB",
);
