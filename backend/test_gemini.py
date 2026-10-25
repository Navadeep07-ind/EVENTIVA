import os
import sys
import httpx
import time

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("NO API KEY")
    sys.exit(1)

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={api_key}"
payload = {
    "contents": [{"parts": [{"text": "Hello!"}]}]
}
print("Sending raw request...")
t0 = time.time()
try:
    response = httpx.post(url, json=payload, timeout=20.0)
    print(f"Time taken: {time.time()-t0:.2f}s")
    print("Status:", response.status_code)
    print("Response:", response.text[:200])
except Exception as e:
    print("Error:", e)
