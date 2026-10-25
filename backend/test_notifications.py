import os
import sys
import unittest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

# Ensure test mode for email mock
os.environ["TESTING"] = "1"
os.environ["MOCK_EMAIL"] = "1"

from app.main import app
from app.database import get_db, SessionLocal
from app import models, crud
from app.core.security import get_password_hash, create_access_token
from app.core.email import get_mock_sent_emails, clear_mock_sent_emails

client = TestClient(app)

class TestNotificationSystem(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()
        clear_mock_sent_emails()

        # Create Organizer A
        cls.organizer_a = cls.db.query(models.User).filter(models.User.email == "org_a_notif@eventiva.in").first()
        if not cls.organizer_a:
            cls.organizer_a = models.User(
                email="org_a_notif@eventiva.in",
                hashed_password=get_password_hash("SecretOrgPass123!"),
                full_name="Organizer Alpha",
                organization="Tech Innovators Hub",
                is_verified=True
            )
            cls.db.add(cls.organizer_a)
            cls.db.commit()
            cls.db.refresh(cls.organizer_a)

        # Create Organizer B (for cross-event security check)
        cls.organizer_b = cls.db.query(models.User).filter(models.User.email == "org_b_notif@eventiva.in").first()
        if not cls.organizer_b:
            cls.organizer_b = models.User(
                email="org_b_notif@eventiva.in",
                hashed_password=get_password_hash("SecretOrgPass456!"),
                full_name="Organizer Beta",
                organization="Beta Labs",
                is_verified=True
            )
            cls.db.add(cls.organizer_b)
            cls.db.commit()
            cls.db.refresh(cls.organizer_b)

        cls.token_a = create_access_token(data={"sub": cls.organizer_a.email})
        cls.token_b = create_access_token(data={"sub": cls.organizer_b.email})
        cls.headers_a = {"Authorization": f"Bearer {cls.token_a}"}
        cls.headers_b = {"Authorization": f"Bearer {cls.token_b}"}

        # Create test event for Organizer A
        future_start = datetime.now(timezone.utc) + timedelta(days=2)
        future_end = future_start + timedelta(hours=4)
        cls.event = models.Event(
            title="Global AI & Cloud Summit 2026",
            description="Leading conference on cloud AI systems.",
            category="Conference",
            venue="Hall 4, Convention Center",
            start_time=future_start,
            end_time=future_end,
            registration_start_date=datetime.now(timezone.utc) - timedelta(days=1),
            registration_deadline=datetime.now(timezone.utc) + timedelta(days=1),
            max_participants=50,
            min_team_size=2,
            max_team_size=4,
            registration_mode="team",
            status="Published",
            organizer_id=cls.organizer_a.id
        )
        cls.db.add(cls.event)
        cls.db.commit()
        cls.db.refresh(cls.event)

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def setUp(self):
        clear_mock_sent_emails()

    def test_01_registration_email_and_unsubscribe_token(self):
        """Test that registering an attendee issues a ticket pass email with unsubscribe token."""
        payload = {
            "full_name": "Rohan Sharma",
            "email": "rohan.sharma@sprint.org",
            "college": "National Tech Institute"
        }
        res = client.post(f"/api/events/{self.event.id}/register", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["ticket_code"].startswith("EVT-"))

        # Verify registration in DB has an unsubscribe token
        reg = self.db.query(models.Registration).filter(models.Registration.id == data["id"]).first()
        self.assertIsNotNone(reg)
        self.assertIsNotNone(reg.unsubscribe_token)
        self.assertFalse(reg.unsubscribed_announcements)

        # Check mock emails
        emails = get_mock_sent_emails()
        self.assertTrue(len(emails) >= 1)
        ticket_email = next((e for e in emails if e["to"] == "rohan.sharma@sprint.org"), None)
        self.assertIsNotNone(ticket_email)
        self.assertIn("Digital Ticket Pass", ticket_email["subject"])
        self.assertIn(reg.ticket_code, ticket_email["plain_body"])

    def test_02_team_notifications(self):
        """Test team creation and member joining notifications."""
        # Leader creates team
        team_payload = {
            "team_name": "Cloud Knights",
            "leader": {
                "full_name": "Priya Patel",
                "email": "priya.patel@sprint.org",
                "college": "IIIT Hyderabad"
            }
        }
        res = client.post(f"/api/events/{self.event.id}/teams", json=team_payload)
        self.assertEqual(res.status_code, 200)
        team_data = res.json()
        invite_code = team_data["team"]["invite_code"]

        # Check leader got team created confirmation
        emails = get_mock_sent_emails()
        leader_email = next((e for e in emails if e["to"] == "priya.patel@sprint.org"), None)
        self.assertIsNotNone(leader_email)
        self.assertIn("Cloud Knights", leader_email["subject"])
        self.assertIn(invite_code, leader_email["plain_body"])

        clear_mock_sent_emails()

        # Member joins team
        join_payload = {
            "full_name": "Amit Roy",
            "email": "amit.roy@sprint.org",
            "college": "IIIT Hyderabad"
        }
        join_res = client.post(f"/api/teams/invite/{invite_code}/join", json=join_payload)
        self.assertEqual(join_res.status_code, 200)

        # Joined member should receive confirmation, and leader should receive teammate alert
        new_emails = get_mock_sent_emails()
        member_email = next((e for e in new_emails if e["to"] == "amit.roy@sprint.org"), None)
        self.assertIsNotNone(member_email)
        self.assertIn("Welcome to Cloud Knights", member_email["subject"])

        leader_alert = next((e for e in new_emails if e["to"] == "priya.patel@sprint.org"), None)
        self.assertIsNotNone(leader_alert)
        self.assertIn("New Teammate Alert", leader_alert["subject"])
        self.assertIn("Amit Roy", leader_alert["plain_body"])

    def test_03_announcement_broadcast_and_authorization(self):
        """Test that only the event organizer can broadcast, and cross-event access is denied."""
        broadcast_payload = {
            "title": "Welcome to AI Summit 2026",
            "message": "Keynote begins at 9:00 AM sharp in Auditorium B.",
            "priority": "important",
            "target_audience": "all"
        }

        # Unauthorized organizer B receives 403 Forbidden
        res_forbidden = client.post(
            f"/api/events/{self.event.id}/notifications/broadcast",
            json=broadcast_payload,
            headers=self.headers_b
        )
        self.assertEqual(res_forbidden.status_code, 403)

        # Authorized organizer A succeeds
        res_ok = client.post(
            f"/api/events/{self.event.id}/notifications/broadcast",
            json=broadcast_payload,
            headers=self.headers_a
        )
        self.assertEqual(res_ok.status_code, 200)
        data = res_ok.json()
        self.assertEqual(data["campaign_type"], "announcement")
        self.assertEqual(data["title"], "Welcome to AI Summit 2026")
        self.assertEqual(data["status"], "Completed")
        self.assertGreater(data["sent_count"], 0)

    def test_04_target_audience_filtering(self):
        """Test targeting specific teams versus all attendees."""
        # Find team Cloud Knights for this event
        team = self.db.query(models.Team).filter(
            models.Team.event_id == self.event.id,
            models.Team.team_name == "Cloud Knights"
        ).first()
        self.assertIsNotNone(team)

        broadcast_team = {
            "title": "Cloud Knights Team Briefing",
            "message": "Please report to Room 102 for team check-in.",
            "priority": "normal",
            "target_audience": "teams",
            "target_ids": [team.id]
        }
        res = client.post(
            f"/api/events/{self.event.id}/notifications/broadcast",
            json=broadcast_team,
            headers=self.headers_a
        )
        self.assertEqual(res.status_code, 200)
        camp = res.json()
        # Cloud Knights has Priya Patel (leader) and Amit Roy (member) = 2 recipients
        self.assertEqual(camp["total_recipients"], 2)

    def test_05_cancelled_registrations_excluded(self):
        """Test that cancelled and rejected registrations are strictly excluded from broadcasts."""
        import uuid
        can_email = f"cancelled_{uuid.uuid4().hex[:6]}@sprint.org"
        reg_cancel = models.Registration(
            event_id=self.event.id,
            full_name="Cancelled Attendee",
            email=can_email,
            status="Cancelled",
            ticket_code=f"EVT-CAN-{uuid.uuid4().hex[:6].upper()}",
            unsubscribe_token=f"unsub-{uuid.uuid4()}"
        )
        self.db.add(reg_cancel)
        self.db.commit()

        recipients = crud.resolve_campaign_recipients(self.db, event_id=self.event.id, target_audience="all")
        emails = [r.email for r in recipients]
        self.assertNotIn(can_email, emails)

    def test_06_schedule_and_venue_change_detection(self):
        """Test detecting changes to event date, time, and venue."""
        # 1. No changes
        detect_no_change = client.post(
            f"/api/events/{self.event.id}/detect-changes",
            json={
                "venue": self.event.venue,
                "start_time": self.event.start_time.isoformat(),
                "end_time": self.event.end_time.isoformat()
            },
            headers=self.headers_a
        )
        self.assertEqual(detect_no_change.status_code, 200)
        self.assertFalse(detect_no_change.json()["has_changes"])

        # 2. Modify venue
        detect_change = client.post(
            f"/api/events/{self.event.id}/detect-changes",
            json={
                "venue": "Grand Ballroom, Marriott Hyderabad",
                "start_time": self.event.start_time.isoformat(),
                "end_time": self.event.end_time.isoformat()
            },
            headers=self.headers_a
        )
        self.assertEqual(detect_change.status_code, 200)
        data = detect_change.json()
        self.assertTrue(data["has_changes"])
        self.assertIn("Venue moved", data["summary"])
        self.assertGreater(data["eligible_attendees_count"], 0)

        # 3. Notify change to attendees
        clear_mock_sent_emails()
        notify_res = client.post(
            f"/api/events/{self.event.id}/notify-change",
            json={"custom_note": "Please use West entrance parking."},
            headers=self.headers_a
        )
        self.assertEqual(notify_res.status_code, 200)
        camp = notify_res.json()
        self.assertEqual(camp["campaign_type"], "schedule_change")
        self.assertGreater(camp["sent_count"], 0)

    def test_07_event_reminders_and_duplicate_prevention(self):
        """Test saving reminder schedule, timezone calculation, and duplicate prevention."""
        now = datetime.now(timezone.utc)
        reminders_payload = {
            "reminders": [
                {
                    "reminder_type": "24h_before",
                    "scheduled_time": (now - timedelta(minutes=5)).isoformat(), # Due in past
                    "is_enabled": True
                },
                {
                    "reminder_type": "1h_before",
                    "scheduled_time": (now + timedelta(hours=1)).isoformat(), # Future
                    "is_enabled": True
                }
            ]
        }
        save_res = client.put(
            f"/api/events/{self.event.id}/reminders",
            json=reminders_payload,
            headers=self.headers_a
        )
        self.assertEqual(save_res.status_code, 200)
        configs = save_res.json()
        self.assertEqual(len(configs), 2)

        # Trigger due check: 24h reminder is due and should process
        trigger_res = client.post(
            f"/api/events/{self.event.id}/reminders/trigger-check",
            headers=self.headers_a
        )
        self.assertEqual(trigger_res.status_code, 200)
        processed = trigger_res.json()["processed_campaigns"]
        self.assertEqual(len(processed), 1)

        # Duplicate Prevention: Triggering check again should NOT re-send the reminder
        trigger_again = client.post(
            f"/api/events/{self.event.id}/reminders/trigger-check",
            headers=self.headers_a
        )
        self.assertEqual(len(trigger_again.json()["processed_campaigns"]), 0)

    def test_08_unsubscribe_preferences_enforcement(self):
        """Test that unsubscribed participants are skipped for non-essential announcements."""
        reg = self.db.query(models.Registration).filter(
            models.Registration.event_id == self.event.id,
            models.Registration.email == "rohan.sharma@sprint.org"
        ).first()
        self.assertIsNotNone(reg)

        # Inspect unsubscribe page
        unsub_get = client.get(f"/api/notifications/unsubscribe/{reg.unsubscribe_token}")
        self.assertEqual(unsub_get.status_code, 200)
        self.assertFalse(unsub_get.json()["unsubscribed_announcements"])

        # Opt-out
        unsub_post = client.post(f"/api/notifications/unsubscribe/{reg.unsubscribe_token}")
        self.assertEqual(unsub_post.status_code, 200)

        self.db.refresh(reg)
        self.assertTrue(reg.unsubscribed_announcements)

        # Broadcast non-essential announcement: Rohan must be skipped
        broadcast_payload = {
            "title": "Sponsor Tech Showcase",
            "message": "Visit our sponsor booths on floor 2.",
            "priority": "normal",
            "target_audience": "all"
        }
        res = client.post(
            f"/api/events/{self.event.id}/notifications/broadcast",
            json=broadcast_payload,
            headers=self.headers_a
        )
        self.assertEqual(res.status_code, 200)
        camp_id = res.json()["id"]

        # Check deliveries in DB
        detail_res = client.get(
            f"/api/events/{self.event.id}/notifications/{camp_id}",
            headers=self.headers_a
        )
        self.assertEqual(detail_res.status_code, 200)
        deliveries = detail_res.json()["deliveries"]
        rohan_delivery = next((d for d in deliveries if d["recipient_email"] == "rohan.sharma@sprint.org"), None)
        self.assertIsNotNone(rohan_delivery)
        self.assertEqual(rohan_delivery["status"], "skipped_unsubscribed")

    def test_09_smtp_failure_handling_and_retry(self):
        """Test safe recording of delivery failures without leaking credentials, and bounded retries."""
        import uuid
        # Create a campaign manually and simulate a delivery failure
        campaign = crud.create_notification_campaign(
            db=self.db,
            event_id=self.event.id,
            organizer_id=self.organizer_a.id,
            campaign_type="announcement",
            title="Important Server Notice",
            message="Test error retry.",
            priority="urgent"
        )
        unique_key = f"fail_{campaign.id}_{uuid.uuid4().hex[:6]}"
        delivery = models.NotificationDelivery(
            campaign_id=campaign.id,
            recipient_email=f"failing_{uuid.uuid4().hex[:6]}@sprint.org",
            recipient_name="Fail Test",
            status="failed",
            error_message="SMTP Connection Timeout",
            idempotency_key=unique_key,
            attempt_count=1
        )
        self.db.add(delivery)
        campaign.total_recipients = 1
        campaign.failed_count = 1
        campaign.status = "Failed"
        self.db.commit()

        # Retry the campaign
        retry_res = client.post(
            f"/api/events/{self.event.id}/notifications/{campaign.id}/retry",
            headers=self.headers_a
        )
        self.assertEqual(retry_res.status_code, 200)
        updated = retry_res.json()
        self.assertEqual(updated["status"], "Completed")
        self.assertEqual(updated["sent_count"], 1)

if __name__ == "__main__":
    unittest.main()
