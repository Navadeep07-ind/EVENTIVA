import httpx
import asyncio

async def test_email():
    async with httpx.AsyncClient() as client:
        # 1. Test registration to send OTP
        resp = await client.post("http://localhost:8000/api/auth/register", json={
            "email": "receiver@example.com",
            "password": "password123",
            "full_name": "Test Receiver"
        })
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text}")

asyncio.run(test_email())
