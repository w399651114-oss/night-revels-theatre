import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { stations, assetURL } from "./route.js";

// 合批前把木框、画芯与金属收边放在同一局部坐标下。
export class StageDetails {
  landscapePanel(x, z, y, wide, high, ry, index, total, blocking = false) {
    const face = 0.075;
    const component = (name, u, v, offset, w, h, d) => {
      this.board(
        name,
        x + u * Math.cos(ry) + offset * Math.sin(ry),
        y + v,
        z - u * Math.sin(ry) + offset * Math.cos(ry),
        w,
        h,
        d,
        ry,
      );
    };
    component("wood", 0, 0, 0, wide, high, 0.14);
    const tex = this.panorama.clone();
    tex.offset.x = index / total;
    tex.repeat.x = 1 / total;
    tex.needsUpdate = true;
    const painting = new T.Mesh(
      new T.PlaneGeometry(wide - 0.12, high * 0.73),
      new T.MeshStandardMaterial({
        map: tex,
        color: 0xf6e5c9,
        roughness: 0.95,
        side: T.DoubleSide,
      }),
    );
    painting.rotation.y = ry;
    painting.position.set(
      x + Math.sin(ry) * face,
      y + high * 0.065,
      z + Math.cos(ry) * face,
    );
    painting.receiveShadow = true;
    this.scene.add(painting);
    this.wireObjects.push(painting);
    component(
      "brocade",
      0,
      high * 0.065,
      -face,
      wide - 0.12,
      high * 0.73,
      0.012,
    );
    for (const u of [-1, 1])
      component(
        "trim",
        u * (wide / 2 - 0.085),
        high * 0.065,
        face + 0.008,
        0.012,
        high * 0.73,
        0.013,
      );
    for (const v of [-0.303, 0.434])
      component("trim", 0, v * high, face + 0.008, wide - 0.14, 0.017, 0.013);
    component("ink", 0, -high * 0.385, face, wide - 0.14, high * 0.083, 0.028);
    component(
      "brass",
      0,
      -high * 0.385,
      face + 0.018,
      wide * 0.57,
      0.015,
      0.013,
    );
    for (const u of [-0.41, 0.41]) {
      component("wood", wide * u, -high * 0.52, 0, 0.09, 0.26, 0.12);
      component("wood", wide * u, -high * 0.55, 0, 0.14, 0.075, 0.36);
    }
    if (blocking) {
      const block = new T.Mesh(new T.BoxGeometry(wide, high, 0.16));
      block.position.set(x, y, z);
      block.rotation.y = ry;
      block.updateMatrixWorld();
      this.blockers.push(block);
    }
  }
  gate(s) {
    for (let j = 0; j < 5; j++) {
      const ry = Math.PI / 2 + (j % 2 ? 0.18 : -0.18),
        z = -1.15 + j * 1.17;
      const height = j < 3 ? 2.3 : 2.03;
      this.landscapePanel(
        -s,
        z,
        height * 0.55 + 0.05,
        1.21,
        height,
        ry,
        j,
        5,
        true,
      );
      this.shadow(-s + 0.2, z, 1.35, 1.65);
    }
  }
  backdrop(x) {
    for (let j = 0; j < 3; j++) {
      const ry = 0.04 + (j % 2 ? 0.2 : -0.19);
      this.landscapePanel(
        x + 0.18 + (j - 1) * 1.12,
        -1.65 + (j % 2 ? 0.04 : 0),
        1.23,
        1.15,
        2.15,
        ry,
        j,
        3,
      );
    }
  }
  shadow(x, z, w, d) {
    const geo = new T.PlaneGeometry(w, d);
    geo.rotateX(-Math.PI / 2);
    geo.translate(x, 0.032, z);
    this.staticShadows.push(geo);
  }
  vessel(x, y, z, scale = 1) {
    const pts = [
      [0, 0],
      [0.075, 0],
      [0.12, 0.04],
      [0.14, 0.14],
      [0.1, 0.21],
      [0.058, 0.25],
      [0.056, 0.31],
      [0.07, 0.32],
    ];
    const g = new T.LatheGeometry(
      pts.map(([a, b]) => new T.Vector2(a * scale, b * scale)),
      20,
    );
    this.shape("ceramic", g, x, y, z);
  }
  furnish(x, i) {
    const dx = i % 2 === 0 ? 1.65 : -1.62;
    this.board("wood", x + dx, 0.4, 0.92, 0.9, 0.09, 0.51);
    this.board("ink", x + dx, 0.33, 0.92, 0.76, 0.075, 0.41);
    this.board("brass", x + dx, 0.412, 1.18, 0.85, 0.013, 0.012);
    for (const a of [-0.34, 0.34])
      for (const b of [-0.17, 0.17])
        this.board("wood", x + dx + a, 0.18, 0.92 + b, 0.055, 0.36, 0.055);
    this.vessel(x + dx + 0.19, 0.445, 0.88, 0.77);
    this.cylinder("brass", x + dx - 0.12, 0.468, 1.0, 0.1, 0.063, 0.044);
    this.cylinder("ink", x + dx - 0.12, 0.494, 1.0, 0.079, 0.079, 0.006);
    this.shadow(x + dx + 0.07, 1.02, 1.5, 1.12);
    const cx = x - 2.05,
      cz = 0.82;
    this.cylinder("wood", cx, 0.45, cz, 0.031, 0.044, 0.82);
    this.cylinder("brass", cx, 0.075, cz, 0.09, 0.175, 0.1);
    this.cylinder("brass", cx, 0.83, cz, 0.145, 0.035, 0.07);
    this.cylinder("brass", cx, 0.41, cz, 0.071, 0.05, 0.06);
    this.cylinder("red", cx, 0.98, cz, 0.048, 0.052, 0.24);
    const flame = new T.Mesh(
      new T.SphereGeometry(0.039, 9, 8),
      new T.MeshBasicMaterial({ color: 0xffe7b5 }),
    );
    flame.position.set(cx, 1.16, cz);
    this.scene.add(flame);
    this.flames.push(flame);
    const glow = new T.Sprite(this.glowMat);
    glow.scale.setScalar(0.64);
    glow.position.copy(flame.position);
    this.scene.add(glow);
    this.halos.push(glow);
    this.shadow(cx + 0.05, cz, 0.62, 0.42);
    this.labels.push({
      section: i,
      name: "漆木几案",
      detail: "三维推定",
      description:
        "参照画中低矮几案与饮器，用木框、案面与旋转器形重组。桌面尺度与器物摆位由本实验设定。",
      point: new T.Vector3(x + dx, 0.7, 0.97),
      object: true,
    });
  }
  async mountArt(manifest, progress) {
    const loader = new T.TextureLoader();
    const layers = manifest.sections.flatMap((section, i) =>
      section.layers.map((layer) => ({ layer, i })),
    );
    let done = 0;
    await Promise.all(
      layers.map(async ({ layer, i }) => {
        const tex = await loader.loadAsync(assetURL(layer.file)).catch(() => {
          throw new Error("无法读取图层 " + layer.file);
        });
        tex.colorSpace = T.SRGBColorSpace;
        tex.anisotropy = 4;
        const w = layer.height * layer.aspect,
          h = layer.height;
        const mat = new T.MeshBasicMaterial({
          map: tex,
          alphaTest: 0.47,
          side: T.DoubleSide,
          color: 0xfff4df,
        });
        const m = new T.Mesh(new T.PlaneGeometry(w, h), mat);
        // 同层原有遮挡顺序用毫米级微差保留，防止共面闪烁。
        const depths = [-0.72, -0.34, 0, 0.36, 0.77];
        const plane = depths.reduce((best, z) =>
          Math.abs(z - layer.z) < Math.abs(best - layer.z) ? z : best,
        );
        m.position.set(
          -stations[i] + layer.x,
          h / 2 + 0.045,
          plane + layer.z * 0.008,
        );
        m.castShadow = true;
        m.userData.id = layer.id;
        this.scene.add(m);
        this.sprites.push(m);
        this.wireObjects.push(m);
        this.shadow(
          m.position.x + 0.08,
          m.position.z + 0.05,
          Math.max(0.5, w * 1.15),
          0.76,
        );
        this.labels.push({
          section: i,
          name: layer.name,
          detail: "原画裁片",
          description:
            layer.description ||
            "从本段画面提取的原画局部。轮廓和设色取自画卷，前后层位、离地高度和实际大小属于实验推定。",
          point: new T.Vector3(m.position.x, h * 0.8 + 0.04, m.position.z),
          sprite: m,
        });
        progress(++done, layers.length);
      }),
    );
    const geom = mergeGeometries(this.staticShadows);
    this.scene.add(new T.Mesh(geom, this.shadowMat));
    this.staticShadows.forEach((g) => g.dispose());
    this.staticShadows = [];
  }
  project(label) {
    const point = label.point.clone().project(this.camera);
    if (
      point.z < -1 ||
      point.z > 1 ||
      Math.abs(point.x) > 0.96 ||
      Math.abs(point.y) > 0.93
    )
      return null;
    const delta = label.point.clone().sub(this.camera.position);
    this.ray.set(this.camera.position, delta.clone().normalize());
    this.ray.far = delta.length() - 0.05;
    if (this.ray.intersectObjects(this.blockers, false).length) return null;
    return { x: (point.x + 1) * 0.5, y: (1 - point.y) * 0.5 };
  }
}
