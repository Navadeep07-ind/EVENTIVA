import os
import sys
import time
from google import genai
from google.genai import types
from PIL import Image, ImageDraw

# Create image
img = Image.new('RGB', (800, 600), color = (73, 109, 137))
d = ImageDraw.Draw(img)
d.text((10,10), "Mega Hackathon 2026", fill=(255,255,0))
d.text((10,50), "Date: Oct 20-22, 2026", fill=(255,255,255))
d.text((10,90), "Venue: San Francisco", fill=(255,255,255))
d.text((10,130), "Join us for 48 hours of coding, pizza, and prizes!", fill=(255,255,255))

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

prompt = """
You are an expert event copywriter. Analyze the uploaded event poster or document and write a highly professional, engaging event description of exactly 100 to 150 words.

If the poster only contains a few words (like just an event name), you MUST still write a full 100-150 word description. Creatively expand on the title and category to make it sound exciting and welcoming for attendees, while using placeholders like 'TBA' for missing specific dates, times, or venues.

Please format your response in beautiful Markdown, including:
### 🌟 About the Event
### ✨ Key Highlights
### 📅 Important Details

Return ONLY the final event description.
"""

print("Sending request to gemini-3.6-flash...")
try:
    response = client.models.generate_content(
        model='gemini-3.6-flash',
        contents=[img, prompt],
        config=types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=300
        )
    )
    print("Response text length:", len(response.text.split()), "words")
    print("Response:")
    print(response.text)
except Exception as e:
    print("Failed:", e)
