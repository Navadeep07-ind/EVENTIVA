from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import timedelta
from . import models, schemas, crud
from .database import engine, get_db, SQLALCHEMY_DATABASE_URL
from typing import Optional, List, Dict, Any
from .core.security import verify_password, create_access_token, get_password_hash, ACCESS_TOKEN_EXPIRE_MINUTES
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import logging
import os
import time
import io
import asyncio
from google import genai
from google.genai import types, errors
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

models.Base.metadata.create_all(bind=engine)

def ensure_database_migrated():
    import sqlite3
    if "sqlite" in SQLALCHEMY_DATABASE_URL:
        db_file = SQLALCHEMY_DATABASE_URL.replace("sqlite:///", "").replace("sqlite://", "")
        if os.path.exists(db_file):
            try:
                conn = sqlite3.connect(db_file)
                cur = conn.cursor()
                
                # Migrate registrations table
                cur.execute("PRAGMA table_info(registrations)")
                reg_cols = [r[1] for r in cur.fetchall()]
                if reg_cols:
                    if "ticket_code" not in reg_cols:
                        cur.execute("ALTER TABLE registrations ADD COLUMN ticket_code VARCHAR")
                    if "checked_in" not in reg_cols:
                        cur.execute("ALTER TABLE registrations ADD COLUMN checked_in BOOLEAN DEFAULT 0")
                    if "checked_in_at" not in reg_cols:
                        cur.execute("ALTER TABLE registrations ADD COLUMN checked_in_at DATETIME")
                    if "team_id" not in reg_cols:
                        cur.execute("ALTER TABLE registrations ADD COLUMN team_id INTEGER REFERENCES teams(id)")
                    if "is_team_leader" not in reg_cols:
                        cur.execute("ALTER TABLE registrations ADD COLUMN is_team_leader BOOLEAN DEFAULT 0")
                    if "unsubscribed_announcements" not in reg_cols:
                        cur.execute("ALTER TABLE registrations ADD COLUMN unsubscribed_announcements BOOLEAN DEFAULT 0")
                    if "unsubscribe_token" not in reg_cols:
                        cur.execute("ALTER TABLE registrations ADD COLUMN unsubscribe_token VARCHAR")
                    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_ticket_code ON registrations(ticket_code)")
                    cur.execute("CREATE INDEX IF NOT EXISTS idx_registrations_team_id ON registrations(team_id)")
                    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_unsub_token ON registrations(unsubscribe_token)")

                    # Populate missing unsubscribe tokens
                    import uuid
                    cur.execute("SELECT id FROM registrations WHERE unsubscribe_token IS NULL")
                    missing_tokens = cur.fetchall()
                    for (row_id,) in missing_tokens:
                        cur.execute("UPDATE registrations SET unsubscribe_token = ? WHERE id = ?", (str(uuid.uuid4()), row_id))

                # Migrate events table
                cur.execute("PRAGMA table_info(events)")
                evt_cols = [r[1] for r in cur.fetchall()]
                if evt_cols:
                    if "registration_mode" not in evt_cols:
                        cur.execute("ALTER TABLE events ADD COLUMN registration_mode VARCHAR DEFAULT 'individual'")

                # Ensure teams table exists
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS teams (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        event_id INTEGER NOT NULL REFERENCES events(id),
                        team_name VARCHAR NOT NULL,
                        leader_registration_id INTEGER REFERENCES registrations(id),
                        invite_code VARCHAR UNIQUE NOT NULL,
                        status VARCHAR DEFAULT 'Active',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_teams_event_id ON teams(event_id)")
                cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_invite_code ON teams(invite_code)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_teams_team_name ON teams(team_name)")

                # Ensure notification tables exist
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS notification_campaigns (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        event_id INTEGER NOT NULL REFERENCES events(id),
                        organizer_id INTEGER NOT NULL REFERENCES users(id),
                        campaign_type VARCHAR DEFAULT 'announcement',
                        title VARCHAR NOT NULL,
                        message TEXT NOT NULL,
                        target_audience VARCHAR DEFAULT 'all',
                        target_filter JSON,
                        priority VARCHAR DEFAULT 'normal',
                        status VARCHAR DEFAULT 'Pending',
                        total_recipients INTEGER DEFAULT 0,
                        sent_count INTEGER DEFAULT 0,
                        failed_count INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        completed_at DATETIME
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_campaigns_event_id ON notification_campaigns(event_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_campaigns_organizer_id ON notification_campaigns(organizer_id)")

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS notification_deliveries (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        campaign_id INTEGER NOT NULL REFERENCES notification_campaigns(id),
                        registration_id INTEGER REFERENCES registrations(id),
                        recipient_email VARCHAR NOT NULL,
                        recipient_name VARCHAR NOT NULL,
                        status VARCHAR DEFAULT 'queued',
                        error_message TEXT,
                        idempotency_key VARCHAR UNIQUE NOT NULL,
                        attempt_count INTEGER DEFAULT 0,
                        last_attempt_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_deliveries_campaign_id ON notification_deliveries(campaign_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_email ON notification_deliveries(recipient_email)")
                cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_idempotency ON notification_deliveries(idempotency_key)")

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS event_reminder_configs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        event_id INTEGER NOT NULL REFERENCES events(id),
                        reminder_type VARCHAR NOT NULL,
                        scheduled_time DATETIME NOT NULL,
                        custom_message TEXT,
                        is_enabled BOOLEAN DEFAULT 1,
                        is_sent BOOLEAN DEFAULT 0,
                        sent_at DATETIME,
                        campaign_id INTEGER REFERENCES notification_campaigns(id),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_reminders_event_id ON event_reminder_configs(event_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON event_reminder_configs(scheduled_time)")

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS live_tasks (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        event_id INTEGER NOT NULL REFERENCES events(id),
                        title VARCHAR NOT NULL,
                        instructions TEXT NOT NULL,
                        description TEXT,
                        deadline DATETIME NOT NULL,
                        timezone VARCHAR DEFAULT 'UTC',
                        target_audience VARCHAR DEFAULT 'all',
                        target_filter JSON,
                        submission_method VARCHAR DEFAULT 'file',
                        allowed_file_types VARCHAR DEFAULT '.pdf,.ppt,.pptx,.zip,.png,.jpg,.jpeg',
                        max_file_size_mb INTEGER DEFAULT 25,
                        review_required BOOLEAN DEFAULT 1,
                        status VARCHAR DEFAULT 'Active',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_live_tasks_event_id ON live_tasks(event_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_live_tasks_deadline ON live_tasks(deadline)")

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS task_reminders (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        task_id INTEGER NOT NULL REFERENCES live_tasks(id),
                        event_id INTEGER NOT NULL REFERENCES events(id),
                        reminder_offset_minutes INTEGER NOT NULL,
                        scheduled_time DATETIME NOT NULL,
                        custom_message TEXT,
                        is_sent BOOLEAN DEFAULT 0,
                        sent_at DATETIME,
                        status VARCHAR DEFAULT 'Scheduled',
                        campaign_id INTEGER REFERENCES notification_campaigns(id),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_task_reminders_task_id ON task_reminders(task_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_task_reminders_event_id ON task_reminders(event_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_task_reminders_scheduled ON task_reminders(scheduled_time)")

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS task_submissions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        task_id INTEGER NOT NULL REFERENCES live_tasks(id),
                        event_id INTEGER NOT NULL REFERENCES events(id),
                        team_id INTEGER REFERENCES teams(id),
                        registration_id INTEGER NOT NULL REFERENCES registrations(id),
                        submission_text TEXT,
                        submission_url VARCHAR,
                        file_url VARCHAR,
                        file_name VARCHAR,
                        file_size_bytes INTEGER,
                        status VARCHAR DEFAULT 'Submitted',
                        is_late BOOLEAN DEFAULT 0,
                        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        organizer_feedback TEXT,
                        reviewed_by_id INTEGER REFERENCES users(id),
                        reviewed_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_task_submissions_task_id ON task_submissions(task_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_task_submissions_event_id ON task_submissions(event_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_task_submissions_team_id ON task_submissions(team_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_task_submissions_reg_id ON task_submissions(registration_id)")

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS event_timeline_entries (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        event_id INTEGER NOT NULL REFERENCES events(id),
                        title VARCHAR NOT NULL,
                        description TEXT,
                        scheduled_time DATETIME NOT NULL,
                        end_time DATETIME,
                        entry_type VARCHAR DEFAULT 'activity',
                        task_id INTEGER REFERENCES live_tasks(id),
                        status VARCHAR DEFAULT 'Scheduled',
                        "order" INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_timeline_event_id ON event_timeline_entries(event_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_timeline_scheduled ON event_timeline_entries(scheduled_time)")

                # Migrate live_tasks table
                cur.execute("PRAGMA table_info(live_tasks)")
                lt_cols = [r[1] for r in cur.fetchall()]
                if lt_cols:
                    if "ai_verification_enabled" not in lt_cols:
                        cur.execute("ALTER TABLE live_tasks ADD COLUMN ai_verification_enabled BOOLEAN DEFAULT 1")
                    if "require_url" not in lt_cols:
                        cur.execute("ALTER TABLE live_tasks ADD COLUMN require_url BOOLEAN DEFAULT 0")
                    if "deliverable_checklist" not in lt_cols:
                        cur.execute("ALTER TABLE live_tasks ADD COLUMN deliverable_checklist JSON")
                    if "scoring_rubric" not in lt_cols:
                        cur.execute("ALTER TABLE live_tasks ADD COLUMN scoring_rubric JSON")

                # Migrate task_reminders table
                cur.execute("PRAGMA table_info(task_reminders)")
                tr_cols = [r[1] for r in cur.fetchall()]
                if tr_cols:
                    if "retry_count" not in tr_cols:
                        cur.execute("ALTER TABLE task_reminders ADD COLUMN retry_count INTEGER DEFAULT 0")
                    if "last_attempt_at" not in tr_cols:
                        cur.execute("ALTER TABLE task_reminders ADD COLUMN last_attempt_at DATETIME")
                    if "failure_reason" not in tr_cols:
                        cur.execute("ALTER TABLE task_reminders ADD COLUMN failure_reason TEXT")
                    if "idempotency_key" not in tr_cols:
                        cur.execute("ALTER TABLE task_reminders ADD COLUMN idempotency_key VARCHAR")
                    if "delivery_result" not in tr_cols:
                        cur.execute("ALTER TABLE task_reminders ADD COLUMN delivery_result JSON")
                    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_task_reminders_idempotency ON task_reminders(idempotency_key)")

                # Migrate task_submissions table
                cur.execute("PRAGMA table_info(task_submissions)")
                ts_cols = [r[1] for r in cur.fetchall()]
                if ts_cols:
                    if "version" not in ts_cols:
                        cur.execute("ALTER TABLE task_submissions ADD COLUMN version INTEGER DEFAULT 1")
                    if "ai_status" not in ts_cols:
                        cur.execute("ALTER TABLE task_submissions ADD COLUMN ai_status VARCHAR DEFAULT 'None'")
                    if "ai_assessment" not in ts_cols:
                        cur.execute("ALTER TABLE task_submissions ADD COLUMN ai_assessment JSON")
                    if "ai_verified_at" not in ts_cols:
                        cur.execute("ALTER TABLE task_submissions ADD COLUMN ai_verified_at DATETIME")
                    if "organizer_decision" not in ts_cols:
                        cur.execute("ALTER TABLE task_submissions ADD COLUMN organizer_decision VARCHAR")
                    if "organizer_override_reason" not in ts_cols:
                        cur.execute("ALTER TABLE task_submissions ADD COLUMN organizer_override_reason TEXT")
                    if "organizer_override_by" not in ts_cols:
                        cur.execute("ALTER TABLE task_submissions ADD COLUMN organizer_override_by INTEGER REFERENCES users(id)")

                # Create task_submission_versions
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS task_submission_versions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        submission_id INTEGER NOT NULL REFERENCES task_submissions(id),
                        version_number INTEGER DEFAULT 1,
                        submission_text TEXT,
                        submission_url VARCHAR,
                        file_url VARCHAR,
                        file_name VARCHAR,
                        file_size_bytes INTEGER,
                        status VARCHAR DEFAULT 'Submitted',
                        ai_status VARCHAR DEFAULT 'None',
                        ai_assessment JSON,
                        organizer_feedback TEXT,
                        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_sub_versions_sub_id ON task_submission_versions(submission_id)")

                # Create ai_verification_jobs
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS ai_verification_jobs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        submission_id INTEGER NOT NULL REFERENCES task_submissions(id),
                        task_id INTEGER NOT NULL REFERENCES live_tasks(id),
                        status VARCHAR DEFAULT 'Queued',
                        attempt_count INTEGER DEFAULT 0,
                        error_message TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_ai_jobs_sub_id ON ai_verification_jobs(submission_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_verification_jobs(status)")


                conn.commit()
                conn.close()
            except Exception as e:
                logger.warning(f"Database migration verification error: {e}")

ensure_database_migrated()

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    from app import live_scheduler
    live_scheduler.start_live_scheduler_worker()
    yield
    live_scheduler.stop_live_scheduler_worker()

app = FastAPI(title="EVENTIVA API", lifespan=lifespan)

from fastapi.staticfiles import StaticFiles
os.makedirs("static/posters", exist_ok=True)
os.makedirs("static/submissions", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

@app.post("/api/auth/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = crud.create_user(db=db, user=user)
    
    from .core.security import generate_otp, get_otp_hash
    from .core.email import send_verification_otp
    from datetime import datetime, timedelta, timezone
    import smtplib
    
    otp = generate_otp()
    otp_hash = get_otp_hash(otp)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    crud.create_otp(db, email=user.email, otp_hash=otp_hash, purpose="verification", expires_at=expires_at)
    
    try:
        send_verification_otp(user.email, otp)
    except ValueError as ve:
        raise HTTPException(status_code=500, detail=str(ve))
    except Exception as e:
        # We don't expose the exact SMTP exception to the client if it has secrets, but we log the type safely
        raise HTTPException(status_code=500, detail="Failed to send verification email. Please check your SMTP configuration and Gmail App Password.")
    
    return new_user

@app.post("/api/auth/verify-otp")
def verify_otp(otp_data: schemas.OTPVerify, db: Session = Depends(get_db)):
    from .core.security import verify_otp_hash
    from datetime import datetime, timezone
    
    otp_record = crud.get_latest_otp(db, otp_data.email, otp_data.purpose)
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
    if otp_record.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        crud.mark_otp_used(db, otp_record.id)
        raise HTTPException(status_code=400, detail="OTP has expired")
        
    if not verify_otp_hash(otp_data.otp, otp_record.hashed_otp):
        crud.increment_otp_attempts(db, otp_record.id)
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    crud.mark_otp_used(db, otp_record.id)
    
    user = crud.get_user_by_email(db, otp_data.email)
    if otp_data.purpose == "verification" and user:
        user.is_verified = True
        db.commit()
        
    return {"message": "OTP verified successfully"}

@app.post("/api/auth/resend-otp")
def resend_otp(otp_req: schemas.OTPRequest, db: Session = Depends(get_db)):
    # Rate limiting / cooldown check could be implemented here
    user = crud.get_user_by_email(db, otp_req.email)
    if not user:
        return {"message": "If the email is registered, an OTP will be sent."}
        
    from .core.security import generate_otp, get_otp_hash
    from .core.email import send_verification_otp, send_password_reset_otp
    from datetime import datetime, timedelta, timezone
    
    # Simple cooldown check
    last_otp = crud.get_latest_otp(db, otp_req.email, otp_req.purpose)
    if last_otp and (datetime.now(timezone.utc) - last_otp.created_at.replace(tzinfo=timezone.utc)).total_seconds() < 60:
        raise HTTPException(status_code=429, detail="Please wait 60 seconds before requesting a new OTP.")
    
    otp = generate_otp()
    otp_hash = get_otp_hash(otp)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    crud.create_otp(db, email=otp_req.email, otp_hash=otp_hash, purpose=otp_req.purpose, expires_at=expires_at)
    
    try:
        if otp_req.purpose == "verification":
            send_verification_otp(otp_req.email, otp)
        elif otp_req.purpose == "reset":
            send_password_reset_otp(otp_req.email, otp)
    except ValueError as ve:
        raise HTTPException(status_code=500, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to send OTP email. Please check your SMTP configuration and Gmail App Password.")
        
    return {"message": "If the email is registered, an OTP will be sent."}

@app.post("/api/auth/reset-password")
def reset_password(reset_data: schemas.PasswordReset, db: Session = Depends(get_db)):
    from .core.security import verify_otp_hash, get_password_hash
    from datetime import datetime, timezone
    
    otp_record = crud.get_latest_otp(db, reset_data.email, "reset")
    if not otp_record or otp_record.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
    if not verify_otp_hash(reset_data.otp, otp_record.hashed_otp):
        crud.increment_otp_attempts(db, otp_record.id)
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    crud.mark_otp_used(db, otp_record.id)
    
    user = crud.get_user_by_email(db, reset_data.email)
    if user:
        user.hashed_password = get_password_hash(reset_data.new_password)
        db.commit()
    return {"message": "Password reset successfully"}

@app.post("/api/auth/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please verify your email address first",
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    from jose import JWTError, jwt
    from .core.security import SECRET_KEY, ALGORITHM
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = crud.get_user_by_email(db, email=email)
    if user is None:
        raise credentials_exception
    if not user.is_verified:
        raise HTTPException(status_code=401, detail="Unverified account")
    return user

def get_optional_current_user(token: Optional[str] = Depends(oauth2_scheme_optional), db: Session = Depends(get_db)):
    if not token:
        return None
    try:
        from jose import JWTError, jwt
        from .core.security import SECRET_KEY, ALGORITHM
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email:
            return crud.get_user_by_email(db, email=email)
    except Exception:
        return None
    return None

@app.get("/api/auth/me", response_model=schemas.User)
def read_users_me(current_user: schemas.User = Depends(get_current_user)):
    return current_user

@app.get("/api/events", response_model=list[schemas.Event])
def read_events(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    events = crud.get_events(db, skip=skip, limit=limit)
    return events

@app.get("/api/events/my", response_model=list[schemas.Event])
def read_my_events(db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_user)):
    return db.query(models.Event).filter(models.Event.organizer_id == current_user.id).all()

@app.get("/api/events/{event_id}", response_model=schemas.Event)
def read_event(event_id: int, db: Session = Depends(get_db)):
    db_event = crud.get_event(db, event_id=event_id)
    if db_event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return db_event

@app.post("/api/events", response_model=schemas.Event)
def create_event(event: schemas.EventCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_user)):
    return crud.create_event(db=db, event=event, organizer_id=current_user.id)

@app.put("/api/events/{event_id}", response_model=schemas.Event)
def update_event(event_id: int, event_update: schemas.EventUpdate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_user)):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this event")
    return crud.update_event(db=db, db_event=db_event, event_update=event_update)

@app.delete("/api/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_user)):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this event")
    crud.delete_event(db=db, db_event=db_event)
    return None

@app.post("/api/events/{event_id}/register", response_model=schemas.Registration)
def register_for_event(
    event_id: int, 
    registration: schemas.RegistrationCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    db_event = crud.get_event(db, event_id=event_id)
    if db_event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.status != 'Published':
        raise HTTPException(status_code=400, detail="Event is not open for registration")
        
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    
    if db_event.registration_start_date:
        # Ensure it has a timezone for proper comparison
        start_date = db_event.registration_start_date
        if start_date.tzinfo is None:
            start_date = start_date.replace(tzinfo=timezone.utc)
        if now < start_date:
            raise HTTPException(status_code=400, detail="Registration has not started yet")
            
    if db_event.registration_deadline:
        deadline = db_event.registration_deadline
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        if now > deadline:
            raise HTTPException(status_code=400, detail="Registration deadline has passed")
            
    # Check capacity only if this is a new registrant
    existing = db.query(models.Registration).filter(
        models.Registration.event_id == event_id,
        models.Registration.email == registration.email.strip()
    ).first()
    if not existing and db_event.max_participants is not None:
        current_count = len(crud.get_registrations_for_event(db, event_id=event_id))
        if current_count >= db_event.max_participants:
            raise HTTPException(status_code=400, detail="Registration capacity has been reached")

    created_reg = crud.create_registration(db=db, registration=registration, event_id=event_id)

    # Dispatch email confirmation with ticket link in background safely
    if background_tasks and created_reg and created_reg.ticket_code:
        from .core.email import send_ticket_confirmation
        ticket_url = f"/tickets/{created_reg.ticket_code}"
        background_tasks.add_task(
            send_ticket_confirmation,
            registration.email,
            registration.full_name,
            db_event.title,
            created_reg.ticket_code,
            ticket_url
        )

    return created_reg

@app.get("/api/tickets/{ticket_code}", response_model=schemas.TicketPublicResponse)
def get_public_ticket(ticket_code: str, db: Session = Depends(get_db)):
    if not ticket_code or not ticket_code.strip():
        raise HTTPException(status_code=404, detail="Ticket not found")

    reg = crud.get_registration_by_ticket_code(db=db, ticket_code=ticket_code.strip())
    if not reg:
        raise HTTPException(status_code=404, detail="Ticket not found")

    db_event = crud.get_event(db=db, event_id=reg.event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Associated event not found")

    # Ticket is valid for admission if not cancelled/revoked/rejected and not already checked in
    is_valid = (reg.status not in ["Cancelled", "Rejected", "Revoked"]) and not reg.checked_in

    return schemas.TicketPublicResponse(
        ticket_code=reg.ticket_code,
        event_id=db_event.id,
        event_title=db_event.title,
        category=db_event.category,
        start_time=db_event.start_time,
        end_time=db_event.end_time,
        venue=db_event.venue,
        poster_url=db_event.poster_url,
        attendee_name=reg.full_name,
        attendee_college=reg.college,
        status=reg.status,
        checked_in=reg.checked_in,
        checked_in_at=reg.checked_in_at,
        is_valid_for_admission=is_valid,
        ticket_url=f"/tickets/{reg.ticket_code}",
        team_name=reg.team_name,
        is_team_leader=reg.is_team_leader
    )

# --- TEAM REGISTRATION ENDPOINTS ---
@app.post("/api/events/{event_id}/teams")
def create_team_for_event(
    event_id: int,
    team_data: schemas.TeamCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.status != "Published":
        raise HTTPException(status_code=400, detail="Event is not published for registration")

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    if db_event.registration_start_date:
        start_date = db_event.registration_start_date
        if start_date.tzinfo is None:
            start_date = start_date.replace(tzinfo=timezone.utc)
        if now < start_date:
            raise HTTPException(status_code=400, detail="Registration has not started yet")
    if db_event.registration_deadline:
        deadline = db_event.registration_deadline
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        if now > deadline:
            raise HTTPException(status_code=400, detail="Registration deadline has passed")

    if db_event.max_participants is not None:
        current_count = len(crud.get_registrations_for_event(db, event_id=event_id))
        if current_count >= db_event.max_participants:
            raise HTTPException(status_code=400, detail="Registration capacity has been reached")

    try:
        team, leader_reg = crud.create_team_with_leader(
            db=db,
            event_id=event_id,
            team_name=team_data.team_name,
            leader_data=team_data.leader
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    if background_tasks and leader_reg.ticket_code:
        from .core.email import send_team_created_confirmation
        ticket_url = f"/tickets/{leader_reg.ticket_code}"
        team_hub_url = f"/teams/hub/{team.invite_code}"
        background_tasks.add_task(
            send_team_created_confirmation,
            leader_reg.email,
            leader_reg.full_name,
            team.team_name,
            db_event.title,
            team.invite_code,
            team_hub_url,
            leader_reg.ticket_code,
            ticket_url
        )

    active_members = [m for m in team.members if m.status not in ["Cancelled", "Rejected"]]
    count = len(active_members)
    spots_remaining = max(0, db_event.max_team_size - count)
    is_full = count >= db_event.max_team_size

    team_info = schemas.TeamPublicInfo(
        id=team.id,
        team_name=team.team_name,
        event_id=db_event.id,
        event_title=db_event.title,
        category=db_event.category,
        venue=db_event.venue,
        start_time=db_event.start_time,
        end_time=db_event.end_time,
        poster_url=db_event.poster_url,
        leader_name=leader_reg.full_name,
        current_member_count=count,
        min_team_size=db_event.min_team_size,
        max_team_size=db_event.max_team_size,
        spots_remaining=spots_remaining,
        is_full=is_full,
        can_join=not is_full and db_event.status == "Published",
        status=team.status,
        invite_code=team.invite_code,
        form_schema=db_event.form_schema
    )

    return {
        "team": team_info,
        "registration": leader_reg,
        "ticket_code": leader_reg.ticket_code,
        "ticket_url": f"/tickets/{leader_reg.ticket_code}",
        "team_hub_url": f"/teams/hub/{team.invite_code}"
    }

@app.get("/api/teams/invite/{invite_code}", response_model=schemas.TeamPublicInfo)
def get_team_by_invite(invite_code: str, db: Session = Depends(get_db)):
    if not invite_code or not invite_code.strip():
        raise HTTPException(status_code=404, detail="Invitation code required")

    team = crud.get_team_by_invite_code(db, invite_code.strip())
    if not team:
        raise HTTPException(status_code=404, detail="Invalid team invitation code")

    db_event = team.event
    if not db_event:
        raise HTTPException(status_code=404, detail="Associated event not found")

    leader = team.leader
    leader_name = leader.full_name if leader else "Team Leader"

    active_members = [m for m in team.members if m.status not in ["Cancelled", "Rejected"]]
    current_count = len(active_members)
    spots_remaining = max(0, db_event.max_team_size - current_count)
    is_full = current_count >= db_event.max_team_size

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    is_expired = False
    if db_event.registration_deadline:
        dl = db_event.registration_deadline
        if dl.tzinfo is None:
            dl = dl.replace(tzinfo=timezone.utc)
        if now > dl:
            is_expired = True

    can_join = (not is_full) and (db_event.status == "Published") and (not is_expired) and (team.status != "Cancelled")

    return schemas.TeamPublicInfo(
        id=team.id,
        team_name=team.team_name,
        event_id=db_event.id,
        event_title=db_event.title,
        category=db_event.category,
        venue=db_event.venue,
        start_time=db_event.start_time,
        end_time=db_event.end_time,
        poster_url=db_event.poster_url,
        leader_name=leader_name,
        current_member_count=current_count,
        min_team_size=db_event.min_team_size,
        max_team_size=db_event.max_team_size,
        spots_remaining=spots_remaining,
        is_full=is_full,
        can_join=can_join,
        status=team.status,
        invite_code=team.invite_code,
        form_schema=db_event.form_schema
    )

@app.post("/api/teams/invite/{invite_code}/join")
def join_team_via_invite(
    invite_code: str,
    member_data: schemas.TeamJoinRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    if not invite_code or not invite_code.strip():
        raise HTTPException(status_code=404, detail="Invitation code required")

    team, member_reg, err = crud.join_team(db, invite_code.strip(), member_data)
    if err:
        if "not found" in err.lower() or "invalid" in err.lower():
            raise HTTPException(status_code=404, detail=err)
        raise HTTPException(status_code=400, detail=err)

    db_event = team.event
    if background_tasks and member_reg.ticket_code and db_event:
        from .core.email import send_team_member_joined_notification
        ticket_url = f"/tickets/{member_reg.ticket_code}"
        team_hub_url = f"/teams/hub/{team.invite_code}"

        # 1. Notify joining member with individual ticket pass & team hub link
        background_tasks.add_task(
            send_team_member_joined_notification,
            to_email=member_reg.email,
            recipient_name=member_reg.full_name,
            member_name=member_reg.full_name,
            team_name=team.team_name,
            event_title=db_event.title,
            team_hub_url=team_hub_url,
            is_leader=False,
            ticket_url=ticket_url,
            ticket_code=member_reg.ticket_code
        )

        # 2. Notify team leader that this member has joined
        if team.leader and team.leader.email:
            background_tasks.add_task(
                send_team_member_joined_notification,
                to_email=team.leader.email,
                recipient_name=team.leader.full_name,
                member_name=member_reg.full_name,
                team_name=team.team_name,
                event_title=db_event.title,
                team_hub_url=team_hub_url,
                is_leader=True
            )

    return {
        "team_id": team.id,
        "team_name": team.team_name,
        "invite_code": team.invite_code,
        "registration": member_reg,
        "ticket_code": member_reg.ticket_code,
        "ticket_url": f"/tickets/{member_reg.ticket_code}",
        "team_hub_url": f"/teams/hub/{team.invite_code}"
    }

def _build_team_detail_response(team: models.Team, db: Session):
    db_event = team.event
    leader = team.leader
    leader_name = leader.full_name if leader else "Team Leader"

    active_members = [m for m in team.members if m.status not in ["Cancelled", "Rejected"]]
    current_count = len(active_members)
    max_size = db_event.max_team_size if db_event else 1
    min_size = db_event.min_team_size if db_event else 1
    spots_remaining = max(0, max_size - current_count)

    member_infos = [
        schemas.TeamMemberInfo(
            id=m.id,
            full_name=m.full_name,
            college=m.college,
            status=m.status,
            checked_in=m.checked_in,
            is_team_leader=m.is_team_leader,
            created_at=m.created_at
        )
        for m in active_members
    ]

    return schemas.TeamDetailResponse(
        id=team.id,
        team_name=team.team_name,
        event_id=db_event.id if db_event else 0,
        event_title=db_event.title if db_event else "",
        category=db_event.category if db_event else None,
        venue=db_event.venue if db_event else None,
        start_time=db_event.start_time if db_event else None,
        end_time=db_event.end_time if db_event else None,
        poster_url=db_event.poster_url if db_event else None,
        leader_name=leader_name,
        invite_code=team.invite_code,
        status=team.status,
        min_team_size=min_size,
        max_team_size=max_size,
        current_member_count=current_count,
        spots_remaining=spots_remaining,
        is_full=current_count >= max_size,
        members=member_infos,
        created_at=team.created_at
    )

@app.get("/api/teams/hub/{invite_code}", response_model=schemas.TeamDetailResponse)
def get_team_hub_by_invite(invite_code: str, db: Session = Depends(get_db)):
    if not invite_code or not invite_code.strip():
        raise HTTPException(status_code=404, detail="Invitation code required")
    team = crud.get_team_by_invite_code(db, invite_code.strip())
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return _build_team_detail_response(team, db)

@app.get("/api/teams/{team_id}", response_model=schemas.TeamDetailResponse)
def get_team_by_id(team_id: int, db: Session = Depends(get_db)):
    team = crud.get_team(db, team_id=team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return _build_team_detail_response(team, db)

@app.get("/api/events/{event_id}/teams", response_model=List[schemas.TeamOrganizerView])
def get_event_teams(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    teams = crud.get_teams_for_event(db, event_id=event_id)
    results = []
    for t in teams:
        leader = t.leader
        active_members = [m for m in t.members if m.status not in ["Cancelled", "Rejected"]]
        count = len(active_members)
        is_complete = count >= db_event.max_team_size
        results.append(
            schemas.TeamOrganizerView(
                id=t.id,
                team_name=t.team_name,
                event_id=t.event_id,
                invite_code=t.invite_code,
                status=t.status,
                leader_registration_id=t.leader_registration_id,
                leader_name=leader.full_name if leader else None,
                leader_email=leader.email if leader else None,
                leader_college=leader.college if leader else None,
                current_member_count=count,
                min_team_size=db_event.min_team_size,
                max_team_size=db_event.max_team_size,
                is_complete=is_complete,
                members=t.members,
                created_at=t.created_at
            )
        )
    return results

# -------------------------------------------------------------
# FEATURE 4: NOTIFICATIONS, BROADCASTS & REMINDERS ENDPOINTS
# -------------------------------------------------------------

@app.post("/api/events/{event_id}/notifications/broadcast", response_model=schemas.NotificationCampaignOut)
def broadcast_event_notification(
    event_id: int,
    request: schemas.NotificationBroadcastRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to broadcast for this event")

    if not request.title or not request.title.strip():
        raise HTTPException(status_code=400, detail="Announcement title is required")
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Announcement message is required")

    target_filter = None
    if request.target_audience == "teams" and request.target_ids:
        target_filter = {"team_ids": request.target_ids}
    elif request.target_audience == "participants" and request.target_ids:
        target_filter = {"registration_ids": request.target_ids}

    # Resolve eligible recipients (strictly exclude Cancelled & Rejected)
    recipients = crud.resolve_campaign_recipients(
        db, event_id=event_id, target_audience=request.target_audience, target_filter=target_filter
    )
    if not recipients:
        raise HTTPException(status_code=400, detail="No eligible registered attendees found for the selected audience")

    # Create campaign
    campaign = crud.create_notification_campaign(
        db=db,
        event_id=event_id,
        organizer_id=current_user.id,
        campaign_type="announcement",
        title=request.title,
        message=request.message,
        target_audience=request.target_audience,
        target_filter=target_filter,
        priority=request.priority
    )

    # Queue deliveries
    crud.queue_campaign_deliveries(db, campaign, recipients)

    # Execute in background (or execute synchronously in test mode)
    if os.getenv("TESTING") == "1" or os.getenv("MOCK_EMAIL") == "1":
        crud.execute_campaign_deliveries(db, campaign.id)
    elif background_tasks:
        background_tasks.add_task(crud.execute_campaign_deliveries, db, campaign.id)
    else:
        crud.execute_campaign_deliveries(db, campaign.id)

    db.refresh(campaign)
    return campaign

@app.get("/api/events/{event_id}/notifications", response_model=List[schemas.NotificationCampaignOut])
def get_event_notifications(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view notifications for this event")

    return crud.get_notification_campaigns_for_event(db, event_id=event_id)

@app.get("/api/events/{event_id}/notifications/{campaign_id}", response_model=schemas.NotificationCampaignDetail)
def get_campaign_detail(
    event_id: int,
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    campaign = crud.get_notification_campaign(db, campaign_id=campaign_id)
    if not campaign or campaign.event_id != event_id:
        raise HTTPException(status_code=404, detail="Notification campaign not found")

    deliveries = db.query(models.NotificationDelivery).filter(
        models.NotificationDelivery.campaign_id == campaign_id
    ).order_by(models.NotificationDelivery.id.asc()).all()

    return schemas.NotificationCampaignDetail(
        id=campaign.id,
        event_id=campaign.event_id,
        organizer_id=campaign.organizer_id,
        campaign_type=campaign.campaign_type,
        title=campaign.title,
        message=campaign.message,
        target_audience=campaign.target_audience,
        priority=campaign.priority,
        status=campaign.status,
        total_recipients=campaign.total_recipients,
        sent_count=campaign.sent_count,
        failed_count=campaign.failed_count,
        created_at=campaign.created_at,
        completed_at=campaign.completed_at,
        deliveries=deliveries
    )

@app.post("/api/events/{event_id}/notifications/{campaign_id}/retry", response_model=schemas.NotificationCampaignOut)
def retry_campaign_failed_deliveries(
    event_id: int,
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    campaign = crud.get_notification_campaign(db, campaign_id=campaign_id)
    if not campaign or campaign.event_id != event_id:
        raise HTTPException(status_code=404, detail="Notification campaign not found")

    updated = crud.retry_failed_deliveries(db, campaign_id=campaign_id)
    return updated or campaign

@app.post("/api/events/{event_id}/detect-changes", response_model=schemas.EventChangeDetectResponse)
def detect_event_changes_endpoint(
    event_id: int,
    request: schemas.EventChangeDetectRequest,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    changed_fields = {}
    summary_parts = []

    if request.venue is not None and request.venue.strip() != (db_event.venue or "").strip():
        old_v = db_event.venue or "TBA"
        new_v = request.venue.strip()
        changed_fields["venue"] = {"old": old_v, "new": new_v}
        summary_parts.append(f"Venue moved from '{old_v}' to '{new_v}'")

    if request.start_time is not None:
        db_st = db_event.start_time.isoformat() if db_event.start_time else None
        new_st = request.start_time.isoformat()
        if db_st != new_st:
            old_str = db_event.start_time.strftime("%b %d, %Y at %I:%M %p") if db_event.start_time else "TBA"
            new_str = request.start_time.strftime("%b %d, %Y at %I:%M %p")
            changed_fields["start_time"] = {"old": old_str, "new": new_str}
            summary_parts.append(f"Start time rescheduled from {old_str} to {new_str}")

    if request.end_time is not None:
        db_et = db_event.end_time.isoformat() if db_event.end_time else None
        new_et = request.end_time.isoformat()
        if db_et != new_et:
            old_str = db_event.end_time.strftime("%b %d, %Y at %I:%M %p") if db_event.end_time else "TBA"
            new_str = request.end_time.strftime("%b %d, %Y at %I:%M %p")
            changed_fields["end_time"] = {"old": old_str, "new": new_str}
            summary_parts.append(f"End time updated from {old_str} to {new_str}")

    has_changes = len(changed_fields) > 0
    summary = "; ".join(summary_parts) if summary_parts else "No significant schedule or venue changes detected."

    eligible_count = db.query(models.Registration).filter(
        models.Registration.event_id == event_id,
        models.Registration.status.notin_(["Cancelled", "Rejected"])
    ).count()

    return schemas.EventChangeDetectResponse(
        has_changes=has_changes,
        changed_fields=changed_fields,
        summary=summary,
        eligible_attendees_count=eligible_count
    )

@app.post("/api/events/{event_id}/notify-change", response_model=schemas.NotificationCampaignOut)
def notify_event_change(
    event_id: int,
    request: schemas.EventChangeNotifyRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    recipients = crud.resolve_campaign_recipients(db, event_id=event_id, target_audience="all")
    if not recipients:
        raise HTTPException(status_code=400, detail="No registered attendees to notify")

    note = request.custom_note.strip() if request.custom_note else "Please check your updated event venue and schedule details."
    title = f"Schedule or Venue Update: {db_event.title}"

    campaign = crud.create_notification_campaign(
        db=db,
        event_id=event_id,
        organizer_id=current_user.id,
        campaign_type="schedule_change",
        title=title,
        message=note,
        target_audience="all",
        priority="important"
    )

    crud.queue_campaign_deliveries(db, campaign, recipients)

    if os.getenv("TESTING") == "1" or os.getenv("MOCK_EMAIL") == "1":
        crud.execute_campaign_deliveries(db, campaign.id)
    elif background_tasks:
        background_tasks.add_task(crud.execute_campaign_deliveries, db, campaign.id)
    else:
        crud.execute_campaign_deliveries(db, campaign.id)

    db.refresh(campaign)
    return campaign

@app.get("/api/events/{event_id}/reminders", response_model=List[schemas.EventReminderConfigOut])
def get_event_reminders_endpoint(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return crud.get_event_reminders(db, event_id=event_id)

@app.put("/api/events/{event_id}/reminders", response_model=List[schemas.EventReminderConfigOut])
def save_event_reminders_endpoint(
    event_id: int,
    request: schemas.EventRemindersSaveRequest,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return crud.save_event_reminders(db, event_id=event_id, reminder_items=request.reminders)

@app.post("/api/events/{event_id}/reminders/trigger-check")
def trigger_reminders_check_endpoint(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    processed = crud.process_due_reminders(db, event_id=event_id)
    return {"status": "ok", "processed_campaigns": processed}

@app.get("/api/notifications/unsubscribe/{token}", response_model=schemas.UnsubscribeInfoResponse)
def get_unsubscribe_info(token: str, db: Session = Depends(get_db)):
    reg = crud.get_registration_by_unsubscribe_token(db, token)
    if not reg:
        raise HTTPException(status_code=404, detail="Invalid unsubscribe token")

    event_title = reg.event.title if reg.event else "EVENTIVA Event"
    return schemas.UnsubscribeInfoResponse(
        event_title=event_title,
        attendee_name=reg.full_name,
        email=reg.email,
        unsubscribed_announcements=reg.unsubscribed_announcements
    )

@app.post("/api/notifications/unsubscribe/{token}")
def post_unsubscribe(token: str, db: Session = Depends(get_db)):
    reg = crud.unsubscribe_registration(db, token)
    if not reg:
        raise HTTPException(status_code=404, detail="Invalid unsubscribe token")

    return {
        "message": "Successfully opted out of non-essential announcements and reminders.",
        "unsubscribed": True
    }

@app.get("/api/events/{event_id}/registrations", response_model=list[schemas.Registration])
def read_event_registrations(
    event_id: int, 
    search: Optional[str] = None,
    status: Optional[str] = None,
    checked_in: Optional[bool] = None,
    sort_by: Optional[str] = "created_at",
    sort_order: Optional[str] = "desc",
    skip: Optional[int] = 0,
    limit: Optional[int] = None,
    db: Session = Depends(get_db), 
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if db_event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    query = db.query(models.Registration).filter(models.Registration.event_id == event_id)

    if search and search.strip():
        term = f"%{search.strip()}%"
        from sqlalchemy import or_
        query = query.filter(
            or_(
                models.Registration.full_name.ilike(term),
                models.Registration.email.ilike(term),
                models.Registration.ticket_code.ilike(term),
                models.Registration.college.ilike(term)
            )
        )

    if status and status.strip() and status.strip().lower() != "all":
        query = query.filter(models.Registration.status.ilike(status.strip()))

    if checked_in is not None:
        query = query.filter(models.Registration.checked_in == checked_in)

    if sort_by == "name":
        order_col = models.Registration.full_name
    else:
        order_col = models.Registration.created_at

    if sort_order == "asc":
        query = query.order_by(order_col.asc())
    else:
        query = query.order_by(order_col.desc())

    if skip and skip > 0:
        query = query.offset(skip)
    if limit and limit > 0:
        query = query.limit(limit)

    return query.all()

@app.get("/api/events/{event_id}/registrations/stats", response_model=schemas.RegistrationStats)
def get_event_registrations_stats(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if db_event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.get_event_registration_stats(db, event_id=event_id)

@app.put("/api/events/{event_id}/registrations/{registration_id}", response_model=schemas.Registration)
def update_event_registration(
    event_id: int,
    registration_id: int,
    reg_update: schemas.RegistrationUpdate,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if db_event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify registrations for this event")

    db_reg = crud.get_registration(db, registration_id=registration_id)
    if db_reg is None or db_reg.event_id != event_id:
        raise HTTPException(status_code=404, detail="Registration not found for this event")

    valid_statuses = ["Registered", "Approved", "Rejected", "Cancelled"]
    if reg_update.status:
        matched = next((s for s in valid_statuses if s.lower() == reg_update.status.lower()), None)
        if not matched:
            raise HTTPException(status_code=400, detail=f"Invalid status '{reg_update.status}'. Allowed: {valid_statuses}")
        reg_update.status = matched

    return crud.update_registration(db=db, db_registration=db_reg, reg_update=reg_update)

@app.post("/api/events/{event_id}/check-in", response_model=schemas.CheckInResponse)
def check_in_attendee(
    event_id: int,
    check_in_req: schemas.CheckInRequest,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if db_event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to check in attendees for this event")

    raw_code = check_in_req.ticket_code.strip() if check_in_req.ticket_code else ""
    import re
    match = re.search(r"EVT-[A-Za-z0-9\-_]+", raw_code)
    clean_code = match.group(0) if match else raw_code

    if not clean_code:
        raise HTTPException(status_code=400, detail="Ticket code is required")

    reg = crud.get_registration_by_ticket_code(db=db, ticket_code=clean_code)
    if not reg:
        raise HTTPException(status_code=404, detail="Invalid ticket code")

    if reg.event_id != event_id:
        raise HTTPException(status_code=400, detail="Ticket belongs to a different event")

    if reg.status.lower() in ["cancelled", "rejected", "revoked"]:
        raise HTTPException(status_code=400, detail=f"Admission denied: Ticket status is marked as '{reg.status}'.")

    if reg.checked_in:
        time_str = reg.checked_in_at.strftime('%I:%M %p') if reg.checked_in_at else ''
        return schemas.CheckInResponse(
            status="already_checked_in",
            message=f"Attendee {reg.full_name} was already checked in {f'at {time_str}' if time_str else ''}.",
            ticket_code=reg.ticket_code,
            attendee_name=reg.full_name,
            attendee_college=reg.college,
            checked_in=True,
            checked_in_at=reg.checked_in_at,
            is_duplicate=True
        )

    from datetime import datetime, timezone
    reg.checked_in = True
    reg.checked_in_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(reg)

    return schemas.CheckInResponse(
        status="success",
        message=f"Admission Confirmed! Welcome, {reg.full_name}.",
        ticket_code=reg.ticket_code,
        attendee_name=reg.full_name,
        attendee_college=reg.college,
        checked_in=True,
        checked_in_at=reg.checked_in_at,
        is_duplicate=False
    )

@app.get("/api/events/{event_id}/registrations/export")
def export_event_registrations(
    event_id: int,
    format: str = "xlsx",
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    import io
    import re
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment
    from fastapi.responses import StreamingResponse

    db_event = crud.get_event(db, event_id=event_id)
    if db_event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    regs = crud.get_registrations_for_event(db, event_id=event_id)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Participants"

    def sanitize_for_excel(val):
        if val is None:
            return ""
        s = str(val).strip()
        if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
            return "'" + s
        return s

    custom_field_ids = []
    custom_field_labels = []
    if db_event.form_schema and isinstance(db_event.form_schema, list):
        for f in db_event.form_schema:
            if isinstance(f, dict) and "id" in f:
                custom_field_ids.append(f["id"])
                custom_field_labels.append(f.get("label") or f["id"])

    for r in regs:
        if r.custom_answers and isinstance(r.custom_answers, dict):
            for k in r.custom_answers.keys():
                if k not in custom_field_ids:
                    custom_field_ids.append(k)
                    custom_field_labels.append(k.replace("_", " ").title())

    headers = [
        "Ticket Code", "Full Name", "Email", "College / Institution", 
        "Team Name", "Team Role",
        "Status", "Checked In", "Check-in Time (UTC)", "Registration Date (UTC)"
    ] + custom_field_labels

    ws.append(headers)

    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for r in regs:
        checked_str = "Yes" if r.checked_in else "No"
        checked_time_str = r.checked_in_at.strftime("%Y-%m-%d %H:%M:%S") if r.checked_in_at else ""
        reg_time_str = r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else ""
        team_role = "Team Leader" if r.is_team_leader else ("Team Member" if r.team_id else "Individual")
        t_name = r.team.team_name if r.team else (r.team_name or "")
        
        row = [
            sanitize_for_excel(r.ticket_code),
            sanitize_for_excel(r.full_name),
            sanitize_for_excel(r.email),
            sanitize_for_excel(r.college),
            sanitize_for_excel(t_name),
            sanitize_for_excel(team_role),
            sanitize_for_excel(r.status),
            checked_str,
            checked_time_str,
            reg_time_str
        ]

        for fid in custom_field_ids:
            ans = (r.custom_answers or {}).get(fid, "")
            if isinstance(ans, list):
                ans = "; ".join(str(item) for item in ans)
            row.append(sanitize_for_excel(ans))

        ws.append(row)

    for col in ws.columns:
        max_len = 0
        col_letter = col[0].column_letter
        for cell in col:
            if cell.value:
                max_len = max(max_len, len(str(cell.value)))
        ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    clean_title = re.sub(r"[^a-zA-Z0-9_\-]", "_", db_event.title or "Event").strip("_")[:30]
    filename = f"{clean_title}_participants.xlsx"

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@app.post("/api/ai/generate-description")
async def generate_description(
    file: UploadFile = File(...),
    current_user: schemas.User = Depends(get_current_user)
):
    import os
    import time
    import logging
    from google import genai
    from google.genai import types
    import PyPDF2
    import io
    from PIL import Image
    from starlette.concurrency import run_in_threadpool
    import asyncio

    t_start = time.time()
    
    # Optional: configure logging if not already done globally
    logger = logging.getLogger("eventiva_ai")
    logger.setLevel(logging.INFO)

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API is not configured.")

    contents_payload = []
    
    t_read_start = time.time()
    try:
        file_bytes = await file.read()
        mime_type = file.content_type
        
        if file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            # Compress and resize image
            img = Image.open(io.BytesIO(file_bytes))
            # Convert to RGB to handle alpha channels from PNGs if needed when saving as JPEG
            if img.mode != 'RGB':
                img = img.convert('RGB')
                
            # Resize image if it's too large (max 1024x1024)
            img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            
            output_io = io.BytesIO()
            # Save as optimized JPEG
            img.save(output_io, format='JPEG', quality=80, optimize=True)
            compressed_bytes = output_io.getvalue()
            
            contents_payload.append(
                types.Part.from_bytes(data=compressed_bytes, mime_type='image/jpeg')
            )
            logger.info(f"Image compressed from {len(file_bytes)} to {len(compressed_bytes)} bytes")
        elif file.filename.lower().endswith('.pdf'):
            pdf_text = ""
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            # Limit to first 3 pages
            for i, page in enumerate(pdf_reader.pages):
                if i >= 3:
                    break
                pdf_text += page.extract_text() + "\n"
            if not pdf_text.strip():
                raise ValueError("PDF appears to be empty or unreadable.")
            contents_payload.append(pdf_text)
        else:
            text_content = file_bytes[:50000].decode('utf-8', errors='replace')
            if not text_content.strip():
                raise ValueError("Text file appears to be empty.")
            contents_payload.append(text_content)
    except Exception as e:
        logger.error(f"File preprocessing error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to process file: {str(e)}")
        
    t_prep = time.time() - t_read_start

    try:
        client = genai.Client(api_key=api_key)
        
        prompt = """
You are EVENTIVA's professional event information assistant.

Analyze the complete uploaded event poster and produce a clear, accurate,
well-organized event description.

Follow these rules:

1. Use simple, professional English.
2. Include only information supported by the poster.
3. Preserve exact event names, dates, fees, venues, contact details, and URLs.
4. Do not invent missing information.
5. Avoid exaggerated marketing language, repeated information, and unnecessary
   phrases such as 'secure your spot today'.
6. Use short paragraphs and descriptive headings.
7. Use bullet points for practical event details.
8. Aim for 120–180 words when sufficient information is available.
9. Do not add information merely to reach the word count.
10. Return the complete description, not just the title or a short summary.

Use this output structure:

EVENT OVERVIEW
Write 2–4 sentences explaining the event, its purpose, organizer, and audience.

EVENT HIGHLIGHTS
List the main activities, categories, tracks, sessions, or benefits shown
on the poster.

EVENT DETAILS
- Date:
- Time:
- Venue:
- Organizer:
Include only fields supported by the poster.

REGISTRATION DETAILS
- Registration fee:
- Eligibility:
- Registration deadline:
- Website:
Include only available information.

CONTACT INFORMATION
List the available email addresses, phone numbers, and official social
media details.

Do not include empty headings or fields.
Do not repeat information across sections.
Do not use Markdown tables.
Return only the finished event description.
"""
        contents_payload.append(prompt)
        
        t_api_start = time.time()
        
        import asyncio
        
        max_retries = 2
        response = None
        for attempt in range(max_retries + 1):
            try:
                response = await asyncio.wait_for(
                    client.aio.models.generate_content(
                        model='gemini-3.5-flash-lite',
                        contents=contents_payload,
                        config=types.GenerateContentConfig(
                            temperature=0.4
                        )
                    ),
                    timeout=30.0
                )
                break
            except asyncio.TimeoutError:
                if attempt == max_retries:
                    logger.error("AI Generation API Timeout (>30s) exhausted retries")
                    raise HTTPException(status_code=504, detail="AI Generation timed out after 30 seconds.")
                await asyncio.sleep(2 ** attempt)
            except errors.ClientError as ce:
                logger.error(f"Gemini ClientError: {ce}")
                if ce.code == 429:
                    raise HTTPException(status_code=429, detail="AI usage limit reached. Please check your API quota.")
                raise HTTPException(status_code=400, detail=f"AI Request Error: {ce.message}")
            except errors.ServerError as se:
                logger.error(f"Gemini ServerError (Attempt {attempt+1}): {se}")
                if attempt == max_retries:
                    raise HTTPException(status_code=503, detail="AI service is temporarily busy. Please try again shortly.")
                await asyncio.sleep(2 ** attempt)
            except Exception as e:
                logger.error(f"Unexpected AI Error: {repr(e)}")
                raise HTTPException(status_code=500, detail="AI Generation failed. Please try again.")

        t_api = time.time() - t_api_start
        
        t_total = time.time() - t_start
        logger.info(f"AI Generation Success | Preprocessing: {t_prep:.2f}s | Gemini API: {t_api:.2f}s | Total: {t_total:.2f}s")
        
        return {"description": response.text}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI Generation Setup failed: {repr(e)}")
        raise HTTPException(status_code=500, detail="AI Generation failed. Please try again.")

# Adding a dummy root endpoint for testing
@app.get("/")
def read_root():
    return {"message": "EVENTIVA API is running"}

import json
from pydantic import BaseModel

class EventGenerationRequest(BaseModel):
    text: str = ""

@app.post("/api/ai/generate-event")
async def generate_full_event(
    text: str = Form(""),
    file: UploadFile = File(None),
    current_user: schemas.User = Depends(get_current_user)
):
    try:
        t_start = time.time()
        contents_payload = []
        t_prep = 0.0
        
        if file:
            t_prep_start = time.time()
            contents = await file.read()
            img = Image.open(io.BytesIO(contents))
            
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
                
            img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='JPEG', quality=85)
            img_bytes = img_byte_arr.getvalue()
            
            contents_payload.append(
                types.Part.from_bytes(
                    data=img_bytes,
                    mime_type='image/jpeg'
                )
            )
            t_prep = time.time() - t_prep_start
            
        if text:
            contents_payload.append(text)
            
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not set")
            
        client = genai.Client(api_key=api_key)
        
        prompt = """
You are EVENTIVA's AI Event Creation Assistant.
Analyze the provided text and/or poster to generate a complete event configuration.
Never invent missing official information (dates, venue, prices). If unknown, leave as null.

Generate a JSON object with the following schema:
{
  "title": "String",
  "description": "String (Markdown formatted, approx 150 words)",
  "category": "String (e.g. Hackathon, Workshop, Seminar, Cultural)",
  "venue": "String or null",
  "start_time": "ISO8601 datetime string or null",
  "end_time": "ISO8601 datetime string or null",
  "registration_start_date": "ISO8601 datetime string or null",
  "registration_deadline": "ISO8601 datetime string or null",
  "max_participants": "Integer or null",
  "min_team_size": "Integer (default 1)",
  "max_team_size": "Integer (default 1)",
  "form_schema": [
    {
      "id": "string (unique snake_case identifier)",
      "label": "string (human readable)",
      "type": "string (text, longtext, email, phone, dropdown, multiselect, radio, checkbox, number, date, file, url)",
      "required": boolean,
      "options": ["array", "of", "strings", "if", "applicable"]
    }
  ]
}

For form_schema, always include standard questions based on the event type (e.g. GitHub URL for hackathons, Dietary Restrictions if food is provided).
Return ONLY the raw JSON object, without markdown blocks.
"""
        contents_payload.append(prompt)
        
        t_api_start = time.time()
        
        max_retries = 2
        response = None
        
        for attempt in range(max_retries + 1):
            try:
                response = await asyncio.wait_for(
                    client.aio.models.generate_content(
                        model='gemini-3.5-flash-lite',
                        contents=contents_payload,
                        config=types.GenerateContentConfig(
                            temperature=0.2,
                            response_mime_type="application/json"
                        )
                    ),
                    timeout=45.0
                )
                break  # Success
            except asyncio.TimeoutError:
                if attempt == max_retries:
                    logger.error("AI Generation API Timeout (>45s) exhausted retries")
                    raise HTTPException(status_code=504, detail="AI Generation timed out after 45 seconds.")
                await asyncio.sleep(2 ** attempt)
            except errors.ClientError as ce:
                # 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Quota
                logger.error(f"Gemini ClientError: {ce}")
                if ce.code == 429:
                    raise HTTPException(status_code=429, detail="AI usage limit reached. Please check your API quota.")
                raise HTTPException(status_code=400, detail=f"AI Request Error: {ce.message}")
            except errors.ServerError as se:
                # 500 Internal, 503 Unavailable
                logger.error(f"Gemini ServerError (Attempt {attempt+1}): {se}")
                if attempt == max_retries:
                    raise HTTPException(status_code=503, detail="AI service is temporarily busy. Please try again shortly.")
                await asyncio.sleep(2 ** attempt)
            except Exception as e:
                logger.error(f"Unexpected AI Error: {repr(e)}")
                raise HTTPException(status_code=500, detail="AI Generation failed. Please try again.")

        t_api = time.time() - t_api_start
        logger.info(f"AI Full Event Generation Success | Prep: {t_prep:.2f}s | API: {t_api:.2f}s")
        
        try:
            event_data = json.loads(response.text)
            return event_data
        except json.JSONDecodeError as jde:
            logger.error(f"Failed to parse AI JSON response: {jde}")
            raise HTTPException(status_code=500, detail="Failed to parse AI response as JSON")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI Generation Setup failed: {repr(e)}")
        raise HTTPException(status_code=500, detail="AI Generation failed. Please try again.")

import json
from typing import Optional, Dict, List, Any
from pydantic import BaseModel

class PosterDataRequest(BaseModel):
    event_details: str
    style: str

class PosterEditRequest(BaseModel):
    prompt: str
    current_state: Dict[str, Any]
    selected_id: Optional[str] = None
    chat_history: Optional[List[Dict[str, Any]]] = None

def calculate_auto_arranged_mutations(layers: list, canvas_config: dict) -> list:
    cw = canvas_config.get("width", 800)
    ch = canvas_config.get("height", 1131)
    
    mutations = []
    if not layers:
        return mutations

    header_layers = []
    sub_header_layers = []
    title_layers = []
    subtitle_layers = []
    desc_layers = []
    info_date_layers = []
    info_time_layers = []
    info_venue_layers = []
    info_divider_layers = []
    tagline_left_layers = []
    tagline_right_layers = []
    other_tagline_layers = []
    qr_layers = []
    signoff_layers = []
    other_layers = []

    for l in layers:
        lid = l.get("id")
        name = (l.get("name") or "").lower()
        ltype = l.get("type")
        text = (l.get("text") or "").lower()
        font_size = l.get("fontSize", 20)

        if ltype == "qr" or "qr" in name:
            qr_layers.append(l)
        elif "logo" in name or "badge" in name or "institution" in name or "college" in name or "university" in name:
            header_layers.append(l)
        elif "header divider" in name or (text.startswith("―") and l.get("y", 0) < 160):
            header_layers.append(l)
        elif "department" in name or "dept" in name or "club" in name or "host" in name or "invitation" in name:
            sub_header_layers.append(l)
        elif "event title" in name or "main heading" in name or "main event title" in name or (ltype == "text" and font_size >= 45):
            title_layers.append(l)
        elif "subtitle" in name or "edition" in name or "theme" in name:
            subtitle_layers.append(l)
        elif "description" in name or "desc" in name or (ltype == "text" and font_size <= 18 and len(text) > 40):
            desc_layers.append(l)
        elif "date" in name or "date:" in text or "📅" in text:
            info_date_layers.append(l)
        elif "time" in name or "time:" in text or "🕒" in text:
            info_time_layers.append(l)
        elif "venue" in name or "venue:" in text or "📍" in text:
            info_venue_layers.append(l)
        elif "divider" in name or text == "|" or (text.startswith("―") and l.get("y", 0) >= 160):
            info_divider_layers.append(l)
        elif "tagline left" in name or "tag left" in name:
            tagline_left_layers.append(l)
        elif "tagline right" in name or "tag right" in name:
            tagline_right_layers.append(l)
        elif "tagline" in name:
            other_tagline_layers.append(l)
        elif "signoff" in name or "footer" in name or "rsvp" in name or "contact" in name or l.get("y", 0) > 950:
            signoff_layers.append(l)
        elif ltype != "border" and "border" not in name:
            other_layers.append(l)

    has_header = bool(header_layers or sub_header_layers)

    # 1. Header Layers
    for hl in header_layers:
        h_name = (hl.get("name") or "").lower()
        if "logo" in h_name:
            mutations.append({"action": "update_position", "target_id": hl.get("id"), "x": 75, "y": 70})
        elif "badge" in h_name:
            mutations.append({"action": "update_position", "target_id": hl.get("id"), "x": cw - 75, "y": 70})
        elif "details" in h_name:
            mutations.append({"action": "update_position", "target_id": hl.get("id"), "x": cw / 2, "y": 84})
        elif "divider" in h_name or "―" in (hl.get("text") or ""):
            mutations.append({"action": "update_position", "target_id": hl.get("id"), "x": cw / 2, "y": 120})
        else:
            mutations.append({"action": "update_position", "target_id": hl.get("id"), "x": cw / 2, "y": 48})

    # Sub-header (Dept / Host)
    dept_y = 152 if has_header else 60
    host_y = 186 if has_header else 95
    for sh in sub_header_layers:
        sh_name = (sh.get("name") or "").lower()
        if "host" in sh_name or "invite" in sh_name:
            mutations.append({"action": "update_position", "target_id": sh.get("id"), "x": cw / 2, "y": host_y})
        else:
            mutations.append({"action": "update_position", "target_id": sh.get("id"), "x": cw / 2, "y": dept_y})

    # 2. Hero Title
    title_y = 295 if has_header else 220
    for tl in title_layers:
        mutations.append({"action": "update_position", "target_id": tl.get("id"), "x": cw / 2, "y": title_y})
        mutations.append({"action": "update_layer", "target_id": tl.get("id"), "updates": {"textAlign": "center"}})

    # 3. Subtitle
    sub_y = title_y + 80
    for sl in subtitle_layers:
        mutations.append({"action": "update_position", "target_id": sl.get("id"), "x": cw / 2, "y": sub_y})
        mutations.append({"action": "update_layer", "target_id": sl.get("id"), "updates": {"textAlign": "center"}})

    # 4. Description
    desc_y = (sub_y + 65) if subtitle_layers else (title_y + 110)
    for dl in desc_layers:
        mutations.append({"action": "update_position", "target_id": dl.get("id"), "x": cw / 2, "y": desc_y})
        mutations.append({"action": "update_layer", "target_id": dl.get("id"), "updates": {"textAlign": "center"}})

    # 5. Key Info Bar (Date, Time, Venue)
    info_y = 645 if has_header else 580
    if info_date_layers and info_venue_layers:
        for d in info_date_layers:
            mutations.append({"action": "update_position", "target_id": d.get("id"), "x": 215, "y": info_y})
        for t in info_time_layers:
            mutations.append({"action": "update_position", "target_id": t.get("id"), "x": 400, "y": info_y})
        for v in info_venue_layers:
            mutations.append({"action": "update_position", "target_id": v.get("id"), "x": 585, "y": info_y})
        for div in info_divider_layers:
            div_text = (div.get("text") or "").strip()
            if div_text == "|":
                mutations.append({"action": "update_position", "target_id": div.get("id"), "x": 315 if "1" in (div.get("name") or "") else 485, "y": info_y})
            elif "―" in div_text:
                mutations.append({"action": "update_position", "target_id": div.get("id"), "x": cw / 2, "y": info_y + 35})
    else:
        cur_y = info_y
        for l in info_date_layers + info_time_layers + info_venue_layers:
            mutations.append({"action": "update_position", "target_id": l.get("id"), "x": cw / 2, "y": cur_y})
            cur_y += 35

    # 6. Taglines & Accent Badges
    tag_y = 785 if has_header else 730
    for tl in tagline_left_layers:
        mutations.append({"action": "update_position", "target_id": tl.get("id"), "x": 145, "y": tag_y})
    for tr in tagline_right_layers:
        mutations.append({"action": "update_position", "target_id": tr.get("id"), "x": 655, "y": tag_y})
    for ot in other_tagline_layers:
        mutations.append({"action": "update_position", "target_id": ot.get("id"), "x": cw / 2, "y": tag_y + 40})

    # 7. QR Code
    qr_y = 910
    for qr in qr_layers:
        mutations.append({"action": "update_position", "target_id": qr.get("id"), "x": 690, "y": qr_y})

    # 8. Footer / Signoff
    footer_y = 1030
    for sf in signoff_layers:
        mutations.append({"action": "update_position", "target_id": sf.get("id"), "x": cw / 2, "y": footer_y})
        mutations.append({"action": "update_layer", "target_id": sf.get("id"), "updates": {"textAlign": "center"}})

    # 9. Other miscellaneous layers
    other_start_y = 850
    for ol in other_layers:
        mutations.append({"action": "update_position", "target_id": ol.get("id"), "x": cw / 2, "y": other_start_y})
        other_start_y += 35

    return mutations

@app.post('/api/ai/edit-poster')
async def edit_poster_content(
    req: PosterEditRequest,
    current_user: Optional[schemas.User] = Depends(get_optional_current_user)
):
    import os, json, re
    from google import genai
    from google.genai import types
    
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail='Gemini API is not configured.')
    client = genai.Client(api_key=api_key)
    
    # Extract layers and config for prompt
    layers_summary = []
    layers = req.current_state.get('layers', [])
    for l in layers:
        layers_summary.append({
            "id": l.get("id"),
            "name": l.get("name"),
            "type": l.get("type"),
            "text": l.get("text"),
            "fontFamily": l.get("fontFamily"),
            "fontSize": l.get("fontSize"),
            "color": l.get("color"),
            "x": l.get("x"),
            "y": l.get("y"),
            "zIndex": l.get("zIndex")
        })

    is_arrange_request = any(k in req.prompt.lower() for k in [
        "arrange", "distribute", "fix overlap", "spread", "use lower half", "layout cramming", "spacing between"
    ])

    prompt = f"""You are an expert AI Design Assistant editing an interactive, layer-based poster canvas.

USER INSTRUCTION: "{req.prompt}"
CURRENT SELECTED ELEMENT ID: "{req.selected_id or 'None'}"
CONVERSATION HISTORY: {json.dumps(req.chat_history or [], indent=1)}

CANVAS GEOMETRY & SPECS:
- Width: 800px, Height: 1131px. Full portrait poster.
- Upper zone: y: 45 to 200 (Branding, Host, Dept)
- Hero zone: y: 280 to 420 (Dominant Event Title, Subtitle, centered x: 400)
- Center zone: y: 440 to 550 (Description, centered x: 400)
- Lower-middle zone: y: 630 to 740 (Date, Time, Venue, Info cards)
- Accent zone: y: 770 to 870 (Taglines, Accents)
- Bottom zone: y: 880 to 1050 (QR code at x: 690, y: 910; Signoff footer at x: 400, y: 1030)

CURRENT CANVAS CONFIGURATION:
{json.dumps(req.current_state.get('canvasConfig', {}), indent=2)}

CURRENT LAYERS LIST:
{json.dumps(layers_summary, indent=2)}

CRITICAL RULES:
1. TARGET RESOLUTION: Target existing element IDs from the layer list above. If user refers to 'the title', target the element representing the title. If user refers to 'it' or 'the element' and a SELECTED ELEMENT ID is provided, target that ID.
2. PRESERVE UNRELATED CONTENT: Do NOT modify or regenerate unrelated text, dates, venues, titles, or logos unless explicitly requested. NEVER invent or replace factual event content.
3. PRESERVE ACCURACY: Never invent official logos, college names, or accreditation badges.
4. AUTO ARRANGE & VERTICAL DISTRIBUTION:
   If the instruction is to "arrange texts", "auto arrange", "distribute elements", or "use the lower half":
   Distribute all text and info elements evenly across the full 1131px height using the canvas specs above.
   Return "update_position" operations for each layer without overlapping.
5. CENTER EVENT TITLE: If user says "center the event title", return update_position with x: 400 and update_layer with textAlign: "center".
6. MOVE DATE AND VENUE: Align date and venue cleanly around y: 645-720.
7. INCREASE SPACING: Shift subsequent elements down smoothly.
8. CHANGE BACKGROUND: If user asks to change background, return update_background with a high quality image/color, and DO NOT change any text layer positions.
9. OPERATION TYPES TO USE:
   - "update_font": {{ "action": "update_font", "target_id": "<id>", "fontFamily": "<font name>" }}
   - "update_font_size": {{ "action": "update_font_size", "target_id": "<id>", "fontSize": <number> }}
   - "update_color": {{ "action": "update_color", "target_id": "<id>", "color": "<hex or name>", "stylePreset": "3d-gold-foil" | "3d-noventrix-blue" | "3d-liquid-chrome" | "solid" }}
   - "update_position": {{ "action": "update_position", "target_id": "<id>", "x": <number>, "y": <number> }}
   - "update_text": {{ "action": "update_text", "target_id": "<id>", "text": "<new text>" }}
   - "update_background": {{ "action": "update_background", "bgImage": "<unsplash image url>", "bgColor": "<hex>" }}
   - "add_text": {{ "action": "add_text", "text": "<text>", "x": <x>, "y": <y>, "fontSize": <size>, "fontFamily": "<font>", "color": "<color>" }}
   - "remove_element": {{ "action": "remove_element", "target_id": "<id>" }}
   - "resize_element": {{ "action": "resize_element", "target_id": "<id>", "width": <w>, "height": <h> }}
   - "update_effects": {{ "action": "update_effects", "target_id": "<id>", "textShadow": "...", "filter": "..." }}
   - "update_layer": {{ "action": "update_layer", "target_id": "<id>", "updates": {{ "textAlign": "center" }} }}
   - "add_border": {{ "action": "add_border", "borderPreset": "gold-luxury" | "double-classic" | "minimalist" | "neon-glow" | "tech-brackets" | "academic-formal" | "rounded-frame", "borderColor": "<hex>", "borderWidth": <1-20>, "borderStyle": "solid" | "double" | "dashed", "borderRadius": <0-40>, "inset": <10-40>, "borderGlow": <true/false>, "borderGlowColor": "<color>" }}
   - "update_border": {{ "action": "update_border", "borderColor": "<hex>", "borderWidth": <number>, "borderRadius": <number>, "borderStyle": "solid" | "double" | "dashed", "inset": <number>, "borderGlow": <true/false> }}
   - "remove_border": {{ "action": "remove_border" }}
   - "wrap_selection_box": {{ "action": "wrap_selection_box", "target_id": "<id>", "boxBg": "<rgba or hex>", "boxBorderColor": "<hex>", "boxBorderWidth": <1-4>, "boxBorderStyle": "solid" | "double" | "dashed", "boxRadius": <4-20>, "boxPadding": <8-24>, "boxShadow": "0 4px 20px rgba(0,0,0,0.5)" }}
   - "add_box_element": {{ "action": "add_box_element", "name": "<Box / Badge Name>", "text": "<text>", "x": <x>, "y": <y>, "fontSize": <size>, "fontFamily": "<font>", "color": "<text color>", "boxBg": "<bg>", "boxBorderColor": "<border>", "boxBorderWidth": <number>, "boxRadius": <number>, "boxPadding": <number> }}
   - "remove_box": {{ "action": "remove_box", "target_id": "<id>" }}
   - "undo": {{ "action": "undo" }}
   - "redo": {{ "action": "redo" }}

Return a STRICT JSON object:
{{
  "message": "Clear explanation of the changes made.",
  "mutations": [
    ... operations
  ]
}}
Respond ONLY with valid JSON.
"""
    try:
        response = client.models.generate_content(
            model='gemini-3.5-flash-lite',
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_mime_type='application/json',
                temperature=0.3
            )
        )
        raw_text = response.text.strip()
        if raw_text.startswith("```"):
            raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
            raw_text = re.sub(r"\s*```$", "", raw_text)
            raw_text = raw_text.strip()
            
        raw_text = re.sub(r',\s*([\]}])', r'\1', raw_text)
        data = json.loads(raw_text)
        
        # Ensure data is always a dict with 'mutations' and 'message'
        if isinstance(data, list):
            data = {
                "message": "Updated layout and elements according to your instructions.",
                "mutations": data
            }
        elif not isinstance(data, dict):
            data = {
                "message": "Updated layout and elements according to your instructions.",
                "mutations": []
            }
            
        # If Gemini returned no mutations for an arrange instruction, use layout engine
        if is_arrange_request and (not data.get("mutations") or len(data.get("mutations", [])) == 0):
            data["mutations"] = calculate_auto_arranged_mutations(layers, req.current_state.get('canvasConfig', {}))
            data["message"] = "Auto-arranged all elements evenly across the full canvas height (800x1131) with balanced vertical spacing."
            
        return data
    except Exception as e:
        error_msg = str(e)
        logger.warning(f"AI Edit API exception: {error_msg}")
        
        # Fallback for arrange instructions if API limits or parsing fails
        if is_arrange_request:
            fallback_mutations = calculate_auto_arranged_mutations(layers, req.current_state.get('canvasConfig', {}))
            return {
                "message": "Auto-arranged all elements evenly across the full canvas height (800x1131) with balanced vertical spacing.",
                "mutations": fallback_mutations
            }
            
        if "429" in error_msg or "quota" in error_msg.lower():
            raise HTTPException(status_code=429, detail='AI usage limit reached. Please try again shortly.')
        raise HTTPException(status_code=500, detail=f'AI editing service error: {error_msg}')

@app.post('/api/ai/generate-poster-content')
async def generate_poster_content(
    req: PosterDataRequest,
    current_user: Optional[schemas.User] = Depends(get_optional_current_user)
):
    import os, json
    from google import genai
    from google.genai import types
    
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail='Gemini API is not configured.')
    client = genai.Client(api_key=api_key)
    prompt = f"""You are an elite, world-class poster designer and art director.
You are tasked with generating the rich layout and typographic data for a PREMIUM event poster matching the quality of top international symposiums and cinematic advertisements.

UNIVERSAL SYSTEM REQUIREMENT:
The event can be ANY category (Business Conference, Hackathon, College Symposium, Birthday Party, Music Concert, Sports Tournament, Wedding, Technical Workshop, Exhibition).
NEVER assume or inject any specific college or company branding (such as TKR, TKRCET, or MINDSPARKS) unless it is explicitly written in the provided event details below.

Event details:
{req.event_details}
Requested Style/Vibe: {req.style}

Analyze the details thoroughly and return a STRICT JSON object containing:
- event_category: The specific category (e.g. 'conference', 'hackathon', 'college_symposium', 'birthday', 'concert', 'sports', 'wedding', 'workshop').
- institution_name: Name of the organizing institution, company, university, or host ONLY IF provided in the event details. If none provided, return empty string "". NEVER invent an institution name.
- institution_details: Accreditation, autonomy, affiliations, or address ONLY IF provided in the event details. If none provided, return empty string "". NEVER invent accreditation badges or approvals.
- department_name: Department, team, faculty, or club host ONLY IF provided in the event details. If none provided, return empty string "". NEVER invent club or department names.
- host_and_invite: Formal invitation or host line (e.g. "CORDIALLY INVITES YOU TO" or "PRESENTS") ONLY IF appropriate for the event. If none, return empty string "".
- title: The main event title extracted accurately from the text.
- subtitle: Edition or sub-brand if present (e.g. "2026" or "Annual Gala"). If none, return empty string "".
- full_title_lockup: The combined title if best rendered together.
- description: A polished 2-3 line event description highlighting the core objective or theme.
- date: Cleanly formatted date extracted accurately from the event details.
- time: Cleanly formatted time extracted accurately from the event details.
- venue: Cleanly formatted venue extracted accurately from the event details.
- tagline_left: Slanted energetic brush/accent tagline if mentioned or fitting the theme (e.g. "Learn. Build. Innovate.").
- tagline_right: Elegant uppercase accent tagline if mentioned (e.g. "SHAPING THE FUTURE").
- signoff_title: Formal signoff prefix if appropriate (e.g. "With Regards," or "RSVP:"). If none, return empty string "".
- signoff_team: Host or organizing team name ONLY IF provided. If none, return empty string "".
- signoff_dept: Department or division ONLY IF provided. If none, return empty string "".
- signoff_brand: Organization or brand highlight ONLY IF provided. If none, return empty string "".
- contact_info: Email, website, or social handle extracted accurately from the text.
- registration_link: Registration URL if mentioned.
- bg_style: Best matching aesthetic: 'cyber-nebula', 'midnight-stars', 'aurora-glow', 'luxury-gold', 'minimal-slate', 'festive-vibrant'.
- typography_style: Best matching typography: '3d-noventrix-blue', '3d-gold-foil', '3d-liquid-chrome', 'neon-tube', 'elegant-serif', 'bold-flat'.
- has_institution_header: true ONLY IF an institution or company name is provided, otherwise false.
- left_logo_asset: 'tkrcet_logo' ONLY IF the event text EXPLICITLY states TKR or TKRCET. Otherwise 'none'. NEVER invent logos.
- right_badge_asset: 'naac_badge' ONLY IF NAAC is EXPLICITLY mentioned in event details. Otherwise 'none'.
- venue_backdrop_asset: 'tkrcet_campus' ONLY IF TKRCET campus is EXPLICITLY mentioned in event details. Otherwise 'none'.

Backwards compatibility aliases:
- organizer_top: same as institution_name
- organizer_sub: same as department_name
- diagonal_tagline: same as tagline_left
- bottom_signoff: same as signoff_brand
"""
    try:
        response = client.models.generate_content(
            model='gemini-3.5-flash-lite',
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_mime_type='application/json',
                temperature=0.3
            )
        )
        import re
        raw_text = response.text.strip()
        if raw_text.startswith("```"):
            raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
            raw_text = re.sub(r"\s*```$", "", raw_text)
            raw_text = raw_text.strip()
            
        # Fix trailing commas which Python's strict json.loads rejects
        raw_text = re.sub(r',\s*([\]}])', r'\1', raw_text)
        
        return json.loads(raw_text)
    except json.JSONDecodeError as je:
        # Fallback empty structure so the UI doesn't completely crash, but logs the error
        print(f"JSON Parse Error: {str(je)} on payload: {response.text}")
        raise HTTPException(status_code=500, detail=f'AI returned invalid format. Please try again.')
    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "quota" in error_msg.lower():
            raise HTTPException(status_code=429, detail='AI usage limit reached. Please try again later or check your API quota.')
        raise HTTPException(status_code=500, detail=f'AI processing error: {error_msg}')

@app.post('/api/events/{event_id}/poster')
async def upload_poster(
    event_id: int,
    file: UploadFile = File(...),
    poster_data: str = Form(None),
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event or db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail='Not authorized')
    import uuid
    import json
    
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'png'
    base_uuid = uuid.uuid4().hex
    unique_filename = f'{event_id}_{base_uuid}.{file_ext}'
    file_path = f'static/posters/{unique_filename}'
    
    with open(file_path, 'wb') as f:
        f.write(await file.read())
        
    if poster_data:
        json_path = f'static/posters/{event_id}_{base_uuid}.json'
        with open(json_path, 'w') as f:
            f.write(poster_data)
            
    db_event.poster_url = f'/{file_path}'
    db.commit()
    return {'poster_url': db_event.poster_url}

# --- BRANDING KITS SYSTEM ---

SYSTEM_BRANDING_KITS = [
    {
        "name": "TKR College of Engineering and Technology",
        "short_name": "TKRCET",
        "institution_type": "Autonomous Engineering College",
        "location": "Medbowli, Meerpet, Hyderabad, Telangana - 500097",
        "department": "Department of Computer Science and Engineering",
        "logo_url": "/assets/tkrcet_logo.png",
        "badge_url": "/assets/naac_a_plus.png",
        "backdrop_url": "/assets/tkrcet_campus.png",
        "primary_color": "#0d233a",
        "secondary_color": "#f59e0b",
        "dark_bg": "#030712",
        "accent_color": "#38bdf8",
        "preferred_font": "Orbitron",
        "recommended_border": "academic-double-gold",
        "signoff_text": "With Regards,\nMINDSPARKS CLUB\nDepartment of Computer Science and Engineering\n— TKRCET —",
        "website": "https://www.tkrcet.ac.in",
        "is_verified": True
    },
    {
        "name": "VNR Vignana Jyothi Institute of Engineering and Technology",
        "short_name": "VNR VJIET",
        "institution_type": "Autonomous Engineering College",
        "location": "Vignana Jyothi Nagar, Pragathi Nagar, Nizampet, Hyderabad - 500090",
        "department": "Department of Information Technology & CSE",
        "logo_url": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/VNR_Vignana_Jyothi_Institute_of_Engineering_and_Technology_logo.png/220px-VNR_Vignana_Jyothi_Institute_of_Engineering_and_Technology_logo.png",
        "badge_url": "/assets/naac_a_plus.png",
        "backdrop_url": "",
        "primary_color": "#7f1d1d",
        "secondary_color": "#d97706",
        "dark_bg": "#0f172a",
        "accent_color": "#fbbf24",
        "preferred_font": "Cinzel",
        "recommended_border": "academic-double-gold",
        "signoff_text": "With Regards,\nStudent Technical Association\nVNR Vignana Jyothi Institute of Engineering & Technology",
        "website": "https://www.vnrvjiet.ac.in",
        "is_verified": True
    },
    {
        "name": "Vignan's Foundation for Science, Technology and Research",
        "short_name": "Vignan University",
        "institution_type": "Deemed to be University",
        "location": "Vadlamudi, Guntur & Hyderabad Campus",
        "department": "School of Computing & Informatics",
        "logo_url": "https://upload.wikimedia.org/wikipedia/en/thumb/5/52/Vignan_University_logo.png/220px-Vignan_University_logo.png",
        "badge_url": "/assets/naac_a_plus.png",
        "backdrop_url": "",
        "primary_color": "#991b1b",
        "secondary_color": "#ea580c",
        "dark_bg": "#0b0f19",
        "accent_color": "#38bdf8",
        "preferred_font": "Montserrat",
        "recommended_border": "modern-minimalist",
        "signoff_text": "With Warm Regards,\nFaculty & Student Organizing Committee\nVignan University",
        "website": "https://www.vignan.ac.in",
        "is_verified": True
    },
    {
        "name": "Chaitanya Bharathi Institute of Technology",
        "short_name": "CBIT",
        "institution_type": "Autonomous Engineering College",
        "location": "Gandipet, Hyderabad, Telangana - 500075",
        "department": "Department of Computer Science & Engineering",
        "logo_url": "",
        "badge_url": "/assets/naac_a_plus.png",
        "backdrop_url": "",
        "primary_color": "#065f46",
        "secondary_color": "#ca8a04",
        "dark_bg": "#022c22",
        "accent_color": "#34d399",
        "preferred_font": "Playfair Display",
        "recommended_border": "classic-emerald-gold",
        "signoff_text": "With Best Compliments,\nChaitanya Bharathi Institute of Technology\nGandipet, Hyderabad",
        "website": "https://www.cbit.ac.in",
        "is_verified": True
    },
    {
        "name": "Vasavi College of Engineering",
        "short_name": "Vasavi College",
        "institution_type": "Autonomous Engineering College",
        "location": "9-5-81, Ibrahimbagh, Hyderabad - 500031",
        "department": "Department of Information Technology",
        "logo_url": "",
        "badge_url": "/assets/naac_a_plus.png",
        "backdrop_url": "",
        "primary_color": "#1e3a8a",
        "secondary_color": "#b45309",
        "dark_bg": "#0a0e1a",
        "accent_color": "#60a5fa",
        "preferred_font": "Inter",
        "recommended_border": "academic-double-gold",
        "signoff_text": "Cordially Invited by,\nOrganizing Committee, Vasavi College of Engineering",
        "website": "https://www.vce.ac.in",
        "is_verified": True
    },
    {
        "name": "Indian Institute of Technology Hyderabad",
        "short_name": "IIT Hyderabad",
        "institution_type": "Institute of National Importance",
        "location": "Near NH-65, Kandi, Sangareddy, Telangana - 502284",
        "department": "Department of Computer Science & Engineering",
        "logo_url": "",
        "badge_url": "",
        "backdrop_url": "",
        "primary_color": "#1d4ed8",
        "secondary_color": "#f97316",
        "dark_bg": "#030712",
        "accent_color": "#06b6d4",
        "preferred_font": "Orbitron",
        "recommended_border": "futuristic-tech-brackets",
        "signoff_text": "Organized by,\nTechnical Council & Students' Gymkhana\nIndian Institute of Technology Hyderabad",
        "website": "https://www.iith.ac.in",
        "is_verified": True
    },
    {
        "name": "TechNova Developer Guild & IEEE Student Branch",
        "short_name": "TechNova & IEEE",
        "institution_type": "Tech Community & Professional Society",
        "location": "National Innovation Hub, Bangalore",
        "department": "Technical Activities & Hackathons Committee",
        "logo_url": "",
        "badge_url": "",
        "backdrop_url": "",
        "primary_color": "#0284c7",
        "secondary_color": "#8b5cf6",
        "dark_bg": "#050816",
        "accent_color": "#06b6d4",
        "preferred_font": "Orbitron",
        "recommended_border": "neon-cyber-glow",
        "signoff_text": "With Regards,\nTechNova Developer Guild & IEEE Student Branch\nteam@technova.dev",
        "website": "https://www.technova.dev",
        "is_verified": True
    },
    {
        "name": "Apex Financial Media Group",
        "short_name": "Apex Financial",
        "institution_type": "Corporate Organization",
        "location": "Mumbai & Singapore Financial Center",
        "department": "Global Conferences & Summits Division",
        "logo_url": "",
        "badge_url": "",
        "backdrop_url": "",
        "primary_color": "#d4af37",
        "secondary_color": "#1e293b",
        "dark_bg": "#090d16",
        "accent_color": "#fbbf24",
        "preferred_font": "Playfair Display",
        "recommended_border": "gold-luxury",
        "signoff_text": "Hosted by,\nApex Financial Media Group\nevents@apexmedia.com",
        "website": "https://www.apexmedia.com",
        "is_verified": True
    }
]

def seed_system_branding_kits(db: Session):
    from .discovery import seed_india_institutions_directory
    seed_india_institutions_directory(db)

# --- INDIA-WIDE INSTITUTION DIRECTORY ENDPOINTS ---

@app.get('/api/institutions', response_model=List[schemas.InstitutionSummary])
def get_institutions_endpoint(
    q: Optional[str] = None,
    category: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    has_kit: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    from .discovery import seed_india_institutions_directory
    seed_india_institutions_directory(db)

    institutions = crud.get_institutions(
        db,
        query=q,
        category=category,
        state=state,
        district=district,
        has_kit=has_kit,
        skip=skip,
        limit=limit
    )

    results = []
    for inst in institutions:
        kit = inst.branding_kits[0] if inst.branding_kits else None
        rec_summary = [f"{r.authority}: {r.recognition_status}" for r in inst.recognition_records[:3]]
        results.append(schemas.InstitutionSummary(
            id=inst.id,
            code=inst.code,
            official_name=inst.official_name,
            common_name=inst.common_name,
            abbreviations=inst.abbreviations,
            category=inst.category,
            institution_type=inst.institution_type,
            state=inst.state,
            district=inst.district,
            city=inst.city,
            website=inst.website,
            established_year=inst.established_year,
            has_branding_kit=bool(kit),
            branding_kit_id=kit.id if kit else None,
            branding_status=kit.status if kit else "Discovered",
            logo_url=kit.logo_url if kit else None,
            primary_color=kit.primary_color if kit else None,
            secondary_color=kit.secondary_color if kit else None,
            recognition_summary=rec_summary
        ))
    return results

@app.get('/api/institutions/{id}', response_model=schemas.InstitutionDetail)
def get_institution_detail_endpoint(id: int, db: Session = Depends(get_db)):
    inst = crud.get_institution_by_id(db, id)
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")
    return inst

@app.post('/api/institutions', response_model=schemas.InstitutionDetail)
def create_institution_endpoint(
    inst_data: schemas.InstitutionCreate,
    db: Session = Depends(get_db)
):
    # Enforce duplicate institution detection
    duplicate = crud.find_duplicate_institution(db, official_name=inst_data.official_name, code=inst_data.code, website=inst_data.website)
    if duplicate:
        raise HTTPException(
            status_code=409, 
            detail=f"Duplicate institution detected! Institution '{duplicate.official_name}' ({duplicate.code}) already exists in directory."
        )
    return crud.create_institution(db, inst_data=inst_data)

@app.post('/api/institutions/{id}/discover', response_model=schemas.BrandingDiscoveryResult)
def discover_institution_branding_endpoint(id: int, db: Session = Depends(get_db)):
    from .discovery import run_branding_discovery
    try:
        return run_branding_discovery(db, institution_id=id)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"Discovery error: {e}")
        raise HTTPException(status_code=500, detail=f"Branding discovery failed: {str(e)}")

# --- BRANDING KIT ENDPOINTS ---

@app.get('/api/branding-kits', response_model=List[schemas.BrandingKit])
def get_branding_kits_endpoint(
    institution_id: Optional[int] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from .discovery import seed_india_institutions_directory
    seed_india_institutions_directory(db)

    kits = crud.get_branding_kits(db, institution_id=institution_id)
    if category and category != 'All':
        c_lower = category.lower()
        kits = [k for k in kits if c_lower in (k.institution_type or '').lower() or c_lower in (k.name or '').lower()]
    return kits

@app.get('/api/branding-kits/{kit_id}', response_model=schemas.BrandingKit)
def get_branding_kit_endpoint(kit_id: int, db: Session = Depends(get_db)):
    kit = crud.get_branding_kit(db, kit_id=kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Branding kit not found")
    return kit

@app.post('/api/branding-kits', response_model=schemas.BrandingKit)
def create_branding_kit_endpoint(
    kit: schemas.BrandingKitCreate,
    db: Session = Depends(get_db)
):
    kit.is_verified = False # User created kits are never automatically verified
    if not kit.status:
        kit.status = "Assets Collected"
    return crud.create_branding_kit(db, kit=kit, user_id=None)

@app.put('/api/branding-kits/{kit_id}', response_model=schemas.BrandingKit)
def update_branding_kit_endpoint(
    kit_id: int,
    kit_update: schemas.BrandingKitUpdate,
    db: Session = Depends(get_db)
):
    db_kit = crud.get_branding_kit(db, kit_id=kit_id)
    if not db_kit:
        raise HTTPException(status_code=404, detail="Branding kit not found")
    
    # Authorized protection: Prevent unauthorized modifications to verified kits
    if db_kit.is_verified:
        raise HTTPException(status_code=403, detail="Verified institutional branding kits cannot be modified without verified institutional representative credentials. Please duplicate the kit to create customized variants.")

    return crud.update_branding_kit(db, db_kit=db_kit, kit_update=kit_update)

@app.post('/api/branding-kits/{kit_id}/duplicate', response_model=schemas.BrandingKit)
def duplicate_branding_kit_endpoint(
    kit_id: int,
    db: Session = Depends(get_db)
):
    db_kit = crud.get_branding_kit(db, kit_id=kit_id)
    if not db_kit:
        raise HTTPException(status_code=404, detail="Branding kit not found")
    # Duplicate as a custom unverified kit
    return crud.duplicate_branding_kit(db, db_kit=db_kit, new_user_id=1)

@app.delete('/api/branding-kits/{kit_id}')
def delete_branding_kit_endpoint(
    kit_id: int,
    db: Session = Depends(get_db)
):
    db_kit = crud.get_branding_kit(db, kit_id=kit_id)
    if not db_kit:
        raise HTTPException(status_code=404, detail="Branding kit not found")
    if db_kit.is_verified and db_kit.user_id is None:
        raise HTTPException(status_code=403, detail="System verified institutional kits cannot be deleted. You can delete your custom kits.")
    crud.delete_branding_kit(db, db_kit=db_kit)
    return {"message": "Branding kit deleted"}

@app.post('/api/branding-kits/{kit_id}/verify')
def verify_branding_kit_endpoint(
    kit_id: int,
    evidence_url: Optional[str] = Form(None),
    verification_method: str = Form("official_domain"),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    from datetime import datetime, timezone
    db_kit = crud.get_branding_kit(db, kit_id=kit_id)
    if not db_kit:
        raise HTTPException(status_code=404, detail="Branding kit not found")

    prev_status = db_kit.status
    db_kit.status = "Institution Confirmed"
    db_kit.is_verified = True

    v_log = models.BrandingVerification(
        kit_id=db_kit.id,
        previous_status=prev_status,
        new_status="Institution Confirmed",
        verification_method=verification_method,
        evidence_url=evidence_url,
        notes=notes or "Institutional authorization confirmed via institutional email & domain evidence",
        verified_at=datetime.now(timezone.utc)
    )
    db.add(v_log)
    db.commit()
    db.refresh(db_kit)
    return {"message": "Branding kit verified and confirmed", "kit_id": db_kit.id, "status": db_kit.status}

@app.post('/api/branding-kits/upload-asset')
@app.post('/api/branding-kits/upload-logo')
@app.post('/api/branding/upload-asset')
@app.post('/api/posters/upload-image')
async def upload_branding_asset_endpoint(
    file: UploadFile = File(...)
):
    import uuid
    import io
    from .discovery import sanitize_svg

    filename_raw = file.filename or "upload.png"
    file_ext = filename_raw.split('.')[-1].lower() if '.' in filename_raw else 'png'

    allowed_exts = {'png', 'jpg', 'jpeg', 'svg', 'webp'}
    if file_ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"Unsupported file format '.{file_ext}'. Allowed formats: PNG, JPG, JPEG, SVG, WEBP.")

    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds maximum permitted limit of 15MB.")

    # Sanitize SVG files safely
    if file_ext == 'svg':
        try:
            svg_text = content.decode('utf-8')
            clean_svg = sanitize_svg(svg_text)
            content = clean_svg.encode('utf-8')
        except Exception:
            pass

    width = None
    height = None
    aspect_ratio = None
    if file_ext in {'png', 'jpg', 'jpeg', 'webp'}:
        try:
            with Image.open(io.BytesIO(content)) as img:
                width, height = img.size
                if height and height > 0:
                    aspect_ratio = round(width / height, 3)
        except Exception as e:
            logger.warning(f"Could not read image dimensions: {e}")

    unique_filename = f"asset_{uuid.uuid4().hex}.{file_ext}"
    filepath = f"static/posters/{unique_filename}"
    with open(filepath, 'wb') as f:
        f.write(content)

    return {
        "url": f"/{filepath}",
        "filename": unique_filename,
        "mime_type": f"image/{file_ext if file_ext != 'svg' else 'svg+xml'}",
        "size": len(content),
        "width": width,
        "height": height,
        "aspect_ratio": aspect_ratio
    }


class ExtractPosterTextRequest(BaseModel):
    image_url: Optional[str] = None
    text_hint: Optional[str] = None


@app.post('/api/ai/extract-poster-text')
async def extract_poster_text(
    req: ExtractPosterTextRequest
):
    """
    Extracts text elements from an uploaded poster image using Gemini Vision OCR,
    returning structured editable text layers for Poster Studio.
    """
    if not req.image_url:
        raise HTTPException(status_code=400, detail="image_url is required for text extraction.")

    # Locate image file on disk if local
    local_path = None
    clean_url = req.image_url.strip()
    if clean_url.startswith('/static/'):
        local_path = clean_url.lstrip('/')
    elif clean_url.startswith('http://') or clean_url.startswith('https://'):
        if '/static/' in clean_url:
            local_path = 'static/' + clean_url.split('/static/')[-1]

    img_bytes = None
    if local_path and os.path.exists(local_path):
        try:
            with open(local_path, 'rb') as f:
                img_bytes = f.read()
        except Exception as e:
            logger.warning(f"Failed to read local image file {local_path}: {e}")

    if not img_bytes and (clean_url.startswith('http://') or clean_url.startswith('https://')):
        try:
            import requests
            resp = requests.get(clean_url, timeout=10)
            if resp.status_code == 200:
                img_bytes = resp.content
        except Exception as e:
            logger.warning(f"Failed to fetch image url {clean_url}: {e}")

    if not img_bytes:
        return {
            "success": False,
            "message": "Image file could not be read for text extraction.",
            "detected_elements": []
        }

    try:
        from google import genai
        from google.genai import types
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            return {
                "success": False,
                "message": "GEMINI_API_KEY not configured for AI text detection.",
                "detected_elements": []
            }

        client = genai.Client(api_key=api_key)
        prompt = """Inspect this poster image carefully and perform OCR / text detection.
Extract the distinct text blocks visible on the poster into structured elements.
For each element, classify its role: 'title', 'subtitle', 'date', 'venue', 'organizer', 'badge', or 'details'.
Estimate approximate vertical position Y (from 0 to 1131, top to bottom).

Return ONLY valid JSON with this schema:
{
  "detected_elements": [
    {
      "text": "Exact text string seen on poster",
      "role": "title|subtitle|date|venue|organizer|badge|details",
      "approx_font_size": 42,
      "approx_y": 250,
      "confidence": 0.95
    }
  ]
}
"""
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                types.Part.from_bytes(data=img_bytes, mime_type="image/png"),
                prompt
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2
            )
        )

        import json
        clean_text = response.text.strip()
        if clean_text.startswith("```"):
            clean_text = clean_text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        result_json = json.loads(clean_text)
        elements = result_json.get("detected_elements", [])
        return {
            "success": True,
            "detected_elements": elements,
            "count": len(elements)
        }
    except Exception as e:
        logger.warning(f"Poster OCR text extraction encountered error: {e}")
        return {
            "success": False,
            "message": f"AI text detection was unable to process this image: {str(e)}",
            "detected_elements": []
        }





# ==========================================
# LIVE EVENT CONTROL CENTER ENDPOINTS
# ==========================================

@app.get("/api/events/{event_id}/live/overview")
def get_live_overview_endpoint(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access control center for this event")
    return crud.get_live_overview(db, event_id=event_id)

@app.get("/api/events/{event_id}/live-tasks", response_model=List[schemas.LiveTaskOut])
def get_live_tasks_endpoint(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.get_live_tasks(db, event_id=event_id)

@app.post("/api/events/{event_id}/live-tasks", response_model=schemas.LiveTaskOut)
def create_live_task_endpoint(
    event_id: int,
    task_in: schemas.LiveTaskCreate,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if not task_in.title or not task_in.title.strip():
        raise HTTPException(status_code=400, detail="Task title is required")
    if not task_in.instructions or not task_in.instructions.strip():
        raise HTTPException(status_code=400, detail="Task instructions are required")

    return crud.create_live_task(db, event_id=event_id, task_in=task_in)

@app.get("/api/events/{event_id}/live-tasks/diagnostics")
def get_live_tasks_diagnostics_endpoint(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event or db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    total_tasks = db.query(models.LiveTask).filter(models.LiveTask.event_id == event_id).count()
    reminders = db.query(models.TaskReminder).filter(models.TaskReminder.event_id == event_id).all()
    submissions = db.query(models.TaskSubmission).filter(models.TaskSubmission.event_id == event_id).all()

    email_provider_ok = bool(os.getenv("SMTP_SERVER") or os.getenv("MOCK_EMAIL") or os.getenv("TESTING"))
    ai_provider_ok = bool(os.getenv("GEMINI_API_KEY"))

    return {
        "event_id": event_id,
        "total_tasks": total_tasks,
        "reminders": {
            "total": len(reminders),
            "scheduled": sum(1 for r in reminders if r.status == "Scheduled"),
            "sent": sum(1 for r in reminders if r.status == "Sent"),
            "skipped": sum(1 for r in reminders if r.status == "Skipped"),
            "expired": sum(1 for r in reminders if r.status == "Expired"),
            "failed": sum(1 for r in reminders if r.status == "Failed"),
        },
        "submissions": {
            "total": len(submissions),
            "ai_passed": sum(1 for s in submissions if s.ai_status == "Passed"),
            "ai_needs_correction": sum(1 for s in submissions if s.ai_status == "Needs Correction"),
            "ai_manual_review": sum(1 for s in submissions if s.ai_status == "Needs Manual Review"),
            "verified": sum(1 for s in submissions if s.status == "Verified")
        },
        "diagnostics": {
            "email_provider_configured": email_provider_ok,
            "ai_provider_configured": ai_provider_ok,
            "background_worker_active": True
        }
    }

@app.get("/api/events/{event_id}/live-tasks/{task_id}", response_model=schemas.LiveTaskOut)
def get_live_task_endpoint(
    event_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    task = crud.get_live_task(db, task_id=task_id)
    if not task or task.event_id != event_id:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.put("/api/events/{event_id}/live-tasks/{task_id}", response_model=schemas.LiveTaskOut)
def update_live_task_endpoint(
    event_id: int,
    task_id: int,
    task_update: schemas.LiveTaskUpdate,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    task = crud.get_live_task(db, task_id=task_id)
    if not task or task.event_id != event_id:
        raise HTTPException(status_code=404, detail="Task not found")

    updated = crud.update_live_task(db, task_id=task_id, task_update=task_update)
    return updated

@app.delete("/api/events/{event_id}/live-tasks/{task_id}")
def delete_live_task_endpoint(
    event_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    task = crud.get_live_task(db, task_id=task_id)
    if not task or task.event_id != event_id:
        raise HTTPException(status_code=404, detail="Task not found")

    crud.delete_live_task(db, task_id=task_id)
    return {"status": "cancelled", "task_id": task_id}

@app.get("/api/events/{event_id}/live-tasks/{task_id}/submissions", response_model=List[schemas.TaskSubmissionOut])
def get_task_submissions_endpoint(
    event_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    task = crud.get_live_task(db, task_id=task_id)
    if not task or task.event_id != event_id:
        raise HTTPException(status_code=404, detail="Task not found")

    return crud.get_task_submissions(db, task_id=task_id)

@app.post("/api/events/{event_id}/submissions/{submission_id}/review", response_model=schemas.TaskSubmissionOut)
def review_submission_endpoint(
    event_id: int,
    submission_id: int,
    review_in: schemas.TaskSubmissionReview,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    valid_statuses = ["Verified", "Correction Required", "Completed"]
    if review_in.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {valid_statuses}")

    sub = crud.review_task_submission(
        db=db,
        submission_id=submission_id,
        reviewer_id=current_user.id,
        status=review_in.status,
        organizer_feedback=review_in.organizer_feedback
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    return sub

@app.post("/api/events/{event_id}/live-tasks/process-reminders")
def process_task_reminders_endpoint(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    processed = crud.process_due_task_reminders(db)
    return {"success": True, "status": "ok", "processed_reminders_count": len(processed), "reminders": processed}

@app.post("/api/events/{event_id}/live-tasks/{task_id}/reminders/send-now")
def send_task_reminder_now_endpoint(
    event_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    task = db.query(models.LiveTask).filter(
        models.LiveTask.id == task_id,
        models.LiveTask.event_id == event_id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    from app import live_scheduler
    result = live_scheduler.dispatch_task_reminder_now(db, task)
    return result

# --- TIMELINE ENDPOINTS ---

@app.get("/api/events/{event_id}/timeline", response_model=List[schemas.EventTimelineOut])
def get_timeline_endpoint(
    event_id: int,
    db: Session = Depends(get_db)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    return crud.get_timeline_entries(db, event_id=event_id)

@app.post("/api/events/{event_id}/timeline", response_model=schemas.EventTimelineOut)
def create_timeline_entry_endpoint(
    event_id: int,
    entry_in: schemas.EventTimelineCreate,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return crud.create_timeline_entry(db, event_id=event_id, entry_in=entry_in)

@app.put("/api/events/{event_id}/timeline/{entry_id}", response_model=schemas.EventTimelineOut)
def update_timeline_entry_endpoint(
    event_id: int,
    entry_id: int,
    entry_update: schemas.EventTimelineUpdate,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    entry = crud.update_timeline_entry(db, entry_id=entry_id, entry_update=entry_update)
    if not entry:
        raise HTTPException(status_code=404, detail="Timeline entry not found")
    return entry

@app.delete("/api/events/{event_id}/timeline/{entry_id}")
def delete_timeline_entry_endpoint(
    event_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    success = crud.delete_timeline_entry(db, entry_id=entry_id)
    if not success:
        raise HTTPException(status_code=404, detail="Timeline entry not found")
    return {"status": "deleted", "entry_id": entry_id}

# --- AI POLISH TASK INSTRUCTIONS ---

@app.post("/api/ai/polish-task-instructions", response_model=schemas.AIPolishInstructionsResponse)
async def polish_task_instructions_endpoint(
    req: schemas.AIPolishInstructionsRequest,
    current_user: Optional[schemas.User] = Depends(get_optional_current_user)
):
    raw = req.raw_text.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="raw_text is required")

    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=api_key)
            prompt = f"""You are an event management assistant for organizers. Convert these rough task notes into clear, professional instructions for live event participants.

CRITICAL CONSTRAINTS:
1. Do NOT invent dates, deadlines, timezones, venues, or rules not present in the input.
2. If no deadline was specified in the text, leave it blank or note "Submit before round conclusion".
3. Return STRICT JSON with keys: "task_title", "instructions", "description", "suggested_submission_method" (one of: "file", "url", "text", "file_url", "all").

Organizer rough input:
"{raw}"
"""
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            parsed = json.loads(response.text)
            return schemas.AIPolishInstructionsResponse(
                task_title=parsed.get("task_title", "Event Task Submission"),
                instructions=parsed.get("instructions", raw),
                description=parsed.get("description", ""),
                suggested_submission_method=parsed.get("suggested_submission_method", "file"),
                is_ai_generated=True
            )
        except Exception as e:
            logger.warning(f"Gemini instruction polish fallback: {e}")

    # Deterministic rule-based fallback (No hallucinations, perfectly structured)
    lines = [line.strip() for line in raw.replace(".", "\n").split("\n") if line.strip()]
    title = lines[0][:60] if lines else "Participant Task"
    if len(title) < 10 and len(lines) > 1:
        title = f"Task: {title}"

    sub_method = "file"
    raw_lower = raw.lower()
    if "link" in raw_lower or "url" in raw_lower or "github" in raw_lower or "figma" in raw_lower:
        sub_method = "url"
    elif "write" in raw_lower or "answer" in raw_lower or "text" in raw_lower:
        sub_method = "text"
    elif "ppt" in raw_lower or "pdf" in raw_lower or "upload" in raw_lower or "doc" in raw_lower:
        sub_method = "file"

    formatted_steps = []
    for idx, l in enumerate(lines, 1):
        clean_line = l.lstrip("0123456789.-) ")
        formatted_steps.append(f"{idx}. {clean_line.capitalize()}")

    return schemas.AIPolishInstructionsResponse(
        task_title=title.title(),
        instructions="\n".join(formatted_steps) if formatted_steps else raw,
        description="Please review and complete the instructions as requested by the organizers.",
        suggested_submission_method=sub_method,
        is_ai_generated=False
    )

# --- PARTICIPANT LIVE PORTAL & SUBMISSIONS ---

@app.get("/api/events/{event_id}/live-portal", response_model=schemas.ParticipantLivePortalResponse)
def get_participant_live_portal_endpoint(
    event_id: int,
    ticket_code: Optional[str] = None,
    email: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[schemas.User] = Depends(get_optional_current_user)
):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Find participant registration
    reg = None
    if ticket_code and ticket_code.strip():
        reg = db.query(models.Registration).filter(
            models.Registration.event_id == event_id,
            models.Registration.ticket_code == ticket_code.strip().upper()
        ).first()
    elif current_user:
        reg = db.query(models.Registration).filter(
            models.Registration.event_id == event_id,
            models.Registration.email == current_user.email
        ).first()
    elif email and email.strip():
        reg = db.query(models.Registration).filter(
            models.Registration.event_id == event_id,
            models.Registration.email == email.strip().lower()
        ).first()

    # Announcements
    announcements = db.query(models.NotificationCampaign).filter(
        models.NotificationCampaign.event_id == event_id
    ).order_by(models.NotificationCampaign.created_at.desc()).limit(15).all()

    urgent_update = db.query(models.NotificationCampaign).filter(
        models.NotificationCampaign.event_id == event_id,
        models.NotificationCampaign.priority == "urgent"
    ).order_by(models.NotificationCampaign.created_at.desc()).first()

    # Active tasks
    tasks = db.query(models.LiveTask).filter(
        models.LiveTask.event_id == event_id,
        models.LiveTask.status.in_(["Active", "Completed"])
    ).order_by(models.LiveTask.deadline.asc()).all()

    timeline = db.query(models.EventTimelineEntry).filter(
        models.EventTimelineEntry.event_id == event_id
    ).order_by(models.EventTimelineEntry.scheduled_time.asc()).all()

    task_views = []
    for t in tasks:
        # Check deadline
        dl = t.deadline
        if dl.tzinfo is None:
            dl = dl.replace(tzinfo=timezone.utc)
        diff = int((dl - now).total_seconds())
        is_exp = diff <= 0

        # My submission (if participant identified)
        my_sub = None
        if reg:
            my_sub = crud.get_participant_task_submission(
                db=db,
                task_id=t.id,
                registration_id=reg.id,
                team_id=reg.team_id
            )

        task_views.append(schemas.ParticipantTaskView(
            task=schemas.LiveTaskOut.model_validate(t),
            my_submission=schemas.TaskSubmissionOut.model_validate(my_sub) if my_sub else None,
            time_remaining_seconds=diff,
            is_expired=is_exp
        ))

    return schemas.ParticipantLivePortalResponse(
        event_id=db_event.id,
        event_title=db_event.title,
        event_status=db_event.status,
        announcements=[schemas.NotificationCampaignOut.model_validate(a) for a in announcements],
        urgent_update=schemas.NotificationCampaignOut.model_validate(urgent_update) if urgent_update else None,
        tasks=task_views,
        timeline=[schemas.EventTimelineOut.model_validate(tl) for tl in timeline],
        is_registered=bool(reg),
        participant_name=reg.full_name if reg else None,
        team_name=reg.team.team_name if reg and reg.team else None,
        ticket_code=reg.ticket_code if reg else None
    )

@app.post("/api/events/{event_id}/tasks/{task_id}/submit", response_model=schemas.TaskSubmissionOut)
async def submit_task_endpoint(
    event_id: int,
    task_id: int,
    ticket_code: Optional[str] = Form(None),
    submission_text: Optional[str] = Form(None),
    submission_url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: Optional[schemas.User] = Depends(get_optional_current_user)
):
    import uuid, shutil

    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    task = crud.get_live_task(db, task_id=task_id)
    if not task or task.event_id != event_id:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status == "Cancelled":
        raise HTTPException(status_code=400, detail="This task has been cancelled by the organizers")

    # Authenticate participant
    reg = None
    if ticket_code and ticket_code.strip():
        reg = db.query(models.Registration).filter(
            models.Registration.event_id == event_id,
            models.Registration.ticket_code == ticket_code.strip().upper()
        ).first()
    elif current_user:
        reg = db.query(models.Registration).filter(
            models.Registration.event_id == event_id,
            models.Registration.email == current_user.email
        ).first()

    if not reg:
        raise HTTPException(status_code=401, detail="Participant authentication required. Provide a valid ticket_code or log in.")

    if reg.status in ["Cancelled", "Rejected"]:
        raise HTTPException(status_code=403, detail="Cancelled or rejected registrations are not permitted to submit tasks.")

    # Target audience validation
    if task.target_audience == "teams" and not reg.team_id:
        raise HTTPException(status_code=400, detail="This task is designated for teams only. You are not currently registered as part of a team.")

    if task.target_filter:
        if task.target_audience == "teams":
            allowed_teams = task.target_filter.get("team_ids", [])
            if allowed_teams and reg.team_id not in allowed_teams:
                raise HTTPException(status_code=403, detail="Your team is not included in the target audience for this task.")
        elif task.target_audience == "participants":
            allowed_regs = task.target_filter.get("registration_ids", [])
            if allowed_regs and reg.id not in allowed_regs:
                raise HTTPException(status_code=403, detail="You are not included in the target audience for this task.")

    # File upload handling & validation
    file_url = None
    file_name = None
    file_size_bytes = None

    if file and file.filename:
        # Check blocked extensions
        blocked_exts = [".exe", ".bat", ".cmd", ".sh", ".php", ".py", ".js", ".vbs", ".msi", ".dll"]
        ext = os.path.splitext(file.filename)[1].lower()
        if ext in blocked_exts:
            raise HTTPException(status_code=400, detail=f"File format '{ext}' is forbidden for security reasons.")

        # Check allowed file types
        if task.allowed_file_types:
            allowed = [e.strip().lower() for e in task.allowed_file_types.split(",") if e.strip()]
            if ext not in allowed:
                raise HTTPException(status_code=400, detail=f"Allowed file formats for this task are: {task.allowed_file_types}")

        # Destination directory
        sub_dir = os.path.join("static", "submissions", str(event_id), str(task_id))
        os.makedirs(sub_dir, exist_ok=True)

        secure_filename = f"{uuid.uuid4().hex}_{os.path.basename(file.filename)}"
        destination_path = os.path.join(sub_dir, secure_filename)

        # Read & check size limit
        content = await file.read()
        file_size_bytes = len(content)
        max_bytes = (task.max_file_size_mb or 25) * 1024 * 1024
        if file_size_bytes > max_bytes:
            raise HTTPException(status_code=400, detail=f"File exceeds maximum size limit of {task.max_file_size_mb} MB")

        with open(destination_path, "wb") as buffer:
            buffer.write(content)

        file_url = f"/static/submissions/{event_id}/{task_id}/{secure_filename}"
        file_name = file.filename

    # Verify at least one submission component provided
    if not file_url and not (submission_url and submission_url.strip()) and not (submission_text and submission_text.strip()):
        raise HTTPException(status_code=400, detail="Submission cannot be empty. Please upload a file, provide a URL, or enter response text.")

    try:
        sub = crud.create_or_update_task_submission(
            db=db,
            task_id=task_id,
            registration_id=reg.id,
            submission_text=submission_text.strip() if submission_text else None,
            submission_url=submission_url.strip() if submission_url else None,
            file_url=file_url,
            file_name=file_name,
            file_size_bytes=file_size_bytes
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    return sub


@app.get("/api/events/{event_id}/tasks/{task_id}/public", response_model=schemas.DirectTaskPortalResponse)
def get_direct_task_public_endpoint(
    event_id: int,
    task_id: int,
    ticket_code: Optional[str] = None,
    email: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[schemas.User] = Depends(get_optional_current_user)
):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    task = crud.get_live_task(db, task_id=task_id)
    if not task or task.event_id != event_id:
        raise HTTPException(status_code=404, detail="Task not found")

    # Participant identification
    reg = None
    if ticket_code and ticket_code.strip():
        reg = db.query(models.Registration).filter(
            models.Registration.event_id == event_id,
            models.Registration.ticket_code == ticket_code.strip().upper()
        ).first()
    elif current_user:
        reg = db.query(models.Registration).filter(
            models.Registration.event_id == event_id,
            models.Registration.email == current_user.email
        ).first()
    elif email and email.strip():
        reg = db.query(models.Registration).filter(
            models.Registration.event_id == event_id,
            models.Registration.email == email.strip().lower()
        ).first()

    # Deadline diff
    dl = task.deadline
    if dl.tzinfo is None:
        dl = dl.replace(tzinfo=timezone.utc)
    diff = int((dl - now).total_seconds())
    is_exp = diff <= 0

    my_sub = None
    if reg:
        my_sub = crud.get_participant_task_submission(
            db=db,
            task_id=task.id,
            registration_id=reg.id,
            team_id=reg.team_id
        )

    task_out = schemas.LiveTaskOut.model_validate(task)
    task_out.direct_submit_url = f"/events/{event_id}/tasks/{task.id}/submit"

    sub_out = None
    if my_sub:
        sub_out = schemas.TaskSubmissionOut.model_validate(my_sub)
        # Fetch versions
        versions = db.query(models.TaskSubmissionVersion).filter(
            models.TaskSubmissionVersion.submission_id == my_sub.id
        ).order_by(models.TaskSubmissionVersion.version_number.desc()).all()
        sub_out.versions = [schemas.TaskSubmissionVersionOut.model_validate(v) for v in versions]

    return schemas.DirectTaskPortalResponse(
        task=task_out,
        event_id=db_event.id,
        event_title=db_event.title,
        event_status=db_event.status,
        my_submission=sub_out,
        time_remaining_seconds=diff,
        is_expired=is_exp,
        is_registered=bool(reg),
        participant_name=reg.full_name if reg else None,
        team_name=reg.team.team_name if reg and reg.team else None,
        ticket_code=reg.ticket_code if reg else None
    )

@app.post("/api/events/{event_id}/submissions/{submission_id}/override", response_model=schemas.TaskSubmissionOut)
def override_submission_endpoint(
    event_id: int,
    submission_id: int,
    payload: schemas.TaskSubmissionOverrideRequest,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to review submissions for this event")

    sub = crud.override_submission_ai_result(
        db=db,
        submission_id=submission_id,
        reviewer_id=current_user.id,
        decision=payload.decision,
        reason=payload.reason,
        feedback=payload.feedback
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    return sub

@app.post("/api/events/{event_id}/submissions/{submission_id}/reverify")
def reverify_submission_endpoint(
    event_id: int,
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    from app import live_scheduler
    db_event = crud.get_event(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if db_event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    assessment = live_scheduler.verify_submission_with_ai(db, submission_id)
    return {"status": "ok", "assessment": assessment}

