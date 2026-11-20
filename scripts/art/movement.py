"""在原画坐标中提取动作部位。旋转支点、敲击角度及被遮挡部分的补色均为研究推定。"""
import cv2
import numpy as np
from PIL import Image, ImageFilter

PARTS = {
    "drum-players": {
        "name": "执槌的右前臂", "drive": "drum", "pivot": [531.5, 146],
        "tip": [550.6, 110.9], "angles": [0, 1.63],
        "outline": """
        498,104 499,103.6 505.5,104.5 507.5,103.7 508.8,101.9 511,101.8 513.2,102.0 514.6,102.8
        516.5,102.4 518.6,103.0 520.4,103.6 522.4,103.9 524.4,105.3 525,106.5
        547.3,109.4 548.4,108.1 550.0,107.3 552.1,107.8 553.5,109.1 554,111.2 553.3,113.3
        551.6,114.4 549.6,114.4 547.9,113.4 547.1,111.7 546.9,111 525.8,108.8 526.1,110
        525.4,111.7 522.3,113.1 520.3,115.2 521.5,119.7 524,123.5 527.6,127.4 530.6,129.5
        532.4,132.2 533.7,136.8 534.5,142.7 534.2,147.3 532.6,150.2 529.6,151.2
        526.3,150.0 523.3,147.7 521.3,144.1 518.8,139.8 517.3,134.4 515.8,130.2
        514.5,126.9 512.3,122 510.3,117.9 508.8,113.6 508.4,110 508.4,108.3 498,105.4
        """,
        "clear": """490,93 542,93 545,102 555,106 554,115 545,120 540,124 535,129 531,134
        529,140 530,146 533,151 534,155 529,157 521,152 512,143 493,129""",
    },
    "pipa-player": {
        "name": "持拨的腕与前臂", "drive": "lute", "pivot": [82,234.4], "angles": [-0.09,0.115],
        "outline": """
        75.3,230.1 77.7,228.5 81.6,228.1 84.7,229.2 87.7,229.3 89.2,230.9 92.2,231.7
        96,233.4 98.9,235.5 101.2,236.1 102.5,234.2 105.4,234.8 107.8,234.1 110.3,234.6
        112.5,235.2 115.8,236.1 118.9,236.3 122.6,234.5 125.9,231.3 129.1,237.5
        128.4,244.1 125.7,242.8 122.6,241 119,241 116.5,242.9 111.5,244.4
        105.9,245.8 101.4,245.7 99.2,247 95.8,246.5 91.3,244.9 86.8,243.5 82.9,242.4
        79.2,241 76.8,238.4 74.6,235.2 74.2,232.7""",
    },
    "dancer": {
        "name": "回身舞动的衣袖", "drive": "dance", "pivot": [194,244], "angles": [-0.055,0.18],
        "outline": """
        187.7,238.9 190.4,237.9 194.1,239.1 196.8,241.2 199.5,243.9 202.2,247.3
        207,249.2 211.1,249.7 214.6,248.1 217.8,247.2 221,247 224.1,248.5 225.4,250.2
        222.2,252 218.3,252.3 216.5,254.6 210,255.2 204.4,255.5 200.1,254.8
        195.7,254.2 192,251.3 189.2,248.6 187.5,245.4 186.3,242.4""",
    },
    "ensemble": {
        "name": "竖管与按音手势", "drive": "wind", "pivot": [565.7,103.5], "angles": [-0.027,0.046],
        "outline": """
        566.6,101.4 568.2,101.4 567.8,104.3 565.3,111.7 566.5,112.9 569,115.7 570.5,120
        571.3,122.7 571.3,127.8 569.7,128.4 567.4,126.7 565.8,123.1 565,121.7 563.6,122.3
        562.2,125.8 561.3,129.9 560,135.4 559.1,137.3 556.6,136.2 558.3,130 558,126.9
        557.7,124 555.5,122.7 554.7,120.7 556.5,118.8 558.8,118 556.2,117.5 557,115.8 559.1,114.8
        556.7,114.4 556.6,112.8 559.5,111.7 562.8,111.6 565.7,103.2""",
    },
}


def points(text, scale, offset=(0,0)):
    values = np.array([list(map(float,pair.split(","))) for pair in text.split()])
    return np.rint(values * scale - np.asarray(offset)).astype(np.int32)


def separate_part(figure, box, stage, slug, scale, output):
    """透明底图保持既有裁片锚点；另存可围绕关节点旋转的局部原画。"""
    part = PARTS[slug]
    outline = points(part["outline"],scale)
    left, top, width, height = cv2.boundingRect(outline)
    margin = 4
    left, top = left-margin, top-margin
    right, bottom = left+width+2*margin, top+height+2*margin
    crop = stage.crop((left,top,right,bottom)).convert("RGBA")
    mask = np.zeros((crop.height,crop.width),np.uint8)
    cv2.fillPoly(mask,[outline-[left,top]],255,lineType=cv2.LINE_AA)
    part_alpha = Image.fromarray(mask).filter(ImageFilter.GaussianBlur(.54))
    crop.putalpha(part_alpha)
    filename = slug+"-gesture.webp"
    crop.save(output/filename,quality=91,method=5,alpha_quality=100)

    # 先在原位置消去墨线，避免活动手势旁出现第二只静止的手。
    full_mask = Image.new("L",figure.size)
    full_mask.paste(part_alpha,(left-box[0],top-box[1]))
    mask = np.uint8(np.asarray(full_mask)>24)*255
    mask = cv2.dilate(mask,np.ones((5,5),np.uint8))
    color = cv2.inpaint(np.array(figure.convert("RGB")),mask,5,cv2.INPAINT_TELEA)
    body = Image.fromarray(color)
    base_alpha = np.array(figure.getchannel("A"))
    if "clear" in part:
        cv2.fillPoly(base_alpha,[points(part["clear"],scale,box[:2])],0,lineType=cv2.LINE_AA)
    body.putalpha(Image.fromarray(base_alpha))
    info = {
        "name": part["name"], "drive":part["drive"], "file":"art/"+filename,
        "partBox":[round(q/scale,3) for q in (left,top,right,bottom)], "pivot":part["pivot"], "angles":part["angles"],
    }
    if "tip" in part:
        info["tip"] = part["tip"]
    return body,info
