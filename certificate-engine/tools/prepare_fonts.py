"""Download Google Fonts, freeze variable fonts to static weights, and subset to Latin.
Writes the .ttf files into ../fonts.
Usage: pip install fonttools && python prepare_fonts.py
"""
import os, shutil, subprocess, urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "_font_src")
OUT = os.path.join(HERE, "..", "fonts")
BASE = "https://raw.githubusercontent.com/google/fonts/main/ofl/"
DOWNLOADS = {
    "NotoSerif[wdth,wght].ttf": "notoserif/NotoSerif%5Bwdth,wght%5D.ttf",
    "NotoSerif-Italic[wdth,wght].ttf": "notoserif/NotoSerif-Italic%5Bwdth,wght%5D.ttf",
    "PlayfairDisplay[wght].ttf": "playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf",
    "PlayfairDisplay-Italic[wght].ttf": "playfairdisplay/PlayfairDisplay-Italic%5Bwght%5D.ttf",
    "EBGaramond[wght].ttf": "ebgaramond/EBGaramond%5Bwght%5D.ttf",
    "EBGaramond-Italic[wght].ttf": "ebgaramond/EBGaramond-Italic%5Bwght%5D.ttf",
    "CormorantGaramond[wght].ttf": "cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf",
    "Cinzel[wght].ttf": "cinzel/Cinzel%5Bwght%5D.ttf",
    "AlexBrush-Regular.ttf": "alexbrush/AlexBrush-Regular.ttf",
}
STATIC = [  # (variable source, axes, output name)
    ("NotoSerif[wdth,wght].ttf", {"wght": 700, "wdth": 100}, "NotoSerif-Bold.ttf"),
    ("NotoSerif[wdth,wght].ttf", {"wght": 600, "wdth": 100}, "NotoSerif-SemiBold.ttf"),
    ("NotoSerif-Italic[wdth,wght].ttf", {"wght": 600, "wdth": 100}, "NotoSerif-SemiBoldItalic.ttf"),
    ("PlayfairDisplay-Italic[wght].ttf", {"wght": 700}, "PlayfairDisplay-BoldItalic.ttf"),
    ("PlayfairDisplay[wght].ttf", {"wght": 700}, "PlayfairDisplay-Bold.ttf"),
    ("EBGaramond-Italic[wght].ttf", {"wght": 600}, "EBGaramond-SemiBoldItalic.ttf"),
    ("EBGaramond[wght].ttf", {"wght": 600}, "EBGaramond-SemiBold.ttf"),
    ("CormorantGaramond[wght].ttf", {"wght": 700}, "CormorantGaramond-Bold.ttf"),
    ("Cinzel[wght].ttf", {"wght": 700}, "Cinzel-Bold.ttf"),
    ("Cinzel[wght].ttf", {"wght": 600}, "Cinzel-SemiBold.ttf"),
]
# Latin + common punctuation. Only 'kern' is kept: ligatures (fi, fl) break in pdf-lib.
UNICODES = "U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-201D,U+2022,U+2026"

os.makedirs(SRC, exist_ok=True); os.makedirs(OUT, exist_ok=True)
for name, path in DOWNLOADS.items():
    dst = os.path.join(SRC, name)
    if not os.path.exists(dst):
        urllib.request.urlretrieve(BASE + path, dst)

tmp = os.path.join(SRC, "static"); os.makedirs(tmp, exist_ok=True)
for src, axes, out in STATIC:
    f = TTFont(os.path.join(SRC, src)); instantiateVariableFont(f, axes, inplace=True); f.save(os.path.join(tmp, out))
shutil.copy(os.path.join(SRC, "AlexBrush-Regular.ttf"), tmp)

for f in os.listdir(tmp):
    subprocess.run(["pyftsubset", os.path.join(tmp, f), f"--unicodes={UNICODES}",
                    "--layout-features=kern", f"--output-file={os.path.join(OUT, f)}"], check=True)
    print("wrote", f)
