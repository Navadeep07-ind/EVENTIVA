import asyncio
import httpx
import os

async def run_poster_tests():
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Get token
        print("Logging in...")
        resp = await client.post("/api/auth/token", data={"username": "testuser@example.com", "password": "password123"})
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test 1: Generate poster JSON content
        print("Testing AI Poster Generation...")
        event_details = "An epic 24-hour hackathon for Python devs at Tech Hub on Oct 24th."
        resp = await client.post("/api/ai/generate-poster-content", json={"event_details": event_details, "style": "HACKATHON"}, headers=headers, timeout=60.0)
        print("AI Response status:", resp.status_code)
        print("AI Response data:", resp.json())
        assert resp.status_code == 200, "AI poster generation failed"
        assert 'title' in resp.json(), "Invalid AI response structure"
        
        # Test 2: Upload mock rendered PNG
        print("Testing Poster Upload & Save...")
        dummy_png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0bIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe\xa7\x35\x81\x84\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {'file': ('poster.png', dummy_png, 'image/png')}
        resp = await client.post("/api/events/1/poster", files=files, headers=headers)
        print("Upload Response status:", resp.status_code)
        assert resp.status_code == 200, "Upload failed"
        poster_url = resp.json().get("poster_url")
        assert poster_url, "No poster_url returned"
        
        print("ALL TESTS PASSED")

if __name__ == "__main__":
    asyncio.run(run_poster_tests())
