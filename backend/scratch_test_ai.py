import os
import json
from dotenv import load_dotenv
load_dotenv()
from google import genai
from google.genai import types

api_key = os.getenv('GEMINI_API_KEY')
print("API KEY:", api_key[:10] if api_key else "None")

client = genai.Client(api_key=api_key)

layers_summary = [
    {"id": "l-1", "name": "Institution Name", "type": "text", "text": "TKR COLLEGE OF ENGINEERING AND TECHNOLOGY", "x": 400, "y": 44, "fontSize": 18},
    {"id": "l-2", "name": "Department", "type": "text", "text": "DEPARTMENT OF CSE", "x": 400, "y": 70, "fontSize": 12},
    {"id": "l-3", "name": "Event Title", "type": "text", "text": "NOVENTRIX", "x": 400, "y": 320, "fontSize": 72},
    {"id": "l-4", "name": "Subtitle", "type": "text", "text": "2K26", "x": 400, "y": 410, "fontSize": 24},
    {"id": "l-5", "name": "Description", "type": "text", "text": "Fostering innovation and creativity.", "x": 400, "y": 470, "fontSize": 16},
    {"id": "l-6", "name": "Tagline", "type": "text", "text": "Ideas. Design. Build. Innovate.", "x": 200, "y": 700, "fontSize": 22},
    {"id": "l-7", "name": "Date & Time", "type": "text", "text": "DATE: 30th September 2026", "x": 250, "y": 750, "fontSize": 18},
    {"id": "l-8", "name": "Venue", "type": "text", "text": "VENUE: K9 Auditorium", "x": 600, "y": 750, "fontSize": 18},
    {"id": "l-9", "name": "Footer", "type": "text", "text": "mindsparks@tkrcet.com", "x": 400, "y": 920, "fontSize": 12}
]

prompt = f"""You are an expert AI Design Assistant editing an interactive, layer-based poster canvas.

USER INSTRUCTION: "arrange texts"
CURRENT SELECTED ELEMENT ID: "None"
CONVERSATION HISTORY: []

CURRENT CANVAS CONFIGURATION:
{{"width": 800, "height": 1131}}

CURRENT LAYERS LIST:
{json.dumps(layers_summary, indent=2)}

CRITICAL RULES:
1. TARGET RESOLUTION: Target existing element IDs from the layer list above.
2. PRESERVE UNRELATED CONTENT: Do NOT modify or regenerate unrelated text, dates, venues, titles, or logos unless explicitly requested.
3. PRESERVE ACCURACY: Never invent official logos, college names, or accreditation badges.
4. OPERATION TYPES TO USE:
   - "update_position": {{ "action": "update_position", "target_id": "<id>", "x": <number>, "y": <number> }}
   - "update_font_size": {{ "action": "update_font_size", "target_id": "<id>", "fontSize": <number> }}
   - "update_layout": {{ "action": "update_position", "target_id": "<id>", "x": <number>, "y": <number> }}

Return a STRICT JSON object:
{{
  "message": "Clear explanation of the changes made.",
  "mutations": [
    ... operations
  ]
}}
Respond ONLY with valid JSON.
"""

for model_name in ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.5-flash-lite']:
    try:
        print(f"\n--- Testing model: {model_name} ---")
        response = client.models.generate_content(
            model=model_name,
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_mime_type='application/json',
                temperature=0.3
            )
        )
        print("Success! Response len:", len(response.text))
        parsed = json.loads(response.text)
        print("Message:", parsed.get("message"))
        print("Mutations count:", len(parsed.get("mutations", [])))
        for m in parsed.get("mutations", [])[:4]:
            print("  ", m)
    except Exception as e:
        print(f"FAILED on {model_name}:", e)
