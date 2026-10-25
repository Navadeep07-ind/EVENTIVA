import os
from google import genai
from google.genai import types

try:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        with open(".env", "r") as f:
            for line in f:
                if line.startswith("GEMINI_API_KEY="):
                    api_key = line.split("=")[1].strip().strip('"').strip("'")
                    
    client = genai.Client(api_key=api_key)
    result = client.models.generate_content(
        model='gemini-3.5-flash',
        contents='Extract JSON from this event: Hackathon on Oct 24',
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )
    print("Success")
    print(result.text)
    
except Exception as e:
    print(f"Error: {e}")
