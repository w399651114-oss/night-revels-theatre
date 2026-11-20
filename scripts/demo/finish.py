"""剪去首尾校准标记，生成恒帧率成片，并从视频逐帧读回验收数据。"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import re
import tempfile
import gzip
import av
import imageio_ffmpeg
import numpy as np

FF = os.environ.get("FFMPEG") or imageio_ffmpeg.get_ffmpeg_exe()
FPS = 24
RATE = 48000


def pcm(file):
    data = subprocess.check_output([FF, "-v", "error", "-i", str(file), "-map", "0:a:0",
                                    "-ar", str(RATE), "-ac", "2", "-f", "f32le", "-"])
    return np.frombuffer(data, dtype="<f4").reshape(-1, 2)


def db(value):
    return round(20 * np.log10(max(float(value), 1e-12)), 2)


def audio_stats(audio):
    spectrum = np.fft.rfft(audio.mean(axis=1))
    freq = np.fft.rfftfreq(len(audio), 1 / RATE)
    low = np.sqrt(2 * np.square(np.abs(spectrum[(freq >= 60) & (freq <= 180)])).sum()) / len(audio)
    return {"均方根dBFS": db(np.sqrt(np.mean(audio ** 2))),
            "峰值dBFS": db(np.max(np.abs(audio))),
            "鼓声频带60至180Hz均方根dBFS": db(low),
            "左右声道差值均方根dBFS": db(np.sqrt(np.mean((audio[:, 0] - audio[:, 1]) ** 2)))}


def loudness(file):
    process = subprocess.run([FF, "-hide_banner", "-nostats", "-i", str(file), "-vn",
                              "-af", "ebur128=peak=true", "-f", "null", "-"],
                             capture_output=True, check=True, text=True)
    summary = process.stderr.rsplit("Summary:", 1)[-1]
    return {name:float(re.search(pattern,summary).group(1)) for name,pattern in (
        ("综合响度LUFS",r"\bI:\s+([-0-9.]+) LUFS"),
        ("响度范围LU",r"\bLRA:\s+([-0-9.]+) LU"),
        ("真峰值dBTP",r"Peak:\s+([-0-9.]+) dBFS"),
    )}

def video_info(file, detect=False):
    with av.open(str(file)) as container:
        stream = container.streams.video[0]
        stream.thread_type = "AUTO"
        times, flashes = [], []
        previous, sizes = False, set()
        for frame in container.decode(video=0):
            times.append(frame.time)
            sizes.add((frame.width, frame.height))
            if detect:
                # 校准白块在 4K 图像的 (16,16) 到 (116,116)。
                plane = frame.planes[0]
                white = memoryview(plane)[60 * plane.line_size + 60] >= 231
                if white and not previous:
                    flashes.append(frame.time)
                previous = white
        gaps = np.diff(times)
        result = {"编码": stream.codec_context.name, "逐帧尺寸": sorted(sizes), "实解码帧数": len(times),
                  "时间戳严格递增": bool((gaps > 0).all()), "首帧秒": times[0], "末帧秒": times[-1],
                  "最大帧间隔毫秒": round(float(gaps.max() * 1000), 2),
                  "平均帧率": round((len(times) - 1) / (times[-1] - times[0]), 3)}
        return result, np.array(times), flashes


def tone_times(audio):
    size = 240
    blocks = audio[:len(audio) // size * size].mean(axis=1).reshape(-1, size)
    kernel = np.exp(-2j * np.pi * 2000 * np.arange(size) / RATE)
    amplitude = 2 * np.abs(blocks @ kernel) / size
    active = amplitude > .055
    return np.where(active & ~np.r_[False, active[:-1]])[0] * size / RATE


def closest(times, value):
    found = min(times, key=lambda t: abs(t - value))
    if abs(found - value) > .45:
        raise RuntimeError(f"距 {value:.3f} 秒没有找到校准标记")
    return float(found)


def digest(file):
    with file.open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path)
    parser.add_argument("--sample", action="store_true")
    args = parser.parse_args()
    folder = args.folder.resolve()
    raw = folder / ("校准小样-原始.mp4" if args.sample else "浏览器原始实录.mp4")
    movie = folder / ("校准小样-剪辑.mp4" if args.sample else "韩熙载夜宴图-折屏剧场与听觉实验-4K.mp4")
    meta = json.loads((folder / ("小样事件.json" if args.sample else "实录事件.json")).read_text())
    events = meta["事件"]
    by_name = {e["名称"]: e["时间"] for e in events}
    raw_video, _, whites = video_info(raw, detect=True)
    original = pcm(raw)
    sounds = tone_times(original)
    calibration = []
    for mark in [e["时间"] for e in events if e["类别"] == "校准"]:
        visual, audible = closest(whites, mark), closest(sounds, mark)
        calibration.append({"记录秒": mark, "白块首帧秒": visual, "短音起点秒": audible,
                            "画面减声音毫秒": round(1000 * (visual - audible), 2)})
    video_lag = float(np.median([v["白块首帧秒"] - v["记录秒"] for v in calibration]))
    av_lag = float(np.median([v["白块首帧秒"] - v["短音起点秒"] for v in calibration]))
    start = by_name["正片起点"] + video_lag
    audio_start = start - av_lag
    # 尾部保留一帧余量，使最后一个校准闪白和短音都在正片以外。
    frames = int(np.floor((by_name["正片终点"] - by_name["正片起点"]) * FPS)) - 1
    duration = frames / FPS
    retained = original[int(audio_start * RATE):int((audio_start + duration) * RATE)]
    if np.max(np.abs(retained)) < .001:
        raise RuntimeError("正片音轨过低，请检查录制权限与静音配置")
    # 整片共享一个增益，源内 A/B 关系与声像得以保留。
    gain = round(min(15.0, -2.5 - db(np.max(np.abs(retained)))), 2)
    vf = f"trim=start={start},setpts=PTS-STARTPTS,fps={FPS},trim=end_frame={frames},format=yuv420p"
    af = (f"atrim=start={audio_start},asetpts=PTS-STARTPTS,volume={gain}dB,"
          f"aresample={RATE},apad,atrim=duration={duration}")
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw),
                    "-map", "0:v:0", "-map", "0:a:0", "-vf", vf, "-af", af,
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-threads", "6",
                    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                    "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", str(movie)],check=True)
    # 采用相同的原始帧选择表达式，把成片逐帧与录制像素比对。
    with tempfile.TemporaryDirectory() as scratch:
        metric = Path(scratch) / "ssim.txt"
        subprocess.run([FF, "-v", "error", "-filter_complex_threads", "4", "-i", str(raw),
                        "-i", str(movie), "-filter_complex", f"[0:v]{vf}[ref];[ref][1:v]ssim=stats_file={metric}",
                        "-an", "-f", "null", "-"], check=True)
        lines = metric.read_bytes()
    values = [float(x) for x in re.findall(rb"All:([0-9.]+)", lines)]
    if len(values) != frames:
        raise RuntimeError(f"逐帧像素比对数量不符：{len(values)} / {frames}")
    with gzip.open(folder / ("小样逐帧SSIM.txt.gz" if args.sample else "4K逐帧SSIM.txt.gz"), "wb") as output:
        output.write(lines)
    quality = {"比对帧数": len(values), "完整4K像素最低SSIM": min(values), "最低帧序号": int(np.argmin(values))+1,
               "第五百分位SSIM": round(float(np.percentile(values,5)),6), "平均SSIM": round(float(np.mean(values)),6)}
    video, times, _ = video_info(movie)
    final_audio = pcm(movie)
    if (video["实解码帧数"] != frames or video["逐帧尺寸"] != [(3840, 2160)] or
            not np.allclose(np.diff(times), 1 / FPS, atol=.00001)):
        raise RuntimeError("成片帧率、画幅或帧数与目标不符")
    with av.open(str(movie)) as content:
        a = content.streams.audio[0]
        audio_meta = {"编码": a.codec_context.name, "声道": a.codec_context.layout.name,
                      "采样率": a.codec_context.sample_rate, "容器音轨秒": float(a.duration * a.time_base),
                      "完整解码PCM秒含编解码补齐": len(final_audio) / RATE}
    with av.open(str(movie)) as content:
        video["容器秒"] = content.duration / 1e6
    # 事件时间统一换算到最终成片。
    offset = by_name["正片起点"]
    timeline = [{**e, "时间": round(e["时间"] - offset, 3)} for e in events
                if offset <= e["时间"] <= by_name["正片终点"]]
    windows = {}
    for event in timeline:
        if event["类别"] == "试听起点":
            first = event["名称"].startswith("切片一")
            lo, hi = (0.55, 2.0) if first else (5.0, 6.8)
            low, high = event["时间"] + lo, event["时间"] + hi
            windows[event["名称"]] = {"成片窗口秒": [round(low, 3), round(high, 3)],
                                    **audio_stats(final_audio[int(low*RATE):int(high*RATE)])}
    report = {"原始SHA256": digest(raw), "成片SHA256": digest(movie), "成片字节": movie.stat().st_size,
              "原始视频": raw_video, "实录设备": meta["屏幕"], "实录轨道": meta["轨道"],
              "浏览器": meta["浏览器"], "校准": calibration, "校正声音延迟毫秒": round(av_lag * 1000, 2),
              "校正后最大标记误差毫秒": round(max(abs(v["画面减声音毫秒"] - av_lag * 1000) for v in calibration), 2),
              "全片统一增益dB": gain, "全帧像素复核": quality, "成片视频": video, "成片音频": {**audio_meta, **audio_stats(final_audio), **loudness(movie)},
              "切片测量": windows, "成片事件": timeline}
    out = folder / ("小样验收.json" if args.sample else "4K成片验收.json")
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({k:report[k] for k in ["成片视频","成片音频","全帧像素复核","校准","全片统一增益dB","切片测量","成片SHA256"]},ensure_ascii=False,indent=2))


if __name__ == "__main__":
    run()
