import asyncio
import os
import json
from google import genai
from google.genai import types

async def test():
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)
    
    prompt = """
You are EVENTIVA's AI Event Creation Assistant.
Analyze the provided text and/or poster to generate a complete event configuration.
Never invent missing official information (dates, venue, prices). If unknown, leave as null.

Generate a JSON object with the following schema:
{
  "title": "String",
  "description": "String (Markdown formatted, approx 150 words)",
  "category": "String (e.g. Hackathon, Workshop, Seminar, Cultural)",
  "venue": "String or null",
  "start_time": "ISO8601 datetime string or null",
  "end_time": "ISO8601 datetime string or null",
  "registration_start_date": "ISO8601 datetime string or null",
  "registration_deadline": "ISO8601 datetime string or null",
  "max_participants": "Integer or null",
  "min_team_size": "Integer (default 1)",
  "max_team_size": "Integer (default 1)",
  "form_schema": [
    {
      "id": "string (unique snake_case identifier)",
      "label": "string (human readable)",
      "type": "string (text, longtext, email, phone, dropdown, multiselect, radio, checkbox, number, date, file, url)",
      "required": boolean,
      "options": ["array", "of", "strings", "if", "applicable"]
    }
  ]
}

For form_schema, always include standard questions based on the event type (e.g. GitHub URL for hackathons, Dietary Restrictions if food is provided).
Return ONLY the raw JSON object, without markdown blocks.
"""
    
    contents_payload = ["A 48-hour Web3 hackathon called ChainCraft next weekend in the main auditorium. Max 200 participants, teams of 2 to 4. We need to ask for their GitHub profile and dietary restrictions.", prompt]
    
    from tenacity import AsyncRetrying, stop_after_attempt, wait_exponential
    
    try:
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(5),
            wait=wait_exponential(multiplier=1, min=2, max=10)
        ):
            with attempt:
                response = await client.aio.models.generate_content(
                    model='gemini-3.8-flash',
                    contents=contents_payload,
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                        response_mime_type="application/json"
                    )
                )
    except Exception as e:
        print(f"FAILED COMPLETELY: {e}")
        return
    
    try:
        data = json.loads(response.text)
        print("SUCCESS! Data:")
        print(json.dumps(data, indent=2))
    except Exception as e:
        print("FAILED TO PARSE JSON!")
        print(response.text)

if __name__ == "__main__":
    asyncio.run(test())
