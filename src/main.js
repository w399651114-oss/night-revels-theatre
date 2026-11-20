import "./style.css";
import { Theatre } from "./scene.js";
import { mountScrollView } from "./scroll-view.js";
import { TrialLog } from "./trial-log.js";
import { SoundField, trials, gains } from "./audio.js";
import { Capture, download } from "./capture.js";
import {
  titles,
  lines,
  numerals,
  stations,
  inGap,
  sectionAt,
  clamp,
  length,
  assetURL,
} from "./route.js";
import { icon } from "./icons.js";
import { panelContent } from "./panels.js";
import { evidence } from "./evidence.js";

const $ = (s) => document.querySelector(s);
const world = $("#world"),
  drawer = $("#drawer"),
  status = $("#loading"),
  annotations = $("#annotations");
const sound = new SoundField();
const log = new TrialLog();
const app = {
  log,
  section: 0,
  slice: 0,
  versions: sound.versions,
  quality: "标准",
  recording: false,
  replaying: false,
  startingTrial: false,
};
let stage,
  capture,
  panel = "",
  tour = false,
  destination = null,
  focusPoint = null,
  labels = true,
  wire = false,
  hidden = false,
  ready = false;
let walk = 0,
  hold = 0,
  last = performance.now(),
  lastPanelFocus,
  clock = 0,
  distanceText = "",
  labelNodes = [],
  lastUiPos = -1;
const keys = new Set();
const small = () => matchMedia("(max-width: 660px)").matches;
const btn = (id, title, ic, visible = false) =>
  '<button data-do="' +
  id +
  '" title="' +
  title +
  '" aria-label="' +
  title +
  '">' +
  icon(ic) +
  (visible ? "<span>" + title + "</span>" : "") +
  "</button>";
