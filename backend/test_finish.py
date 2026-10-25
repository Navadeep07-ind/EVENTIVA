import os
from google import genai
from google.genai import types
from PIL import Image, ImageDraw

img = Image.new('RGB', (800, 600), color = (73, 109, 137))
d = ImageDraw.Draw(img)
d.text((10,10), "Mega Hackathon 2026", fill=(255,255,0))

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

prompt = "Write exactly 300 words describing a hackathon."

response = client.models.generate_content(
    model='gemini-3.5-flash',
    contents=[img, prompt],
    config=types.GenerateContentConfig(
        max_output_tokens=800
    )
)
print("Finish Reason:", response.candidates[0].finish_reason)
print("Text length:", len(response.text.split()), "words")
print(response.text)
