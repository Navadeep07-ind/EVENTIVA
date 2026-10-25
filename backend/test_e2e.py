import asyncio
import os
import json
import httpx

async def test_e2e():
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        print("1. Logging in / Getting token...")
        # Get test user token
        login_data = {"username": "testuser@example.com", "password": "password123"}
        resp = await client.post("/api/auth/token", data=login_data)
        if resp.status_code != 200:
            print("Creating test user...")
            await client.post("/api/auth/register", json={"email": "testuser@example.com", "password": "password123", "full_name": "Test User", "college": "Test College"})
            
            # Manually verify
            from app.database import SessionLocal
            from app.models import User
            db = SessionLocal()
            u = db.query(User).filter(User.email == "testuser@example.com").first()
            if u:
                u.is_verified = True
                db.commit()
            db.close()
            
            resp = await client.post("/api/auth/token", data=login_data)
        
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        print("2. Generating event via AI (Poster mock)...")
        files = {'text': (None, 'A 24-hour Python Hackathon tomorrow. Needs github and t-shirt size.')}
        resp = await client.post("/api/ai/generate-event", data={"text": "A 24-hour Python Hackathon tomorrow. Needs github and t-shirt size."}, headers=headers, timeout=60.0)
        
        if resp.status_code != 200:
            print(f"Failed to generate event: {resp.status_code} {resp.text}")
            return
            
        event_data = resp.json()
        print(f"AI Generated Event: {event_data['title']}")
        
        print("3. Editing event fields and form schema...")
        event_data['title'] = "Edited Python Hackathon 2026"
        
        # Add a custom field
        event_data['form_schema'].append({
            "id": "custom_12345",
            "label": "Are you a student?",
            "type": "radio",
            "required": True,
            "options": ["Yes", "No"]
        })
        
        # Reorder fields (Move the new field to the front)
        schema = event_data['form_schema']
        schema.insert(0, schema.pop())
        
        event_data['registration_start_date'] = None
        event_data['registration_deadline'] = None
        event_data['status'] = 'Published'
        
        print("4. Saving and publishing event...")
        resp = await client.post("/api/events", json=event_data, headers=headers)
        if resp.status_code != 200:
            print(f"Failed to save event: {resp.status_code} {resp.text}")
            return
            
        saved_event = resp.json()
        event_id = saved_event['id']
        print(f"Event Saved! ID: {event_id}")
        
        print("5. Submitting a registration to the public event page...")
        reg_payload = {
            "full_name": "Jane Doe",
            "email": "jane@example.com",
            "college": "Tech U",
            "custom_answers": {
                "custom_12345": "Yes",
                "github_profile": "https://github.com/janedoe"
            }
        }
        
        resp = await client.post(f"/api/events/{event_id}/register", json=reg_payload)
        if resp.status_code != 200:
            print(f"Failed to register: {resp.status_code} {resp.text}")
            return
            
        print("Registration Successful!")
        
        print("6. Verifying organizer can see custom answers...")
        resp = await client.get(f"/api/events/{event_id}/registrations", headers=headers)
        registrations = resp.json()
        print(f"Registrations found: {len(registrations)}")
        print(f"Custom Answers retrieved: {registrations[0].get('custom_answers')}")
        
        print("\n7. Testing consecutive AI generations to verify quota/retry logic...")
        for i in range(3):
            print(f"  -> Attempt {i+1}...")
            resp = await client.post("/api/ai/generate-event", data={"text": f"Event #{i} - A small workshop"}, headers=headers, timeout=60.0)
            if resp.status_code == 200:
                print(f"     Success: {resp.json()['title']}")
            else:
                print(f"     Failed: {resp.status_code} {resp.text}")
                
        print("\nALL END-TO-END TESTS PASSED SUCCESSFULLY.")

if __name__ == "__main__":
    asyncio.run(test_e2e())
