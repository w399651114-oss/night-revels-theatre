"""将外部高清整卷与手工轮廓配准。输入为 34600 像素宽的整卷 JPEG。"""
import argparse
import io
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

directory = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("image", type=Path,help="完整装裱图像，须由说明所列的公开 TIFF 生成")
options = parser.parse_args()
master = cv2.imread(str(options.image))
if master is None or master.shape[1] != 34600:
    raise SystemExit("请输入宽度为 34600 像素的配准底图。")
transforms = json.loads((directory/"registration.json").read_text())
zoom = 3
xx,yy = np.meshgrid(np.arange(4720*zoom,dtype=np.float32)/zoom,np.arange(396*zoom,dtype=np.float32)/zoom)
matrices = np.stack([matrix for _,matrix in transforms])
centers = [value for value,_ in transforms]
coefficients = [np.interp(xx[0],centers,matrices[:,j,k]).astype(np.float32) for j in range(2) for k in range(3)]
factor = master.shape[0]/396
mx = (coefficients[0]*xx+coefficients[1]*yy+coefficients[2])*factor
my = (coefficients[3]*xx+coefficients[4]*yy+coefficients[5])*factor
# 先裁出绘画本幅，以便遵循 OpenCV 重采样对于单边像素数的限制。
xmin,xmax = round(np.min(mx))-4,round(np.max(mx))+6
image = cv2.remap(master[:,xmin:xmax],mx-xmin,my,cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE)
success,encoded = cv2.imencode(".jpg",image,[cv2.IMWRITE_JPEG_QUALITY,96])
if not success:
    raise SystemExit("配准图像编码失败。")
Image.open(io.BytesIO(encoded)).save(directory/"master.webp",quality=87,method=6)
