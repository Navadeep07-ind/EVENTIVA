import requests
import io
import json
from PIL import Image, ImageDraw

from app.database import SessionLocal
from app import models, crud
from app.core.security import get_password_hash, create_access_token

BASE_URL = "http://127.0.0.1:8000"

def setup_test_users():
    db = SessionLocal()
    try:
        # Create or update organizer A
        user_a = db.query(models.User).filter(models.User.email == "organizer_a@eventiva.test").first()
        if not user_a:
            user_a = models.User(
                email="organizer_a@eventiva.test",
                full_name="Organizer Alpha",
                hashed_password=get_password_hash("Password123!"),
                is_verified=True
            )
            db.add(user_a)
        else:
            user_a.is_verified = True

        # Create or update organizer B
        user_b = db.query(models.User).filter(models.User.email == "organizer_b@eventiva.test").first()
        if not user_b:
            user_b = models.User(
                email="organizer_b@eventiva.test",
                full_name="Organizer Beta",
                hashed_password=get_password_hash("Password123!"),
                is_verified=True
            )
            db.add(user_b)
        else:
            user_b.is_verified = True

        db.commit()
        db.refresh(user_a)
        db.refresh(user_b)
        return user_a.id, user_b.id
    finally:
        db.close()

def run_tests():
    print("==================================================")
    print("EVENTIVA POSTER STUDIO WORKFLOW TEST SUITE")
    print("==================================================")

    # 0. Setup: Ensure verified test users exist
    uid_a, uid_b = setup_test_users()

    token_a = create_access_token({"sub": "organizer_a@eventiva.test"})
    token_b = create_access_token({"sub": "organizer_b@eventiva.test"})
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    print(f"[PASS] Test users verified: User A (ID: {uid_a}), User B (ID: {uid_b})")

    # TEST 1: Create an event without uploading a poster
    evt1_data = {
        "title": "National Science Conclave 2026",
        "description": "Annual Science symposium for researchers and students",
        "category": "Academic",
        "venue": "CV Raman Auditorium",
        "min_team_size": 1,
        "max_team_size": 1,
        "status": "Published"
    }
    res = requests.post(f"{BASE_URL}/api/events", json=evt1_data, headers=headers_a)
    assert res.status_code == 200, f"Event creation failed: {res.text}"
    evt1 = res.json()
    assert evt1["poster_url"] is None, "Poster URL should be None when skipped"
    print(f"[TEST 1 PASS] Event created without poster (ID: {evt1['id']}). Poster is properly optional.")

    # TEST 2: Generate a poster with AI
    ai_gen_req = {
        "event_details": "National Science Conclave 2026 - Academic Symposium",
        "style": "Modern Corporate Summit, Executive Navy Slate, Clean"
    }
    res = requests.post(f"{BASE_URL}/api/ai/generate-poster-content", json=ai_gen_req)
    assert res.status_code == 200, f"AI poster generation failed: {res.text}"
    gen_data = res.json()
    assert "title" in gen_data, "AI generation must return title"
    print(f"[TEST 2 PASS] AI poster content generation returned title: '{gen_data['title']}', category: '{gen_data.get('event_category')}'.")

    # TEST 3: Select a template / branding kit
    res = requests.get(f"{BASE_URL}/api/branding-kits")
    assert res.status_code == 200, f"Fetch kits failed: {res.text}"
    kits = res.json()
    assert len(kits) > 0, "Branding kits list should not be empty"
    selected_kit = kits[0]
    print(f"[TEST 3 PASS] Branding kit retrieved: {selected_kit['name']} (short: {selected_kit.get('short_name')})")

    # TEST 4: Upload a PNG poster
    png_buf = io.BytesIO()
    img_png = Image.new('RGB', (800, 1131), color=(15, 23, 42))
    d = ImageDraw.Draw(img_png)
    d.text((40, 40), "PNG POSTER TEST", fill=(255, 255, 255))
    img_png.save(png_buf, format='PNG')
    png_buf.seek(0)

    res = requests.post(
        f"{BASE_URL}/api/posters/upload-image",
        files={"file": ("test_poster.png", png_buf, "image/png")}
    )
    assert res.status_code == 200, f"PNG upload failed: {res.text}"
    png_upload = res.json()
    assert png_upload["url"].startswith("/static/posters/"), "URL must be relative static path"
    assert png_upload["width"] == 800 and png_upload["height"] == 1131, "Dimensions must match uploaded PNG"
    print(f"[TEST 4 PASS] PNG poster uploaded successfully. Dimensions: {png_upload['width']}x{png_upload['height']}, URL: {png_upload['url']}")

    # TEST 5: Upload a JPG poster
    jpg_buf = io.BytesIO()
    img_jpg = Image.new('RGB', (1080, 1080), color=(30, 58, 138))
    img_jpg.save(jpg_buf, format='JPEG')
    jpg_buf.seek(0)

    res = requests.post(
        f"{BASE_URL}/api/posters/upload-image",
        files={"file": ("square_banner.jpg", jpg_buf, "image/jpeg")}
    )
    assert res.status_code == 200, f"JPG upload failed: {res.text}"
    jpg_upload = res.json()
    assert jpg_upload["width"] == 1080 and jpg_upload["height"] == 1080, "Square JPG dimensions detected"
    assert jpg_upload["aspect_ratio"] == 1.0, "Aspect ratio must be 1.0"
    print(f"[TEST 5 PASS] JPG poster uploaded successfully. Dimensions: {jpg_upload['width']}x{jpg_upload['height']}, Aspect Ratio: {jpg_upload['aspect_ratio']}")

    # TEST 6: Preview and save an uploaded poster without editing
    evt2_data = {
        "title": "Hackathon 2026",
        "description": "National Hackathon",
        "category": "Technology",
        "poster_url": png_upload["url"],
        "status": "Published"
    }
    res = requests.post(f"{BASE_URL}/api/events", json=evt2_data, headers=headers_a)
    assert res.status_code == 200, f"Event creation with poster failed: {res.text}"
    evt2 = res.json()
    assert evt2["poster_url"] == png_upload["url"], "Uploaded poster must be preserved directly"
    print(f"[TEST 6 PASS] Saved uploaded poster directly without editing or AI regeneration for event ID {evt2['id']}.")

    # TEST 7: Add text and border to an uploaded poster
    edited_poster_buf = io.BytesIO()
    img_edited = Image.new('RGB', (800, 1131), color=(20, 20, 20))
    img_edited.save(edited_poster_buf, format='PNG')
    edited_poster_buf.seek(0)

    layers_state = [
        {"id": "l-1", "name": "Event Title", "text": "HACKATHON 2026", "fontSize": 54, "x": 400, "y": 250},
        {"id": "l-2", "name": "Date & Venue Card", "text": "OCTOBER 24-26 • AUDITORIUM", "hasBox": True, "fontSize": 20, "x": 400, "y": 750}
    ]
    canvas_config = {
        "width": 800,
        "height": 1131,
        "hasBorder": True,
        "borderWidth": 4,
        "borderColor": "#f59e0b",
        "bgImage": png_upload["url"]
    }
    poster_data_json = json.dumps({"layers": layers_state, "canvasConfig": canvas_config})

    res = requests.post(
        f"{BASE_URL}/api/events/{evt2['id']}/poster",
        files={"file": ("poster_rendered.png", edited_poster_buf, "image/png")},
        data={"poster_data": poster_data_json},
        headers=headers_a
    )
    assert res.status_code == 200, f"Save poster failed: {res.text}"
    print(f"[TEST 7 PASS] Text overlay and border saved on uploaded poster for event ID {evt2['id']}.")

    # TEST 8: Replace an uploaded poster with another image
    res = requests.put(
        f"{BASE_URL}/api/events/{evt2['id']}",
        json={"poster_url": jpg_upload["url"]},
        headers=headers_a
    )
    assert res.status_code == 200, f"Replace poster failed: {res.text}"
    updated_evt2 = res.json()
    assert updated_evt2["poster_url"] == jpg_upload["url"], "Poster must be replaced with new URL"
    print(f"[TEST 8 PASS] Poster replaced with new image ({jpg_upload['url']}).")

    # TEST 9: Reopen the event and verify its poster and saved state
    res = requests.get(f"{BASE_URL}/api/events/{evt2['id']}")
    assert res.status_code == 200, f"Get event failed: {res.text}"
    fetched_evt = res.json()
    assert fetched_evt["poster_url"] == jpg_upload["url"]
    print(f"[TEST 9 PASS] Reopened event {evt2['id']}, poster properly linked: {fetched_evt['poster_url']}.")

    # TEST 10: Export final poster / download verification
    poster_file_res = requests.get(f"{BASE_URL}{jpg_upload['url']}")
    assert poster_file_res.status_code == 200, "Poster image must be accessible over HTTP"
    assert len(poster_file_res.content) > 0, "Poster content must be non-empty"
    print(f"[TEST 10 PASS] Final poster image successfully fetched over HTTP. Size: {len(poster_file_res.content)} bytes.")

    # TEST 11: Verify that posters remain isolated between different events
    evt3_data = {
        "title": "Medical Symposium 2026",
        "description": "Healthcare Innovation",
        "category": "Medical",
        "poster_url": png_upload["url"],
        "status": "Published"
    }
    res = requests.post(f"{BASE_URL}/api/events", json=evt3_data, headers=headers_a)
    evt3 = res.json()

    # Changing evt3 poster must NOT change evt2 poster
    requests.put(f"{BASE_URL}/api/events/{evt3['id']}", json={"poster_url": "/static/posters/different_med.png"}, headers=headers_a)
    
    check_evt2 = requests.get(f"{BASE_URL}/api/events/{evt2['id']}").json()
    check_evt3 = requests.get(f"{BASE_URL}/api/events/{evt3['id']}").json()
    assert check_evt2["poster_url"] != check_evt3["poster_url"], "Posters must remain isolated between different events"
    print(f"[TEST 11 PASS] Poster isolation confirmed: Event {evt2['id']} ({check_evt2['poster_url']}) != Event {evt3['id']} ({check_evt3['poster_url']}).")

    # TEST 12: Verify that unauthorized users cannot modify another organizer's poster
    unauthorized_res = requests.post(
        f"{BASE_URL}/api/events/{evt2['id']}/poster",
        files={"file": ("hacked.png", edited_poster_buf, "image/png")},
        data={"poster_data": "{}"},
        headers=headers_b # Organizer B trying to modify Organizer A's event!
    )
    assert unauthorized_res.status_code == 403, f"Expected 403 Forbidden, got {unauthorized_res.status_code}"
    print(f"[TEST 12 PASS] Authorization check verified: User B received 403 Forbidden when attempting to modify User A's poster.")

    print("\n==================================================")
    print("ALL 12/12 TESTS PASSED PERFECTLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
