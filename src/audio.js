import { gap, stations } from "./route.js";

import { drumHit, drumStep } from "./rhythm.js";

export const trials = [
  {
    name: "听乐 → 观舞",
    a: "别殿遥闻",
    b: "过屏方启",
    from: 2.25,
    to: 6.15,
    source: "羯鼓",
    speed: 0.66,
  },
  {
    name: "清吹 → 散宴",
    a: "余音越界",
    b: "凤箫吹断／留白静默",
    from: 18.6,
    to: 24.75,
    source: "管声",
    speed: 0.66,
  },
];
const loop = 12;
// 两种版本读取同一条循环音轨，只改变指定空间边界的增益。
export function gains(s, versions, dancerVisible = false) {
  const drum =
    s >= 1.8 && s < 9.4 && (versions[0] === "甲" || dancerVisible) ? 0.73 : 0;
  const wind =
    s < 15.5
      ? 0
      : s < gap[0]
        ? 0.82
        : versions[1] === "甲"
          ? Math.max(0, 0.82 * (1 - (s - gap[0]) / 4.5))
          : 0;
  const lute = s <= 4.2 ? 0.76 : Math.max(0, 0.76 * (1 - (s - 4.2) / 1.6));
  return [lute, drum, wind];
}
function track(ctx, kind) {
  const rate = 24000,
    buf = ctx.createBuffer(1, rate * loop, rate),
    out = buf.getChannelData(0);
  const notes = [220, 247, 294, 330, 392, 330, 294, 247, 220, 294, 247, 196];
  const step = [0.5, drumStep, 1.5][kind],
    span = [1, 0.48, 1.39][kind];
  for (let j = 0; j < loop / step; j++) {
    if (kind === 1 && !drumHit(j)) continue;
    const hz =
      notes[(j * (kind === 0 ? 5 : 1)) % notes.length] * (kind === 2 ? 1.5 : 1);
    const start = Math.round(j * step * rate);
    for (let n = 0; n < span * rate; n++) {
      const t = n / rate,
        ph = t * hz * 2 * Math.PI;
      let v;
      if (kind === 0)
        v =
          (Math.sin(ph) +
            0.45 * Math.sin(2 * ph) * Math.exp(-4 * t) +
            0.19 * Math.sin(3 * ph)) *
          Math.min(1, t * 140) *
          Math.exp(-5.8 * t) *
          0.24;
      else if (kind === 1)
        v =
          (Math.sin(2 * Math.PI * (79 * t + 3.4 * (1 - Math.exp(-24 * t)))) +
            0.17 * Math.sin(2 * Math.PI * 169 * t)) *
          Math.min(1, t * 230) *
          Math.exp(-12 * t) *
          (j % 4 === 0 ? 0.49 : 0.3);
      else
        v =
          (Math.sin(ph + 0.17 * Math.sin(2 * Math.PI * 4.9 * t)) +
            0.19 * Math.sin(ph * 2) +
            0.055 * Math.sin(ph * 3)) *
          Math.min(1, t * 4, (span - t) * 5) *
          0.23;
      out[(start + n) % out.length] += v;
    }
  }
  return buf;
}
export class SoundField {
  constructor() {
    this.on = false;
    this.versions = ["甲", "甲"];
    this.nodes = [];
    this.epoch = 0;
  }
  placeSources(sprites) {
    this.positions = ["pipa-player", "red-drum", "ensemble"].map((id) => {
      const mesh = sprites.find((sprite) => sprite.userData.id === id);
      return mesh?.position.toArray();
    });
  }
  async enable() {
    if (!this.ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error("此浏览器未提供 Web Audio");
      this.ctx = new Context();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(this.ctx.destination);
      this.output = this.ctx.createMediaStreamDestination();
      this.master.connect(this.output);
      this.nodes = [0, 1, 3].map((section, kind) => {
        const pan = this.ctx.createPanner();
        pan.panningModel = "equalpower";
        pan.distanceModel = "inverse";
        pan.refDistance = 2;
        pan.maxDistance = 34;
        pan.rolloffFactor = 0.82;
        pan.setPosition(
          ...(this.positions?.[kind] ?? [-stations[section], 1.15, 0]),
        );
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        gain.connect(pan);
        pan.connect(this.master);
        return { gain, buffer: track(this.ctx, kind) };
      });
      this.restart();
    }
    await this.ctx.resume();
    this.on = true;
    this.master.gain.setTargetAtTime(0.72, this.ctx.currentTime, 0.025);
  }
  mute() {
    this.on = false;
    if (this.ctx)
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.025);
  }
  restart() {
    if (!this.ctx) return;
    this.epoch = this.ctx.currentTime + 0.035;
    this.drumEpoch = this.epoch;
    this.wasVisible = false;
    for (const n of this.nodes) {
      const now = this.ctx.currentTime;
      n.gain.gain.cancelScheduledValues(now);
      n.gain.gain.setValueAtTime(0, now);
      n.level = undefined;
      this.startTrack(n, this.epoch);
    }
  }
  startTrack(node, when) {
    if (node.source) {
      node.source.stop();
      node.source.disconnect();
    }
    node.source = this.ctx.createBufferSource();
    node.source.buffer = node.buffer;
    node.source.loop = true;
    node.source.connect(node.gain);
    node.source.start(when);
  }
  syncDrum(visible) {
    if (!this.ctx) return;
    if (visible && !this.wasVisible) {
      this.drumEpoch = this.ctx.currentTime;
      this.startTrack(this.nodes[1], this.drumEpoch);
    }
    this.wasVisible = visible;
  }
  drumPhase() {
    return this.ctx ? Math.max(0, this.ctx.currentTime - this.drumEpoch) : 0;
  }
  update(s, camera, visible) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime,
      l = this.ctx.listener,
      p = camera.position;
    const f = camera.getWorldDirection(camera.position.clone());
    if (l.positionX) {
      for (const [name, val] of Object.entries({
        positionX: p.x,
        positionY: p.y,
        positionZ: p.z,
        forwardX: f.x,
        forwardY: f.y,
        forwardZ: f.z,
        upX: 0,
        upY: 1,
        upZ: 0,
      }))
        l[name].value = val;
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(f.x, f.y, f.z, 0, 1, 0);
    }
    const levels = gains(s, this.versions, visible);
    this.nodes.forEach((n, i) => {
      if (n.level === levels[i]) return;
      n.level = levels[i];
      n.gain.gain.setTargetAtTime(n.level, t, 0.012);
    });
  }
  phase() {
    return this.ctx ? Math.max(0, this.ctx.currentTime - this.epoch) : 0;
  }
}
