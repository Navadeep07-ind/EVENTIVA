import os
import sys
import io
import uuid
import threading
import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

# Configure test environment
os.environ["TESTING"] = "1"
os.environ["MOCK_EMAIL"] = "1"

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app import models, crud, live_scheduler
from app.core.security import get_password_hash, create_access_token
from app.core.email import get_mock_sent_emails, clear_mock_sent_emails

client = TestClient(app)

class TestCriticalLiveWorkflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()
        clear_mock_sent_emails()
        cls.run_id = uuid.uuid4().hex[:6]

        # Organizer A (Event Owner)
        cls.org_a = models.User(
            email=f"org_alpha_{cls.run_id}@eventiva.in",
            hashed_password=get_password_hash("Pass123!"),
            full_name="Alpha Organizer",
            organization="Workflow Tech",
            is_verified=True
        )
        cls.db.add(cls.org_a)

        # Organizer B (Attacker / Other event organizer)
        cls.org_b = models.User(
            email=f"org_beta_{cls.run_id}@eventiva.in",
            hashed_password=get_password_hash("Pass456!"),
            full_name="Beta Intruder",
            organization="Rival Systems",
            is_verified=True
        )
        cls.db.add(cls.org_b)
        cls.db.commit()
        cls.db.refresh(cls.org_a)
        cls.db.refresh(cls.org_b)

        cls.token_a = create_access_token(data={"sub": cls.org_a.email})
        cls.headers_a = {"Authorization": f"Bearer {cls.token_a}"}
        cls.token_b = create_access_token(data={"sub": cls.org_b.email})
        cls.headers_b = {"Authorization": f"Bearer {cls.token_b}"}

        # Create Event with Asia/Kolkata timezone (+05:30)
        start_time = datetime.now(timezone.utc) + timedelta(hours=2)
        end_time = start_time + timedelta(hours=8)
        cls.event = models.Event(
            title=f"National Hackathon 2026 {cls.run_id}",
            description="High-velocity live coding and pitching summit",
            start_time=start_time,
            end_time=end_time,
            venue="Grand Innovation Hub",
            category="Hackathon",
            status="published",
            organizer_id=cls.org_a.id,
            registration_mode="Team",
            min_team_size=2,
            max_team_size=4
        )
        cls.db.add(cls.event)
        cls.db.commit()
        cls.db.refresh(cls.event)

        # Create Participant 1: Alice (Team Leader)
        cls.team = models.Team(
            event_id=cls.event.id,
            team_name=f"Vanguard_{cls.run_id}",
            invite_code=f"VANG-{cls.run_id.upper()}",
            status="Active"
        )
        cls.db.add(cls.team)
        cls.db.commit()
        cls.db.refresh(cls.team)

        cls.reg_alice = models.Registration(
            event_id=cls.event.id,
            full_name="Alice Smith",
            email=f"alice_{cls.run_id}@vanguard.dev",
            college="MIT Institute",
            status="Registered",
            ticket_code=f"EVT-ALICE-{cls.run_id.upper()}",
            team_id=cls.team.id
        )
        cls.db.add(cls.reg_alice)
        cls.db.commit()
        cls.db.refresh(cls.reg_alice)

        cls.team.leader_registration_id = cls.reg_alice.id
        cls.db.commit()

        # Create Participant 2: Bob (Teammate)
        cls.reg_bob = models.Registration(
            event_id=cls.event.id,
            full_name="Bob Jones",
            email=f"bob_{cls.run_id}@vanguard.dev",
            college="MIT Institute",
            status="Registered",
            ticket_code=f"EVT-BOB-{cls.run_id.upper()}",
            team_id=cls.team.id
        )
        cls.db.add(cls.reg_bob)

        # Create Participant 3: Charlie (Solo / Another event participant)
        cls.reg_charlie = models.Registration(
            event_id=cls.event.id,
            full_name="Charlie Solo",
            email=f"charlie_{cls.run_id}@solo.io",
            college="State University",
            status="Registered",
            ticket_code=f"EVT-CHARLIE-{cls.run_id.upper()}",
            team_id=None
        )
        cls.db.add(cls.reg_charlie)

        # Create Participant 4: David (Cancelled registration)
        cls.reg_david = models.Registration(
            event_id=cls.event.id,
            full_name="David Cancelled",
            email=f"david_{cls.run_id}@cancelled.org",
            college="State University",
            status="Cancelled",
            ticket_code=f"EVT-DAVID-{cls.run_id.upper()}",
            team_id=None
        )
        cls.db.add(cls.reg_david)
        cls.db.commit()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def setUp(self):
        clear_mock_sent_emails()

    # -------------------------------------------------------------------------
    # TEST 1: Task due at 5:00 PM schedules reminders at 4:30 PM (30m) & 4:50 PM (10m)
    # -------------------------------------------------------------------------
    def test_01_reminder_calculation_exact_times(self):
        """Verify absolute scheduled times calculated from task deadline."""
        deadline = datetime(2026, 11, 20, 17, 0, 0, tzinfo=timezone.utc)
        offsets = [30, 10]

        task = models.LiveTask(
            event_id=self.event.id,
            title="Design Document Submission",
            instructions="Submit system architecture and database schema in PDF.",
            deadline=deadline,
            timezone="UTC",
            target_audience="all",
            submission_method="file"
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        reminders = live_scheduler.calculate_and_schedule_task_reminders(
            db=self.db,
            task=task,
            reminder_offsets=offsets
        )
        self.assertEqual(len(reminders), 2)

        rem_30 = next(r for r in reminders if r.reminder_offset_minutes == 30)
        rem_10 = next(r for r in reminders if r.reminder_offset_minutes == 10)

        expected_30 = datetime(2026, 11, 20, 16, 30, 0, tzinfo=timezone.utc)
        expected_10 = datetime(2026, 11, 20, 16, 50, 0, tzinfo=timezone.utc)

        actual_30 = rem_30.scheduled_time if rem_30.scheduled_time.tzinfo else rem_30.scheduled_time.replace(tzinfo=timezone.utc)
        actual_10 = rem_10.scheduled_time if rem_10.scheduled_time.tzinfo else rem_10.scheduled_time.replace(tzinfo=timezone.utc)

        self.assertEqual(actual_30, expected_30)
        self.assertEqual(actual_10, expected_10)
        self.assertEqual(rem_30.status, "Scheduled")
        self.assertFalse(rem_30.is_sent)

    # -------------------------------------------------------------------------
    # TEST 2: Timezone conversions do not shift reminder times
    # -------------------------------------------------------------------------
    def test_02_timezone_conversions_consistent(self):
        """Verify event timezone conversion maintains correct absolute UTC scheduling."""
        deadline_utc = datetime(2026, 11, 20, 11, 30, 0, tzinfo=timezone.utc)
        
        task = models.LiveTask(
            event_id=self.event.id,
            title="Timezone Invariant Task",
            instructions="Ensure timezone offsets maintain exact relative windows.",
            deadline=deadline_utc,
            timezone="Asia/Kolkata", # UTC+05:30 -> 17:00 IST
            target_audience="all",
            submission_method="all"
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        reminders = live_scheduler.calculate_and_schedule_task_reminders(
            db=self.db,
            task=task,
            reminder_offsets=[30, 10]
        )
        self.assertEqual(len(reminders), 2)

        rem_30 = next(r for r in reminders if r.reminder_offset_minutes == 30)
        actual_30 = rem_30.scheduled_time if rem_30.scheduled_time.tzinfo else rem_30.scheduled_time.replace(tzinfo=timezone.utc)
        expected_30 = datetime(2026, 11, 20, 11, 0, 0, tzinfo=timezone.utc)
        self.assertEqual(actual_30, expected_30)

    # -------------------------------------------------------------------------
    # TEST 3: Backend restart / reload preserves scheduled reminders in SQLite
    # -------------------------------------------------------------------------
    def test_03_restart_preserves_scheduled_reminders(self):
        """Verify scheduled reminder jobs survive session teardown and database reconnect."""
        deadline = datetime.now(timezone.utc) + timedelta(hours=3)
        temp_db = SessionLocal()
        task = models.LiveTask(
            event_id=self.event.id,
            title="Restart Resilience Task",
            instructions="Must persist in SQLite across server restarts.",
            deadline=deadline,
            timezone="UTC"
        )
        temp_db.add(task)
        temp_db.commit()
        temp_db.refresh(task)

        live_scheduler.calculate_and_schedule_task_reminders(temp_db, task, [30, 10])
        task_id = task.id

        # Close session (simulating app shutdown)
        temp_db.close()

        # Reopen fresh session (simulating restart)
        new_session = SessionLocal()
        try:
            persisted_rems = new_session.query(models.TaskReminder).filter(
                models.TaskReminder.task_id == task_id
            ).all()
            self.assertEqual(len(persisted_rems), 2)
            self.assertTrue(all(r.status == "Scheduled" for r in persisted_rems))
            self.assertTrue(all(r.idempotency_key is not None for r in persisted_rems))
        finally:
            new_session.close()

    # -------------------------------------------------------------------------
    # TEST 4: Multiple worker atomic status claiming prevents duplicate delivery
    # -------------------------------------------------------------------------
    def test_04_multi_worker_atomic_claiming_prevents_duplicate_delivery(self):
        """Simulate concurrent worker processes attempting to process the same due reminder."""
        # Create a task due in 25 mins (so a 30m reminder is overdue and ready to process)
        now_utc = datetime.now(timezone.utc)
        deadline = now_utc + timedelta(minutes=25)
        
        task = models.LiveTask(
            event_id=self.event.id,
            title="Concurrent Worker Safety Task",
            instructions="Concurrent workers must never double-send reminders.",
            deadline=deadline,
            timezone="UTC",
            target_audience="all"
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        # Schedule reminder at now - 5 mins (due)
        due_time = now_utc - timedelta(minutes=5)
        rem = models.TaskReminder(
            event_id=self.event.id,
            task_id=task.id,
            reminder_offset_minutes=30,
            scheduled_time=due_time,
            status="Scheduled",
            idempotency_key=f"REM-TEST-CONCUR-{task.id}-30"
        )
        self.db.add(rem)
        self.db.commit()

        evt_id = self.event.id
        results = []
        def worker_run(worker_name):
            worker_db = SessionLocal()
            try:
                res = live_scheduler.process_due_task_reminders_robust(
                    db=worker_db,
                    now_override=now_utc,
                    event_id=evt_id
                )
                results.append((worker_name, len(res)))
            finally:
                worker_db.close()

        # Launch 3 concurrent workers in parallel threads
        threads = [threading.Thread(target=worker_run, args=(f"worker_{i}",)) for i in range(3)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        total_processed = sum(r[1] for r in results)
        # Exactly 1 worker should have claimed and processed the reminder!
        self.assertEqual(total_processed, 1)

        # Check DB state
        rem_refreshed = self.db.query(models.TaskReminder).filter(models.TaskReminder.id == rem.id).first()
        self.assertEqual(rem_refreshed.status, "Sent")
        self.assertTrue(rem_refreshed.is_sent)

    # -------------------------------------------------------------------------
    # TEST 5: Temporary email failures trigger bounded exponential backoff retries
    # -------------------------------------------------------------------------
    def test_05_temporary_email_failure_triggers_backoff_retry(self):
        """Temporary email dispatch failures mark reminder as Retry with incremented count."""
        now_utc = datetime.now(timezone.utc)
        deadline = now_utc + timedelta(minutes=25)

        task = models.LiveTask(
            event_id=self.event.id,
            title="Retry Backoff Test Task",
            instructions="Test exponential backoff retries on email failure.",
            deadline=deadline,
            timezone="UTC",
            target_audience="all"
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        rem = models.TaskReminder(
            event_id=self.event.id,
            task_id=task.id,
            reminder_offset_minutes=30,
            scheduled_time=now_utc - timedelta(minutes=2),
            status="Scheduled",
            idempotency_key=f"REM-TEST-RETRY-{task.id}-30"
        )
        self.db.add(rem)
        self.db.commit()

        # Mock send_email to fail temporarily
        with patch("app.live_scheduler.send_email", return_value={"status": "failed", "error": "SMTP server timeout 421"}):
            res = live_scheduler.process_due_task_reminders_robust(
                db=self.db,
                now_override=now_utc,
                event_id=self.event.id
            )

        self.db.refresh(rem)
        self.assertEqual(rem.status, "Retry")
        self.assertEqual(rem.retry_count, 1)
        self.assertIn("SMTP server timeout", rem.failure_reason)
        self.assertFalse(rem.is_sent)

    # -------------------------------------------------------------------------
    # TEST 6: Completed participants / teams are excluded from reminders
    # -------------------------------------------------------------------------
    def test_06_completed_participants_excluded_from_reminders(self):
        """Participants who have submitted or completed work receive NO reminder."""
        now_utc = datetime.now(timezone.utc)
        deadline = now_utc + timedelta(minutes=25)

        task = models.LiveTask(
            event_id=self.event.id,
            title="Submission Completion Filter Task",
            instructions="Submit deck.",
            deadline=deadline,
            timezone="UTC",
            target_audience="all"
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        # Team Vanguard submits work
        sub = models.TaskSubmission(
            task_id=task.id,
            event_id=self.event.id,
            team_id=self.team.id,
            registration_id=self.reg_alice.id,
            submission_text="Vanguard slide deck completed.",
            status="Submitted",
            is_late=False,
            version=1,
            submitted_at=now_utc
        )
        self.db.add(sub)

        # Create due reminder
        rem = models.TaskReminder(
            event_id=self.event.id,
            task_id=task.id,
            reminder_offset_minutes=30,
            scheduled_time=now_utc - timedelta(minutes=1),
            status="Scheduled",
            idempotency_key=f"REM-EXCL-{task.id}-30"
        )
        self.db.add(rem)
        self.db.commit()

        clear_mock_sent_emails()
        res = live_scheduler.process_due_task_reminders_robust(
            db=self.db,
            now_override=now_utc,
            event_id=self.event.id
        )

        sent_emails = get_mock_sent_emails()
        # Alice and Bob belong to Vanguard and should NOT receive reminder email!
        sent_recipients = [e["to"] for e in sent_emails]
        self.assertNotIn(self.reg_alice.email, sent_recipients)
        self.assertNotIn(self.reg_bob.email, sent_recipients)

        # Cancelled David should NOT receive reminder email
        self.assertNotIn(self.reg_david.email, sent_recipients)

        # Charlie (Solo, not submitted) SHOULD receive reminder email
        self.assertIn(self.reg_charlie.email, sent_recipients)

    # -------------------------------------------------------------------------
    # TEST 7: Direct task-specific submission link opens correct task
    # -------------------------------------------------------------------------
    def test_07_direct_task_submission_link_endpoint(self):
        """GET /api/events/{eventId}/tasks/{taskId}/public returns full task view."""
        deadline = datetime.now(timezone.utc) + timedelta(hours=4)
        task = models.LiveTask(
            event_id=self.event.id,
            title="Direct Link Portal Task",
            instructions="Participants navigate directly via QR code or link.",
            deadline=deadline,
            timezone="Asia/Kolkata",
            deliverable_checklist=["Architecture Diagram", "README file"],
            require_url=True,
            ai_verification_enabled=True
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        # Query direct endpoint anonymously with ticket_code param
        res = client.get(
            f"/api/events/{self.event.id}/tasks/{task.id}/public",
            params={"ticket_code": self.reg_alice.ticket_code}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["task"]["title"], "Direct Link Portal Task")
        self.assertTrue(data["task"]["require_url"])
        self.assertEqual(data["participant_name"], "Alice Smith")
        self.assertEqual(data["team_name"], self.team.team_name)
        self.assertTrue(data["is_registered"])
        self.assertFalse(data["is_expired"])
        self.assertIn("Architecture Diagram", data["task"]["deliverable_checklist"])

    # -------------------------------------------------------------------------
    # TEST 8: Unauthorized participants cannot view or modify another's submission
    # -------------------------------------------------------------------------
    def test_08_submission_cross_participant_isolation(self):
        """Charlie cannot submit under Alice's ticket or modify Vanguard's submission."""
        deadline = datetime.now(timezone.utc) + timedelta(hours=2)
        task = models.LiveTask(
            event_id=self.event.id,
            title="Isolation Test Task",
            instructions="Check unauthorized access.",
            deadline=deadline
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        # Alice creates submission for Vanguard
        res_alice = client.post(
            f"/api/events/{self.event.id}/tasks/{task.id}/submit",
            data={
                "ticket_code": self.reg_alice.ticket_code,
                "submission_text": "Vanguard Official Submission"
            }
        )
        self.assertEqual(res_alice.status_code, 200)

        # Non-existent ticket fails with 401 / 404
        res_fake = client.post(
            f"/api/events/{self.event.id}/tasks/{task.id}/submit",
            data={
                "ticket_code": "EVT-NONEXISTENT-CODE",
                "submission_text": "Attacker payload"
            }
        )
        self.assertIn(res_fake.status_code, [401, 403, 404])

        # Charlie queries portal: sees his own submission (None yet), NOT Vanguard's
        res_charlie_portal = client.get(
            f"/api/events/{self.event.id}/tasks/{task.id}/public",
            params={"ticket_code": self.reg_charlie.ticket_code}
        )
        self.assertEqual(res_charlie_portal.status_code, 200)
        charlie_data = res_charlie_portal.json()
        self.assertIsNone(charlie_data["my_submission"])

    # -------------------------------------------------------------------------
    # TEST 9: Individual and team submissions follow correct authorization rules
    # -------------------------------------------------------------------------
    def test_09_team_submission_shared_among_members(self):
        """Teammate Bob can see and resubmit team work, but non-members cannot."""
        deadline = datetime.now(timezone.utc) + timedelta(hours=2)
        task = models.LiveTask(
            event_id=self.event.id,
            title="Team Sharing Test Task",
            instructions="All team members share single submission state.",
            deadline=deadline
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        # Alice submits on behalf of Vanguard
        client.post(
            f"/api/events/{self.event.id}/tasks/{task.id}/submit",
            data={
                "ticket_code": self.reg_alice.ticket_code,
                "submission_text": "Alice initial submission"
            }
        )

        # Bob views direct portal: sees team submission!
        res_bob = client.get(
            f"/api/events/{self.event.id}/tasks/{task.id}/public",
            params={"ticket_code": self.reg_bob.ticket_code}
        )
        self.assertEqual(res_bob.status_code, 200)
        bob_data = res_bob.json()
        self.assertIsNotNone(bob_data["my_submission"])
        self.assertEqual(bob_data["my_submission"]["submission_text"], "Alice initial submission")

    # -------------------------------------------------------------------------
    # TEST 10: Invalid, oversized, or unsafe (.exe, .sh) uploads rejected
    # -------------------------------------------------------------------------
    def test_10_invalid_and_unsafe_uploads_rejected(self):
        """Reject executable scripts, oversized files, and missing required URLs."""
        deadline = datetime.now(timezone.utc) + timedelta(hours=2)
        task = models.LiveTask(
            event_id=self.event.id,
            title="Security Upload Task",
            instructions="PDF only.",
            allowed_file_types=".pdf",
            max_file_size_mb=1,
            require_url=True,
            deadline=deadline
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        # 1. Unsafe executable .exe rejected
        fake_exe = io.BytesIO(b"MZ\x90\x00BinaryExeContent")
        res_exe = client.post(
            f"/api/events/{self.event.id}/tasks/{task.id}/submit",
            data={"ticket_code": self.reg_alice.ticket_code, "submission_url": "https://github.com/vanguard/proj"},
            files={"file": ("malware.exe", fake_exe, "application/octet-stream")}
        )
        self.assertEqual(res_exe.status_code, 400)
        self.assertIn(".exe", res_exe.json()["detail"])

        # 2. Missing required URL rejected
        pdf_content = io.BytesIO(b"%PDF-1.4 Minimal PDF document content")
        res_nourl = client.post(
            f"/api/events/{self.event.id}/tasks/{task.id}/submit",
            data={"ticket_code": self.reg_alice.ticket_code}, # missing required URL
            files={"file": ("slides.pdf", pdf_content, "application/pdf")}
        )
        self.assertEqual(res_nourl.status_code, 400)
        self.assertIn("required", res_nourl.json()["detail"].lower())

    # -------------------------------------------------------------------------
    # TEST 11: Submission confirmation appears only after successful persistence
    # -------------------------------------------------------------------------
    def test_11_submission_persistence_guarantee(self):
        """Submission record exists in database before 200 response is finalized."""
        deadline = datetime.now(timezone.utc) + timedelta(hours=2)
        task = models.LiveTask(
            event_id=self.event.id,
            title="Persistence Guarantee Task",
            instructions="Must be persisted reliably.",
            deadline=deadline
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        res = client.post(
            f"/api/events/{self.event.id}/tasks/{task.id}/submit",
            data={
                "ticket_code": self.reg_charlie.ticket_code,
                "submission_text": "Charlie verified persistence text."
            }
        )
        self.assertEqual(res.status_code, 200)
        sub_id = res.json()["id"]

        # Confirm in SQLite database
        db_sub = self.db.query(models.TaskSubmission).filter(models.TaskSubmission.id == sub_id).first()
        self.assertIsNotNone(db_sub)
        self.assertEqual(db_sub.submission_text, "Charlie verified persistence text.")
        self.assertEqual(db_sub.version, 1)

    # -------------------------------------------------------------------------
    # TEST 12: AI verification compares content against actual organizer instructions & checklist
    # -------------------------------------------------------------------------
    def test_12_ai_verification_evaluates_against_checklist(self):
        """AI compares submitted content against organizer instructions and checklist."""
        task = models.LiveTask(
            event_id=self.event.id,
            title="AI Verification Criteria Task",
            instructions="Submit presentation deck with system architecture diagram and GitHub repo.",
            deliverable_checklist=[
                "System architecture diagram included",
                "Working GitHub repository"
            ],
            submission_method="all",
            deadline=datetime.now(timezone.utc) + timedelta(hours=2)
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        sub = models.TaskSubmission(
            task_id=task.id,
            event_id=self.event.id,
            registration_id=self.reg_charlie.id,
            submission_text="Our system architecture diagram illustrates microservices and event queues.",
            submission_url="https://github.com/charlie/microservices-app",
            status="Submitted",
            version=1,
            submitted_at=datetime.now(timezone.utc)
        )
        self.db.add(sub)
        self.db.commit()
        self.db.refresh(sub)

        # Run verification engine (deterministic rule-based fallback mode)
        assessment = live_scheduler.verify_submission_with_ai(
            db=self.db,
            submission_id=sub.id
        )

        self.assertIn("checklist_results", assessment)
        self.assertGreaterEqual(len(assessment["checklist_results"]), 2)
        
        # Verify citations and statuses
        arch_res = next((c for c in assessment["checklist_results"] if "architecture diagram" in c["criteria"].lower()), None)
        self.assertIsNotNone(arch_res)
        self.assertEqual(arch_res["status"], "PASS")
        self.assertIn("architecture diagram", arch_res["evidence_quote_or_citation"].lower())

    # -------------------------------------------------------------------------
    # TEST 13: Missing evidence results in Needs Manual Review, not a fabricated pass
    # -------------------------------------------------------------------------
    def test_13_missing_evidence_flags_needs_manual_review(self):
        """Empty or ambiguous submissions flag Needs Manual Review rather than inventing pass."""
        task = models.LiveTask(
            event_id=self.event.id,
            title="Rigorous Evidence Task",
            instructions="Must include system benchmarks and load test graphs.",
            deliverable_checklist=["Benchmark metrics graph", "Latency under 50ms proof"],
            deadline=datetime.now(timezone.utc) + timedelta(hours=2)
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        sub = models.TaskSubmission(
            task_id=task.id,
            event_id=self.event.id,
            registration_id=self.reg_charlie.id,
            submission_text="Here is our code.", # completely missing benchmarks & latency proof
            status="Submitted",
            version=1,
            submitted_at=datetime.now(timezone.utc)
        )
        self.db.add(sub)
        self.db.commit()
        self.db.refresh(sub)

        assessment = live_scheduler.verify_submission_with_ai(
            db=self.db,
            submission_id=sub.id
        )

        # Must NOT be Passed!
        self.assertIn(assessment["overall_result"], ["Needs Correction", "Needs Manual Review"])
        self.assertNotEqual(assessment["overall_result"], "Passed")

    # -------------------------------------------------------------------------
    # TEST 14: AI provider failure does not destroy submission
    # -------------------------------------------------------------------------
    def test_14_ai_provider_failure_does_not_destroy_submission(self):
        """Simulate unexpected AI API failure; submission remains intact and organizer alerted."""
        task = models.LiveTask(
            event_id=self.event.id,
            title="Fault Tolerant AI Task",
            instructions="AI engine robustness under network drop.",
            deadline=datetime.now(timezone.utc) + timedelta(hours=2)
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        sub = models.TaskSubmission(
            task_id=task.id,
            event_id=self.event.id,
            registration_id=self.reg_charlie.id,
            submission_text="Critical participant work that must not be lost.",
            status="Submitted",
            version=1,
            submitted_at=datetime.now(timezone.utc)
        )
        self.db.add(sub)
        self.db.commit()
        self.db.refresh(sub)

        # Force exception inside AI engine
        with patch("app.live_scheduler.extract_submission_content", side_effect=RuntimeError("AI Engine Socket Disconnect")):
            assessment = live_scheduler.verify_submission_with_ai(
                db=self.db,
                submission_id=sub.id
            )

        self.assertEqual(assessment["overall_result"], "Needs Manual Review")
        self.assertIn("error", assessment["summary"].lower())

        # Submission in DB remains intact!
        self.db.refresh(sub)
        self.assertEqual(sub.submission_text, "Critical participant work that must not be lost.")
        self.assertEqual(sub.ai_status, "Needs Manual Review")

    # -------------------------------------------------------------------------
    # TEST 15: Correction requests permit authorized resubmission & increments version
    # -------------------------------------------------------------------------
    def test_15_correction_requests_and_version_increment(self):
        """Organizer requests correction -> Participant updates work -> version increments."""
        deadline = datetime.now(timezone.utc) + timedelta(hours=2)
        task = models.LiveTask(
            event_id=self.event.id,
            title="Versioning Workflow Task",
            instructions="Upload initial draft, then revise.",
            deadline=deadline
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        # 1. Initial submission v1
        res_v1 = client.post(
            f"/api/events/{self.event.id}/tasks/{task.id}/submit",
            data={
                "ticket_code": self.reg_charlie.ticket_code,
                "submission_text": "Version 1 draft without appendix"
            }
        )
        self.assertEqual(res_v1.status_code, 200)
        self.assertEqual(res_v1.json()["version"], 1)
        sub_id = res_v1.json()["id"]

        # 2. Organizer reviews and requests corrections
        res_review = client.post(
            f"/api/events/{self.event.id}/submissions/{sub_id}/review",
            json={"status": "Correction Required", "organizer_feedback": "Please attach appendix section."},
            headers=self.headers_a
        )
        self.assertEqual(res_review.status_code, 200)

        # 3. Participant resubmits with appendix -> version 2
        res_v2 = client.post(
            f"/api/events/{self.event.id}/tasks/{task.id}/submit",
            data={
                "ticket_code": self.reg_charlie.ticket_code,
                "submission_text": "Version 2 draft WITH appendix section completed"
            }
        )
        self.assertEqual(res_v2.status_code, 200)
        v2_data = res_v2.json()
        self.assertEqual(v2_data["version"], 2)
        self.assertEqual(v2_data["submission_text"], "Version 2 draft WITH appendix section completed")

        # 4. Check versions audit trail
        history_records = self.db.query(models.TaskSubmissionVersion).filter(
            models.TaskSubmissionVersion.submission_id == sub_id
        ).all()
        self.assertGreaterEqual(len(history_records), 1)

    # -------------------------------------------------------------------------
    # TEST 16: Organizer dashboard displays persisted AI results and override decisions
    # -------------------------------------------------------------------------
    def test_16_organizer_override_workflow(self):
        """Organizer can override AI result with recorded reason, displayed in dashboard."""
        deadline = datetime.now(timezone.utc) + timedelta(hours=2)
        task = models.LiveTask(
            event_id=self.event.id,
            title="Organizer Override Task",
            instructions="Human in the loop override test.",
            deadline=deadline
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        # Create submission flagged with Needs Correction by AI
        sub = models.TaskSubmission(
            task_id=task.id,
            event_id=self.event.id,
            registration_id=self.reg_charlie.id,
            submission_text="Custom architecture format.",
            status="Submitted",
            ai_status="Needs Correction",
            version=1,
            submitted_at=datetime.now(timezone.utc)
        )
        self.db.add(sub)
        self.db.commit()
        self.db.refresh(sub)

        # Non-owner cannot override (403)
        res_intruder = client.post(
            f"/api/events/{self.event.id}/submissions/{sub.id}/override",
            json={
                "decision": "Approved",
                "reason": "Intruder attempting override",
                "feedback": "None"
            },
            headers=self.headers_b
        )
        self.assertEqual(res_intruder.status_code, 403)

        # Legitimate organizer overrides AI decision to Approved
        res_owner = client.post(
            f"/api/events/{self.event.id}/submissions/{sub.id}/override",
            json={
                "decision": "Approved",
                "reason": "Diagram verified manually via appendix page 4",
                "feedback": "Approved upon manual visual inspection."
            },
            headers=self.headers_a
        )
        self.assertEqual(res_owner.status_code, 200)
        overridden = res_owner.json()
        self.assertEqual(overridden["status"], "Verified")
        self.assertEqual(overridden["organizer_decision"], "Approved")
        self.assertEqual(overridden["organizer_override_reason"], "Diagram verified manually via appendix page 4")

        # Diagnostics endpoint reports verified count
        res_diag = client.get(f"/api/events/{self.event.id}/live-tasks/diagnostics", headers=self.headers_a)
        self.assertEqual(res_diag.status_code, 200)
        self.assertGreaterEqual(res_diag.json()["submissions"]["verified"], 1)

    # -------------------------------------------------------------------------
    # TEST 17: Completed submissions stop receiving reminders
    # -------------------------------------------------------------------------
    def test_17_completed_submissions_stop_receiving_reminders(self):
        """Once work is completed or verified, subsequent due reminders skip recipient."""
        now_utc = datetime.now(timezone.utc)
        deadline = now_utc + timedelta(minutes=8) # less than 10 mins

        task = models.LiveTask(
            event_id=self.event.id,
            title="Final Reminder Exclusion Task",
            instructions="Must stop reminders once completed.",
            deadline=deadline,
            timezone="UTC"
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        # Charlie completed his work and is marked Verified
        sub = models.TaskSubmission(
            task_id=task.id,
            event_id=self.event.id,
            registration_id=self.reg_charlie.id,
            submission_text="All deliverables finished and approved.",
            status="Verified",
            version=1,
            submitted_at=now_utc
        )
        self.db.add(sub)

        # Schedule 10 min reminder
        rem = models.TaskReminder(
            event_id=self.event.id,
            task_id=task.id,
            reminder_offset_minutes=10,
            scheduled_time=now_utc - timedelta(minutes=1),
            status="Scheduled",
            idempotency_key=f"REM-FINAL-{task.id}-10"
        )
        self.db.add(rem)
        self.db.commit()

        clear_mock_sent_emails()
        res = live_scheduler.process_due_task_reminders_robust(
            db=self.db,
            now_override=now_utc,
            event_id=self.event.id
        )

        sent_emails = get_mock_sent_emails()
        # Charlie is Verified and MUST NOT be in sent emails
        self.assertNotIn(self.reg_charlie.email, [e["to"] for e in sent_emails])

    # -------------------------------------------------------------------------
    # TEST 18: Existing tickets, check-in, team registration, and notifications pass
    # -------------------------------------------------------------------------
    def test_18_system_regression_and_idempotency(self):
        """Verify ticket check-in and team invitation idempotency remain intact."""
        # Query ticket for Alice
        res_ticket = client.get(f"/api/tickets/{self.reg_alice.ticket_code}")
        self.assertEqual(res_ticket.status_code, 200)
        self.assertTrue(res_ticket.json()["is_valid_for_admission"])

        # Check-in Alice
        res_checkin = client.post(
            f"/api/events/{self.event.id}/check-in",
            json={"ticket_code": self.reg_alice.ticket_code},
            headers=self.headers_a
        )
        self.assertEqual(res_checkin.status_code, 200)
        self.assertTrue(res_checkin.json()["checked_in"])

        # Second check-in attempt is idempotent / indicates already checked in
        res_checkin_2 = client.post(
            f"/api/events/{self.event.id}/check-in",
            json={"ticket_code": self.reg_alice.ticket_code},
            headers=self.headers_a
        )
        self.assertEqual(res_checkin_2.status_code, 200)

    # -------------------------------------------------------------------------
    # TEST 19: Manual 'Send Reminder Now' triggers immediate delivery to unsubmitted participants
    # -------------------------------------------------------------------------
    def test_19_send_task_reminder_now_endpoint(self):
        """Organizer can manually dispatch an immediate reminder for an active task."""
        task = models.LiveTask(
            event_id=self.event.id,
            title="Instant On-Demand Reminder Task",
            instructions="Submit your final project deck.",
            submission_method="file",
            deadline=datetime.now(timezone.utc) + timedelta(hours=3),
            target_audience="all"
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        clear_mock_sent_emails()
        res = client.post(
            f"/api/events/{self.event.id}/live-tasks/{task.id}/reminders/send-now",
            headers=self.headers_a
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertGreater(data["delivered_count"], 0)

        # Verify email was dispatched
        sent_emails = get_mock_sent_emails()
        recipients = [e["to"] for e in sent_emails]
        self.assertIn(self.reg_alice.email, recipients)

if __name__ == "__main__":
    unittest.main()
