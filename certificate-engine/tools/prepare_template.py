"""Convert the 5000x3535 PNG template to a 300 dpi A4 JPEG (~0.8 MB instead of 2.3 MB per PDF).
Usage: python prepare_template.py ../assets/template.png
"""
import os, sys
from PIL import Image
src = sys.argv[1] if len(sys.argv) > 1 else "../assets/template.png"
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "template.jpg")
Image.open(src).convert("RGB").resize((3508, 2480), Image.LANCZOS).save(out, quality=90, optimize=True)
print("wrote", out)
