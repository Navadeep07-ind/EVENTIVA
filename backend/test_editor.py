import asyncio
import httpx
import json

async def run_test():
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Login
        resp = await client.post("/api/auth/token", data={"username": "testuser@example.com", "password": "password123"})
        token = resp.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test Save State
        dummy_png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0bIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe\xa7\x35\x81\x84\x00\x00\x00\x00IEND\xaeB`\x82'
        dummy_state = json.dumps({"layers": [{"id": "test", "text": "EDITED TEXT"}]})
        
        files = {'file': ('poster.png', dummy_png, 'image/png')}
        data = {'poster_data': dummy_state}
        
        resp = await client.post("/api/events/1/poster", files=files, data=data, headers=headers)
        print("Save Endpoint Status:", resp.status_code)
        
        url = resp.json().get('poster_url')
        print("Poster URL:", url)
        
        # Verify JSON was saved correctly
        json_url = url.replace('.png', '.json')
        resp = await client.get(json_url)
        print("JSON Endpoint Status:", resp.status_code)
        if resp.status_code == 200:
            print("Loaded JSON:", resp.json())
        
if __name__ == "__main__":
    asyncio.run(run_test())
