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
    result = client.models.generate_images(
        model='gemini-3.1-flash-image',
        prompt='A futuristic city',
        config=types.GenerateImagesConfig(
            number_of_images=1,
            output_mime_type="image/jpeg",
            aspect_ratio="3:4"
        )
    )
    for i, img in enumerate(result.generated_images):
        print(f"Generated image {i}, len: {len(img.image.image_bytes)}")
except Exception as e:
    print(f"Error: {e}")
