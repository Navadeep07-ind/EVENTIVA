import asyncio
import httpx
import os
import json

EVENTS_TO_TEST = [
    {"desc": "Grand Indian Wedding of Rohan and Priya, Dec 12, The Taj Palace, Dress Code: Traditional", "style": "Romantic and Elegant"},
    {"desc": "Global AI Summit 2026. Keynote by Sam Altman. Moscone Center, SF.", "style": "Professional Corporate"},
    {"desc": "Rock in Rio 2026! 3 days of pure music madness with Metallica headlining.", "style": "Dark Atmospheric"},
    {"desc": "Web3 Builders Hackathon. Win $50k in prizes. 48 hours of coding.", "style": "Cyberpunk Neon"},
    {"desc": "Local Charity Bake Sale supporting the animal shelter. Saturday 9am at Town Hall.", "style": "Minimal Clean"}
]

async def run_poster_tests():
    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=120.0) as client:
        print("Logging in...")
        resp = await client.post("/api/auth/token", data={"username": "testuser@example.com", "password": "password123"})
        token = resp.json().get("access_token")
        if not token:
            print("Failed to login!")
            return
        headers = {"Authorization": f"Bearer {token}"}
        
        for idx, ev in enumerate(EVENTS_TO_TEST):
            print(f"\n--- Testing Event {idx+1}: {ev['style']} ---")
            resp = await client.post("/api/ai/generate-poster-content", json={"event_details": ev["desc"], "style": ev["style"]}, headers=headers)
            print("Status:", resp.status_code)
            
            if resp.status_code == 200:
                data = resp.json()
                print("Category:", data.get('event_category'))
                print("Title:", data.get('title'))
                print("Info Blocks:", [f"{b.get('label')}: {b.get('value')}" for b in data.get('info_blocks', [])])
                print("BG Style:", data.get('bg_style'))
                print("Typo Style:", data.get('typography_style'))
            else:
                print("Error:", resp.text)
                
if __name__ == "__main__":
    asyncio.run(run_poster_tests())
