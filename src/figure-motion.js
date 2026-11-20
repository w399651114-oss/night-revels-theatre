import * as T from "three";
import { drumPose } from "./rhythm.js";

export function gestureAmount(drive, phase, drumPhase = phase) {
  if (drive === "drum") return drumPose(drumPhase);
  if (drive === "dance")
    return 0.5 + 0.5 * Math.cos((drumPhase * Math.PI * 2) / 0.75);
  if (drive === "wind")
    return 0.5 - 0.5 * Math.cos((phase * Math.PI * 2) / 1.5);
  // 每个半秒拨弦音的起点先下拨，再回到下一次起拨位置。
  const part = (((phase % 0.5) + 0.5) % 0.5) / 0.5;
  if (part < 0.4) return (1 - part / 0.4) ** 2;
  if (part > 0.82) return ((part - 0.82) / 0.18) ** 2;
  return 0;
}

export function attachGesture(body, layer, material) {
  const motion = layer.motion;
  const [x0, y0, x1, y1] = layer.sourceBox;
  const [u0, v0, u1, v1] = motion.partBox;
  const [px, py] = motion.pivot;
  const scale = layer.height / (y1 - y0);
  // 平面内图像 y 朝下，Three.js 中 y 朝上。关节本地原点与原画支点重合。
  const hinge = new T.Group();
  hinge.name = motion.name;
  hinge.position.set(
    (px - (x0 + x1) / 2) * scale,
    ((y0 + y1) / 2 - py) * scale,
    0.004,
  );
  body.add(hinge);
  const gesture = new T.Mesh(
    new T.PlaneGeometry((u1 - u0) * scale, (v1 - v0) * scale),
    material,
  );
  gesture.position.set(
    ((u0 + u1) / 2 - px) * scale,
    (py - (v0 + v1) / 2) * scale,
    0,
  );
  gesture.name = motion.name;
  gesture.userData.id = layer.id;
  gesture.castShadow = true;
  hinge.add(gesture);
  return { hinge, gesture, motion };
}

export function animateGesture({ hinge, motion }, phase, drumPhase) {
  const [lift, strike] = motion.angles;
  const amount = gestureAmount(motion.drive, phase, drumPhase);
  hinge.rotation.z = -(lift + (strike - lift) * amount);
}
