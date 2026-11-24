"""Find the name/college underlines in the template (pixel coords used for SLOTS in engine.js).
Prints every row in the search bands that has a dark horizontal run longer than 800 px.
Usage: python measure_template.py ../assets/template.png
"""
import sys
import numpy as np
from PIL import Image
im = np.array(Image.open(sys.argv[1] if len(sys.argv) > 1 else "../assets/template.png").convert("L"))
print("size", im.shape[::-1])
for y0, y1 in [(2000, 2120), (2140, 2260)]:          # bands around the two lines
    for y in range(y0, y1):
        dark = im[y] < 110
        best, start = (0, 0, 0), None
        for x, d in enumerate(dark):
            if d and start is None: start = x
            if (not d or x == len(dark) - 1) and start is not None:
                if x - start > best[0]: best = (x - start, start, x)
                start = None
        if best[0] > 800: print(f"y={y} line x={best[1]}..{best[2]} (len {best[0]})")
