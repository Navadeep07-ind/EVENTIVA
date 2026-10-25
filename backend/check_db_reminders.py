import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app import models
from app.core.email import get_smtp_config, is_mock_mode

db = SessionLocal()

print('=== SMTP CONFIGURATION ===')
print('MOCK_EMAIL:', os.getenv('MOCK_EMAIL'))
print('TESTING:', os.getenv('TESTING'))
print('SMTP_SERVER:', os.getenv('SMTP_SERVER'))
print('SMTP_USER:', os.getenv('SMTP_USER'))
print('SMTP_PASSWORD set?:', bool(os.getenv('SMTP_PASSWORD')))
try:
    cfg = get_smtp_config()
    print('Resolved SMTP Host:', cfg[0], 'Port:', cfg[1], 'User:', cfg[2])
except Exception as e:
    print('SMTP Config resolution error:', e)

print('\n=== RECENT EVENTS (LAST 5) ===')
for ev in db.query(models.Event).order_by(models.Event.id.desc()).limit(5).all():
    print(f'Event ID: {ev.id}, Title: {ev.title}, Status: {ev.status}, Mode: {ev.registration_mode}, Org ID: {ev.organizer_id}')

print('\n=== RECENT LIVE TASKS (LAST 10) ===')
for t in db.query(models.LiveTask).order_by(models.LiveTask.id.desc()).limit(10).all():
    print(f'Task ID: {t.id}, Event ID: {t.event_id}, Title: {t.title}, Status: {t.status}, Deadline: {t.deadline}, TZ: {t.timezone}')

print('\n=== RECENT TASK REMINDERS (LAST 20) ===')
for r in db.query(models.TaskReminder).order_by(models.TaskReminder.id.desc()).limit(20).all():
    print(f'Rem ID: {r.id}, Event ID: {r.event_id}, Task ID: {r.task_id}, Offset: {r.reminder_offset_minutes}m, Sched: {r.scheduled_time}, Status: {r.status}, Sent: {r.is_sent}, Retry: {r.retry_count}, Fail: {r.failure_reason}')

print('\n=== RECENT NOTIFICATION CAMPAIGNS (LAST 5) ===')
for c in db.query(models.NotificationCampaign).order_by(models.NotificationCampaign.id.desc()).limit(5).all():
    print(f'Campaign ID: {c.id}, Event ID: {c.event_id}, Title: {c.title}, Type: {c.campaign_type}, Status: {c.status}')
    for d in c.deliveries:
        print(f'  -> Deliv ID: {d.id}, To: {d.recipient_email}, Status: {d.status}, Fail: {d.failure_reason}')

db.close()
