"""把实际成片的检测与四次网页导出日志整理为可公开的镜头表。"""
import argparse
import json
from pathlib import Path


def timecode(secs):
    f = max(0, round(secs * 24))
    return f"{f // 1440:02}:{(f // 24) % 60:02}:{f % 24:02}"


def generate(folder, out):
    report = json.loads((folder / "4K成片验收.json").read_text())
    runs = json.loads((folder / "演示点击-四回合逐次实验记录.json").read_text())["回合"]
    if [(r["切片"],r["初始条件"]) for r in runs] != [(1,"甲"),(1,"乙"),(2,"甲"),(2,"乙")]:
        raise ValueError("导出的桌面试次次序与镜头表不一致")
    if any(abs(run["事件"][-1]["位置米"] - run["固定路线"][1]) > .002 for run in runs):
        raise ValueError("一个或多个试次没有走完全程")
    events=report["成片事件"]
    cues=[e for e in events if e["类别"]=="镜头"]
    starts={e["名称"]:e["时间"] for e in events if e["类别"]=="试听起点"}
    ends={e["名称"]:e["时间"] for e in events if e["类别"]=="试听终点"}
    vid, aud, src = report["成片视频"], report["成片音频"], report["原始视频"]
    q=report["全帧像素复核"]
    lines=[
        "# 4K 实录镜头表与机器验收","",
        f"本次成片由 Apple M1 Pro、16 GB 内存的 MacBook Pro 运行 Chrome {report['浏览器']} 录得。"
        f"时长 {vid['容器秒']:.3f} 秒，以下时间码依次为分、秒、帧，每秒 24 帧。",
        "", "![成片中的人物定位、听觉实验和窄屏操作](./images/4K实录分镜.jpg)", "", "| 起点 | 镜头 | 画面中的操作或条件 |","| --- | --- | --- |",
    ]
    for cue in cues:
        lines.append(f"| {timecode(cue['时间'])} | {cue['名称'].replace('｜',' · ')} | {cue['文案']} |")
    lines += ["","## 固定起点的四次完整试听","",
              "起止位置与回合状态从网页实际下载的日志读回。起止时码标记界面开始行走与抵达后重新展开面板的时刻。"
              "自报为演示者点击控件的记录。","","| 条件 | 成片全程 | 起止米 | 回合状态 | 轨迹样本 | 自报 |",
              "| --- | --- | --- | --- | ---: | --- |"]
    for run in runs:
        k=f"切片{'一二'[run['切片']-1]} · {run['初始条件']}"
        names="、".join(e["事件"].removeprefix("自报：") for e in run["事件"] if e["事件"].startswith("自报："))
        lines.append(f"| {k} | {timecode(starts[k])} 至 {timecode(ends[k])} | "
                     f"{run['固定路线'][0]:.2f} 至 {run['固定路线'][1]:.2f} | {run['状态']} | {len(run['轨迹'])} | {names} |")
    lines += ["","## 音频复验","",
              f"全片共用 {report['全片统一增益dB']:+.2f} dB 剪辑增益。EBU R128 综合响度 {aud['综合响度LUFS']:.1f} LUFS，"
              f"响度范围 {aud['响度范围LU']:.1f} LU，真峰值 {aud['真峰值dBTP']:.1f} dBTP。"
              f"成片为 AAC 立体声，{aud['采样率']} Hz。",
              "", "| 条件 | 成片取样 | 全频 RMS，dBFS | 60–180 Hz RMS，dBFS |","| --- | --- | ---: | ---: |"]
    for name, row in report["切片测量"].items():
        lo,hi=row["成片窗口秒"]
        lines.append(f"| {name} | {timecode(lo)} 至 {timecode(hi)} | {row['均方根dBFS']:.2f} | "
                     f"{row['鼓声频带60至180Hz均方根dBFS']:.2f} |")
    lines+=["","数字零显示为 −240 dBFS，该值是分析工具对零取对数时设置的显示下限。"
             "切片一的琵琶和鼓同处一条混音轨，低频测量用于复听屏前差异。切片二的同程时窗位于素绢留白之内。",
             "","## 画幅、帧数、同步与摘要","",
             f"- 逐帧解码得到 {vid['实解码帧数']} 帧，所有帧为 3840 × 2160。H.264 成片恒定 {vid['平均帧率']:.3f} fps，最大帧间隔 {vid['最大帧间隔毫秒']:.2f} 毫秒。"
             f"原始标签页录制采用可变帧率，平均 {src['平均帧率']:.2f} fps，最大帧间隔 {src['最大帧间隔毫秒']:.2f} 毫秒。",
             f"- 成片全部 {q['比对帧数']} 帧以其对应的 4K 原始录制帧作 SSIM 比对。最低 {q['完整4K像素最低SSIM']:.6f}，"
             f"平均 {q['平均SSIM']:.6f}。该项量化二次编码的像素变化。",
             f"- 三次实录的闪白与同步音得到统一声音延迟校正量 {report['校正声音延迟毫秒']:+.2f} 毫秒。"
             f"三个标记校正后的最大残差为 {report['校正后最大标记误差毫秒']:.2f} 毫秒。",
             f"- 文件大小 {report['成片字节']:,} 字节。成片 SHA-256 为 `{report['成片SHA256']}`。",
             f"- 浏览器原始实录 SHA-256 为 `{report['原始SHA256']}`。",
             "","完整逐帧数据、原始视频、成片、事件标记和四回合导出均保存在交付目录。"
             "项目仓库提供录制脚本和复验方法。[录制与复验](./4K实录与复验.md)",""]
    out.write_text("\n".join(lines))


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder",type=Path)
    parser.add_argument("out",type=Path)
    a=parser.parse_args()
    generate(a.folder,a.out)
