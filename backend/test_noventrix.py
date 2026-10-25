import asyncio
import httpx
import json

noventrix_desc = """
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

async def run_test():
    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=60.0) as client:
        resp = await client.post("/api/auth/token", data={"username": "testuser@example.com", "password": "password123"})
        token = resp.json().get("access_token")
        
        headers = {"Authorization": f"Bearer {token}"}
        resp = await client.post(
            "/api/ai/generate-poster-content",
            json={"event_details": noventrix_desc, "style": "Cinematic Blue, 3D Typography, College Symposium"},
            headers=headers
        )
        
        print("Status:", resp.status_code)
        if resp.status_code == 200:
            print(json.dumps(resp.json(), indent=2))
        else:
            print(resp.text)

if __name__ == "__main__":
    asyncio.run(run_test())
