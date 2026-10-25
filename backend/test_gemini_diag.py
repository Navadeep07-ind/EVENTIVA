import os
import sys
import time
import httpx
from google import genai

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("NO API KEY")
    sys.exit(1)

print("Testing raw HTTP GET to models list to verify connectivity...")
try:
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    t0 = time.time()
    res = httpx.get(url, timeout=10.0)
    print(f"Models list fetched in {time.time()-t0:.2f}s. Status: {res.status_code}")
    if res.status_code != 200:
        print("Error response:", res.text[:200])
except Exception as e:
    print("Failed GET to models list:", e)

print("\nTesting google-genai SDK for text generation...")
try:
    client = genai.Client(api_key=api_key)
    t0 = time.time()
    response = client.models.generate_content(
        model='gemini-3.8-flash',
        contents="Hello! Reply with exactly one word: OK."
    )
    print(f"Text generation completed in {time.time()-t0:.2f}s.")
    print("Response:", response.text)
except Exception as e:
    print("Failed text generation:", e)
