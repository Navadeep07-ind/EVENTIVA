import asyncio
import httpx
import json

async def main():
    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=60.0) as client:
        # Authenticate
        resp = await client.post("/api/auth/token", data={"username": "testuser@example.com", "password": "password123"})
        if resp.status_code != 200:
            print("Failed to authenticate:", resp.text)
            return
        token = resp.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}

        print("==================================================")
        print("TEST 1: NEUTRALITY & BRAND ISOLATION ACROSS EVENTS")
        print("==================================================")

        # Case A: TKRCET Explicit Event
        tkrcet_text = """
        TKR COLLEGE OF ENGINEERING AND TECHNOLOGY (TKRCET)
        Accredited by NBA and NAAC with 'A+' Grade
        DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING
        PRESENTS NOVENTRIX 2K26
        Date: 30th September 2026, Venue: K9 Auditorium
        """
        rA = await client.post("/api/ai/generate-poster-content", json={"event_details": tkrcet_text, "style": "College Symposium"}, headers=headers)
        resA = rA.json()
        print("\n[Case A - Explicit TKRCET]")
        print(f"Title: {resA.get('title')}")
        print(f"Institution: {resA.get('institution_name')}")
        print(f"Left Logo: {resA.get('left_logo_asset')}")
        print(f"Right Badge: {resA.get('right_badge_asset')}")
        assert "TKR" in resA.get("institution_name", "").upper() or "TKRCET" in resA.get("institution_name", "").upper(), "Case A failed: Expected TKRCET institution"

        # Case B: Other College (MIT / Stanford)
        mit_text = """
        MASSACHUSETTS INSTITUTE OF TECHNOLOGY
        Department of Electrical Engineering and Computer Science
        PRESENTS MIT HACKATHON 2026
        Date: 15th October 2026, Venue: Kresge Auditorium, Cambridge MA
        """
        rB = await client.post("/api/ai/generate-poster-content", json={"event_details": mit_text, "style": "Modern Tech"}, headers=headers)
        resB = rB.json()
        print("\n[Case B - MIT / Other College]")
        print(f"Title: {resB.get('title')}")
        print(f"Institution: {resB.get('institution_name')}")
        print(f"Left Logo: {resB.get('left_logo_asset')}")
        print(f"Right Badge: {resB.get('right_badge_asset')}")
        print(f"Backdrop: {resB.get('venue_backdrop_asset')}")
        assert "TKR" not in str(resB).upper(), "Case B failed: Found TKR references in non-TKR college event"
        assert resB.get('left_logo_asset') != 'tkrcet_logo', "Case B failed: TKRCET logo was assigned to MIT"
        assert resB.get('right_badge_asset') != 'naac_badge', "Case B failed: NAAC badge was assigned to MIT"

        # Case C: Business Conference
        biz_text = """
        GLOBAL FINTECH LEADERSHIP SUMMIT 2026
        Keynote by Industry Leaders & Investors
        Date: 12th December 2026, Venue: Grand Hyatt Hotel, Singapore
        Organized by Apex Financial Media Group
        """
        rC = await client.post("/api/ai/generate-poster-content", json={"event_details": biz_text, "style": "Luxury Corporate"}, headers=headers)
        resC = rC.json()
        print("\n[Case C - Business Conference]")
        print(f"Title: {resC.get('title')}")
        print(f"Institution: {resC.get('institution_name')}")
        print(f"Left Logo: {resC.get('left_logo_asset')}")
        print(f"Right Badge: {resC.get('right_badge_asset')}")
        assert "TKR" not in str(resC).upper(), "Case C failed: Found TKR in Business Conference"
        assert resC.get('left_logo_asset') == 'none', "Case C failed: Logo invented for business without logo"
        assert resC.get('right_badge_asset') == 'none', "Case C failed: Badge invented for business without badge"

        # Case D: Birthday Party
        bday_text = """
        Liam's 10th Superhero Birthday Party!
        Join us for laser tag, cake, and arcade games!
        Date: Saturday, July 18th at 3:00 PM
        Venue: Adventure Park Arcade, 123 Fun Street
        RSVP: Sarah (555-0199)
        """
        rD = await client.post("/api/ai/generate-poster-content", json={"event_details": bday_text, "style": "Festive Vibrant"}, headers=headers)
        resD = rD.json()
        print("\n[Case D - Birthday Party]")
        print(f"Title: {resD.get('title')}")
        print(f"Institution: {resD.get('institution_name')}")
        print(f"Has Header: {resD.get('has_institution_header')}")
        print(f"Left Logo: {resD.get('left_logo_asset')}")
        assert "TKR" not in str(resD).upper(), "Case D failed: Found TKR in Birthday"
        assert not resD.get('has_institution_header') or resD.get('institution_name') == '', "Case D failed: Invented institution for Birthday"
        assert resD.get('left_logo_asset') == 'none', "Case D failed: Invented logo for Birthday"

        print("\n==================================================")
        print("TEST 2: AI CONVERSATIONAL EDITING ACTIONS")
        print("==================================================")

        current_state = {
            "canvasConfig": {
                "width": 800,
                "height": 1130,
                "bgImage": "",
                "bgColor": "#0b0f19"
            },
            "layers": [
                {
                    "id": "hero-title-1",
                    "name": "Event Title",
                    "type": "text",
                    "text": "INNOVEX 2026",
                    "fontFamily": "Inter",
                    "fontSize": 90,
                    "color": "#ffffff",
                    "x": 400,
                    "y": 300,
                    "zIndex": 10
                },
                {
                    "id": "date-time-1",
                    "name": "Date & Time",
                    "type": "text",
                    "text": "OCTOBER 24, 2026",
                    "fontFamily": "Inter",
                    "fontSize": 24,
                    "color": "#a5b4fc",
                    "x": 400,
                    "y": 600,
                    "zIndex": 8
                }
            ]
        }

        # Edit 1: Change font
        r_edit1 = await client.post("/api/ai/edit-poster", json={
            "prompt": "Change the title font to Orbitron",
            "current_state": current_state,
            "selected_id": "hero-title-1"
        }, headers=headers)
        mut1 = r_edit1.json()
        print("\n[Edit 1: Font change to Orbitron]")
        print("AI Message:", mut1.get("message"))
        print("Mutations:", json.dumps(mut1.get("mutations"), indent=2))
        assert any("Orbitron" in str(m) for m in mut1.get("mutations", [])), "Edit 1 failed: Font Orbitron not in mutations"

        # Edit 2: Change color to gold
        r_edit2 = await client.post("/api/ai/edit-poster", json={
            "prompt": "Make the title metallic gold",
            "current_state": current_state,
            "selected_id": "hero-title-1"
        }, headers=headers)
        mut2 = r_edit2.json()
        print("\n[Edit 2: Color change to metallic gold]")
        print("AI Message:", mut2.get("message"))
        print("Mutations:", json.dumps(mut2.get("mutations"), indent=2))
        assert any("#" in str(m) or "gold" in str(m).lower() for m in mut2.get("mutations", [])), "Edit 2 failed: Gold color not in mutations"

        # Edit 3: Position change (move date below title)
        r_edit3 = await client.post("/api/ai/edit-poster", json={
            "prompt": "Move the date below the title",
            "current_state": current_state,
            "selected_id": "date-time-1"
        }, headers=headers)
        mut3 = r_edit3.json()
        print("\n[Edit 3: Move date below title]")
        print("AI Message:", mut3.get("message"))
        print("Mutations:", json.dumps(mut3.get("mutations"), indent=2))
        assert any(m.get("action") in ("update_position", "update_layer") for m in mut3.get("mutations", [])), "Edit 3 failed: Position action not returned"

        # Edit 4: Add new text
        r_edit4 = await client.post("/api/ai/edit-poster", json={
            "prompt": "Add a text element 'Free Entry for All' at the bottom",
            "current_state": current_state
        }, headers=headers)
        mut4 = r_edit4.json()
        print("\n[Edit 4: Add text]")
        print("AI Message:", mut4.get("message"))
        print("Mutations:", json.dumps(mut4.get("mutations"), indent=2))
        assert any(m.get("action") == "add_text" for m in mut4.get("mutations", [])), "Edit 4 failed: add_text action not returned"

        print("\n==================================================")
        print("ALL VERIFICATION SUITES PASSED SUCCESSFULLY!")
        print("==================================================")

if __name__ == "__main__":
    asyncio.run(main())