function message(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t.timer);
  t.timer = setTimeout(() => (t.hidden = true), 3400);
}
function errorView(e) {
  ready = false;
  stop();
  status.hidden = false;
  status.setAttribute("role", "alert");
  status.replaceChildren();
  const strong = document.createElement("strong");
  strong.textContent = "画卷加载中断";
  const span = document.createElement("span");
  span.textContent = e.message || String(e);
  const retry = document.createElement("button");
  retry.textContent = "重新加载";
  retry.onclick = () => location.reload();
  status.append(strong, span, retry);
}
function controls() {
  $("#nav").innerHTML =
    btn("close", "折屏剧场", "theatre", true) +
    btn("experiment", "声场实验", "wave", true) +
    btn("evidence", "证据溯源", "layers", true);
  $("#head-actions").innerHTML =
    btn("audio", "开启声音", "mute", true) + btn("fullscreen", "全屏", "full");
  $("#railtools").innerHTML =
    btn("labels", "空间标签", "pin") +
    btn("wire", "几何线框", "grid") +
    btn("hide", "隐藏界面", "eye") +
    "<i></i>" +
    btn("settings", "视图与导出", "sliders") +
    btn("help", "观卷操作", "help");
  $("#timeline-icon").innerHTML = icon("ribbon", 21);
  $("#touch-walk").innerHTML =
    btn("forward", "向左行进", "left") + btn("back", "向右回退", "arrow");
  $(".gestures").innerHTML =
    "<span>" +
    icon("mouse", 14) +
    " 拖动环视</span><span>滚轮缩放</span><span><kbd>A</kbd><kbd>D</kbd> 沿卷行走</span><span><kbd>W</kbd><kbd>S</kbd> 前后移步</span>";
  document.body.insertAdjacentHTML(
    "beforeend",
    '<button id="restore" data-do="hide" hidden>' +
      icon("eye", 16) +
      ' 显示界面</button><button id="stop-record" hidden data-do="record">' +
      icon("rec", 16) +
      " 结束录制</button>",
  );
  updateButtons();
}
function updateButtons() {
  const t = $("#tour");
  t.innerHTML =
    icon(tour ? "pause" : "play", 15) + (tour ? "暂停巡游" : "自动巡游");
  t.setAttribute("aria-pressed", String(tour));
  t.dataset.do = "tour";
  const a = $('[data-do="audio"]');
  a.innerHTML =
    icon(sound.on ? "sound" : "mute") +
    "<span>" +
    (sound.on ? "声音已开" : "开启声音") +
    "</span>";
  a.setAttribute("aria-label", sound.on ? "关闭声音" : "开启声音");
  a.title = a.getAttribute("aria-label");
  a.setAttribute("aria-pressed", String(sound.on));
  $("#nav")
    .querySelectorAll("button")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(
          b.dataset.do ===
            (["experiment", "evidence"].includes(panel) ? panel : "close"),
        ),
      ),
    );
  for (const [key, val] of [
    ["labels", labels],
    ["wire", wire],
    ["settings", panel === "settings"],
    ["help", panel === "help"],
  ])
    $('[data-do="' + key + '"]').setAttribute("aria-pressed", String(val));
}
function refreshPanel() {
  if (!panel) return;
  drawer.innerHTML = panelContent(panel, app);
  if (panel === "scroll")
    mountScrollView(drawer, app.manifest, app.scrollOptions);
}
function open(type) {
  if (type !== panel) lastPanelFocus = document.activeElement;
  panel = type;
  drawer.dataset.type = type;
  drawer.hidden = !type;
  $("#stage").classList.toggle("has-panel", Boolean(type));
  if (type) {
    refreshPanel();
    drawer.querySelector(".panel-head button").focus({ preventScroll: true });
  } else if (lastPanelFocus?.isConnected)
    lastPanelFocus.focus({ preventScroll: true });
  updateButtons();
}
function trialBar() {
  const bar = $("#trial-bar");
  bar.hidden = !log.current;
  if (!log.current) {
    bar.replaceChildren();
    return;
  }
  const v = app.versions[app.slice];
  const mark = (id, text) =>
    '<button data-do="' + id + '">' + text + "</button>";
  bar.innerHTML =
    "<strong>切片" +
    ["一", "二"][app.slice] +
    " · " +
    v +
    '</strong><div class="trial-conditions">' +
    ["甲", "乙"]
      .map(
        (c) =>
          '<button data-do="version-' +
          c +
          '" aria-pressed="' +
          (c === v) +
          '">' +
          c +
          "</button>",
      )
      .join("") +
    "</div>" +
    mark("hold-trial", app.replaying ? "驻足" : "继续") +
    mark("replay", "结束") +
    '<div class="trial-reports"><span>自报</span>' +
    mark("heard", "听到了") +
    mark(
      app.slice === 0 ? "seen" : "quiet",
      app.slice === 0 ? "看到了" : "声止了",
    ) +
    "</div>";
}
function stop(reason = "中途结束") {
  if (log.current) {
    log.end(reason, stage.state);
    trialBar();
  }

  tour = false;
  app.replaying = false;
  destination = null;
  hold = 0;
  focusPoint = null;
  if ($("#tour") && $('[data-do="audio"]')) updateButtons();
}
function chapter(i) {
  stop();
  destination = stations[i];
  focusPoint = { yaw: 0, pitch: 0, lift: 0, offsetZ: 0, fov: 44 };
  open("");
}
function buildChapters() {
  $("#chapters").innerHTML = app.manifest.sections
    .map(
      (sec, i) =>
        '<button data-do="chapter-' +
        i +
        '" aria-label="定位到' +
        titles[i] +
        '"><img src="' +
        assetURL(sec.thumbnail) +
        '" alt=""><span class="chapter-wash"></span><span class="card-copy"><small>0' +
        (i + 1) +
        "</small><strong>" +
        titles[i] +
        "</strong></span><i></i></button>",
    )
    .reverse()
    .join("");
}
function makeLabels() {
  annotations.replaceChildren();
  labelNodes = [];
  const group = stage.labels.filter((l) => l.section === app.section);
  group.sort(
    (a, b) =>
      (a.sprite?.position.x ?? a.point.x) - (b.sprite?.position.x ?? b.point.x),
  );
  for (const l of group) {
    const b = document.createElement("button");
    b.className = "spot";
    b.title = "查看" + l.name;
    b.setAttribute("aria-label", "查看" + l.name);
    const text = document.createElement("span");
    text.textContent = l.name;
    b.append(document.createElement("i"), text);
    b.onclick = () => {
      stop();
      app.label = l;
      open("object");
    };
    annotations.append(b);
    labelNodes.push([l, b]);
  }
}
function projectLabels() {
  if (!labels || hidden || !ready) return;
  const placed = [],
    w = world.clientWidth,
    h = world.clientHeight;
  // 依当前投影避免题签互压，细屏优先保留中央的两件。
  const eligible = labelNodes.map(([l, b]) => ({
    l,
    b,
    pos: stage.project(l),
  }));
  const priorities = [
    "pipa-player",
    "banquet-bed",
    "dancer",
    "drum-players",
    "rest-bed",
    "washing-aide",
    "ensemble",
    "seated-host",
    "farewell-host",
    "farewell-pair",
  ];
  const rank = (l) =>
    priorities.includes(l.sprite?.userData.id)
      ? 3
      : l.sprite?.userData.id === "low-tables"
        ? 2
        : l.object
          ? 1
          : 0;
  eligible.sort(
    (a, b) =>
      rank(b.l) - rank(a.l) ||
      Math.abs((a.pos?.x ?? 2) - 0.53) - Math.abs((b.pos?.x ?? 2) - 0.53),
  );
  for (const { b, pos } of eligible) {
    let show = Boolean(pos) && placed.length < (small() ? 2 : 3);
    if (show) {
      const x = pos.x * w,
        y = pos.y * h,
        box = { x, y, w: b.offsetWidth || 90 };
      show =
        y > h * (small() ? 0.32 : 0.21) &&
        y < h * 0.8 &&
        x > 24 &&
        x < w - 62 &&
        placed.every(
          (r) =>
            Math.abs(r.y - y) > 43 ||
            Math.abs(r.x - x) > (r.w + box.w) * 0.49 + 15,
        );
      if (show) {
        placed.push(box);
        b.style.left = x + "px";
        b.style.top = y + "px";
      }
    }
    b.hidden = !show;
  }
}
function caption(force = false) {
  const s = stage.state.s,
    i = sectionAt(s),
    blank = inGap(s);
  if (force || i !== app.section || blank !== app.blank) {
    app.section = i;
    app.blank = blank;
    app.objects = stage.labels.filter((l) => l.section === i);
    $("#scene-number").textContent = blank
      ? "幕间　/　时间间隙"
      : "第" + numerals[i] + "幕　 /　 0" + (i + 1) + " — 05";
    $("#scene-title").textContent = blank ? "素绢留白" : titles[i];
    $("#scene-desc").textContent = blank
      ? "在画面之间驻足，听管声延续或中断。"
      : lines[i];
    $("#chapters")
      .querySelectorAll("button")
      .forEach((b) =>
        b.setAttribute(
          "aria-current",
          b.dataset.do === "chapter-" + i ? "step" : "false",
        ),
      );
    makeLabels();
    if (panel === "evidence") refreshPanel();
    if (panel === "object" && app.label.section !== i) open("");
  }
  const meter = s.toFixed(1);
  if (meter !== distanceText) {
    distanceText = meter;
    $("#meter").innerHTML =
      icon("aim", 14) + "<span>" + meter + " <em>/ 27.0 米</em></span>";
  }
}
async function audioToggle() {
  if (sound.on) sound.mute();
  else await sound.enable();
  log.event(sound.on ? "开启声音" : "关闭声音", stage.state);
  updateButtons();
}
async function run(id) {
  if (!ready) return;
  if (id.startsWith("item-")) {
    stop();
    app.label = app.objects[Number(id.slice(5))];
    open("object");
    return;
  }
  if (id.startsWith("chapter-")) return chapter(Number(id.slice(8)));
  if (id.startsWith("quality-")) {
    app.quality = id.slice(8);
    stage.setQuality(app.quality, !app.recording);
    refreshPanel();
    return;
  }
  if (id.startsWith("slice-")) {
    stop();
    app.slice = Number(id.slice(6));
    refreshPanel();
    return;
  }
  if (id.startsWith("version-")) {
    const condition = id.slice(8);
    if (condition !== app.versions[app.slice])
      log.event("切换条件", stage.state, {
        从: app.versions[app.slice],
        至: condition,
      });
    app.versions[app.slice] = condition;
    await sound.enable();
    sound.update(stage.state.s, stage.camera, stage.cue.visible);
    trialBar();
    refreshPanel();
    updateButtons();
    return;
  }
  if (["experiment", "evidence", "help", "settings"].includes(id)) {
    stop(
      "打开" +
        {
          experiment: "实验面板",
          evidence: "证据面板",
          settings: "设置",
          help: "帮助",
        }[id],
    );
    open(panel === id ? "" : id);
    return;
  }
  switch (id) {
    case "scroll":
    case "scroll-gap":
      app.scrollOptions = {
        section: app.section,
        layerId: panel === "object" ? app.label?.sprite?.userData?.id : null,
        showGap: id === "scroll-gap",
      };
      open("scroll");
      break;
    case "close":
      open("");
      break;
    case "audio":
      await audioToggle();
      break;
    case "fullscreen":
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else message("此浏览器未提供全屏，可隐藏界面观卷。");
      break;
    case "labels":
      labels = !labels;
      annotations.hidden = !labels;
      updateButtons();
      break;
    case "wire":
      wire = !wire;
      stage.setWire(wire);
      updateButtons();
      break;
    case "hide":
      hidden = !hidden;
      if (hidden) open("");
      document.body.classList.toggle("clean", hidden);
      $("#restore").hidden = !hidden;
      annotations.hidden = hidden || !labels;
      break;
    case "tour":
      if (tour) stop();
      else {
        stop();
        if (stage.state.s >= length - 0.05) stage.state.s = 0;
        tour = true;
        hold = 0.6;
        focusPoint = { yaw: 0, pitch: 0, lift: 0, offsetZ: 0, fov: 44 };
        open("");
      }
      updateButtons();
      break;
    case "heard":
    case "seen":
    case "quiet": {
      const text = { heard: "听到", seen: "看到", quiet: "听到声止" }[id];
      log.event("自报：" + text, stage.state, {
        条件: app.versions[app.slice],
      });
      message("已记下 · " + text);
      break;
    }
    case "hold-trial":
      if (!log.current) break;
      app.replaying = !app.replaying;
      app.runStartS = stage.state.s;
      app.runStartPhase = sound.phase();
      log.event(app.replaying ? "继续固定行走" : "手动驻足", stage.state);
      trialBar();
      break;
    case "replay":
      if (log.current) {
        stop("手动结束");
        open("experiment");
        break;
      }
      if (app.startingTrial) break;
      app.startingTrial = true;
      stop();
      try {
        await sound.enable();
      } finally {
        app.startingTrial = false;
      }
      if (panel !== "experiment") break;
      sound.restart();
      stage.cue.reset();
      const trial = trials[app.slice];
      Object.assign(stage.state, {
        s: trial.from,
        yaw: 0,
        pitch: 0,
        offsetZ: 0,
        lift: 0,
        fov: 44,
      });
      app.runStartS = trial.from;
      app.runStartPhase = 0;
      app.replaying = true;
      log.begin(
        app.slice,
        app.versions[app.slice],
        trial,
        [innerWidth, innerHeight, devicePixelRatio],
        app.quality,
      );
      Object.assign(log.current, {
        音频采样率: sound.ctx.sampleRate,
        输出延时秒: sound.ctx.outputLatency ?? null,
        声音开启: sound.on,
        操作类型: "网页实时交互",
      });
      log.event("开始固定行走", stage.state);
      open("");
      trialBar();
      updateButtons();
      break;
    case "export-log":
      download(
        new Blob([JSON.stringify(log.export(), null, 2)], {
          type: "application/json",
        }),
        "夜宴折屏-逐次实验记录.json",
      );
      break;
    case "reset":
      chapter(app.section);
      break;
    case "approach": {
      const l = app.label;
      stop();
      destination = stations[l.section];
      const dx = l.point.x + destination - 0.62;
      focusPoint = {
        yaw: -Math.atan2(dx, 3.33 - l.point.z) - 0.22,
        pitch: Math.atan2(l.point.y - 1.6, 3.33 - l.point.z) + 0.065,
        offsetZ: -1.05,
        fov: 34,
        lift: 0,
      };
      open("");
      break;
    }
    case "still":
      await capture.still();
      message("4K 画面已交给浏览器下载");
      break;
    case "record":
      if (app.recording) capture.stop();
      else {
        await capture.start();
        app.recording = true;
        $("#stop-record").hidden = false;
        open("");
        updateButtons();
        message("开始录制 4K 声画");
      }
      break;
    case "export": {
      const state = {
        段落: titles[app.section],
        留白: app.blank,
        位置米: stage.state.s,
        视点: { ...stage.state },
        画质: app.quality,
        声音: sound.on,
        切片: trials.map((t, i) => ({
          段落: t.name,
          版本: app.versions[i],
          方案: app.versions[i] === "甲" ? t.a : t.b,
          起止米: [t.from, t.to],
          速度米每秒: t.speed,
        })),
        证据: evidence[app.section],
        试验记录: log.export(),
        说明: "米制与声学均为研究推定",
      };
      download(
        new Blob([JSON.stringify(state, null, 2)], {
          type: "application/json",
        }),
        "夜宴折屏-实验参数.json",
      );
      break;
    }
  }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-do]");
  if (b) run(b.dataset.do).catch((e) => message("操作未完成：" + e.message));
});
function input() {
  let pointers = new Map();
  function manual() {
    if (log.current) {
      if (app.replaying) {
        app.replaying = false;
        log.event("转为自主观察", stage.state);
        trialBar();
      }
      return;
    }
    if (tour || app.replaying || destination !== null || focusPoint) {
      stop();
      refreshPanel();
    }
  }
  world.oncontextmenu = (e) => e.preventDefault();
  world.onpointerdown = (e) => {
    manual();
    world.focus({ preventScroll: true });
    world.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  world.onpointermove = (e) => {
    const old = pointers.get(e.pointerId);
    if (!old) return;
    const dx = e.clientX - old.x,
      dy = e.clientY - old.y,
      v = stage.state;
    if (pointers.size === 2) {
      const other = [...pointers.entries()].find(
        ([id]) => id !== e.pointerId,
      )[1];
      const was = Math.hypot(old.x - other.x, old.y - other.y),
        now = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (was > 10 && now > 10) v.fov = clamp((v.fov * was) / now, 24, 76);
      v.s = clamp(v.s + dx * 0.003, 0, length);
      v.offsetZ = clamp(v.offsetZ + dy * 0.005, -1.65, 1.8);
    } else if (e.buttons === 2 || e.shiftKey) {
      v.s = clamp(v.s + dx * 0.006, 0, length);
      v.lift = clamp(v.lift + dy * 0.006, -0.65, 0.32);
    } else {
      v.yaw += dx * 0.004;
      v.pitch = clamp(v.pitch + dy * 0.0035, -1.15, 1.15);
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  world.onlostpointercapture = (e) => pointers.delete(e.pointerId);
  world.onwheel = (e) => {
    e.preventDefault();
    manual();
    stage.state.fov = clamp(stage.state.fov + e.deltaY * 0.035, 24, 76);
  };
  $("#touch-walk").onpointerdown = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    manual();
    walk = b.dataset.do === "forward" ? 1 : -1;
    b.setPointerCapture(e.pointerId);
  };
  $("#touch-walk").addEventListener("lostpointercapture", () => (walk = 0));
  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (
      [
        "arrowleft",
        "arrowright",
        "arrowup",
        "arrowdown",
        "a",
        "d",
        "w",
        "s",
      ].includes(key) &&
      !e.metaKey &&
      !e.ctrlKey
    ) {
      e.preventDefault();
      manual();
      keys.add(key);
    }
    if (key === "h" && !e.repeat && !e.metaKey && !e.ctrlKey) run("hide");
    if (key === "escape") {
      if (hidden) run("hide");
      else open("");
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  const release = () => {
    keys.clear();
    walk = 0;
    pointers.clear();
  };
  window.addEventListener("blur", release);
  document.addEventListener("visibilitychange", () => {
    release();
    last = performance.now();
    if (document.hidden) {
      stop();
      refreshPanel();
    }
  });
}
function frame(now) {
  if (!ready) return;
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const v = stage.state,
    dir =
      walk +
      Number(keys.has("a") || keys.has("arrowleft")) -
      Number(keys.has("d") || keys.has("arrowright"));
  const near =
    Number(keys.has("s") || keys.has("arrowdown")) -
    Number(keys.has("w") || keys.has("arrowup"));
  const prev = v.s;
  v.s = clamp(v.s + clamp(dir, -1, 1) * dt * 1.75, 0, length);
  v.offsetZ = clamp(v.offsetZ + near * dt * 1.2, -1.65, 1.8);
  if (destination !== null) {
    const d = destination - v.s;
    v.s += d * (1 - Math.exp(-dt * 2.3));
    if (Math.abs(d) < 0.004) {
      v.s = destination;
      destination = null;
    }
  }
  if (focusPoint) {
    let remaining = 0;
    for (const k of Object.keys(focusPoint)) {
      let d = focusPoint[k] - v[k];
      if (k === "yaw") d = Math.atan2(Math.sin(d), Math.cos(d));
      v[k] += d * (1 - Math.exp(-dt * 4.5));
      remaining += Math.abs(d);
    }
    if (remaining < 0.003) focusPoint = null;
  }
  if (tour) {
    if (hold > 0) hold -= dt;
    else {
      v.s = Math.min(length, v.s + dt * 0.65);
      if (stations.some((s) => prev < s && v.s >= s)) hold = 1.8;
      if (v.s === length) stop();
    }
  }
  if (app.replaying) {
    const t = trials[app.slice];
    v.s = Math.min(
      app.runStartS + t.speed * Math.max(0, sound.phase() - app.runStartPhase),
      t.to,
    );
  }
  stage.render(
    log.current ? sound.phase() : now / 1000,
    sound.on ? sound.phase() : 0,
    sound,
  );
  sound.update(v.s, stage.camera, stage.cue.visible);
  log.frame(
    v,
    app.versions[app.slice],
    stage.cue.visible,
    gains(v.s, app.versions, stage.cue.visible),
    sound.on,
  );
  if (app.replaying && v.s === trials[app.slice].to) {
    stop("抵达终点");
    open("experiment");
  }
  clock += dt;
  if (clock > 0.045 || prev !== v.s || lastUiPos !== v.s) {
    clock = 0;
    lastUiPos = v.s;
    caption();
    projectLabels();
  }
  requestAnimationFrame(frame);
}
async function init() {
  controls();
  stage = new Theatre(world);
  const res = await fetch(assetURL("art/art.json"));
  if (!res.ok) throw new Error("画面清单读取失败（" + res.status + "）");
  app.manifest = await res.json();
  const files = app.manifest.sections.map((s) => s.thumbnail);
  const layers = app.manifest.sections.reduce((n, s) => n + s.layers.length, 0);
  const total = 1 + files.length + layers + 1;
  let count = 1;
  const progress = (name) => {
    status.querySelector("progress").value = count / total;
    status.querySelector("span").textContent =
      name + "　" + count + " / " + total;
  };
  progress("原画与场景资源");
  await Promise.all([
    stage.mountArt(app.manifest, () => {
      count++;
      progress("人物与器物图层");
    }),
    ...files.map(async (f) => {
      const im = new Image();
      im.src = assetURL(f);
      await im.decode();
      count++;
      progress("段落局部");
    }),
    Promise.all(
      ["卷宋", "卷黑"].map((font) =>
        document.fonts.load("500 16px " + font, "听乐"),
      ),
    )
      .then(() => {
        count++;
        progress("字形");
      })
      .catch(() => {
        throw new Error("中文字体读取失败");
      }),
  ]);
  stage.installCue();
  sound.placeSources(stage.sprites);
  buildChapters();
  caption(true);
  capture = new Capture(stage, sound, message, (msg) => {
    app.recording = false;
    $("#stop-record").hidden = true;
    refreshPanel();
    message(msg);
  });
  input();
  new ResizeObserver(() => {
    if (!app.recording) stage.resize();
  }).observe($("#stage"));
  world.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    errorView(new Error("图形上下文已丢失，请重新加载画卷。"));
  });
  stage.resize();
  stage.cameraPose();
  status.querySelector("span").textContent = "正在准备首帧与投影";
  await stage.renderer.compileAsync(stage.scene, stage.camera);
  stage.render(performance.now() / 1000);
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
  stage.render(performance.now() / 1000);
  ready = true;
  last = performance.now();
  status.hidden = true;
  $("#app").dataset.ready = "true";
  requestAnimationFrame(frame);
}
window.addEventListener("pagehide", () => {
  if (log.current) stop("离开页面");
});
init().catch(errorView);
