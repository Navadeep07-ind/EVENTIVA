import os
import sys
import time
import httpx

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("NO API KEY")
    sys.exit(1)

print("Testing raw HTTP POST to generateContent...")
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={api_key}"
payload = {
    "contents": [{"parts": [{"text": "Hello!"}]}]
}
try:
    t0 = time.time()
    res = httpx.post(url, json=payload, timeout=30.0)
    print(f"POST completed in {time.time()-t0:.2f}s. Status: {res.status_code}")
    print("Response:", res.text[:200])
except Exception as e:
    print("Failed POST to generateContent:", e)
