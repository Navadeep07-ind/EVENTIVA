import os
from google import genai
import sys

try:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        with open(".env", "r") as f:
            for line in f:
                if line.startswith("GEMINI_API_KEY="):
                    api_key = line.split("=")[1].strip().strip('"').strip("'")
                    
    client = genai.Client(api_key=api_key)
    for m in client.models.list():
        print(f"{m.name}")
except Exception as e:
    print(f"Error: {e}")
