import os
code = """
import json
from pydantic import BaseModel

class PosterDataRequest(BaseModel):
    event_details: str
    style: str

@app.post('/api/ai/generate-poster-content')
async def generate_poster_content(
    req: PosterDataRequest,
    current_user: schemas.User = Depends(get_current_user)
):
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail='Gemini API is not configured.')
    client = genai.Client(api_key=api_key)
    prompt = f"You are a professional poster designer. Extract and format the provided event details into concise strings suitable for a {req.style} style poster.\\n\\nEvent details:\\n{req.event_details}\\n\\nReturn a clean JSON object containing:\\n- title (Keep it exactly as given but formatted nicely)\\n- tagline (A short punchy subtitle or phrase)\\n- date_time (e.g. 'Oct 24, 2026 | 9:00 AM')\\n- venue (Shortened venue, max 4 words)\\n- contact_website (The most prominent link or contact info)\\n- theme_colors (An array of 2 hex codes fitting the {req.style} style)\\n- sponsor_text (Short string for sponsors if any, otherwise empty string)"
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_mime_type='application/json',
                temperature=0.7
            )
        )
        return json.loads(response.text)
    except Exception as e:
        logger.error(f'AI Poster error: {e}')
        raise HTTPException(status_code=500, detail='AI Poster generation failed.')

@app.post('/api/events/{event_id}/poster')
async def upload_poster(
    event_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event or db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail='Not authorized')
    import uuid
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'png'
    unique_filename = f'{event_id}_{uuid.uuid4().hex}.{file_ext}'
    file_path = f'static/posters/{unique_filename}'
    with open(file_path, 'wb') as f:
        f.write(await file.read())
    db_event.poster_url = f'http://localhost:8000/{file_path}'
    db.commit()
    return {'poster_url': db_event.poster_url}
"""
with open("app/main.py", "a") as f:
    f.write(code)
