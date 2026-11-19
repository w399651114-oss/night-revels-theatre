"""从仓库内的配准母版重建所有运行贴图。依赖详见同目录 requirements.txt。"""
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageFilter
from outlines import SECTIONS, REVISED, ISLANDS, PATCHES, BORROWED, NOTES

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "public" / "art"
MASTER = Image.open(Path(__file__).with_name("master.webp")).convert("RGB")
SCALE = MASTER.height // 396
OUTPUT.mkdir(parents=True, exist_ok=True)
cv2.setNumThreads(1)

def save_thumbnail(image, filename, limits, quality):
    image.thumbnail(limits, Image.Resampling.LANCZOS)
    image.save(OUTPUT / filename, quality=quality, method=5)

def points_from(text):
    return np.array([list(map(int,pair.split(","))) for pair in text.split()],dtype=np.int32)

def cut(image, slug, outline):
    shapes = [points_from(REVISED.get(slug,outline))] + [points_from(island) for island in ISLANDS.get(slug,[])]
    points = np.vstack(shapes)
    left, top = np.maximum(points.min(axis=0) - 9, 0)
    right, bottom = np.minimum(points.max(axis=0) + 10, [image.width // SCALE,396])
    box = int(left),int(top),int(right),int(bottom)
    pixels = np.array(image.crop(tuple(c * SCALE for c in box)))
    polygons = [(shape - [left,top]).astype(np.int32) * SCALE for shape in shapes]
    stencil = np.zeros(pixels.shape[:2],np.uint8)
    for polygon in polygons:
        cv2.fillPoly(stencil,[polygon],255)
    # 两侧仅留可搜索的窄带，颜色相近的袍服与绢地仍然由手工轮廓约束。
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(21,21))
    interior = cv2.erode(stencil,kernel)
    exterior = cv2.dilate(stencil,kernel)
    likelihood = np.full(stencil.shape,cv2.GC_BGD,np.uint8)
    likelihood[exterior>0] = cv2.GC_PR_BGD
    likelihood[stencil>0] = cv2.GC_PR_FGD
    likelihood[interior>0] = cv2.GC_FGD
    cv2.setRNGSeed(20261119)
    models = (np.zeros((1,65),np.float64),np.zeros((1,65),np.float64))
    cv2.grabCut(cv2.cvtColor(pixels,cv2.COLOR_RGB2BGR),likelihood,None,*models,3,cv2.GC_INIT_WITH_MASK)
    mask = np.uint8(likelihood % 2) * 255
    # 仅清除缘外细小孤岛；琴颈、鼓槌和椅腿的长线保留。
    count,labels,stats,_ = cv2.connectedComponentsWithStats(mask)
    for index in range(1,count):
        if stats[index,cv2.CC_STAT_AREA] < 80:
            mask[labels==index]=0
    alpha=Image.fromarray(mask).filter(ImageFilter.GaussianBlur(0.7))
    source=Image.fromarray(pixels)
    for area,(dx,dy) in PATCHES.get(slug,[]):
        patch = Image.fromarray(cv2.fillPoly(np.zeros(mask.shape,np.uint8),[(points_from(area)-[left,top]).astype(np.int32)*SCALE],255)).filter(ImageFilter.GaussianBlur(1.0*SCALE))
        shifted = image.crop(((left+dx)*SCALE,(top+dy)*SCALE,(right+dx)*SCALE,(bottom+dy)*SCALE))
        source.paste(shifted,(0,0),patch)
    source.putalpha(alpha)
    bounds=alpha.getbbox()
    source=source.crop(bounds)
    anchor=[int(left*SCALE+bounds[0]),int(top*SCALE+bounds[1]),int(left*SCALE+bounds[2]),int(top*SCALE+bounds[3])]
    return source,anchor

def extend_costume(figure,box,slug,stage):
    # 只给局部遮挡后的站立宾客补袍脚，使用同卷手工分出的衣纹。
    background = Image.new("RGBA",stage.size)
    _,start,end,items = SECTIONS[1]
    donor = next(item for item in items if item[0]=="clapper")
    donor_stage = MASTER.crop((start*SCALE,0,end*SCALE,MASTER.height))
    donor_image,donor_box = cut(donor_stage,"clapper",donor[-1])
    for (lx,ty,rx,by),(width,height),(x,y) in BORROWED[slug]:
        crop = donor_image.crop(((lx-start)*SCALE-donor_box[0],ty*SCALE-donor_box[1],(rx-start)*SCALE-donor_box[0],by*SCALE-donor_box[1]))
        crop = crop.resize((width*SCALE,height*SCALE),Image.Resampling.LANCZOS)
        background.alpha_composite(crop,(x*SCALE,y*SCALE))
    background.alpha_composite(figure,(box[0],box[1]))
    bounds = background.getchannel("A").getbbox()
    return background.crop(bounds),list(bounds)

save_thumbnail(MASTER.crop((0,0,4553*SCALE,MASTER.height)),"scroll.webp",(3840,340),89)
manifest={"scroll":"art/scroll.webp","sections":[]}
for section,(name,start,end,items) in enumerate(SECTIONS):
    stage=MASTER.crop((start*SCALE,0,end*SCALE,MASTER.height))
    thumb=f"scene-{section+1}.webp"
    save_thumbnail(stage.copy(),thumb,(1560,650),88)
    entry={"id":section,"name":name,"thumbnail":f"art/{thumb}","sourceRange":[start,end],"layers":[]}
    for slug,title,kind,x,z,height,outline in items:
        figure,box=cut(stage,slug,outline)
        if slug in BORROWED:
            figure,box=extend_costume(figure,box,slug,stage)
        filename=f"{slug}.webp"
        figure.thumbnail((1250,1080),Image.Resampling.LANCZOS)
        figure.save(OUTPUT / filename,quality=89,method=5,alpha_quality=98)
        entry["layers"].append({"id":slug,"description":NOTES[slug]+" 景深、尺度与摆位由本实验推定。","occludedPaint":slug in PATCHES or slug in BORROWED,"file":f"art/{filename}","name":title,
          "kind":kind,"x":x,"z":z,"height":height,"aspect":round(figure.width/figure.height,6),
          "sourceBox":[round(c/SCALE,2) for c in box]})
    manifest["sections"].append(entry)
(OUTPUT/"art.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
