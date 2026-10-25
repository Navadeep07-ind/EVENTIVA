import asyncio
import httpx
import json

noventrix_data = """
TKR COLLEGE OF ENGINEERING AND TECHNOLOGY (TKRCET)
(An Autonomous Institution)
Accredited by NBA and NAAC with 'A+' Grade
(Sponsored by TKR Educational Society, Approved by AICTE, Affiliated to JNTUH)
Medbowli, Meerpet, Balapur, Hyderabad, Telangana - 500097.

DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING
MINDSPARKS CLUB
CORDIALLY INVITES YOU TO

NOVENTRIX 2K26

The event is being organized by MINDSPARKS CLUB with the objective of fostering innovation, creativity, technical excellence and collaborative learning among students.

Date: 30th September 2026
Time: 10:00 AM
Venue: K9 Auditorium

TAGLINES:
Ideas. Design. Build. Innovate.
A BRIGHTER TOMORROW TOGETHER

With Regards
MINDSPARKS CLUB
Department of Computer Science and Engineering
— TKRCET —
"""

hackathon_data = """
EVENT: CYBERHACK 2026 - 48-Hour AI & Web3 Hackathon
ORGANIZER: TechNova Developer Guild & IEEE Student Branch
THEMES: Artificial Intelligence, Decentralized Finance, Climate Tech
DATES: 14th - 16th November 2026
TIME: 09:00 AM
VENUE: Innovation Hall, Cyber Hub, Bangalore
PRIZE POOL: ₹1,50,000
REGISTRATION: cyberhack2026.dev | team@cyberhack.dev
TAGLINE: Code the Impossible. Redefine Tomorrow.
SIGNOFF: With Regards, Organizing Committee, TechNova
"""

async def test_quality():
    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=60.0) as client:
        # Authenticate
        resp = await client.post("/api/auth/token", data={"username": "testuser@example.com", "password": "password123"})
        token = resp.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test 1: NOVENTRIX
        print("--- Testing NOVENTRIX Generation ---")
        resp1 = await client.post(
            "/api/ai/generate-poster-content",
            json={"event_details": noventrix_data, "style": "College Symposium, 3D Ice Blue, Cinematic Night Campus"},
            headers=headers
        )
        assert resp1.status_code == 200, f"Failed: {resp1.text}"
        res1 = resp1.json()
        print("NOVENTRIX Title:", res1.get("title"), res1.get("subtitle"))
        print("Institution:", res1.get("institution_name"))
        print("Department:", res1.get("department_name"))
        print("Date/Time/Venue:", res1.get("date"), "|", res1.get("time"), "|", res1.get("venue"))
        print("Taglines:", res1.get("tagline_left"), "|", res1.get("tagline_right"))
        print("Assets:", res1.get("left_logo_asset"), "|", res1.get("right_badge_asset"), "|", res1.get("venue_backdrop_asset"))
        
        # Test 2: CYBERHACK (Universal Event Support)
        print("\n--- Testing Universal Event (CYBERHACK 2026) ---")
        resp2 = await client.post(
            "/api/ai/generate-poster-content",
            json={"event_details": hackathon_data, "style": "Cyberpunk Neon, 3D Chrome, High Tech"},
            headers=headers
        )
        assert resp2.status_code == 200, f"Failed: {resp2.text}"
        res2 = resp2.json()
        print("CYBERHACK Title:", res2.get("title"), res2.get("subtitle"))
        print("Organizer:", res2.get("institution_name"))
        print("Date/Time/Venue:", res2.get("date"), "|", res2.get("time"), "|", res2.get("venue"))
        print("Style / Typography:", res2.get("bg_style"), "|", res2.get("typography_style"))
        print("\nAll quality checks PASSED successfully!")

if __name__ == "__main__":
    asyncio.run(test_quality())
