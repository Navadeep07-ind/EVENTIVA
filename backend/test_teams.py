import os
import sys
import unittest

os.environ["TESTING"] = "1"
os.environ["MOCK_EMAIL"] = "1"

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.app.main import app, ensure_database_migrated
from backend.app.database import engine, Base, SessionLocal
from backend.app import models

class TestTeamRegistrationEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        ensure_database_migrated()
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Create or fetch organizer user
        from backend.app.core.security import get_password_hash, create_access_token
        test_email = "team_organizer@eventiva.org"
        cls.user = cls.db.query(models.User).filter(models.User.email == test_email).first()
        if not cls.user:
            cls.user = models.User(
                email=test_email,
                hashed_password=get_password_hash("testpass123"),
                full_name="Team Organizer",
                organization="Eventiva Test Org",
                is_verified=True
            )
            cls.db.add(cls.user)
            cls.db.commit()
            cls.db.refresh(cls.user)

        cls.token = create_access_token(data={"sub": cls.user.email})
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_complete_team_lifecycle(self):
        # 1. Create a published event configured for Team registration (2 to 3 members)
        event_payload = {
            "title": "HackSprint 2026",
            "description": "Annual 48-hour build hackathon for engineering teams.",
            "category": "Hackathon",
            "venue": "Campus Innovation Lab & Hall B",
            "registration_mode": "team",
            "min_team_size": 2,
            "max_team_size": 3,
            "status": "Published",
            "form_schema": [
                {"id": "name", "label": "Full Name", "type": "text", "required": True},
                {"id": "email", "label": "Email Address", "type": "email", "required": True},
                {"id": "github", "label": "GitHub Profile", "type": "url", "required": False}
            ]
        }
        res = self.client.post("/api/events", json=event_payload, headers=self.headers)
        self.assertEqual(res.status_code, 200, res.text)
        event_data = res.json()
        event_id = event_data["id"]
        self.assertEqual(event_data["registration_mode"], "team")
        self.assertEqual(event_data["min_team_size"], 2)
        self.assertEqual(event_data["max_team_size"], 3)

        # 2. Team Leader creates team "Alpha Coders"
        team_create_payload = {
            "team_name": "Alpha Coders",
            "leader": {
                "full_name": "Alice Sharma",
                "email": "alice.leader@sprint.org",
                "college": "TKR College of Engineering",
                "custom_answers": {
                    "name": "Alice Sharma",
                    "email": "alice.leader@sprint.org",
                    "github": "https://github.com/alice-sharma"
                }
            }
        }
        team_res = self.client.post(f"/api/events/{event_id}/teams", json=team_create_payload)
        self.assertEqual(team_res.status_code, 200, team_res.text)
        team_resp_data = team_res.json()

        self.assertIn("team", team_resp_data)
        team_info = team_resp_data["team"]
        self.assertEqual(team_info["team_name"], "Alpha Coders")
        self.assertTrue(team_info["invite_code"].startswith("TEAM-"))
        self.assertEqual(team_info["current_member_count"], 1)
        self.assertEqual(team_info["spots_remaining"], 2)
        self.assertFalse(team_info["is_full"])

        # Check leader ticket
        leader_ticket = team_resp_data["ticket_code"]
        self.assertTrue(leader_ticket.startswith("EVT-"))
        self.assertEqual(team_resp_data["registration"]["is_team_leader"], True)

        invite_code = team_info["invite_code"]
        team_id = team_info["id"]

        # 3. Duplicate Team Name within the same event must be rejected
        dup_res = self.client.post(f"/api/events/{event_id}/teams", json=team_create_payload)
        self.assertEqual(dup_res.status_code, 400)
        self.assertIn("already exists", dup_res.json()["detail"].lower())

        # 4. Public Invite Endpoint verification (Sanitized - NO private emails exposed!)
        pub_invite_res = self.client.get(f"/api/teams/invite/{invite_code}")
        self.assertEqual(pub_invite_res.status_code, 200, pub_invite_res.text)
        pub_data = pub_invite_res.json()
        self.assertEqual(pub_data["team_name"], "Alpha Coders")
        self.assertEqual(pub_data["leader_name"], "Alice Sharma")
        self.assertEqual(pub_data["current_member_count"], 1)
        self.assertEqual(pub_data["spots_remaining"], 2)
        self.assertEqual(pub_data["can_join"], True)
        self.assertNotIn("email", pub_data)  # Leader email NOT exposed publicly

        # 5. Member 2 joins team via invite code
        join_payload_2 = {
            "full_name": "Bob Builder",
            "email": "bob.builder@sprint.org",
            "college": "TKR College of Engineering",
            "custom_answers": {
                "name": "Bob Builder",
                "email": "bob.builder@sprint.org",
                "github": "https://github.com/bob-builder"
            }
        }
        join_res_2 = self.client.post(f"/api/teams/invite/{invite_code}/join", json=join_payload_2)
        self.assertEqual(join_res_2.status_code, 200, join_res_2.text)
        join_data_2 = join_res_2.json()
        self.assertTrue(join_data_2["ticket_code"].startswith("EVT-"))
        self.assertNotEqual(join_data_2["ticket_code"], leader_ticket)  # Each member gets unique ticket!
        self.assertEqual(join_data_2["registration"]["is_team_leader"], False)

        # 6. Member 3 joins team via invite code (Reaches max capacity of 3)
        join_payload_3 = {
            "full_name": "Charlie Dev",
            "email": "charlie.dev@sprint.org",
            "college": "IIT Hyderabad",
            "custom_answers": {
                "name": "Charlie Dev",
                "email": "charlie.dev@sprint.org"
            }
        }
        join_res_3 = self.client.post(f"/api/teams/invite/{invite_code}/join", json=join_payload_3)
        self.assertEqual(join_res_3.status_code, 200, join_res_3.text)

        # Now public invite should show team is full
        pub_invite_res_after = self.client.get(f"/api/teams/invite/{invite_code}")
        pub_data_after = pub_invite_res_after.json()
        self.assertEqual(pub_data_after["current_member_count"], 3)
        self.assertEqual(pub_data_after["spots_remaining"], 0)
        self.assertEqual(pub_data_after["is_full"], True)
        self.assertEqual(pub_data_after["can_join"], False)

        # 7. Member 4 attempts to join full team -> Must be rejected with 400
        join_payload_4 = {
            "full_name": "Dave Overflow",
            "email": "dave.overflow@sprint.org",
            "college": "NIT Warangal"
        }
        join_res_4 = self.client.post(f"/api/teams/invite/{invite_code}/join", json=join_payload_4)
        self.assertEqual(join_res_4.status_code, 400)
        self.assertIn("capacity", join_res_4.json()["detail"].lower())

        # 8. Idempotency: Member 2 retrying join with same email -> returns existing registration
        retry_res_2 = self.client.post(f"/api/teams/invite/{invite_code}/join", json=join_payload_2)
        self.assertEqual(retry_res_2.status_code, 200)
        self.assertEqual(retry_res_2.json()["ticket_code"], join_data_2["ticket_code"])

        # 9. Invalid invite code -> Returns 404
        inv_res = self.client.get("/api/teams/invite/TEAM-NONEXISTENT")
        self.assertEqual(inv_res.status_code, 404)

        # 10. Participant Team Hub Endpoint
        hub_res = self.client.get(f"/api/teams/hub/{invite_code}")
        self.assertEqual(hub_res.status_code, 200, hub_res.text)
        hub_data = hub_res.json()
        self.assertEqual(hub_data["team_name"], "Alpha Coders")
        self.assertEqual(len(hub_data["members"]), 3)
        # Check roster display
        member_names = [m["full_name"] for m in hub_data["members"]]
        self.assertIn("Alice Sharma", member_names)
        self.assertIn("Bob Builder", member_names)
        self.assertIn("Charlie Dev", member_names)
        # Verify no email fields in public team member roster
        for m in hub_data["members"]:
            self.assertNotIn("email", m)

        # 11. Organizer Teams Management View (Authorized)
        org_teams_res = self.client.get(f"/api/events/{event_id}/teams", headers=self.headers)
        self.assertEqual(org_teams_res.status_code, 200, org_teams_res.text)
        org_teams = org_teams_res.json()
        self.assertEqual(len(org_teams), 1)
        self.assertEqual(org_teams[0]["team_name"], "Alpha Coders")
        self.assertEqual(org_teams[0]["leader_email"], "alice.leader@sprint.org")
        self.assertEqual(org_teams[0]["current_member_count"], 3)
        self.assertEqual(org_teams[0]["is_complete"], True)

        # 12. Check Individual Tickets can be fetched for all team members
        for code in [leader_ticket, join_data_2["ticket_code"]]:
            t_res = self.client.get(f"/api/tickets/{code}")
            self.assertEqual(t_res.status_code, 200)
            t_data = t_res.json()
            self.assertEqual(t_data["team_name"], "Alpha Coders")

        # 13. Check Check-In works seamlessly for team member tickets
        checkin_res = self.client.post(
            f"/api/events/{event_id}/check-in",
            json={"ticket_code": leader_ticket},
            headers=self.headers
        )
        self.assertEqual(checkin_res.status_code, 200)
        self.assertEqual(checkin_res.json()["status"], "success")

        # 14. Organizer Excel Export includes Team Name and Team Role
        export_res = self.client.get(f"/api/events/{event_id}/registrations/export", headers=self.headers)
        self.assertEqual(export_res.status_code, 200)
        import openpyxl
        import io
        wb = openpyxl.load_workbook(io.BytesIO(export_res.content))
        ws = wb.active
        headers_row = [cell.value for cell in ws[1]]
        self.assertIn("Team Name", headers_row)
        self.assertIn("Team Role", headers_row)

        team_name_idx = headers_row.index("Team Name") + 1
        team_role_idx = headers_row.index("Team Role") + 1

        roles_found = [ws.cell(row=r, column=team_role_idx).value for r in range(2, ws.max_row + 1)]
        self.assertIn("Team Leader", roles_found)
        self.assertIn("Team Member", roles_found)

        team_names_found = [ws.cell(row=r, column=team_name_idx).value for r in range(2, ws.max_row + 1)]
        for tn in team_names_found:
            self.assertEqual(tn, "Alpha Coders")

if __name__ == "__main__":
    unittest.main()
