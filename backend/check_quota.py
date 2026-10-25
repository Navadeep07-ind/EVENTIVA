import os
import requests
import json

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    with open(".env", "r") as f:
        for line in f:
            if line.startswith("GEMINI_API_KEY="):
                api_key = line.split("=")[1].strip().strip('"').strip("'")

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}"
payload = {
    "contents": [{"parts": [{"text": "Hello"}]}]
}
headers = {'Content-Type': 'application/json'}

response = requests.post(url, json=payload, headers=headers)
print("Status:", response.status_code)
print("Response:", json.dumps(response.json(), indent=2))
