import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { stations, gates, railPoint } from "./route.js";

import {
  silk,
  wood,
  inkLandscape,
  softShadow,
  halo,
  horizon,
} from "./textures.js";
import { StageDetails } from "./details.js";

export class Theatre extends StageDetails {
  constructor(canvas) {
    super();
    this.canvas = canvas;
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.scene = new T.Scene();
    this.scene.background = horizon();
    this.scene.fog = new T.FogExp2(0xcfba99, 0.062);
    this.camera = new T.PerspectiveCamera(44, 1, 0.05, 90);
    this.state = {
      s: stations[0],
      yaw: 0,
      pitch: 0,
      offsetZ: 0,
      lift: 0,
      fov: 44,
    };
    this.level = "标准";
    this.batches = new Map();
    this.mats = {};
    this.labels = [];
    this.flames = [];
    this.sprites = [];
    this.blockers = [];
    this.wireObjects = [];
    this.scene.add(new T.HemisphereLight(0xffecd1, 0xad977f, 1.5));
    const sun = new T.DirectionalLight(0xffe1b2, 1.35);
    this.sun = sun;
    sun.castShadow = true;
    Object.assign(sun.shadow.camera, {
      left: -5.5,
      right: 5.5,
      top: 5.5,
      bottom: -5.5,
      near: 0.1,
      far: 30,
    });
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.012;
    this.scene.add(sun.target);
    sun.position.set(-4, 6, 3);
    this.scene.add(sun);
    this.candleLight = new T.PointLight(0xffb35c, 6, 5, 2);
    this.scene.add(this.candleLight);
    this.material("wood", 0xb6a18d, { map: wood() });
    this.material("brocade", 0xd0bc95, { map: silk() });
    this.panorama = inkLandscape();
    this.shadowMat = new T.MeshBasicMaterial({
      map: softShadow(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    this.glowMat = new T.SpriteMaterial({
      map: halo(),
      transparent: true,
      depthWrite: false,
    });
    this.staticShadows = [];
    this.halos = [];
    this.material("ceramic", 0x9aada6);
    this.material("trim", 0x927652);
    this.material("silk", 0xc4aa80);
    this.material("pale", 0xd1bd98);
    this.material("brass", 0x917147);
    this.material("ink", 0x352c25);
    this.material("red", 0x855545);
    this.board("pale", -12, -0.14, 1, 110, 0.22, 100);
    this.board("brocade", -13, -0.012, 0.8, 30, 0.07, 9.6);
    for (const z of [-3.75, -3.66, 5.25, 5.34])
      this.board("trim", -13, 0.024, z, 30, 0.006, 0.022);
    this.ray = new T.Raycaster();
    gates.forEach((s) => this.gate(s));
    stations.forEach((s, i) => {
      this.furnish(-s, i);
      this.backdrop(-s, i);
    });
    this.flush();
    this.resize();
  }
  material(name, color, extra = {}) {
    this.mats[name] = new T.MeshStandardMaterial({
      color,
      roughness: 0.92,
      ...extra,
    });
  }
  shape(name, geo, x, y, z, ry = 0) {
    geo.rotateY(ry);
    geo.translate(x, y, z);
    if (!this.batches.has(name)) this.batches.set(name, []);
    this.batches.get(name).push(geo);
  }
  board(name, x, y, z, w, h, d, ry = 0) {
    this.shape(name, new T.BoxGeometry(w, h, d), x, y, z, ry);
  }
  cylinder(name, x, y, z, top, bottom, h, n = 16) {
    this.shape(name, new T.CylinderGeometry(top, bottom, h, n), x, y, z);
  }
  flush() {
    for (const [name, geometries] of this.batches) {
      const geo = mergeGeometries(geometries);
      const mesh = new T.Mesh(geo, this.mats[name]);
      mesh.receiveShadow = true;
      mesh.castShadow = name !== "pale" && name !== "brocade";
      this.scene.add(mesh);
      this.wireObjects.push(mesh);
      geometries.forEach((g) => g.dispose());
    }
    this.batches.clear();
  }
  resize() {
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    const ratio = Math.min(
      devicePixelRatio,
      { 节能: 1, 标准: 1.5, 精细: 2 }[this.level],
    );
    if (
      this.renderer.getPixelRatio() === ratio &&
      this.canvas.width === Math.floor(w * ratio) &&
      this.canvas.height === Math.floor(h * ratio) &&
      Math.abs(this.camera.aspect - w / h) < 0.0001
    )
      return;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
  }
  cameraPose() {
    const v = this.state,
      r = railPoint(v.s, v.offsetZ);
    this.camera.position.set(r.x, 1.6 + v.lift, r.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.set(-0.065 + v.pitch, 0.22 + v.yaw, 0, "YXZ");
    this.camera.fov = T.MathUtils.radToDeg(
      2 *
        Math.atan(
          Math.tan(T.MathUtils.degToRad(v.fov / 2)) *
            Math.max(1, 1.42 / this.camera.aspect),
        ),
    );
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }
  render(time, phase = 0) {
    const sx = Math.round(this.state.s / 2) * 2;
    if (sx !== this.shadowCenter) {
      this.shadowCenter = sx;
      this.sun.position.set(-sx - 4, 6, 3.7);
      this.sun.target.position.set(-sx, 0, 0);
      this.renderer.shadowMap.needsUpdate = true;
    }
    for (const sprite of this.sprites) {
      if (sprite.userData.id === "dancer")
        sprite.rotation.z = 0.015 * Math.sin((phase * Math.PI * 2) / 0.75);
      if (sprite.userData.id === "pipa-player")
        sprite.rotation.z = 0.003 * Math.sin(phase * Math.PI * 4);
    }
    this.cameraPose();
    const near = this.flames.reduce((a, b) =>
      Math.abs(a.position.x + this.state.s) <
      Math.abs(b.position.x + this.state.s)
        ? a
        : b,
    );
    this.candleLight.position.copy(near.position);
    this.candleLight.position.y += 0.14;
    this.candleLight.intensity =
      4.6 + Math.sin(time * 4.5) * 0.5 + Math.cos(time * 7.2) * 0.24;
    this.flames.forEach((f, i) => {
      f.scale.y =
        1.65 + 0.21 * Math.sin(time * 6 + i) + 0.1 * Math.cos(time * 11 + i);
    });
    this.renderer.render(this.scene, this.camera);
  }
  setWire(on) {
    this.wireObjects.forEach((o) => {
      o.material.wireframe = on;
    });
  }
  setQuality(level) {
    this.level = level;
    this.renderer.shadowMap.enabled = level !== "节能";
    this.renderer.shadowMap.needsUpdate = true;
    this.resize();
  }
}
