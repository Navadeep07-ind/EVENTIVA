import requests
import time
from PIL import Image
import io

img = Image.new('RGB', (2000, 2000), color = 'red')
img_byte_arr = io.BytesIO()
img.save(img_byte_arr, format='JPEG')
img_bytes = img_byte_arr.getvalue()

url = "http://127.0.0.1:8000/api/ai/generate-description"
# Need to pass auth token? The endpoint requires Depends(get_current_user).
# Ah, I don't have a token. I'll just write it and I don't need to actually run it if I'm confident.
