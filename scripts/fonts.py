"""从 Google Fonts 的两份思源字体子集化；运行网页时不需要 Python。"""
import argparse
import pathlib
from fontTools import subset
from fontTools.ttLib import TTFont

root = pathlib.Path(__file__).resolve().parents[1]
args = argparse.ArgumentParser()
args.add_argument('directory', type=pathlib.Path, help='存有 serif.ttf 和 sans.ttf 的目录')
source = args.parse_args().directory
paths = [root / 'index.html', root / 'public/art/art.json', *sorted((root / 'src').glob('*.js'))]
text = ''.join(p.read_text() for p in paths) + ''.join(chr(i) for i in range(32, 127))
for name in ('serif', 'sans'):
    font = TTFont(source / (name + '.ttf'))
    options = subset.Options()
    options.flavor = 'woff2'
    sub = subset.Subsetter(options=options)
    sub.populate(text=text)
    sub.subset(font)
    font.flavor = 'woff2'
    font.save(root / 'src/fonts' / (name + '.woff2'))
