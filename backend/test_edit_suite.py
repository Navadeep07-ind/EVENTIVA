import requests
import json

test_prompts = [
    "arrange texts",
    "center the event title",
    "move the date and venue into a single aligned section",
    "make the poster more professional",
    "increase the spacing between the title and description",
    "use the lower half of the poster more effectively",
    "undo the last change",
    "change the background to dark cosmic space without moving any text"
]

canvas_state = {
    "canvasConfig": {"width": 800, "height": 1131, "bgColor": "#030712"},
    "layers": [
        {"id": "l-title", "name": "Main Event Title", "type": "text", "text": "TECHNOVATION 2026", "fontSize": 78, "x": 400, "y": 220},
        {"id": "l-desc", "name": "Event Description", "type": "text", "text": "The Ultimate Hackathon", "fontSize": 16, "x": 400, "y": 280},
        {"id": "l-date", "name": "Date Info", "type": "text", "text": "📅 Date: Nov 15, 2026", "fontSize": 15, "x": 215, "y": 350},
        {"id": "l-venue", "name": "Venue Info", "type": "text", "text": "📍 Venue: Main Arena", "fontSize": 15, "x": 585, "y": 350}
    ]
}

for p in test_prompts:
    res = requests.post("http://localhost:8000/api/ai/edit-poster", json={
        "prompt": p,
        "current_state": canvas_state,
        "selected_id": "l-title" if "title" in p else None
    })
    status = res.status_code
    data = res.json() if status == 200 else res.text
    print(f"PROMPT: \"{p}\" -> STATUS: {status}")
    if status == 200:
        msg = data.get("message", "")
        print(f"  MSG: {msg[:80]}...")
        muts = data.get("mutations", [])
        print(f"  MUTATIONS COUNT: {len(muts)}")
        if muts:
            print(f"  SAMPLE MUTATION: {muts[0]}")
    else:
        print(f"  ERROR: {data}")
    print("-" * 50)
