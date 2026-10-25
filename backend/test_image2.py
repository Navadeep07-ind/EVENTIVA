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
        model='gemini-3.1-flash-image',
        contents=['A futuristic city poster'],
    )
    # The output is returned as inline_data or directly accessible?
    print(result.text) # It might print base64 or throw error
    if result.candidates and result.candidates[0].content.parts:
        part = result.candidates[0].content.parts[0]
        if part.inline_data:
            print("Got image bytes! Length:", len(part.inline_data.data))
except Exception as e:
    print(f"Error: {e}")
