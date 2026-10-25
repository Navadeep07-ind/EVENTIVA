import asyncio
import httpx
import json

async def run_test():
    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=30.0) as client:
        # Login
        resp = await client.post("/api/auth/token", data={"username": "testuser@example.com", "password": "password123"})
        token = resp.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        payload = {
            "prompt": "Change the background to a dark blue futuristic theme.",
            "current_state": {
                "layers": [
                    { "id": "l-3", "type": "text", "text": "VISTERA", "fontSize": 110, "color": "#ffffff" }
                ],
                "canvasConfig": {
                    "bgImage": "",
                    "bgColor": "#000000"
                }
            }
        }
        
        resp = await client.post("/api/ai/edit-poster", json=payload, headers=headers)
        print("Edit Endpoint Status:", resp.status_code)
        try:
            print("Response:", json.dumps(resp.json(), indent=2))
        except:
            print("Text:", resp.text)
        
if __name__ == "__main__":
    asyncio.run(run_test())
