import os
import sys
import httpx

api_key = os.getenv("GEMINI_API_KEY")
url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
res = httpx.get(url, timeout=10.0)
models = res.json()
print("Available models:")
for m in models.get("models", []):
    name = m.get("name", "")
    if "flash" in name.lower() or "gemini" in name.lower():
        print(" -", name)
