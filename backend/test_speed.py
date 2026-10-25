import os
import sys
import time
from google import genai

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

models_to_test = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.8-flash", "gemini-omni-1.1-flash"]

for model in models_to_test:
    print(f"Testing {model}...")
    try:
        t0 = time.time()
        response = client.models.generate_content(
            model=model,
            contents="Say OK."
        )
        print(f"  -> {time.time()-t0:.2f}s | Response: {response.text}")
    except Exception as e:
        print(f"  -> Failed: {e}")
