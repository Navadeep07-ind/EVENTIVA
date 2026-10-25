import os
from PIL import Image

src_path = r"C:\Users\navad\.gemini\antigravity\brain\b473c9c5-33f7-4d18-ab48-5a4785ce3bbe\.user_uploaded\media_1791706719536_4f867487.png"
out_dir = r"c:\Users\navad\OneDrive\Desktop\EVENTIVA\frontend\public\assets"
os.makedirs(out_dir, exist_ok=True)
static_dir = r"c:\Users\navad\OneDrive\Desktop\EVENTIVA\backend\static\assets"
os.makedirs(static_dir, exist_ok=True)

img = Image.open(src_path)
w, h = img.size
print(f"Image size: {w}x{h}")

# In media_1791706719536_4f867487.png:
# Top left logo (TKRCET logo):
# Looking at the image, logo is roughly in top left corner
# Let's inspect bounding boxes
logo_box = (int(w * 0.022), int(h * 0.013), int(w * 0.138), int(h * 0.085))
logo_img = img.crop(logo_box)
logo_img.save(os.path.join(out_dir, "tkrcet_logo.png"))
logo_img.save(os.path.join(static_dir, "tkrcet_logo.png"))

# NAAC badge top right:
naac_box = (int(w * 0.862), int(h * 0.013), int(w * 0.978), int(h * 0.085))
naac_img = img.crop(naac_box)
naac_img.save(os.path.join(out_dir, "naac_badge.png"))
naac_img.save(os.path.join(static_dir, "naac_badge.png"))

# Campus building photo at the bottom:
# building starts around y = 0.72 to 1.0 (or 0.65 to 1.0)
campus_box = (0, int(h * 0.68), w, h)
campus_img = img.crop(campus_box)
campus_img.save(os.path.join(out_dir, "tkrcet_campus.png"))
campus_img.save(os.path.join(static_dir, "tkrcet_campus.png"))

print("Extracted assets saved to frontend/public/assets and backend/static/assets")
