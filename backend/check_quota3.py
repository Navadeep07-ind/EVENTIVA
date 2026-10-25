import os
import requests
import json

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    with open(".env", "r") as f:
        for line in f:
            if line.startswith("GEMINI_API_KEY="):
                api_key = line.split("=")[1].strip().strip('"').strip("'")

def test_model(model):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {"contents": [{"parts": [{"text": "Hello"}]}]}
    headers = {'Content-Type': 'application/json'}
    response = requests.post(url, json=payload, headers=headers)
    print(f"{model} Status:", response.status_code)
    if response.status_code != 200:
        print(response.json())

test_model("gemini-2.5-flash")
test_model("gemini-flash-latest")
test_model("gemini-pro-latest")
