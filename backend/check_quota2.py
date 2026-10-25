import os
import requests
import json

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    with open(".env", "r") as f:
        for line in f:
            if line.startswith("GEMINI_API_KEY="):
                api_key = line.split("=")[1].strip().strip('"').strip("'")

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
response = requests.get(url)
models = response.json().get('models', [])
print("Models available:")
for m in models:
    name = m['name'].split('/')[-1]
    if 'flash' in name or 'pro' in name:
        print(f"{name}")
