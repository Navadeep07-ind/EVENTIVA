import os
from PIL import Image, ImageDraw, ImageFont

w, h = 800, 1131
img = Image.new('RGB', (w, h), color='#030712')
draw = ImageDraw.Draw(img)

# Inset border
draw.rectangle([14, 14, w - 14, h - 14], outline=(255, 255, 255, 45), width=2)

# Paste campus building at the bottom with alpha fade
campus_path = r"c:\Users\navad\OneDrive\Desktop\EVENTIVA\frontend\public\assets\tkrcet_campus.png"
if os.path.exists(campus_path):
    campus_img = Image.open(campus_path).convert('RGBA')
    cw, ch = 800, 420
    campus_img = campus_img.resize((cw, ch))
    
    # Create smooth gradient alpha mask
    mask = Image.new('L', (cw, ch), 0)
    for y in range(ch):
        if y < ch * 0.35:
            alpha = int(255 * (y / (ch * 0.35)))
        else:
            alpha = 255
        for x in range(cw):
            mask.putpixel((x, y), alpha)
            
    campus_img.putalpha(mask)
    img.paste(campus_img, (0, h - ch), campus_img)

# Paste Left Logo (TKRCET logo)
logo_path = r"c:\Users\navad\OneDrive\Desktop\EVENTIVA\frontend\public\assets\tkrcet_logo.png"
if os.path.exists(logo_path):
    logo = Image.open(logo_path).convert('RGBA').resize((75, 75))
    img.paste(logo, (35, 30), logo)

# Paste Right Badge (NAAC badge)
badge_path = r"c:\Users\navad\OneDrive\Desktop\EVENTIVA\frontend\public\assets\naac_badge.png"
if os.path.exists(badge_path):
    badge = Image.open(badge_path).convert('RGBA').resize((75, 75))
    img.paste(badge, (w - 110, 30), badge)

out_path = r"c:\Users\navad\OneDrive\Desktop\EVENTIVA\backend\static\posters\noventrix_preview.png"
img.save(out_path)
print("Preview base saved to:", out_path)
