import sys, glob
from PIL import Image
out = sys.argv[1]; files = sys.argv[2:]
ims = [Image.open(f).convert('RGB') for f in files]
cols = 3 if len(ims) > 4 else 2
w = max(i.width for i in ims); h = max(i.height for i in ims)
scale = min(1.0, 1500 / (cols * w))
tw, th = int(w * scale), int(h * scale)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * th), 'white')
for k, im in enumerate(ims):
    sheet.paste(im.resize((tw, th)), ((k % cols) * tw, (k // cols) * th))
sheet.save(out)
print(out, sheet.size)
