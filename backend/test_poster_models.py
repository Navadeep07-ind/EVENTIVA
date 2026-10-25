import os
import time
from google import genai
from google.genai import types
from PIL import Image, ImageDraw

img = Image.new('RGB', (800, 600), color = (73, 109, 137))
d = ImageDraw.Draw(img)
d.text((10,10), "Mega Hackathon 2026", fill=(255,255,0))
d.text((10,50), "Date: Oct 20-22, 2026", fill=(255,255,255))
d.text((10,90), "Venue: San Francisco", fill=(255,255,255))
d.text((10,130), "Join us for 48 hours of coding, pizza, and prizes!", fill=(255,255,255))

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

prompt = """
You are an expert event information extraction and event-description writing assistant for EVENTIVA.

Carefully inspect the entire uploaded event poster.

FIRST, identify all clearly visible and relevant information:
- Official event name and event type
- Organizing institution or organization
- Event date and time
- Venue or online platform
- Main activities, sessions, competitions, or highlights
- Target audience and eligibility
- Registration process and deadline
- Registration fees, prizes, or benefits
- Website, email, phone number, and other contact information
- Any other important information explicitly shown on the poster

SECOND, write a complete, engaging, professional event description based on the extracted information.

The description must explain what the event is, who should attend, what participants can expect, and the important practical details available on the poster.

Write approximately 150–220 words when sufficient information is available.
If the poster contains less information, write a shorter but complete description without inventing details.

Preserve exact names, dates, fees, venue details, and URLs whenever readable.
Do not invent information that is missing or unclear.
Do not return only keywords, a title, a summary fragment, or a list of four words.

Return the complete event description as plain text.
Do not include your analysis or introductory commentary.
"""

for model in ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-3.8-flash']:
    print(f"--- Testing {model} ---")
    try:
        response = client.models.generate_content(
            model=model,
            contents=[img, prompt],
            config=types.GenerateContentConfig(
                temperature=0.4,
                max_output_tokens=800
            )
        )
        print("Length:", len(response.text.split()), "words")
        print("Response:", response.text[:200])
    except Exception as e:
        print("Failed:", e)
