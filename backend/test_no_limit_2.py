import os
from google import genai
from google.genai import types

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

print(f"Testing gemini-3.5-flash WITHOUT max_output_tokens...")
try:
    response = client.models.generate_content(
        model='gemini-3.5-flash',
        contents="Write a highly detailed, 300 word description of an event.",
        config=types.GenerateContentConfig(
            temperature=0.4
        )
    )
    print("Finish Reason:", response.candidates[0].finish_reason)
    print("Text length:", len(response.text.split()), "words")
    print(response.text[-100:]) 
except Exception as e:
    print("Failed:", e)
