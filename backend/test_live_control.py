import os
import sys
import io
import uuid
import unittest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

# Ensure test mode
os.environ["TESTING"] = "1"
os.environ["MOCK_EMAIL"] = "1"

# Add current directory to path if needed
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.database import SessionLocal
from app import models, crud
from app.core.security import get_password_hash, create_access_token
from app.core.email import get_mock_sent_emails, clear_mock_sent_emails

client = TestClient(app)

class TestLiveControlCenter(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()
        clear_mock_sent_emails()
        run_id = uuid.uuid4().hex[:6]

        # 1. Organizer A (Owner)
        cls.org_a = models.User(
            email=f"live_org_a_{run_id}@eventiva.in",
            hashed_password=get_password_hash("LivePass123!"),
            full_name="Live Master A",
            organization="Hackathon HQ",
            is_verified=True
        )
        cls.db.add(cls.org_a)
        cls.db.commit()
        cls.db.refresh(cls.org_a)
        cls.token_a = create_access_token(data={"sub": cls.org_a.email})
        cls.headers_a = {"Authorization": f"Bearer {cls.token_a}"}

        # 2. Organizer B (Attacker / Non-owner)
        cls.org_b = models.User(
            email=f"live_org_b_{run_id}@eventiva.in",
            hashed_password=get_password_hash("LivePass456!"),
            full_name="Live Intruder B",
            organization="Rival Systems",
            is_verified=True
        )
        cls.db.add(cls.org_b)
        cls.db.commit()
        cls.db.refresh(cls.org_b)
        cls.token_b = create_access_token(data={"sub": cls.org_b.email})
        cls.headers_b = {"Authorization": f"Bearer {cls.token_b}"}

        # 3. Create Event
        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        end_time = datetime.now(timezone.utc) + timedelta(hours=24)
        cls.event = models.Event(
            title=f"Global AI Hackathon 2026 {run_id}",
            description="24-hour live building sprint",
            category="Hackathon",
            start_time=start_time,
            end_time=end_time,
            registration_deadline=start_time,
            venue="Grand Hall & Virtual",
            organizer_id=cls.org_a.id,
            status="Published",
            registration_mode="team",
            min_team_size=2,
            max_team_size=4
        )
        cls.db.add(cls.event)
        cls.db.commit()
        cls.db.refresh(cls.event)

        # 4. Create Team
        cls.team = models.Team(
            event_id=cls.event.id,
            team_name=f"Cyber Sentinels {run_id}",
            invite_code=f"SENT-{run_id.upper()}",
            status="Active"
        )
        cls.db.add(cls.team)
        cls.db.commit()
        cls.db.refresh(cls.team)

        # 5. Create Registrations (Alice = Leader, Bob = Member, Charlie = Solo/Other)
        cls.reg_alice = models.Registration(
            event_id=cls.event.id,
            team_id=cls.team.id,
            is_team_leader=True,
            full_name="Alice Smith",
            email=f"alice_{run_id}@sentinels.io",
            college="Tech University",
            status="Confirmed",
            ticket_code=f"EVT-ALICE-{run_id.upper()}",
            checked_in=True,
            checked_in_at=datetime.now(timezone.utc)
        )
        cls.reg_bob = models.Registration(
            event_id=cls.event.id,
            team_id=cls.team.id,
            is_team_leader=False,
            full_name="Bob Jones",
            email=f"bob_{run_id}@sentinels.io",
            college="Tech University",
            status="Confirmed",
            ticket_code=f"EVT-BOB-{run_id.upper()}",
            checked_in=True,
            checked_in_at=datetime.now(timezone.utc)
        )
        cls.reg_charlie = models.Registration(
            event_id=cls.event.id,
            is_team_leader=False,
            full_name="Charlie Brown",
            email=f"charlie_{run_id}@solo.io",
            college="Solo Arts",
            status="Confirmed",
            ticket_code=f"EVT-CHARLIE-{run_id.upper()}",
            checked_in=False
        )
        cls.db.add_all([cls.reg_alice, cls.reg_bob, cls.reg_charlie])
        cls.db.commit()
        cls.db.refresh(cls.reg_alice)
        cls.db.refresh(cls.reg_bob)
        cls.db.refresh(cls.reg_charlie)

        cls.team.leader_registration_id = cls.reg_alice.id
        cls.db.commit()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_01_organizer_authorization(self):
        """Test strict organizer ownership enforcement on live tasks."""
        deadline = (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat()
        payload = {
            "title": "Initial Architecture Pitch Deck",
            "instructions": "Upload a PDF deck summarizing your problem statement.",
            "description": "5 slides maximum",
            "deadline": deadline,
            "timezone": "UTC",
            "target_audience": "teams",
            "submission_method": "file_or_url",
            "allowed_file_types": ".pdf,.pptx",
            "max_file_size_mb": 15,
            "review_required": True,
            "reminder_offsets_minutes": [30, 10]
        }

        # 1. Unauthenticated -> 401
        res_anon = client.post(f"/api/events/{self.event.id}/live-tasks", json=payload)
        self.assertEqual(res_anon.status_code, 401)

        # 2. Non-owner Organizer B -> 403
        res_intruder = client.post(
            f"/api/events/{self.event.id}/live-tasks",
            json=payload,
            headers=self.headers_b
        )
        self.assertEqual(res_intruder.status_code, 403)

        # 3. Legitimate Owner Organizer A -> 200 / 201
        res_owner = client.post(
            f"/api/events/{self.event.id}/live-tasks",
            json=payload,
            headers=self.headers_a
        )
        self.assertEqual(res_owner.status_code, 200)
        data = res_owner.json()
        self.assertEqual(data["title"], "Initial Architecture Pitch Deck")
        self.assertEqual(data["target_audience"], "teams")
        self.assertEqual(len(data["reminders"]), 2)
        TestLiveControlCenter.created_task_id = data["id"]

    def test_02_live_overview_endpoint(self):
        """Test organizer live operations overview metrics."""
        res = client.get(f"/api/events/{self.event.id}/live/overview", headers=self.headers_a)
        self.assertEqual(res.status_code, 200)
        overview = res.json()
        self.assertEqual(overview["event_id"], self.event.id)
        self.assertEqual(overview["total_registered"], 3)
        self.assertEqual(overview["total_checked_in"], 2)
        self.assertEqual(overview["total_teams"], 1)
        self.assertGreaterEqual(overview["active_tasks_count"], 1)

    def test_03_task_update_and_retrieval(self):
        """Test task detail retrieval and updating."""
        task_id = self.created_task_id
        res_get = client.get(f"/api/events/{self.event.id}/live-tasks/{task_id}", headers=self.headers_a)
        self.assertEqual(res_get.status_code, 200)
        task_data = res_get.json()
        self.assertEqual(task_data["id"], task_id)

        # Update instructions
        new_deadline = (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat()
        update_payload = {
            "title": "Initial Architecture Deck (Updated)",
            "deadline": new_deadline,
            "max_file_size_mb": 20
        }
        res_put = client.put(
            f"/api/events/{self.event.id}/live-tasks/{task_id}",
            json=update_payload,
            headers=self.headers_a
        )
        self.assertEqual(res_put.status_code, 200)
        self.assertEqual(res_put.json()["title"], "Initial Architecture Deck (Updated)")
        self.assertEqual(res_put.json()["max_file_size_mb"], 20)

    def test_04_ai_polish_instructions_endpoint(self):
        """Test AI task instructions polish endpoint with deterministic fallback."""
        payload = {
            "raw_text": "all teams must submit github repo link before 5pm. make sure readme has setup steps and team member names. late submissions lose points.",
            "context_info": "Sprint Milestone Submission"
        }
        res = client.post("/api/ai/polish-task-instructions", json=payload, headers=self.headers_a)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(bool(data["task_title"]))
        self.assertTrue(bool(data["instructions"]))

    def test_05_participant_portal_view(self):
        """Test live participant dashboard data retrieval."""
        # 1. Anonymous attendee view
        res_anon = client.get(f"/api/events/{self.event.id}/live-portal")
        self.assertEqual(res_anon.status_code, 200)
        anon_data = res_anon.json()
        self.assertFalse(anon_data["is_registered"])
        self.assertIsNone(anon_data["ticket_code"])
        self.assertGreaterEqual(len(anon_data["tasks"]), 1)

        # 2. Authenticated by ticket code
        res_ticket = client.get(
            f"/api/events/{self.event.id}/live-portal",
            params={"ticket_code": self.reg_alice.ticket_code}
        )
        self.assertEqual(res_ticket.status_code, 200)
        user_data = res_ticket.json()
        self.assertTrue(user_data["is_registered"])
        self.assertEqual(user_data["participant_name"], "Alice Smith")
        self.assertEqual(user_data["team_name"], self.team.team_name)
        self.assertEqual(user_data["ticket_code"], self.reg_alice.ticket_code)

    def test_06_submission_security_and_validation(self):
        """Test security validation against dangerous executables and empty submissions."""
        task_id = self.created_task_id

        # 1. Blocked executable format (.exe) -> 400
        exe_file = io.BytesIO(b"MOCK_MALWARE_PAYLOAD")
        res_blocked = client.post(
            f"/api/events/{self.event.id}/tasks/{task_id}/submit",
            data={"ticket_code": self.reg_alice.ticket_code},
            files={"file": ("hack.exe", exe_file, "application/octet-stream")}
        )
        self.assertEqual(res_blocked.status_code, 400)
        self.assertIn("forbidden for security", res_blocked.json()["detail"].lower())

        # 2. Blocked shell script (.sh) -> 400
        sh_file = io.BytesIO(b"#!/bin/bash\necho bad")
        res_sh = client.post(
            f"/api/events/{self.event.id}/tasks/{task_id}/submit",
            data={"ticket_code": self.reg_alice.ticket_code},
            files={"file": ("payload.sh", sh_file, "text/x-shellscript")}
        )
        self.assertEqual(res_sh.status_code, 400)
        self.assertIn("forbidden for security", res_sh.json()["detail"].lower())

        # 3. Empty submission (no file, no text, no url) -> 400
        res_empty = client.post(
            f"/api/events/{self.event.id}/tasks/{task_id}/submit",
            data={"ticket_code": self.reg_alice.ticket_code}
        )
        self.assertEqual(res_empty.status_code, 400)
        self.assertIn("cannot be empty", res_empty.json()["detail"].lower())

    def test_07_valid_team_submission(self):
        """Test valid submission and team-level sharing."""
        task_id = self.created_task_id

        # Alice submits valid PDF
        pdf_bytes = io.BytesIO(b"%PDF-1.4 Mock valid deck document content")
        res_submit = client.post(
            f"/api/events/{self.event.id}/tasks/{task_id}/submit",
            data={
                "ticket_code": self.reg_alice.ticket_code,
                "submission_url": "https://github.com/cybersentinels/ai-core",
                "submission_text": "Completed core architecture and pipeline diagram."
            },
            files={"file": ("architecture_deck.pdf", pdf_bytes, "application/pdf")}
        )
        self.assertEqual(res_submit.status_code, 200)
        sub_data = res_submit.json()
        self.assertEqual(sub_data["status"], "Submitted")
        self.assertEqual(sub_data["team_id"], self.team.id)
        self.assertEqual(sub_data["team_name"], self.team.team_name)
        self.assertTrue(bool(sub_data["file_url"]))
        TestLiveControlCenter.submission_id = sub_data["id"]

        # Teammate Bob queries portal: sees the team submission
        res_bob = client.get(
            f"/api/events/{self.event.id}/live-portal",
            params={"ticket_code": self.reg_bob.ticket_code}
        )
        self.assertEqual(res_bob.status_code, 200)
        bob_portal = res_bob.json()
        bob_task = next(t for t in bob_portal["tasks"] if t["task"]["id"] == task_id)
        self.assertIsNotNone(bob_task["my_submission"])
        self.assertEqual(bob_task["my_submission"]["id"], sub_data["id"])
        self.assertEqual(bob_task["my_submission"]["submission_url"], "https://github.com/cybersentinels/ai-core")

    def test_08_submission_review_and_correction_cycle(self):
        """Test organizer review workflow with feedback and resubmission."""
        task_id = self.created_task_id
        sub_id = getattr(self, "submission_id", None)
        if not sub_id:
            res_subs = client.get(f"/api/events/{self.event.id}/live-tasks/{task_id}/submissions", headers=self.headers_a)
            sub_id = res_subs.json()[0]["id"]

        # 1. Organizer requests correction
        review_payload = {
            "status": "Correction Required",
            "organizer_feedback": "Please add slide 4 explaining your data privacy policy."
        }
        res_review = client.post(
            f"/api/events/{self.event.id}/submissions/{sub_id}/review",
            json=review_payload,
            headers=self.headers_a
        )
        self.assertEqual(res_review.status_code, 200)
        self.assertEqual(res_review.json()["status"], "Correction Required")
        self.assertEqual(res_review.json()["organizer_feedback"], review_payload["organizer_feedback"])

        # 2. Participant portal reflects Correction Required & feedback
        res_portal = client.get(
            f"/api/events/{self.event.id}/live-portal",
            params={"ticket_code": self.reg_alice.ticket_code}
        )
        portal_task = next(t for t in res_portal.json()["tasks"] if t["task"]["id"] == task_id)
        self.assertEqual(portal_task["my_submission"]["status"], "Correction Required")
        self.assertEqual(portal_task["my_submission"]["organizer_feedback"], review_payload["organizer_feedback"])

        # 3. Participant resubmits corrected deck
        res_resubmit = client.post(
            f"/api/events/{self.event.id}/tasks/{task_id}/submit",
            data={
                "ticket_code": self.reg_alice.ticket_code,
                "submission_url": "https://github.com/cybersentinels/ai-core/pull/2",
                "submission_text": "Added data privacy policy slide as requested."
            }
        )
        self.assertEqual(res_resubmit.status_code, 200)
        self.assertEqual(res_resubmit.json()["status"], "Submitted")

        # 4. Organizer approves & verifies
        res_approve = client.post(
            f"/api/events/{self.event.id}/submissions/{sub_id}/review",
            json={"status": "Verified", "organizer_feedback": "All requirements satisfied. Excellent work!"},
            headers=self.headers_a
        )
        self.assertEqual(res_approve.status_code, 200)
        self.assertEqual(res_approve.json()["status"], "Verified")

    def test_09_smart_reminders_completion_exclusion(self):
        """Test that participants who completed the task are excluded from reminders."""
        clear_mock_sent_emails()

        # Create a task due soon (e.g., 20 mins from now with a 30-min reminder offset)
        due_soon = datetime.now(timezone.utc) + timedelta(minutes=20)
        task_payload = {
            "title": "Final Code Submission",
            "instructions": "Push all code to main branch.",
            "deadline": due_soon.isoformat(),
            "timezone": "UTC",
            "target_audience": "teams",
            "submission_method": "url",
            "reminder_offsets_minutes": [30]
        }
        res_task = client.post(
            f"/api/events/{self.event.id}/live-tasks",
            json=task_payload,
            headers=self.headers_a
        )
        self.assertEqual(res_task.status_code, 200)
        final_task_id = res_task.json()["id"]

        # Sentinels team submits immediately
        client.post(
            f"/api/events/{self.event.id}/tasks/{final_task_id}/submit",
            data={
                "ticket_code": self.reg_alice.ticket_code,
                "submission_url": "https://github.com/cybersentinels/final-release"
            }
        )

        # Trigger reminder processing
        res_remind = client.post(
            f"/api/events/{self.event.id}/live-tasks/process-reminders",
            headers=self.headers_a
        )
        self.assertEqual(res_remind.status_code, 200)
        remind_data = res_remind.json()
        self.assertTrue(remind_data["success"])

        # Cyber Sentinels already submitted, so they should not receive a duplicate reminder
        mock_emails = get_mock_sent_emails()
        alice_emails = [e for e in mock_emails if "alice.smith@sentinels.io" in e.get("recipients", [])]
        final_task_emails = [e for e in alice_emails if "Final Code Submission" in e.get("subject", "")]
        self.assertEqual(len(final_task_emails), 0, "Completed submitters must be excluded from reminders!")

    def test_10_event_timeline_crud(self):
        """Test event timeline scheduling and live participant visibility."""
        scheduled_time = datetime.now(timezone.utc) + timedelta(hours=5)
        timeline_payload = {
            "title": "Live Mentorship Office Hours",
            "description": "Drop in with technical judges for architecture questions.",
            "scheduled_time": scheduled_time.isoformat(),
            "entry_type": "activity",
            "status": "Scheduled",
            "order": 1
        }

        # 1. Create timeline entry
        res_create = client.post(
            f"/api/events/{self.event.id}/timeline",
            json=timeline_payload,
            headers=self.headers_a
        )
        self.assertEqual(res_create.status_code, 200)
        entry_id = res_create.json()["id"]

        # 2. Update status to In Progress
        res_update = client.put(
            f"/api/events/{self.event.id}/timeline/{entry_id}",
            json={"status": "In Progress"},
            headers=self.headers_a
        )
        self.assertEqual(res_update.status_code, 200)
        self.assertEqual(res_update.json()["status"], "In Progress")

        # 3. View in participant live portal
        res_portal = client.get(f"/api/events/{self.event.id}/live-portal")
        timeline = res_portal.json()["timeline"]
        matched_entry = next((e for e in timeline if e["id"] == entry_id), None)
        self.assertIsNotNone(matched_entry)
        self.assertEqual(matched_entry["status"], "In Progress")

        # 4. Delete timeline entry
        res_delete = client.delete(
            f"/api/events/{self.event.id}/timeline/{entry_id}",
            headers=self.headers_a
        )
        self.assertEqual(res_delete.status_code, 200)

if __name__ == "__main__":
    unittest.main()
