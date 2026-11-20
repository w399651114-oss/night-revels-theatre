import "./scroll-view.css";
import { assetURL } from "./route.js";

// 横向坐标以配准母版的预览标尺为单位。本幅图像从 x=0 截取至 x=4553。
const scrollWidth = 4553;
const scrollHeight = 396;
const blankRange = [710, 760];

function escapeText(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}

export function scrollViewHTML(manifest) {
  return `<section class="scroll-reader" data-scroll-reader aria-label="原卷对照">
    <nav class="scroll-sections" aria-label="自右向左分段定位">${manifest.sections
      .map(
        (section) =>
          `<button type="button" data-scroll-section="${section.id}">${escapeText(section.name)}</button>`,
      )
      .join("")}</nav>
    <div class="scroll-glass" tabindex="0" aria-label="本幅原卷，可横向拖动或使用左右方向键">
      <div class="scroll-strip"><img class="scroll-paper" src="${assetURL(manifest.scroll)}" alt="韩熙载夜宴图绘画本幅，从右侧的听乐延至左侧的散宴" draggable="false">
        <div class="scroll-mark" aria-hidden="true"><span></span></div>
      </div>
    </div>
    <div class="scroll-overview" aria-label="全卷定位尺">
      <button type="button" data-scroll-end="left" aria-label="移向卷末">卷末</button>
      <input type="range" min="0" max="${scrollWidth}" step="1" aria-label="横移原卷">
      <button type="button" data-scroll-end="right" aria-label="移向卷首">卷首</button>
    </div>
    <label class="scroll-index"><span>画中人物与器物</span><select data-scroll-object aria-label="框选画中人物与器物"></select></label>
    <button type="button" class="scroll-gap-button" data-scroll-gap>定位清吹与散宴间的留白</button>
    <p class="scroll-reading" aria-live="polite" aria-atomic="true"></p>
    <p class="scroll-source">故宫博物院藏宋摹本 · 本幅从右向左展读</p>
  </section>`;
}

function activeLocation(manifest, section, layerId, showGap) {
  if (showGap) {
    return {
      x: blankRange[0],
      y: 8,
      w: blankRange[1] - blankRange[0],
      h: 380,
      title: "素绢参照区",
      mode: "gap",
      description:
        "框内为坐客与屏旁女侍之间的一处素绢。局部范围由研究者选取。剧场将这个停顿展开为 2.60 米可步行廊道，长度为实验推定。",
    };
  }
  const current = manifest.sections[section];
  const [left, right] = current.sourceRange;
  const layer = current.layers.find((item) => item.id === layerId);
  if (layer) {
    const [x0, y0, x1, y1] = layer.sourceBox;
    return {
      x: left + x0,
      y: y0,
      w: x1 - x0,
      h: y1 - y0,
      mode: "object",
      title: layer.name,
      description: `「${layer.name}」的框线取自该画片在原卷中的裁切范围。${layer.occludedPaint ? "三维裁片另有遮挡补绘，框内展示原画。" : ""}`,
    };
  }
  return {
    x: left,
    y: 2,
    w: right - left,
    h: scrollHeight - 4,
    mode: "section",
    title: current.name,
    description: `框线标出「${current.name}」的本幅取图范围，可在下方选取人物或器物。分段取景边界为实验标注。`,
  };
}

export function mountScrollView(container, manifest, options = {}) {
  const root = container.matches("[data-scroll-reader]")
    ? container
    : container.querySelector("[data-scroll-reader]");
  if (!root) return;
  const viewport = root.querySelector(".scroll-glass");
  const strip = root.querySelector(".scroll-strip");
  const mark = root.querySelector(".scroll-mark");
  const slider = root.querySelector("input");
  const select = root.querySelector("select");
  const gapButton = root.querySelector("[data-scroll-gap]");
  const reading = root.querySelector(".scroll-reading");
  let section = manifest.sections[options.section] ? options.section : 0;
  let layerId = options.layerId || "";
  let showGap = Boolean(options.showGap);
  let location;
  let drag = null;

  function centerSelection() {
    const x = ((location.x + location.w / 2) / scrollWidth) * strip.clientWidth;
    viewport.scrollLeft = x - viewport.clientWidth / 2;
    syncSlider();
  }

  function syncSlider() {
    const limit = viewport.scrollWidth - viewport.clientWidth;
    slider.value = limit
      ? (viewport.scrollLeft / limit) * scrollWidth
      : scrollWidth;
  }

  function renderSelection() {
    location = activeLocation(manifest, section, layerId, showGap);
    root.dataset.mode = location.mode;
    root.dataset.selectedSection = section;
    root.dataset.selectedLayer = location.mode === "object" ? layerId : "";
    root
      .querySelectorAll("[data-scroll-section]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(!showGap && Number(button.dataset.scrollSection) === section),
        ),
      );
    gapButton.setAttribute("aria-pressed", String(showGap));
    const current = manifest.sections[section];
    select.replaceChildren(new Option(`整段 · ${current.name}`, ""));
    current.layers.forEach((layer) =>
      select.add(new Option(layer.name, layer.id)),
    );
    if (showGap) {
      const blank = new Option("当前选区 · 素绢留白", "__blank");
      blank.disabled = true;
      select.add(blank, 0);
      select.value = "__blank";
    } else {
      select.value = layerId;
    }
    mark.style.left = (100 * location.x) / scrollWidth + "%";
    mark.style.top = (100 * location.y) / scrollHeight + "%";
    mark.style.width = (100 * location.w) / scrollWidth + "%";
    mark.style.height = (100 * location.h) / scrollHeight + "%";
    mark.querySelector("span").textContent = showGap
      ? "素绢参照区\n廊道 2.60 米为推定"
      : location.title;
    reading.textContent = location.description;
    centerSelection();
  }

  root.querySelectorAll("[data-scroll-section]").forEach((button) => {
    button.onclick = () => {
      section = Number(button.dataset.scrollSection);
      showGap = false;
      layerId = "";
      renderSelection();
    };
  });
  gapButton.onclick = () => {
    section = 3;
    layerId = "";
    showGap = true;
    renderSelection();
  };
  select.onchange = () => {
    layerId = select.value;
    showGap = false;
    renderSelection();
  };
  root.querySelectorAll("[data-scroll-end]").forEach((button) => {
    button.onclick = () => {
      viewport.scrollLeft =
        button.dataset.scrollEnd === "left" ? 0 : viewport.scrollWidth;
      syncSlider();
    };
  });
  slider.oninput = () => {
    viewport.scrollLeft =
      (Number(slider.value) / scrollWidth) *
      (viewport.scrollWidth - viewport.clientWidth);
  };
  viewport.onscroll = syncSlider;
  viewport.onpointerdown = (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    drag = { x: event.clientX, left: viewport.scrollLeft };
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add("grabbing");
  };
  viewport.onpointermove = (event) => {
    if (drag) viewport.scrollLeft = drag.left - (event.clientX - drag.x);
  };
  viewport.onlostpointercapture = () => {
    drag = null;
    viewport.classList.remove("grabbing");
  };
  viewport.onkeydown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = Math.max(60, viewport.clientWidth * 0.3);
    if (event.key === "Home") viewport.scrollLeft = viewport.scrollWidth;
    else if (event.key === "End") viewport.scrollLeft = 0;
    else viewport.scrollLeft += event.key === "ArrowLeft" ? -delta : delta;
  };
  root.onkeydown = (event) => {
    if (
      (event.target === slider || event.target === select) &&
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(event.key)
    )
      event.stopPropagation();
  };
  renderSelection();
  requestAnimationFrame(() => {
    if (root.isConnected) centerSelection();
  });
}
