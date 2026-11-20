"""从已验收成片提取真实操作帧，生成研究文档中的缩略图。"""
import argparse
import json
from pathlib import Path
import av
from PIL import Image, ImageDraw, ImageFont

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("folder",type=Path)
parser.add_argument("output",type=Path)
parser.add_argument("--font",type=Path,help="可选的本地中文字体文件")
args=parser.parse_args()
report=json.loads((args.folder/"4K成片验收.json").read_text())
events=report["成片事件"]
# 每张图片取自实际操作之后。相邻的甲乙画面显示相同线路位置。
choices=[
    ("操作","琵琶乐伎",.8,"人物题签"),
    ("操作","在原卷定位乐伎",1.3,"原卷定位"),
    ("操作","原卷定位清吹与散宴的素绢",1.2,"原卷留白"),
    ("镜头","观舞",2.8,"观舞"),
    ("镜头","三层证据",2.8,"三层证据"),
    ("试听起点","切片一 · 甲",2.9,"切片一 · 甲"),
    ("试听起点","切片一 · 乙",2.9,"切片一 · 乙"),
    ("试听起点","切片二 · 甲",5.4,"切片二 · 甲"),
    ("试听起点","切片二 · 乙",5.4,"切片二 · 乙"),
    ("操作","浏览器下载四次实验日志",.6,"四回合日志"),
    ("操作","窄屏启动试听，面板自动收起",.4,"窄屏试听"),
    ("操作","窄屏试听驻足",.5,"窄屏驻足"),
]
candidates=[args.font,Path("/System/Library/Fonts/STHeiti Medium.ttc"),
            Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
            Path("C:/Windows/Fonts/msyh.ttc")]
file=next((p for p in candidates if p and p.exists()),None)
font=ImageFont.truetype(str(file),15) if file else ImageFont.load_default(size=15)
sheet=Image.new("RGB",(1440,4*294),"#ece7dc")
draw=ImageDraw.Draw(sheet)
with av.open(str(args.folder/"韩熙载夜宴图-折屏剧场与听觉实验-4K.mp4")) as src:
    stream=src.streams.video[0]
    stream.thread_type="AUTO"
    for n,(kind,name,offset,caption) in enumerate(choices):
        begin=next(e["时间"] for e in events if e["类别"]==kind and e["名称"]==name)
        t=begin+offset
        src.seek(int(t/stream.time_base),stream=stream)
        frame=next(f for f in src.decode(video=0) if f.time>=t)
        x,y=n%3*480,n//3*294
        sheet.paste(frame.reformat(width=480,height=270,format="rgb24").to_image(),(x,y))
        stamp=f"{int(t)//60:02}:{int(t)%60:02}"
        draw.text((x+8,y+271),stamp+"  "+caption if file else stamp,font=font,fill="#252b22")
args.output.parent.mkdir(parents=True,exist_ok=True)
sheet.save(args.output,quality=88)
