import asyncio
import httpx
import json

vistera_desc = """
EVENT TITLE: VISTERA
EVENT TYPE: 36-Hour National Hackathon
TAGLINES: Build, Solve, Learn, Repeat. Bigger Ideas, A Brighter Tomorrow.
ORGANIZER: Department of CSE (AI & ML), TKR College of Engineering and Technology
IN COLLABORATION WITH: ISTE Student Chapter
DATES: 8, 9, 10 October 2026
VENUE: TKR Campus, Hyderabad
WEBSITE: vistera.in
PRIZE POOL: ₹80,000
REGISTRATION FEE: ₹500 per person
"""

async def run_test():
    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=120.0) as client:
        resp = await client.post("/api/auth/token", data={"username": "testuser@example.com", "password": "password123"})
        token = resp.json().get("access_token")
        
        headers = {"Authorization": f"Bearer {token}"}
        resp = await client.post("/api/ai/generate-poster-content", json={"event_details": vistera_desc, "style": "HACKATHON (Like Noventrix, Cinematic Blue, 3D Typography)"}, headers=headers)
        
        print(resp.status_code)
        if resp.status_code == 200:
            print(json.dumps(resp.json(), indent=2))
        else:
            print(resp.text)

if __name__ == "__main__":
    asyncio.run(run_test())
