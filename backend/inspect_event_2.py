import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.database import SessionLocal
from app import models

db = SessionLocal()

print("=== EVENT 2 DETAILS ===")
ev2 = db.query(models.Event).filter(models.Event.id == 2).first()
if ev2:
    print(f"Event 2: Title: {ev2.title}, Status: {ev2.status}, Mode: {ev2.registration_mode}")

print("\n=== TASKS FOR EVENT 2 ===")
tasks = db.query(models.LiveTask).filter(models.LiveTask.event_id == 2).all()
for t in tasks:
    print(f"Task {t.id}: '{t.title}', Deadline: {t.deadline}, TZ: {t.timezone}, Status: {t.status}")
    rems = db.query(models.TaskReminder).filter(models.TaskReminder.task_id == t.id).all()
    print(f"  -> Reminders count: {len(rems)}")
    for r in rems:
        print(f"     Rem {r.id}: {r.reminder_offset_minutes}m, Sched: {r.scheduled_time}, Status: {r.status}, Sent: {r.is_sent}, Fail: {r.failure_reason}")

print("\n=== REGISTRATIONS FOR EVENT 2 ===")
regs = db.query(models.Registration).filter(models.Registration.event_id == 2).all()
print(f"Total registrations for Event 2: {len(regs)}")
for rg in regs:
    print(f"  Reg {rg.id}: {rg.full_name} ({rg.email}), Status: {rg.status}, Team: {rg.team_id}")

print("\n=== SUBMISSIONS FOR TASKS IN EVENT 2 ===")
subs = db.query(models.TaskSubmission).filter(models.TaskSubmission.event_id == 2).all()
print(f"Total submissions for Event 2: {len(subs)}")
for s in subs:
    print(f"  Sub {s.id}: Task {s.task_id}, Reg {s.registration_id}, Status: {s.status}")

db.close()
