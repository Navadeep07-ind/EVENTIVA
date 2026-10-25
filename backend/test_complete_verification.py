import sys
import os
import requests
import json

BASE_URL = "http://localhost:8000"

def run_tests():
    print("=== EVENTIVA INDIA-WIDE BRANDING KIT VERIFICATION SUITE ===\n")
    passed = 0
    total = 0

    def test(desc, fn):
        nonlocal passed, total
        total += 1
        try:
            fn()
            print(f"  [PASS] Test {total}: {desc}")
            passed += 1
        except Exception as e:
            print(f"  [FAIL] Test {total}: {desc} -> {e}")

    # TEST 1: Search for TKRCET and select kit
    def test_tkrcet_search():
        res = requests.get(f"{BASE_URL}/api/institutions?q=TKRCET")
        assert res.status_code == 200, f"Status {res.status_code}"
        items = res.json()
        assert isinstance(items, list), "Response must be list of institutions"
        assert any("TKRCET" in item.get("code", "") for item in items), "TKRCET not found in search"
        tkr = next(item for item in items if "TKRCET" in item.get("code", ""))
        assert tkr.get("has_branding_kit") is True, "TKRCET should have branding kit"
        assert tkr.get("state") == "Telangana", "TKRCET should be in Telangana"
    test("Search for TKRCET and verify record & kit status", test_tkrcet_search)

    # TEST 2: Search for other Indian institutions (VNR, CBIT, IIT, AIIMS)
    def test_multi_institution_search():
        for query in ["VNR", "CBIT", "IIT", "AIIMS"]:
            res = requests.get(f"{BASE_URL}/api/institutions?q={query}")
            assert res.status_code == 200, f"Status {res.status_code} for {query}"
            items = res.json()
            assert len(items) > 0, f"Query '{query}' returned no institutions"
    test("Search across diverse Indian institutions (VNR, CBIT, IIT, AIIMS)", test_multi_institution_search)

    # TEST 3: State & Category Filters
    def test_filters():
        # State filter
        res = requests.get(f"{BASE_URL}/api/institutions?state=Maharashtra")
        assert res.status_code == 200
        items = res.json()
        assert all(it.get("state") == "Maharashtra" for it in items), "All items must be in Maharashtra"
        assert len(items) >= 2, "Should find Maharashtra institutions (IIT Bombay, COEP, etc.)"

        # Category filter
        res_med = requests.get(f"{BASE_URL}/api/institutions?category=Medical")
        assert res_med.status_code == 200
        med_items = res_med.json()
        assert len(med_items) >= 2, "Should find Medical institutions (AIIMS, CMC, etc.)"
        assert all(it.get("category") == "Medical" for it in med_items)
    test("Filter institutions by State and Discipline Category", test_filters)

    # TEST 4: Duplicate Institution Detection (HTTP 409)
    def test_duplicate_prevention():
        duplicate_payload = {
            "code": "TKRCET",
            "official_name": "TKR College of Engineering and Technology",
            "common_name": "TKRCET",
            "state": "Telangana",
            "city": "Hyderabad",
            "category": "Engineering",
            "website": "https://tkrcet.ac.in"
        }
        res = requests.post(f"{BASE_URL}/api/institutions", json=duplicate_payload)
        assert res.status_code == 409, f"Expected 409 Conflict, got {res.status_code}"
        detail = str(res.json().get("detail", ""))
        assert "Duplicate institution detected" in detail, "Response must indicate duplicate institution"
        assert "TKRCET" in detail, "Response must specify existing institution code"
    test("Duplicate institution creation rejection (HTTP 409 Conflict)", test_duplicate_prevention)

    # TEST 5: Automatic Branding Discovery for institution without existing kit
    def test_discovery_workflow():
        res = requests.get(f"{BASE_URL}/api/institutions?q=Osmania")
        assert res.status_code == 200
        items = res.json()
        assert len(items) > 0, "Osmania University should exist"
        osmania = items[0]
        
        # Trigger discovery
        disc_res = requests.post(f"{BASE_URL}/api/institutions/{osmania['id']}/discover")
        assert disc_res.status_code == 200, f"Status {disc_res.status_code}"
        data = disc_res.json()
        assert "candidate_logo_url" in data, "Must provide candidate logo url"
        assert "extracted_colors" in data, "Must provide extracted colors"
        assert "draft_kit" in data, "Must provide draft kit"
        assert len(data["extracted_colors"]) > 0, "Should have extracted color swatches"
        
        palette = data["extracted_colors"]
        assert "source" in palette[0], "Color swatches must have source attribution tags"
    test("Automated Branding-Kit Discovery workflow & attribution tagging", test_discovery_workflow)

    # TEST 6: SVG Sanitization on Asset Upload (Security XSS prevention)
    def test_svg_sanitization():
        malicious_svg = """<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
            <script>alert('XSS-ATTACK')</script>
            <circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" onload="stealCookies()" />
            <a href="javascript:alert(1)"><text x="10" y="20">Test</text></a>
        </svg>"""
        files = {'file': ('test_logo.svg', malicious_svg.encode('utf-8'), 'image/svg+xml')}
        res = requests.post(f"{BASE_URL}/api/branding-kits/upload-asset", files=files)
        assert res.status_code == 200, f"Upload status {res.status_code}"
        uploaded_url = res.json().get("url")
        assert uploaded_url, "Must return uploaded file url"

        saved_filename = uploaded_url.split("/")[-1]
        saved_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "posters", saved_filename)
        assert os.path.exists(saved_path), f"File {saved_path} must exist"
        with open(saved_path, 'r', encoding='utf-8') as f:
            content = f.read()
        assert "<script>" not in content, "SVG must have <script> stripped"
        assert "alert(" not in content, "SVG must have scripts stripped"
        assert "onload" not in content, "SVG must have onload handlers stripped"
        assert "javascript:" not in content, "SVG must have javascript: URIs stripped"
    test("SVG Insignia sanitization (script & handler stripping)", test_svg_sanitization)

    # TEST 7: Unauthorized modification protection on Verified Kits (HTTP 403)
    def test_verified_kit_protection():
        res = requests.get(f"{BASE_URL}/api/branding-kits")
        assert res.status_code == 200
        kits = res.json()
        verified_kits = [k for k in kits if k.get("is_verified") is True]
        assert len(verified_kits) > 0, "Should have verified kits"
        v_kit = verified_kits[0]

        put_res = requests.put(f"{BASE_URL}/api/branding-kits/{v_kit['id']}", json={"name": "Hacked Name"})
        assert put_res.status_code == 403, f"Expected 403 Forbidden on verified kit, got {put_res.status_code}"
        assert "Verified" in put_res.json().get("detail", "")
    test("Protection of verified institutional kits from unauthorized edits (HTTP 403)", test_verified_kit_protection)

    # TEST 8: Kit Duplication / Cloning for customized variants
    def test_kit_duplication():
        res = requests.get(f"{BASE_URL}/api/branding-kits")
        kits = res.json()
        assert len(kits) > 0
        kit_to_dup = kits[0]
        
        dup_res = requests.post(f"{BASE_URL}/api/branding-kits/{kit_to_dup['id']}/duplicate")
        assert dup_res.status_code == 200, f"Duplicate status {dup_res.status_code}"
        cloned = dup_res.json()
        assert cloned["id"] != kit_to_dup["id"], "Cloned kit must have new ID"
        assert "(Custom Copy)" in cloned["name"], "Cloned kit must be marked as custom copy"
        assert cloned["is_verified"] is False, "Cloned kit must be unverified/custom"

        # Clean up cloned kit
        del_res = requests.delete(f"{BASE_URL}/api/branding-kits/{cloned['id']}")
        assert del_res.status_code == 200
    test("Duplicate branding kit creating editable unverified copy", test_kit_duplication)

    # TEST 9: Public Branding Kits Endpoint Available Without Hardcoding
    def test_preset_kits_neutrality():
        res = requests.get(f"{BASE_URL}/api/branding-kits")
        assert res.status_code == 200
        kits = res.json()
        # Verify multiple institutions exist in directory, not just one
        kit_names = [k.get("name") for k in kits]
        assert len(kit_names) >= 4, "Should offer diverse preset kits (TKRCET, VNR, IIT, IIM, etc.)"
    test("Diverse institutional branding kits available in library", test_preset_kits_neutrality)

    print(f"\nRESULTS: {passed}/{total} tests passed successfully!")
    if passed == total:
        print("ALL VERIFICATION SUITE CHECKS PASSED!")
        return 0
    else:
        print("SOME TESTS FAILED.")
        return 1

if __name__ == "__main__":
    sys.exit(run_tests())
