import smtplib
import json
import urllib.request

try:
    req = urllib.request.Request(
        'https://api.nodemailer.com/user',
        headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
        data=b'{"requestor":"eventiva-agent","version":"1.0.0"}'
    )
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print(f"SMTP_SERVER=smtp.ethereal.email")
        print(f"SMTP_PORT=587")
        print(f"SMTP_EMAIL={data['user']}")
        print(f"SMTP_APP_PASSWORD={data['pass']}")
        print(f"WEB_URL=https://ethereal.email/message/")
except Exception as e:
    print("Error:", e)
