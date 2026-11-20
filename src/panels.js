import { titles, assetURL } from "./route.js";
import { trials } from "./audio.js";
import { evidence } from "./evidence.js";
import { scrollViewHTML } from "./scroll-view.js";
import { icon } from "./icons.js";

export const action = (id, label, ic = "") =>
  '<button class="panel-btn" data-do="' +
  id +
  '">' +
  (ic ? icon(ic, 16) : "") +
  label +
  "</button>";
const diagrams = [
  ["2.25 米 · 屏前", "绕屏见舞 · 乙起鼓", "6.15 米 · 终点"],
  ["屏前先闻鼓", "绕屏见舞", "停驻重听"],
  ["前段鼓声渐远", "榻前停驻", "自主离开"],
  ["18.60 米 · 吹奏", "20.95 米 · 留白", "23.55 米 · 出廊"],
  ["散宴驻足", "折返留白", "重听清吹"],
];
const row = (term, value) =>
  '<div class="pair"><dt>' + term + "</dt><dd>" + value + "</dd></div>";
export function panelContent(type, app) {
  const { section, slice, versions, quality, label, recording, manifest } = app;
  const e = evidence[section],
    trial = trials[slice];
  let title = "",
    body = "";
  if (type === "experiment") {
    title = "声场实验";
    body =
      '<div class="switch tabs">' +
      trials
        .map(
          (t, i) =>
            '<button data-do="slice-' +
            i +
            '" aria-pressed="' +
            (slice === i) +
            '">切片' +
            ["一", "二"][i] +
            "</button>",
        )
        .join("") +
      "</div><h3>" +
      trial.name +
      '</h3><p class="panel-sub">在同一位置切换，或沿相同路线重走一次。</p>' +
      '<div class="variants">' +
      ["甲", "乙"]
        .map(
          (v, i) =>
            '<button data-do="version-' +
            v +
            '" aria-pressed="' +
            (versions[slice] === v) +
            '"><b>' +
            v +
            "</b><span>" +
            [trial.a, trial.b][i] +
            "</span><i></i></button>",
        )
        .join("") +
      "</div>" +
      '<div class="schematic" aria-label="时空边界示意"><div><span>' +
      ["屏前", "清吹"][slice] +
      "</span><span>" +
      ["见舞", "留白"][slice] +
      "</span><span>" +
      ["屏后", "散宴"][slice] +
      '</span></div><div class="bars">' +
      Array.from({ length: 41 }, (_, j) => {
        let h =
          slice === 0
            ? j < 20
              ? versions[0] === "甲"
                ? 4 + j * 0.6
                : 1
              : 19
            : j < 17
              ? 20
              : versions[1] === "甲"
                ? Math.max(2, 21 - (j - 17) * 0.84)
                : 1;
        return (
          '<i style="height:' +
          Math.max(1, h * (0.4 + 0.6 * Math.abs(Math.cos(j * 2.7)))) +
          'px"></i>'
        );
      }).join("") +
      "</div><small>研究推定 · 增益趋势示意</small></div>" +
      "<p>" +
      (slice === 0
        ? "甲在屏前放入可衰减的鼓声；乙在舞者露出的同一渲染帧启动鼓点。两版共享这次落槌。"
        : "甲让管声进入留白后逐步衰减；乙在留白入口把管声收为静默。") +
      "</p><dl>" +
      row("固定条件", "路线、音轨、视点、速度") +
      row("对照速度", "0.66 米 / 秒") +
      "</dl>" +
      action(
        "replay",
        app.replaying ? "停止对照行走" : "从同一起点试听",
        app.replaying ? "pause" : "play",
      ) +
      "<p>开始后收起面板，本标签页记录条件顺序、行进与驻足。可点“听到了”“看到了”或“声止了”自报知觉。</p>" +
      (app.log.memoryOnly
        ? "<p>浏览器暂存空间不可用，请在关闭页面前下载记录。</p>"
        : "") +
      (app.log.runs.length
        ? action(
            "export-log",
            "下载实验记录 · " + app.log.runs.length + " 回合",
            "download",
          )
        : "");
  } else if (type === "evidence") {
    title = "三层证据溯源";
    const img = manifest.sections[section].thumbnail;
    body =
      '<div class="source-context">当前段落 <b>' +
      titles[section] +
      '</b></div><article class="evidence"><small>L3　实验推定</small><h3>当前声画参数</h3><p>' +
      trials
        .map(
          (t, i) =>
            "切片" +
            ["一", "二"][i] +
            " · " +
            versions[i] +
            "「" +
            (versions[i] === "甲" ? t.a : t.b) +
            "」",
        )
        .join("<br>") +
      "</p><p>动线 27 米 · 留白 2.60 米 · " +
      quality +
      "画质。<br>屏位、层深、烛光与合成音色均为推定。</p></article>" +
      '<article class="evidence"><small>L2　文献与时空</small><p>' +
      e.text +
      '</p><a target="_blank" rel="noreferrer" href="' +
      e.url +
      '">' +
      e.source +
      ' ↗</a><div class="evidence-path">' +
      (section === 1 && versions[0] === "乙"
        ? ["屏前无鼓", "见舞起鼓", "停驻重听"]
        : diagrams[section]
      )
        .map((node) => "<span>" + node + "</span>")
        .join("<i></i>") +
      "</div><p>" +
      e.time +
      "</p></article>" +
      '<article class="evidence"><small>L1　画面与器物</small><img src="' +
      assetURL(img) +
      '" alt="' +
      titles[section] +
      '段原画局部"><p>' +
      e.painting +
      '</p><a target="_blank" rel="noreferrer" href="https://www.dpm.org.cn/collection/paint/228200.html">故宫博物院藏品著录 ↗</a><details><summary>人物与器物索引</summary><div class="object-list">' +
      app.objects.map((l, i) => action("item-" + i, l.name)).join("") +
      "</div></details></article>" +
      action("scroll", "展开原卷对照", "book") +
      (section >= 3 ? action("scroll-gap", "定位留白取样", "aim") : "") +
      action("export", "下载当前证据与参数", "download");
  } else if (type === "scroll") {
    title = "原卷对照";
    body =
      scrollViewHTML(manifest) + action("evidence", "返回本段证据", "book");
  } else if (type === "settings") {
    title = "视图与导出";
    body =
      '<h3>渲染画质</h3><div class="switch">' +
      ["节能", "标准", "精细"]
        .map(
          (v) =>
            '<button data-do="quality-' +
            v +
            '" aria-pressed="' +
            (quality === v) +
            '">' +
            v +
            "</button>",
        )
        .join("") +
      "</div><p>像素比上限分别为 1、1.5、2。录制使用固定的 3840 × 2160 画幅。</p><h3>影像导出</h3>" +
      action("still", "下载 4K 画面", "download") +
      action(
        "record",
        recording ? "结束录制并下载" : "录制 4K 声画",
        recording ? "pause" : "rec",
      ) +
      "<p>录像收录剧场画面与合成声场，由浏览器下载。实际帧率取决于设备。</p>" +
      action("export", "下载实验参数", "download") +
      '<p><a target="_blank" rel="noreferrer" href="https://github.com/w399651114-oss/night-revels-theatre/blob/main/docs/4K分镜与验收.md">完整演示分镜与甲乙复听时码 ↗</a></p>';
  } else if (type === "object") {
    title = label.name;
    body =
      '<span class="source-context">' +
      titles[section] +
      "　/　" +
      label.detail +
      "</span><p>" +
      label.description +
      "</p>" +
      action("approach", "走近看看", "aim") +
      action("scroll", "在原卷中定位", "book") +
      action("evidence", "查看本段证据", "book");
  } else {
    title = "观卷操作";
    body =
      "<dl>" +
      row("沿卷行走", "← / A 向左推进，→ / D 回退") +
      row("近看与退后", "W / S，或双指平移") +
      row("自由环视", "拖动画面，向各方向转身") +
      row("缩放", "滚轮或双指捏合") +
      row("平移", "右键拖动或双指拖动") +
      row("界面", "H 隐藏或显示，Esc 关闭面板") +
      row("触屏", "按住下方行进键，松手即驻足") +
      "</dl>" +
      action("reset", "回到本幕标准视点", "reset");
  }
  return (
    '<div class="panel-head"><h2>' +
    title +
    '</h2><button aria-label="关闭面板" title="关闭面板" data-do="close">' +
    icon("close") +
    '</button></div><div class="panel-body">' +
    body +
    "</div>"
  );
}
