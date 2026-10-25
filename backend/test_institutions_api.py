import urllib.request
import urllib.error
import json

def test():
    print("--- TEST 1: SEARCH & FILTER ---")
    req = urllib.request.urlopen('http://localhost:8000/api/institutions?q=Vignan')
    vignan_data = json.loads(req.read().decode())
    print('Search Vignan results count:', len(vignan_data))
    assert len(vignan_data) >= 1
    print('Found:', vignan_data[0]['official_name'], f"(Code: {vignan_data[0]['code']})")

    req_med = urllib.request.urlopen('http://localhost:8000/api/institutions?category=Medical')
    med_data = json.loads(req_med.read().decode())
    print('Medical colleges count:', len(med_data))
    assert len(med_data) >= 1
    print('Sample medical college:', med_data[0]['official_name'], f"({med_data[0]['state']})")

    print("\n--- TEST 2: DUPLICATE DETECTION ---")
    post_data = json.dumps({
        'code': 'TKRCET-HYD',
        'official_name': 'TKR College of Engineering and Technology',
        'state': 'Telangana',
        'city': 'Hyderabad'
    }).encode()
    req2 = urllib.request.Request(
        'http://localhost:8000/api/institutions',
        data=post_data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        urllib.request.urlopen(req2)
        print('FAILED: Duplicate should have returned 409')
        assert False
    except urllib.error.HTTPError as e:
        assert e.code == 409
        err_msg = json.loads(e.read().decode())['detail']
        print(f"PASSED: HTTP 409 returned with detail: {err_msg}")

    print("\n--- TEST 3: AUTOMATIC BRANDING DISCOVERY ---")
    req_ou = urllib.request.urlopen('http://localhost:8000/api/institutions?q=Osmania')
    ou_list = json.loads(req_ou.read().decode())
    ou_data = ou_list[0]
    print(f"Testing discovery on: {ou_data['official_name']} (ID: {ou_data['id']})")
    
    disc_url = f"http://localhost:8000/api/institutions/{ou_data['id']}/discover"
    req_disc = urllib.request.Request(disc_url, data=b"", method='POST')
    disc_res = json.loads(urllib.request.urlopen(req_disc).read().decode())
    print("Discovery successful!")
    print("- Status:", disc_res['status'])
    print("- Recommended Font:", disc_res['recommended_font'])
    print("- Extracted Colors:", len(disc_res['extracted_colors']))
    print("- Candidate Logo URL:", disc_res['candidate_logo_url'])

    print("\n--- TEST 4: ASSET UPLOAD WITH SVG SANITIZATION ---")
    # Upload an SVG with a dangerous script to test sanitization
    svg_payload = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><script>alert(1)</script><circle cx="50" cy="50" r="40" fill="navy"/></svg>'
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    body = (
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="file"; filename="test_emblem.svg"\r\n'
        f'Content-Type: image/svg+xml\r\n\r\n'
        f'{svg_payload}\r\n'
        f'--{boundary}--\r\n'
    ).encode()
    upload_req = urllib.request.Request(
        'http://localhost:8000/api/branding-kits/upload-asset',
        data=body,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'},
        method='POST'
    )
    upload_res = json.loads(urllib.request.urlopen(upload_req).read().decode())
    print("Asset Upload Result:", upload_res['url'], "| MIME:", upload_res['mime_type'])
    
    # Verify script tag was stripped
    uploaded_file_path = upload_res['url'].replace("http://localhost:8000/", "")
    with open(uploaded_file_path, "r", encoding="utf-8") as f:
        saved_content = f.read()
    assert "<script>" not in saved_content
    print("SVG Sanitization verified: <script> was safely removed!")

    print("\nALL BACKEND TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    test()
