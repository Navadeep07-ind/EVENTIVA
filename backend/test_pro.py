import os
from google import genai
from google.genai import types

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

for model in ["gemini-pro-latest", "gemini-3.5-flash"]:
    print(f"Testing {model}...")
    try:
        response = client.models.generate_content(
            model=model,
            contents="Write exactly 300 words describing a hackathon.",
            config=types.GenerateContentConfig(
                max_output_tokens=2000
            )
        )
        print("Finish Reason:", response.candidates[0].finish_reason)
        print("Text length:", len(response.text.split()), "words")
        print(response.text[:100] + "...")
    except Exception as e:
        print("Failed:", e)
