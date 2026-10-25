import os
from google import genai
from google.genai import types

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

for model in ["gemini-3.5-flash", "gemini-3.7-flash"]:
    print(f"Testing {model} without max_output_tokens...")
    try:
        response = client.models.generate_content(
            model=model,
            contents="Write exactly 300 words describing a hackathon.",
            config=types.GenerateContentConfig(
                temperature=0.4
                # No max_output_tokens
            )
        )
        print("Finish Reason:", response.candidates[0].finish_reason)
        print("Text length:", len(response.text.split()), "words")
        print(response.text[-100:]) # print end of string
    except Exception as e:
        print("Failed:", e)
