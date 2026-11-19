import * as T from "three";

// 固定种子让甲乙版本共享同一幅实验布景。
function seed(n) {
  return () => {
    n = (Math.imul(1664525, n) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
const rand = seed(713);
function surface(w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d"), w, h);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
export function silk() {
  const t = surface(256, 256, (c, w, h) => {
    c.fillStyle = "#c0ad8d";
    c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      c.fillStyle = "rgba(77,59,35," + rand() * 0.12 + ")";
      c.fillRect(0, y, w, 0.8);
    }
    for (let x = 0; x < w; x++) {
      c.fillStyle = "rgba(253,232,194," + rand() * 0.25 + ")";
      c.fillRect(x, 0, 0.7, h);
    }
    for (let i = 0; i < 1400; i++) {
      c.fillStyle = "rgba(91,71,46,.10)";
      c.fillRect(rand() * w, rand() * h, 2 + rand() * 7, 0.6);
    }
  });
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(17, 6);
  return t;
}
export function wood() {
  const t = surface(256, 128, (c, w, h) => {
    c.fillStyle = "#68503c";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 280; i++) {
      const y = rand() * h;
      c.strokeStyle =
        rand() < 0.6 ? "rgba(29,20,14,.23)" : "rgba(220,173,108,.17)";
      c.lineWidth = rand() * 1.7;
      c.beginPath();
      c.moveTo(0, y);
      c.bezierCurveTo(70, y - 6 * rand(), 130, y + 4 * rand(), w, y + rand());
      c.stroke();
    }
  });
  return t;
}
export function inkLandscape() {
  return surface(2048, 768, (c, w, h) => {
    const wash = c.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, "#d6c193");
    wash.addColorStop(0.65, "#e1d2ae");
    wash.addColorStop(1, "#b7a982");
    c.fillStyle = wash;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 65000; i++) {
      c.fillStyle =
        rand() < 0.55 ? "rgba(79,65,46,.04)" : "rgba(255,240,201,.14)";
      c.fillRect(rand() * w, rand() * h, 2 + rand() * 4, 1);
    }
    function ridge(base, amp, step, ink, opacity) {
      const noise = Array.from({ length: Math.ceil(w / step) + 2 }, () =>
        rand(),
      );
      const ys = [];
      for (let x = 0; x <= w; x += 2) {
        const k = x / step,
          j = Math.floor(k),
          u = k - j;
        const n = noise[j] * (1 - u) + noise[j + 1] * u;
        ys.push(
          base -
            amp *
              (0.52 * Math.sin(x / 146 + 0.8) +
                0.23 * Math.cos(x / 57) +
                n * 0.5) +
            rand() * 3,
        );
      }
      const g = c.createLinearGradient(
        0,
        base - amp * 0.9,
        0,
        base + amp * 0.8,
      );
      g.addColorStop(0, "rgba(" + ink + "," + opacity + ")");
      g.addColorStop(0.55, "rgba(" + ink + "," + opacity * 0.63 + ")");
      g.addColorStop(1, "rgba(" + ink + ",0)");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, h);
      ys.forEach((y, i) => c.lineTo(i * 2, y));
      c.lineTo(w, h);
      c.closePath();
      c.fill();
      for (let i = 0; i < ys.length; i += 2) {
        const x = i * 2,
          y = ys[i],
          l = rand() * 20 + 5;
        c.strokeStyle = "rgba(" + ink + "," + opacity * 0.35 + ")";
        c.lineWidth = rand() * 1.8 + 0.5;
        c.beginPath();
        c.moveTo(x, y + rand() * 6);
        c.quadraticCurveTo(x - 5, y + l * 0.5, x - 10 - rand() * 8, y + l);
        c.stroke();
      }
      return ys;
    }
    ridge(307, 115, 76, "127,128,112", 0.38);
    ridge(416, 123, 39, "109,115,99", 0.48);
    const ys = ridge(540, 146, 33, "79,87,72", 0.66);
    for (let i = 0; i < 180; i++) {
      const x = rand() * w,
        y = ys[Math.floor(x / 2)] + rand() * 21,
        ht = 4 + rand() * 27;
      c.strokeStyle = "rgba(58,64,48,.64)";
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 2, y - ht);
      c.stroke();
      for (let k = 0; k < 4; k++) {
        c.fillStyle = "rgba(60,70,53,.46)";
        c.beginPath();
        c.ellipse(
          x + rand() * 5 - 2,
          y - ht * 0.9 + k * ht * 0.16,
          ht * (0.08 + k * 0.065),
          ht * 0.083,
          -0.13,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    }
    for (let i = 0; i < 24; i++) {
      const x = rand() * w,
        y = h * 0.82 + rand() * 67;
      c.strokeStyle = "rgba(90,91,72,.26)";
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 8 + rand() * 54, y);
      c.stroke();
    }
  });
}
export function softShadow() {
  return surface(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(64, 64, 1, 64, 64, 63);
    g.addColorStop(0, "rgba(50,32,19,.54)");
    g.addColorStop(0.4, "rgba(56,37,23,.33)");
    g.addColorStop(1, "rgba(64,44,29,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
}
export function halo() {
  return surface(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 63);
    g.addColorStop(0, "rgba(255,237,178,.92)");
    g.addColorStop(0.1, "rgba(255,208,113,.55)");
    g.addColorStop(0.4, "rgba(248,164,69,.14)");
    g.addColorStop(1, "rgba(229,149,75,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
}
export function horizon() {
  return surface(1024, 512, (c, w, h) => {
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#a28c71");
    sky.addColorStop(0.41, "#cfba99");
    sky.addColorStop(0.55, "#cfba99");
    sky.addColorStop(0.79, "#d1ba94");
    sky.addColorStop(1, "#baa382");
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 10; i++) {
      const x = rand() * w,
        y = rand() * h,
        g = c.createRadialGradient(x, y, 0, x, y, 180);
      g.addColorStop(0, "rgba(255,225,172,.13)");
      g.addColorStop(1, "rgba(255,225,173,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 20000; i++) {
      c.fillStyle = "rgba(67,49,31,.035)";
      c.fillRect(rand() * w, rand() * h, 1, 1);
    }
  });
}
