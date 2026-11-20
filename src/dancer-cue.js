import * as T from "three";

// 在实体与原画裁片完成深度写入后，询问 GPU：舞者的实形有没有通过深度测试的像素。
// 查询异步返回。甲乙共享同一揭帧，程序在揭帧时给声音和人物动作同一个起拍。
export class DancerCue {
  constructor(stage, actor) {
    this.actor = actor;
    this.gl = stage.renderer.getContext();
    this.pending = [];
    this.generation = 0;
    this.visible = false;
    this.active = false;
    const material = actor.material.clone();
    material.colorWrite = false;
    material.depthWrite = false;
    this.probe = new T.Mesh(actor.geometry, material);
    this.probe.frustumCulled = false;
    this.probe.renderOrder = 100000;
    this.probe.visible = false;
    stage.scene.add(this.probe);
    this.probe.onBeforeRender = () => {
      if (this.pending.length >= 4) return;
      this.query = this.gl.createQuery();
      if (this.query)
        this.gl.beginQuery(this.gl.ANY_SAMPLES_PASSED, this.query);
    };
    this.probe.onAfterRender = () => {
      if (!this.query) return;
      this.gl.endQuery(this.gl.ANY_SAMPLES_PASSED);
      this.pending.push({ query: this.query, generation: this.generation });
      this.query = null;
    };
  }
  reset() {
    this.generation++;
    this.visible = false;
  }
  prepare(s) {
    const active = s >= 1.6 && s < 9.4;
    if (active !== this.active) this.reset();
    this.active = active;
    const gl = this.gl;
    while (
      this.pending.length &&
      gl.getQueryParameter(this.pending[0].query, gl.QUERY_RESULT_AVAILABLE)
    ) {
      const item = this.pending.shift();
      if (active && item.generation === this.generation)
        this.visible = Boolean(
          gl.getQueryParameter(item.query, gl.QUERY_RESULT),
        );
      gl.deleteQuery(item.query);
    }
    this.probe.visible = active;
    this.actor.visible = !active || this.visible;
    this.probe.position.copy(this.actor.position);
    this.probe.quaternion.copy(this.actor.quaternion);
    this.probe.scale.copy(this.actor.scale);
    return active && this.visible;
  }
}
