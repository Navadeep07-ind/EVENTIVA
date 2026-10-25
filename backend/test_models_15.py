import os
import httpx

api_key = os.getenv("GEMINI_API_KEY")
url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
res = httpx.get(url, timeout=10.0)
models = res.json()
print("All available models containing '1.5' or '1.0' or '2.0':")
for m in models.get("models", []):
    name = m.get("name", "")
    if "1.5" in name or "1.0" in name or "2.0" in name:
        print(" -", name)
