import requests
import uuid
from datetime import datetime, timezone, timedelta

from app.database import SessionLocal
from app import models
from app.core.security import get_password_hash, create_access_token

BASE_URL = "http://127.0.0.1:8000"

def setup_test_context():
    db = SessionLocal()
    try:
        # Create test organizer
        organizer = db.query(models.User).filter(models.User.email == "organizer_tickets@eventiva.test").first()
        if not organizer:
            organizer = models.User(
                email="organizer_tickets@eventiva.test",
                full_name="Ticket Test Organizer",
                hashed_password=get_password_hash("Password123!"),
                is_verified=True
            )
            db.add(organizer)
            db.commit()
            db.refresh(organizer)
        
        token = create_access_token({"sub": organizer.email})
        headers = {"Authorization": f"Bearer {token}"}

        # Create published test event
        event = models.Event(
            title="National AI & Robotics Summit 2026",
            description="Leading AI and Robotics Conclave in Hyderabad",
            category="Technology",
            venue="Tech Auditorium, Hall 3",
            start_time=datetime.now(timezone.utc) + timedelta(days=7),
            end_time=datetime.now(timezone.utc) + timedelta(days=7, hours=4),
            status="Published",
            max_participants=50,
            organizer_id=organizer.id
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        return organizer, event.id, headers
    finally:
        db.close()

def run_ticket_tests():
    print("==================================================")
    print("EVENTIVA DIGITAL TICKET & QR PASS TEST SUITE")
    print("==================================================")

    _, event_id, headers = setup_test_context()

    # TEST 1: Successful Registration Creates Unique Ticket
    test_email = f"attendee_{uuid.uuid4().hex[:6]}@example.com"
    reg_payload = {
        "full_name": "Arjun Sharma",
        "email": test_email,
        "college": "TKR College of Engineering and Technology",
        "custom_answers": {
            "track": "Robotics Vision",
            "dietary": "Vegetarian",
            "phone_number": "+91 9876543210" # Sensitive data
        }
    }

    res = requests.post(f"{BASE_URL}/api/events/{event_id}/register", json=reg_payload)
    assert res.status_code == 200, f"Registration failed: {res.text}"
    reg_data = res.json()
    assert "ticket_code" in reg_data and reg_data["ticket_code"], "Ticket code must be returned"
    assert reg_data["ticket_code"].startswith("EVT-"), f"Ticket code format mismatch: {reg_data['ticket_code']}"
    assert reg_data["ticket_url"] == f"/tickets/{reg_data['ticket_code']}", "Ticket URL must match /tickets/{ticket_code}"
    ticket_code = reg_data["ticket_code"]
    print(f"[TEST 1 PASS] Registration succeeded. Issued Ticket Code: {ticket_code}, URL: {reg_data['ticket_url']}")

    # TEST 2: Ticket Retrieval via Public Endpoint
    res = requests.get(f"{BASE_URL}/api/tickets/{ticket_code}")
    assert res.status_code == 200, f"Ticket retrieval failed: {res.text}"
    ticket_data = res.json()
    assert ticket_data["ticket_code"] == ticket_code, "Ticket code must match"
    assert ticket_data["event_title"] == "National AI & Robotics Summit 2026", "Event title mismatch"
    assert ticket_data["attendee_name"] == "Arjun Sharma", "Attendee name mismatch"
    assert ticket_data["attendee_college"] == "TKR College of Engineering and Technology", "Attendee college mismatch"
    assert ticket_data["venue"] == "Tech Auditorium, Hall 3", "Venue mismatch"
    assert ticket_data["status"] == "Registered", "Initial status must be Registered"
    assert ticket_data["checked_in"] is False, "Initial checked_in must be False"
    assert ticket_data["is_valid_for_admission"] is True, "Valid ticket must be valid for admission"
    print(f"[TEST 2 PASS] Public ticket endpoint returned accurate event and admission data for {ticket_code}.")

    # TEST 3: Privacy & Data Protection (No Private Attendee Info Exposed)
    assert "email" not in ticket_data, "Public ticket response MUST NOT expose attendee email"
    assert "phone_number" not in ticket_data, "Public ticket response MUST NOT expose phone number"
    assert "custom_answers" not in ticket_data, "Public ticket response MUST NOT expose custom answers"
    assert "organizer_id" not in ticket_data, "Public ticket response MUST NOT expose organizer ID"
    print(f"[TEST 3 PASS] Data Privacy Verified: Attendee email, phone, and custom answers are strictly omitted from public response.")

    # TEST 4: Invalid Ticket Codes Return HTTP 404
    res_fake = requests.get(f"{BASE_URL}/api/tickets/EVT-NONEXISTENT")
    assert res_fake.status_code == 404, f"Expected 404 for non-existent ticket, got {res_fake.status_code}"
    res_empty = requests.get(f"{BASE_URL}/api/tickets/%20")
    assert res_empty.status_code == 404, f"Expected 404 for whitespace ticket, got {res_empty.status_code}"
    print(f"[TEST 4 PASS] Invalid ticket codes properly return HTTP 404.")

    # TEST 5: Cancelled / Revoked Ticket Validation
    db = SessionLocal()
    try:
        reg_record = db.query(models.Registration).filter(models.Registration.ticket_code == ticket_code).first()
        reg_record.status = "Cancelled"
        db.commit()
    finally:
        db.close()

    res_cancelled = requests.get(f"{BASE_URL}/api/tickets/{ticket_code}")
    assert res_cancelled.status_code == 200
    cancelled_data = res_cancelled.json()
    assert cancelled_data["status"] == "Cancelled"
    assert cancelled_data["is_valid_for_admission"] is False, "Cancelled ticket must NOT be valid for admission"
    print(f"[TEST 5 PASS] Revocation Verified: Cancelled ticket status reflected and is_valid_for_admission=False.")

    # TEST 6: Checked-In State Validation
    db = SessionLocal()
    try:
        reg_record = db.query(models.Registration).filter(models.Registration.ticket_code == ticket_code).first()
        reg_record.status = "Registered" # restore status
        reg_record.checked_in = True
        reg_record.checked_in_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()

    res_checked = requests.get(f"{BASE_URL}/api/tickets/{ticket_code}")
    assert res_checked.status_code == 200
    checked_data = res_checked.json()
    assert checked_data["checked_in"] is True
    assert checked_data["checked_in_at"] is not None
    assert checked_data["is_valid_for_admission"] is False, "Already checked-in ticket must not be admitted a second time"
    print(f"[TEST 6 PASS] Check-in status accurately tracked and prevents duplicate entry.")

    # TEST 7: Idempotency & Duplicate Prevention on Repeated Requests
    # Submitting the exact same email for the same event must return existing registration and same ticket code
    res_retry = requests.post(f"{BASE_URL}/api/events/{event_id}/register", json=reg_payload)
    assert res_retry.status_code == 200, f"Retry failed: {res_retry.text}"
    retry_data = res_retry.json()
    assert retry_data["ticket_code"] == ticket_code, "Retried registration must return original ticket code"

    db = SessionLocal()
    try:
        count = db.query(models.Registration).filter(
            models.Registration.event_id == event_id,
            models.Registration.email == test_email
        ).count()
        assert count == 1, f"Expected exactly 1 registration row, found {count}"
    finally:
        db.close()
    print(f"[TEST 7 PASS] Idempotency Verified: Repeated submission did not create duplicate registration or ticket.")

    # TEST 8: Existing Registration Validations Still Enforced
    db = SessionLocal()
    try:
        # Event with passed deadline
        past_event = models.Event(
            title="Expired Conclave",
            description="Past Event",
            category="Academic",
            status="Published",
            registration_deadline=datetime.now(timezone.utc) - timedelta(days=1),
            organizer_id=1
        )
        # Event at full capacity
        full_event = models.Event(
            title="Full Event",
            description="Sold Out",
            category="Academic",
            status="Published",
            max_participants=0,
            organizer_id=1
        )
        # Draft event
        draft_event = models.Event(
            title="Draft Event",
            description="Not Published",
            category="Academic",
            status="Draft",
            organizer_id=1
        )
        db.add_all([past_event, full_event, draft_event])
        db.commit()
        db.refresh(past_event)
        db.refresh(full_event)
        db.refresh(draft_event)
        past_id, full_id, draft_id = past_event.id, full_event.id, draft_event.id
    finally:
        db.close()

    dummy_payload = {"full_name": "Test User", "email": "unique_test@example.com"}
    res_past = requests.post(f"{BASE_URL}/api/events/{past_id}/register", json=dummy_payload)
    assert res_past.status_code == 400, "Registration after deadline must be rejected with 400"

    res_full = requests.post(f"{BASE_URL}/api/events/{full_id}/register", json=dummy_payload)
    assert res_full.status_code == 400, "Registration beyond capacity must be rejected with 400"

    res_draft = requests.post(f"{BASE_URL}/api/events/{draft_id}/register", json=dummy_payload)
    assert res_draft.status_code == 400, "Registration for Draft event must be rejected with 400"

    print(f"[TEST 8 PASS] Existing registration business rules (deadline, capacity, draft state) remain fully enforced.")

    print("\n==================================================")
    print("ALL 8 TICKET & QR PASS SUITES PASSED PERFECTLY!")
    print("==================================================")

if __name__ == "__main__":
    run_ticket_tests()
