import sys

with open('backend/app/main.py', 'r') as f:
    content = f.read()

old_part = """  Return a STRICT JSON object matching this schema EXACTLY:
{{
  "message": "A short, friendly response describing what you did.",
  "mutations": [
    {{ "action": "update_layer", "target_id": "l-...", "updates": {{ "fontSize": 80, "color": "#FFD700" }} }},
    {{ "action": "update_canvas", "updates": {{ "bgImage": "...", "brightness": 80 }} }},
    {{ "action": "delete_layer", "target_id": "l-..." }}
  ]
}}

Guidelines for updates:
- Text styling: Use standard CSS (e.g., color, fontSize, fontFamily, textAlign).
- NEVER change the layer `id`.
- If requested to change background, update_canvas with a high-quality Unsplash image url in `bgImage`.
- Do not fabricate missing information.
Respond ONLY with the JSON object."""

new_part = """  Return a STRICT JSON object matching this schema EXACTLY:
{{
  "message": "A short, friendly response describing what you did.",
  "mutations": [
    {{ "action": "update_layer", "target_id": "l-...", "updates": {{ "fontSize": 80, "color": "#FFD700" }} }},
    {{ "action": "update_canvas", "updates": {{ "bgImage": "...", "brightness": 80 }} }},
    {{ "action": "delete_layer", "target_id": "l-..." }},
    {{ "action": "add_layer", "layer": {{ "id": "l-new", "type": "text", "text": "NEW TEXT", "x": 400, "y": 400, "fontSize": 50, "color": "#ffffff", "zIndex": 100 }} }},
    {{ "action": "undo" }},
    {{ "action": "redo" }}
  ]
}}

Guidelines for updates:
- Text styling: Use standard CSS (e.g., color, fontSize, fontFamily, textAlign).
- NEVER change the layer `id`.
- If requested to change background, update_canvas with a high-quality Unsplash image url in `bgImage`.
- If the user explicitly asks to "undo", "revert", or "go back", return ONLY the "undo" action.
- If the user explicitly asks to "redo", return ONLY the "redo" action.
- Do not fabricate missing information.
Respond ONLY with the JSON object."""

if old_part in content:
    with open('backend/app/main.py', 'w') as f:
        f.write(content.replace(old_part, new_part))
    print('Replaced successfully')
else:
    print('Pattern not found. Checking if already replaced...')
    if new_part in content:
        print('Already replaced')
    else:
        print('NOT FOUND AT ALL')
