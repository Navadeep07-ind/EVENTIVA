import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.database import SessionLocal
from app import models

db = SessionLocal()

print("=== REMINDER 9 & 10 DELIVERIES ===")
for r_id in [9, 10, 87, 88, 89, 90]:
    rem = db.query(models.TaskReminder).filter(models.TaskReminder.id == r_id).first()
    if rem:
        print(f"Reminder {rem.id} (Task {rem.task_id}, Offset {rem.reminder_offset_minutes}m): Status={rem.status}, Sent={rem.is_sent}, Key={rem.idempotency_key}")
        delivs = db.query(models.NotificationDelivery).filter(models.NotificationDelivery.idempotency_key.like(f"%{rem.id}%")).all()
        for d in delivs:
            print(f"   -> Deliv {d.id} to {d.recipient_email}: Status={d.status}, LastAttempt={d.last_attempt_at}")

print("\n=== ALL DELIVERIES TO navadeepsnr07@gmail.com ===")
nav_delivs = db.query(models.NotificationDelivery).filter(models.NotificationDelivery.recipient_email == "navadeepsnr07@gmail.com").all()
for d in nav_delivs:
    print(f"Deliv {d.id} (Campaign {d.campaign_id}): Status={d.status}, Key={d.idempotency_key}")

db.close()
