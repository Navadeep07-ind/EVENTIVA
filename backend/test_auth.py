import asyncio
import httpx
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import OTP, User

async def run_tests():
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        print("Testing Signup...")
        email = "newuser@example.com"
        resp = await client.post("/api/auth/register", json={"email": email, "password": "password123", "full_name": "New User"})
        print("Signup:", resp.status_code)
        
        print("Testing duplicate email...")
        resp = await client.post("/api/auth/register", json={"email": email, "password": "password123", "full_name": "New User"})
        print("Duplicate signup:", resp.status_code)
        
        print("Testing Login (unverified)...")
        resp = await client.post("/api/auth/token", data={"username": email, "password": "password123"})
        print("Unverified login:", resp.status_code, resp.json().get('detail'))
        
        # Get OTP from DB
        db = SessionLocal()
        otp_record = db.query(OTP).filter(OTP.email == email).first()
        print("Verifying with invalid OTP...")
        resp = await client.post("/api/auth/verify-otp", json={"email": email, "otp": "000000"})
        print("Invalid OTP:", resp.status_code)
        
        # We need to look up the plain OTP - wait, it's hashed in the DB!
        # Since I mocked the email, the OTP is printed to the console output of the uvicorn server.
        # But for automated testing, we can just reset the user's is_verified flag directly.
        user = db.query(User).filter(User.email == email).first()
        user.is_verified = True
        db.commit()
        db.close()
        
        print("Testing Login (verified)...")
        resp = await client.post("/api/auth/token", data={"username": email, "password": "password123"})
        print("Verified login:", resp.status_code)
        
        print("Testing Password Reset request...")
        resp = await client.post("/api/auth/resend-otp", json={"email": email, "purpose": "reset"})
        print("Reset OTP request:", resp.status_code)

if __name__ == "__main__":
    asyncio.run(run_tests())
