import { gap, inGap, gates } from "./route.js";
const storageKey = "夜宴折屏-试次-v2";
const round = (value, digits = 3) => Number(value.toFixed(digits));

// 同一标签页保留各回合的原始次序。仅将自报按钮的点击列为参与者知觉事件。
export class TrialLog {
  constructor() {
    this.runs = [];
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      if (Array.isArray(saved)) {
        this.runs = saved;
        for (const run of this.runs)
          if (run.状态 === "进行中") run.状态 = "上次页面中断";
      }
    } catch {}
  }
  persist() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(this.runs));
    } catch {
      this.memoryOnly = true;
    }
  }
  begin(slice, version, trial, viewport, quality) {
    this.start = performance.now();
    this.lastSample = -Infinity;
    this.prev = null;
    this.lastMoved = this.start;
    this.current = {
      序号: this.runs.length + 1,
      切片: slice + 1,
      初始条件: version,
      开始时间: new Date().toISOString(),
      固定路线: [trial.from, trial.to],
      速度: trial.speed,
      视口: viewport,
      画质: quality,
      状态: "进行中",
      事件: [],
      轨迹: [],
    };
    this.runs.push(this.current);
    this.persist();
  }
  event(name, state, extra = {}, at = performance.now()) {
    if (!this.current) return;
    this.current.事件.push({
      毫秒: Math.round(at - this.start),
      事件: name,
      位置米: round(state.s),
      ...extra,
    });
    this.persist();
  }
  frame(v, version, visible, levels, audible) {
    if (!this.current) return;
    const now = performance.now(),
      last = this.prev;
    const delta = last ? Math.sign(v.s - last.s) : 0;
    if (delta) this.lastMoved = now;
    const dir = delta || (last && now - this.lastMoved < 160 ? last.dir : 0);
    const flags = {
      舞者揭帧: visible,
      鼓轨开放: audible && levels[1] > 0,
      管轨开放: audible && levels[2] > 0,
      留白区: inGap(v.s),
      越过屏线: v.s >= gates[0],
    };
    for (const [name, on] of Object.entries(flags)) {
      if (last ? last[name] !== on : on)
        this.event(name, v, { 值: on, 条件: version }, now);
    }
    if (!last || dir !== last.dir)
      this.event(["回退", "驻足", "行进"][dir + 1], v, {}, now);
    if (now - this.lastSample >= 250 || !last || dir !== last.dir) {
      this.current.轨迹.push({
        毫秒: Math.round(now - this.start),
        位置米: round(v.s),
        方向: dir,
        条件: version,
        视点: [v.yaw, v.pitch, v.offsetZ, v.lift, v.fov].map((x) => round(x)),
        鼓轨增益: round(levels[1]),
        管轨增益: round(levels[2]),
      });
      this.lastSample = now;
    }
    this.prev = { s: v.s, dir, ...flags };
  }
  end(reason, v) {
    if (!this.current) return;
    this.event(reason, v);
    this.current.状态 = reason;
    this.current = null;
    this.persist();
  }
  export() {
    return {
      格式版本: 2,
      时间单位: "距本回合开始的单调时钟毫秒",
      坐标单位: "虚拟米",
      视点字段: [
        "水平角弧度",
        "俯仰角弧度",
        "纵深偏移米",
        "高度偏移米",
        "视场角度",
      ],
      留白区间: gap,
      记录说明:
        "揭帧与开声是程序事件。听到、看到、听到声止是按钮自报。增益不含扬声器与听者延迟。",
      回合: this.runs,
    };
  }
}
