"""Render sample PDFs to PNG: FULL_<style>.png for one participant and compare_<id>.png
(name/college area of all 4 styles stacked). Needs poppler's pdftoppm on PATH.
Usage: python render_previews.py [samples_dir] [cert-id-suffix e.g. 1234]
"""
import glob, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
d = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "samples")
pid = sys.argv[2] if len(sys.argv) > 2 else "0003"
LABELS = {"A": "A · Classic — Noto Serif", "B": "B · Elegant — Playfair Display + EB Garamond",
          "C": "C · Script — Alex Brush + Cormorant", "D": "D · Formal caps — Cinzel"}
font = ImageFont.truetype(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fonts", "NotoSerif-Bold.ttf"), 20)
rows = []
for pdf in sorted(glob.glob(os.path.join(d, f"2026{pid}_*.pdf"))):
    style = os.path.basename(pdf).split("_", 1)[1][:-4]            # e.g. A_classic
    subprocess.run(["pdftoppm", "-png", "-r", "150", "-singlefile", pdf, os.path.join(d, f"FULL_{style}")], check=True)
    im = Image.open(os.path.join(d, f"FULL_{style}.png")); W, H = im.size
    crop = im.crop((int(W*.08), int(H*.535), int(W*.93), int(H*.635)))
    row = Image.new("RGB", (crop.width, crop.height + 30), "white")
    ImageDraw.Draw(row).text((8, 4), LABELS[style[0]], fill=(150, 60, 20), font=font); row.paste(crop, (0, 30)); rows.append(row)
if rows:
    sheet = Image.new("RGB", (rows[0].width, sum(r.height for r in rows)), "white"); y = 0
    for r in rows: sheet.paste(r, (0, y)); y += r.height
    sheet.save(os.path.join(d, f"compare_{pid}.png")); print("wrote previews for", pid)
