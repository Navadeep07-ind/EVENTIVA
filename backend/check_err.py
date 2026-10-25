import os
from google import genai
from google.genai import errors

client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
models_to_test = ['gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite']

for m in models_to_test:
    try:
        resp = client.models.generate_content(model=m, contents='hello')
        print(f"SUCCESS with {m}")
    except Exception as e:
        print(f"FAILED with {m}: {repr(e)}")
