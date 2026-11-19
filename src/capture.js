export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export class Capture {
  constructor(stage, sound, notify, finish) {
    Object.assign(this, { stage, sound, notify, finish });
  }
  format() {
    const r = this.stage.renderer,
      c = this.stage.camera;
    r.setPixelRatio(1);
    r.setSize(3840, 2160, false);
    c.aspect = 16 / 9;
    c.updateProjectionMatrix();
  }
  async still() {
    if (this.recorder) throw new Error("请先结束当前录制");
    this.format();
    try {
      this.stage.render(performance.now() / 1000);
      const image = await new Promise((resolve) =>
        this.stage.canvas.toBlob(resolve, "image/png"),
      );
      if (!image) throw new Error("浏览器未生成图像");
      download(image, "夜宴折屏-3840x2160.png");
    } finally {
      this.stage.resize();
    }
  }
  async start() {
    if (!window.MediaRecorder || !this.stage.canvas.captureStream)
      throw new Error("此浏览器不支持画布录制，可使用系统录屏。");
    const type = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/mp4",
      "video/webm",
    ].find((t) => MediaRecorder.isTypeSupported(t));
    if (!type) throw new Error("浏览器缺少兼容的视频编码器");
    await this.sound.enable();
    this.format();
    let stream;
    try {
      stream = this.stage.canvas.captureStream(30);
      this.sound.output.stream
        .getAudioTracks()
        .forEach((t) => stream.addTrack(t.clone()));
      const recorder = new MediaRecorder(stream, {
          mimeType: type,
          videoBitsPerSecond: 20000000,
        }),
        parts = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) parts.push(e.data);
      };
      recorder.onerror = () =>
        this.notify("编码发生错误，请结束录制并检查下载文件。");
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        this.recorder = null;
        this.stage.resize();
        if (parts.length)
          download(
            new Blob(parts, { type: recorder.mimeType }),
            "夜宴折屏-4K." + (type.includes("mp4") ? "mp4" : "webm"),
          );
        this.finish(
          parts.length ? "录像已交给浏览器下载" : "编码器没有输出视频",
        );
      };
      recorder.start(1000);
      this.recorder = recorder;
    } catch (error) {
      stream?.getTracks().forEach((t) => t.stop());
      this.stage.resize();
      throw error;
    }
  }
  stop() {
    if (this.recorder?.state === "recording") this.recorder.stop();
  }
}
