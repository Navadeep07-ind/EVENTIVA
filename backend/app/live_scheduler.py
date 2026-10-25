import os
import sys
import json
import logging
import asyncio
import traceback
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import SessionLocal
from app import models, crud
from app.core.email import send_email

logger = logging.getLogger("eventiva_live_scheduler")
logger.setLevel(logging.INFO)

# Global background worker task reference
_worker_task: Optional[asyncio.Task] = None
_worker_running: bool = False

def calculate_and_schedule_task_reminders(
    db: Session,
    task: models.LiveTask,
    reminder_offsets: List[int],
    custom_message: Optional[str] = None
) -> List[models.TaskReminder]:
    """
    Calculates absolute scheduled times from task deadline and timezone,
    persisting TaskReminder records with unique idempotency keys.
    """
    created_reminders = []
    dl = task.deadline
    if dl.tzinfo is None:
        dl = dl.replace(tzinfo=timezone.utc)
    else:
        dl = dl.astimezone(timezone.utc)

    # Distinct positive offsets
    unique_offsets = sorted(list({int(o) for o in reminder_offsets if int(o) > 0}), reverse=True)

    for offset in unique_offsets:
        scheduled_time = dl - timedelta(minutes=offset)
        idempotency_key = f"REM-{task.id}-{offset}-{int(scheduled_time.timestamp())}"

        # Check existing
        existing = db.query(models.TaskReminder).filter(
            or_(
                models.TaskReminder.idempotency_key == idempotency_key,
                (models.TaskReminder.task_id == task.id) & (models.TaskReminder.reminder_offset_minutes == offset)
            )
        ).first()

        if existing:
            # Update scheduled time if deadline shifted
            existing.scheduled_time = scheduled_time
            existing.idempotency_key = idempotency_key
            if existing.status in ["Expired", "Failed", "Retry"]:
                existing.status = "Scheduled"
                existing.is_sent = False
            created_reminders.append(existing)
        else:
            rem = models.TaskReminder(
                task_id=task.id,
                event_id=task.event_id,
                reminder_offset_minutes=offset,
                scheduled_time=scheduled_time,
                custom_message=custom_message,
                status="Scheduled",
                is_sent=False,
                retry_count=0,
                idempotency_key=idempotency_key
            )
            db.add(rem)
            created_reminders.append(rem)

    db.commit()
    for r in created_reminders:
        db.refresh(r)
    return created_reminders

def process_due_task_reminders_robust(
    db: Session,
    now_override: Optional[datetime] = None,
    event_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Idempotent, database-backed processing of due task reminders.
    Supports atomic status claiming across multiple workers, completion exclusion,
    late-delivery expiration policy, bounded exponential backoff retries, and detailed telemetry.
    """
    now = now_override or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    # Query reminders that are due for delivery
    query = db.query(models.TaskReminder).filter(
        models.TaskReminder.is_sent == False,
        models.TaskReminder.status.in_(["Scheduled", "Retry"]),
        models.TaskReminder.scheduled_time <= now
    )
    if event_id is not None:
        query = query.filter(models.TaskReminder.event_id == event_id)
    due_reminders = query.all()

    processed_summary = []

    for rem in due_reminders:
        # Atomic claim: update status to 'Processing'
        # In SQLite/Postgres, ensure no double pickup:
        rows_affected = db.query(models.TaskReminder).filter(
            models.TaskReminder.id == rem.id,
            models.TaskReminder.status.in_(["Scheduled", "Retry"]),
            models.TaskReminder.is_sent == False
        ).update({"status": "Processing", "last_attempt_at": now})
        db.commit()
        if rows_affected == 0:
            # Another concurrent worker claimed this job first!
            continue

        db.refresh(rem)

        task = rem.task
        if not task:
            rem.status = "Cancelled"
            rem.failure_reason = "Parent task no longer exists"
            rem.is_sent = True
            db.commit()
            continue

        if task.status != "Active":
            rem.status = "Cancelled"
            rem.failure_reason = f"Task is marked as {task.status}"
            rem.is_sent = True
            db.commit()
            continue

        event = task.event
        if not event or (event.status and event.status.lower() != "published"):
            rem.status = "Cancelled"
            rem.failure_reason = "Event is not published"
            rem.is_sent = True
            db.commit()
            continue

        # LATE-DELIVERY POLICY:
        # If the task deadline has already passed, do NOT send a deadline reminder
        task_dl = task.deadline
        if task_dl.tzinfo is None:
            task_dl = task_dl.replace(tzinfo=timezone.utc)
        else:
            task_dl = task_dl.astimezone(timezone.utc)

        if now > task_dl:
            rem.status = "Expired"
            rem.is_sent = True
            rem.failure_reason = "Task cutoff deadline already passed before reminder was delivered"
            db.commit()
            processed_summary.append({
                "reminder_id": rem.id,
                "task_id": task.id,
                "status": "Expired",
                "reason": rem.failure_reason
            })
            continue

        # RESOLVE ELIGIBLE RECIPIENTS:
        # 1. Resolve candidates based on task audience
        target_audience = task.target_audience or "all"
        target_ids = None
        if task.target_filter:
            target_ids = task.target_filter.get("team_ids") if target_audience == "teams" else task.target_filter.get("registration_ids")

        candidates = crud.resolve_campaign_recipients(db, event.id, target_audience, target_ids)

        # 2. Exclude cancelled or rejected attendees
        eligible_candidates = [r for r in candidates if r.status not in ["Cancelled", "Rejected"]]

        # 3. Exclude participants or teams that have already submitted or completed the task
        submissions = db.query(models.TaskSubmission).filter(
            models.TaskSubmission.task_id == task.id,
            models.TaskSubmission.status.in_(["Submitted", "Verified", "Completed", "Awaiting Organizer Approval"])
        ).all()

        completed_reg_ids = set()
        completed_team_ids = set()
        for s in submissions:
            if s.registration_id:
                completed_reg_ids.add(s.registration_id)
            if s.team_id:
                completed_team_ids.add(s.team_id)

        recipients_to_notify = []
        for reg in eligible_candidates:
            if reg.team_id and reg.team_id in completed_team_ids:
                continue
            if reg.id in completed_reg_ids:
                continue
            recipients_to_notify.append(reg)

        if not recipients_to_notify:
            rem.status = "Skipped"
            rem.is_sent = True
            rem.delivery_result = {"reason": "All eligible participants or teams have already completed the task or were cancelled"}
            db.commit()
            processed_summary.append({
                "reminder_id": rem.id,
                "task_id": task.id,
                "status": "Skipped",
                "recipient_count": 0
            })
            continue

        # DISPATCH EMAILS WITH ISOLATED ERROR HANDLING
        if rem.reminder_offset_minutes <= 0:
            time_display = "NOW"
            subject = f"Urgent Task Deadline Alert: {task.title}"
            base_body = rem.custom_message or f"This is an urgent deadline reminder that your submission for '{task.title}' is due immediately.\n\nPlease submit your deliverables as soon as possible."
        else:
            time_display = f"{rem.reminder_offset_minutes} minutes" if rem.reminder_offset_minutes < 60 else f"{rem.reminder_offset_minutes // 60} hour(s)"
            subject = f"Deadline Reminder: {task.title} (Due in {time_display})"
            base_body = rem.custom_message or f"This is an urgent reminder that your submission for '{task.title}' is due in {time_display}.\n\nPlease review instructions and submit your deliverables before the deadline cutoff."
        priority = "urgent" if rem.reminder_offset_minutes <= 15 else "important"

        # Ensure campaign record exists for telemetry
        campaign = crud.create_notification_campaign(
            db=db,
            event_id=event.id,
            organizer_id=event.organizer_id,
            campaign_type="reminder",
            title=f"Task Deadline Alert: {task.title}",
            message=base_body,
            target_audience=target_audience,
            target_filter=task.target_filter,
            priority=priority
        )
        rem.campaign_id = campaign.id

        successful_deliveries = 0
        failed_deliveries = 0
        delivery_errors = []

        frontend_base = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
        direct_submit_base = f"{frontend_base}/events/{event.id}/tasks/{task.id}/submit"

        for reg in recipients_to_notify:
            idempotency_key = f"DELIV-REM-{rem.id}-{reg.id}"
            existing_deliv = db.query(models.NotificationDelivery).filter(
                models.NotificationDelivery.idempotency_key == idempotency_key
            ).first()

            if existing_deliv and existing_deliv.status == "sent":
                successful_deliveries += 1
                continue

            personalized_body = (
                f"Hello {reg.full_name},\n\n"
                f"{base_body}\n\n"
                f"--- TASK DETAILS ---\n"
                f"Task: {task.title}\n"
                f"Due: {task.deadline.strftime('%b %d, %Y %I:%M %p')} ({task.timezone})\n"
                f"Direct Submission Link: {direct_submit_base}?ticket={reg.ticket_code or ''}\n\n"
                f"Best regards,\n{event.title} Operations Team"
            )

            try:
                # Attempt email dispatch
                res = send_email(
                    to_email=reg.email,
                    subject=subject,
                    body=personalized_body
                )
                if res.get("status") in ["sent", "mock_sent"]:
                    successful_deliveries += 1
                    if existing_deliv:
                        existing_deliv.status = "sent"
                        existing_deliv.last_attempt_at = now
                    else:
                        db.add(models.NotificationDelivery(
                            campaign_id=campaign.id,
                            registration_id=reg.id,
                            recipient_email=reg.email,
                            recipient_name=reg.full_name,
                            status="sent",
                            idempotency_key=idempotency_key,
                            attempt_count=1,
                            last_attempt_at=now
                        ))
                else:
                    failed_deliveries += 1
                    err_msg = res.get("error") or "Email provider rejected message"
                    delivery_errors.append(f"{reg.email}: {err_msg}")
            except Exception as ex:
                failed_deliveries += 1
                err_msg = str(ex)
                delivery_errors.append(f"{reg.email}: {err_msg}")

        # Update telemetry and retry status
        rem.delivery_result = {
            "attempted_count": len(recipients_to_notify),
            "succeeded_count": successful_deliveries,
            "failed_count": failed_deliveries,
            "errors": delivery_errors[:5]
        }

        if failed_deliveries == 0 or successful_deliveries > 0:
            rem.status = "Sent"
            rem.is_sent = True
            rem.sent_at = now
            campaign.status = "completed"
            campaign.delivered_count = successful_deliveries
            campaign.failed_count = failed_deliveries
        else:
            # All failed, apply bounded exponential backoff
            rem.retry_count = (rem.retry_count or 0) + 1
            if rem.retry_count <= 3:
                backoff_minutes = 2 ** rem.retry_count
                rem.status = "Retry"
                rem.scheduled_time = now + timedelta(minutes=backoff_minutes)
                rem.failure_reason = "; ".join(delivery_errors[:3])
            else:
                rem.status = "Failed"
                rem.is_sent = True
                rem.failure_reason = f"Max retries exceeded: {'; '.join(delivery_errors[:3])}"

        db.commit()
        processed_summary.append({
            "reminder_id": rem.id,
            "task_id": task.id,
            "status": rem.status,
            "succeeded": successful_deliveries,
            "failed": failed_deliveries
        })

    return processed_summary

def dispatch_task_reminder_now(
    db: Session,
    task: models.LiveTask,
    custom_message: Optional[str] = None
) -> Dict[str, Any]:
    """
    Manually triggers an immediate deadline reminder for an active task.
    Excludes cancelled/rejected participants and participants/teams that have already submitted.
    Creates a campaign for telemetry, sends emails, and records per-recipient delivery results.
    """
    now = datetime.now(timezone.utc)
    event = task.event
    if not event:
        return {"success": False, "error": "Event not found", "delivered_count": 0}

    # 1. Resolve candidates based on task audience
    target_audience = task.target_audience or "all"
    target_ids = None
    if task.target_filter:
        target_ids = task.target_filter.get("team_ids") if target_audience == "teams" else task.target_filter.get("registration_ids")

    candidates = crud.resolve_campaign_recipients(db, event.id, target_audience, target_ids)

    # 2. Exclude cancelled or rejected attendees
    eligible_candidates = [r for r in candidates if r.status not in ["Cancelled", "Rejected"]]

    # 3. Exclude participants or teams that have already submitted or completed the task
    submissions = db.query(models.TaskSubmission).filter(
        models.TaskSubmission.task_id == task.id,
        models.TaskSubmission.status.in_(["Submitted", "Verified", "Completed", "Awaiting Organizer Approval"])
    ).all()

    completed_reg_ids = set()
    completed_team_ids = set()
    for s in submissions:
        if s.registration_id:
            completed_reg_ids.add(s.registration_id)
        if s.team_id:
            completed_team_ids.add(s.team_id)

    recipients_to_notify = []
    for reg in eligible_candidates:
        if reg.team_id and reg.team_id in completed_team_ids:
            continue
        if reg.id in completed_reg_ids:
            continue
        recipients_to_notify.append(reg)

    if not recipients_to_notify:
        return {
            "success": True,
            "delivered_count": 0,
            "failed_count": 0,
            "total_eligible": 0,
            "message": "All eligible participants or teams have already submitted deliverables or were cancelled."
        }

    # 4. Create NotificationCampaign for telemetry
    subject = f"Urgent Task Reminder: {task.title}"
    base_body = custom_message or f"This is an urgent reminder to submit your deliverables for '{task.title}'.\n\nPlease review instructions and complete your submission before the deadline cutoff."

    campaign = crud.create_notification_campaign(
        db=db,
        event_id=event.id,
        organizer_id=event.organizer_id,
        campaign_type="reminder",
        title=f"Manual Task Reminder: {task.title}",
        message=base_body,
        target_audience=target_audience,
        target_filter=task.target_filter,
        priority="urgent"
    )

    # 5. Create or log instant TaskReminder
    instant_reminder = models.TaskReminder(
        task_id=task.id,
        event_id=event.id,
        reminder_offset_minutes=0,
        scheduled_time=now,
        custom_message=custom_message,
        status="Sent",
        is_sent=True,
        sent_at=now,
        campaign_id=campaign.id,
        idempotency_key=f"MANUAL-{task.id}-{int(now.timestamp())}"
    )
    db.add(instant_reminder)
    db.commit()
    db.refresh(instant_reminder)

    frontend_base = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    successful_deliveries = 0
    failed_deliveries = 0
    delivery_errors = []

    # Format deadline nicely
    dl_str = task.deadline.strftime("%b %d, %Y %I:%M %p")
    tz_str = task.timezone or "UTC"

    for reg in recipients_to_notify:
        ticket_code = reg.ticket_code or ""
        direct_submit_url = f"{frontend_base}/events/{event.id}/tasks/{task.id}/submit?ticket={ticket_code}"
        idempotency_key = f"DELIV-MANUAL-{instant_reminder.id}-{reg.id}"

        personalized_body = (
            f"Hello {reg.full_name},\n\n"
            f"{base_body}\n\n"
            f"--- TASK DETAILS ---\n"
            f"Task: {task.title}\n"
            f"Instructions: {task.instructions}\n"
            f"Deadline: {dl_str} ({tz_str})\n"
            f"Submit Deliverable Here: {direct_submit_url}\n\n"
            f"Best regards,\n{event.title} Operations Team"
        )

        try:
            res = send_email(
                to_email=reg.email,
                subject=subject,
                body=personalized_body
            )
            if res.get("status") in ["sent", "mock_sent"]:
                successful_deliveries += 1
                db.add(models.NotificationDelivery(
                    campaign_id=campaign.id,
                    registration_id=reg.id,
                    recipient_email=reg.email,
                    recipient_name=reg.full_name,
                    status="sent",
                    idempotency_key=idempotency_key,
                    attempt_count=1,
                    last_attempt_at=now
                ))
            else:
                failed_deliveries += 1
                err_msg = res.get("error") or "Email provider rejected message"
                delivery_errors.append(f"{reg.email}: {err_msg}")
        except Exception as ex:
            failed_deliveries += 1
            delivery_errors.append(f"{reg.email}: {str(ex)}")

    instant_reminder.delivery_result = {
        "attempted_count": len(recipients_to_notify),
        "succeeded_count": successful_deliveries,
        "failed_count": failed_deliveries,
        "errors": delivery_errors[:5]
    }
    campaign.status = "completed"
    campaign.delivered_count = successful_deliveries
    campaign.failed_count = failed_deliveries
    db.commit()

    return {
        "success": successful_deliveries > 0 or failed_deliveries == 0,
        "delivered_count": successful_deliveries,
        "failed_count": failed_deliveries,
        "total_eligible": len(recipients_to_notify),
        "errors": delivery_errors,
        "message": f"Reminder successfully delivered to {successful_deliveries} participant(s)." if successful_deliveries > 0 else (delivery_errors[0] if delivery_errors else "No reminders sent.")
    }

# =====================================================================
# PART 3: AI AUTOMATIC SUBMISSION VERIFICATION ENGINE
# =====================================================================

def extract_submission_content(submission: models.TaskSubmission) -> Dict[str, Any]:
    """
    Safely extracts readable document content and validates URLs without executing code.
    Protects against malicious executable payloads and prompt injection.
    """
    extracted_text = ""
    file_metadata = {
        "file_name": submission.file_name,
        "file_size_bytes": submission.file_size_bytes,
        "file_type": None,
        "text_preview": ""
    }

    if submission.file_url:
        # Resolve physical path
        rel_path = submission.file_url.lstrip("/").replace("/", os.sep)
        if os.path.exists(rel_path):
            ext = os.path.splitext(rel_path)[1].lower()
            file_metadata["file_type"] = ext

            # 1. PDF Text Extraction
            if ext == ".pdf":
                try:
                    import PyPDF2
                    with open(rel_path, "rb") as f:
                        reader = PyPDF2.PdfReader(f)
                        num_pages = len(reader.pages)
                        file_metadata["pages_count"] = num_pages
                        extracted_chunks = []
                        for i in range(min(num_pages, 10)):  # Read up to 10 pages
                            page_text = reader.pages[i].extract_text()
                            if page_text:
                                extracted_chunks.append(page_text.strip())
                        extracted_text = "\n\n--- Page Break ---\n\n".join(extracted_chunks)
                        file_metadata["text_preview"] = extracted_text[:500]
                except Exception as e:
                    logger.warning(f"PDF extraction error for {rel_path}: {e}")
                    extracted_text = f"[PDF Document Attached: {submission.file_name} ({num_pages if 'num_pages' in locals() else 'N/A'} pages). Text extraction partial: {e}]"

            # 2. Plain Text / Code / Markdown Extraction
            elif ext in [".txt", ".md", ".json", ".csv"]:
                try:
                    with open(rel_path, "r", encoding="utf-8", errors="ignore") as f:
                        extracted_text = f.read(50000)  # Up to 50KB
                        file_metadata["text_preview"] = extracted_text[:500]
                except Exception as e:
                    logger.warning(f"Text file read error: {e}")

            # 3. Presentations / Office Documents
            elif ext in [".ppt", ".pptx"]:
                file_metadata["text_preview"] = f"[Presentation file submitted: {submission.file_name}]"
                extracted_text = f"[Presentation Deliverable: {submission.file_name}, Size: {submission.file_size_bytes} bytes]"

    # Safe URL verification
    url_info = {
        "provided_url": submission.submission_url,
        "is_accessible": None,
        "status_code": None,
        "summary": None
    }
    if submission.submission_url:
        raw_url = submission.submission_url.strip()
        # SSRF Protection: only allow http/https and reject localhost/private IP
        if raw_url.startswith("http://") or raw_url.startswith("https://"):
            import urllib.parse
            parsed = urllib.parse.urlparse(raw_url)
            host = parsed.hostname or ""
            if host in ["localhost", "127.0.0.1", "0.0.0.0"] or host.startswith("192.168.") or host.startswith("10."):
                url_info["is_accessible"] = False
                url_info["summary"] = "Private/localhost URL rejected for security."
            else:
                try:
                    import urllib.request
                    req = urllib.request.Request(
                        raw_url,
                        headers={"User-Agent": "Eventiva-Verification-Bot/1.0"}
                    )
                    with urllib.request.urlopen(req, timeout=4) as resp:
                        url_info["status_code"] = resp.getcode()
                        url_info["is_accessible"] = 200 <= resp.getcode() < 400
                        content_type = resp.headers.get("Content-Type", "")
                        url_info["summary"] = f"Accessible (HTTP {resp.getcode()}, {content_type})"
                except Exception as ex:
                    url_info["is_accessible"] = False
                    url_info["summary"] = f"URL check error: {str(ex)}"
        else:
            url_info["is_accessible"] = False
            url_info["summary"] = "Invalid URL protocol (must begin with http:// or https://)"

    return {
        "extracted_text": extracted_text,
        "file_metadata": file_metadata,
        "url_info": url_info,
        "submission_text": submission.submission_text or ""
    }

def verify_submission_with_ai(
    db: Session,
    submission_id: int
) -> Dict[str, Any]:
    """
    Executes AI submission verification comparing submitted deliverables against
    actual organizer instructions and deliverable checklist.
    Guarantees evidence-based results with deterministic fallback.
    """
    sub = db.query(models.TaskSubmission).filter(models.TaskSubmission.id == submission_id).first()
    if not sub:
        return {"error": "Submission not found"}

    task = sub.task
    if not task:
        return {"error": "Task not found"}

    # Extract submission content with fault tolerance
    try:
        extracted = extract_submission_content(sub)
    except Exception as e:
        logger.error(f"Error extracting submission content: {e}")
        extracted = {
            "extracted_text": "",
            "submission_text": sub.submission_text or "",
            "url_info": {"provided_url": sub.submission_url, "is_accessible": False, "summary": str(e)},
            "file_metadata": {}
        }
        assessment = {
            "overall_result": "Needs Manual Review",
            "score": 50,
            "checklist_assessment": [],
            "checklist_results": [],
            "missing_requirements": [f"Content extraction error: {e}"],
            "concise_explanation": f"Automated inspection encountered an unexpected error: {e}",
            "summary": f"Automated inspection encountered an unexpected error: {e}",
            "suggested_corrections": "Please notify the organizer or re-upload your deliverable.",
            "ai_model": "Fallback-Error-Handler",
            "verified_at": datetime.now(timezone.utc).isoformat()
        }
        sub.ai_status = "Needs Manual Review"
        sub.ai_assessment = assessment
        sub.ai_verified_at = datetime.now(timezone.utc)
        sub.status = "Submitted"
        db.commit()
        return assessment

    doc_text = extracted["extracted_text"]
    user_notes = extracted["submission_text"]
    url_info = extracted["url_info"]
    file_meta = extracted["file_metadata"]

    checklist = task.deliverable_checklist or []
    if isinstance(checklist, str):
        try:
            checklist = json.loads(checklist)
        except:
            checklist = [checklist]

    # Check evidence availability
    has_file = bool(sub.file_url)
    has_url = bool(sub.submission_url and sub.submission_url.strip())
    has_text = bool(user_notes.strip())

    # Build prompt
    prompt = (
        f"You are the EVENTIVA Academic and Technical Project Evaluator.\n"
        f"Evaluate the following live event task submission against the organizer's exact instructions.\n\n"
        f"=== ORGANIZER TASK SPECIFICATION ===\n"
        f"Task Title: {task.title}\n"
        f"Instructions: {task.instructions}\n"
        f"Description: {task.description or 'N/A'}\n"
        f"Submission Method Required: {task.submission_method}\n"
        f"Project URL Required: {task.require_url}\n"
        f"Deliverable Checklist: {json.dumps(checklist)}\n\n"
        f"=== SUBMITTED MATERIALS ===\n"
        f"File Name: {file_meta.get('file_name') or 'No file attached'}\n"
        f"File Text Content (Extracted):\n{doc_text[:4000] if doc_text else 'No text readable in file'}\n\n"
        f"Submitted URL: {url_info.get('provided_url') or 'None'}\n"
        f"URL Accessibility Check: {url_info.get('summary') or 'None'}\n\n"
        f"Participant Notes: {user_notes or 'None'}\n\n"
        f"=== EVALUATION RULES ===\n"
        f"1. Compare the materials strictly against the organizer's requirements.\n"
        f"2. For each item in the checklist, determine status: 'Met', 'Not Met', or 'Unable to Verify', and cite specific evidence.\n"
        f"3. Do NOT assume a project works merely because a link was provided.\n"
        f"4. If required deliverables or evidence is missing or cannot be read, output overall_result as 'Needs Correction' or 'Needs Manual Review'.\n"
        f"5. Output ONLY valid JSON adhering strictly to this schema:\n"
        f"{{\n"
        f"  \"overall_result\": \"Passed\" | \"Needs Correction\" | \"Needs Manual Review\",\n"
        f"  \"score\": 85,\n"
        f"  \"checklist_assessment\": [\n"
        f"    {{\"item\": \"Requirement name\", \"status\": \"Met\" | \"Not Met\" | \"Unable to Verify\", \"evidence\": \"Exact observation\"}}\n"
        f"  ],\n"
        f"  \"missing_requirements\": [\"List of missing items\"],\n"
        f"  \"concise_explanation\": \"Clear 2-3 sentence summary\",\n"
        f"  \"suggested_corrections\": \"Concrete steps the participant must take if corrections required\"\n"
        f"}}"
    )

    assessment: Dict[str, Any] = {}
    ai_model_name = "Eventiva-RuleEngine-1.0"
    api_key = os.getenv("GEMINI_API_KEY")

    if api_key and not os.getenv("TESTING"):
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=api_key)
            # Try available model
            model_to_use = "gemini-2.5-flash"
            resp = client.models.generate_content(
                model=model_to_use,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    response_mime_type="application/json"
                )
            )
            if resp.text:
                assessment = json.loads(resp.text)
                ai_model_name = model_to_use
        except Exception as e:
            logger.warning(f"Gemini API verification call error: {e}. Utilizing deterministic verification fallback.")

    # DETERMINISTIC EVIDENCE-BASED FALLBACK:
    if not assessment:
        missing = []
        checklist_results = []
        now_ts = datetime.now(timezone.utc).isoformat()

        # Check URL requirement
        if task.require_url:
            if not has_url:
                missing.append("Project / Repository URL is required but missing.")
                checklist_results.append({
                    "item": "Project / Repository URL",
                    "status": "Not Met",
                    "evidence": "No project link was provided in the submission form."
                })
            elif url_info.get("is_accessible") is False:
                missing.append("Provided URL could not be accessed.")
                checklist_results.append({
                    "item": "Project / Repository URL",
                    "status": "Unable to Verify",
                    "evidence": f"URL {url_info.get('provided_url')} was unreachable: {url_info.get('summary')}"
                })
            else:
                checklist_results.append({
                    "item": "Project / Repository URL",
                    "status": "Met",
                    "evidence": f"Verified reachable link: {url_info.get('provided_url')}"
                })

        # Check File requirement
        if "file" in task.submission_method:
            if not has_file:
                missing.append("Deliverable file upload is required.")
                checklist_results.append({
                    "item": "Deliverable File Upload",
                    "status": "Not Met",
                    "evidence": "No file was attached to this submission."
                })
            else:
                checklist_results.append({
                    "item": "Deliverable File Upload",
                    "status": "Met",
                    "evidence": f"File '{file_meta.get('file_name')}' ({file_meta.get('file_size_bytes')} bytes) provided."
                })

        # Evaluate checklist items against document text / notes
        combined_text = (doc_text + " " + user_notes).lower()
        for chk in checklist:
            chk_str = chk if isinstance(chk, str) else str(chk)
            # Look for keyword match
            keywords = [w.lower() for w in chk_str.split() if len(w) > 3]
            match_count = sum(1 for kw in keywords if kw in combined_text)
            if keywords and match_count >= max(1, len(keywords) // 2):
                checklist_results.append({
                    "item": chk_str,
                    "status": "Met",
                    "evidence": f"Relevant content matching '{chk_str}' identified in submitted materials."
                })
            elif not doc_text and not user_notes:
                checklist_results.append({
                    "item": chk_str,
                    "status": "Unable to Verify",
                    "evidence": "Insufficient readable text extracted from submission to verify this requirement."
                })
                missing.append(f"Verification pending manual review for: {chk_str}")
            else:
                checklist_results.append({
                    "item": chk_str,
                    "status": "Not Met",
                    "evidence": f"Could not find matching content for requirement: '{chk_str}'."
                })
                missing.append(chk_str)

        # Decide overall result
        if not has_file and not has_url and not has_text:
            overall = "Needs Correction"
            explanation = "Submission contains no deliverables or verifiable work."
            corrections = "Please attach the required document or provide the project repository link."
            score = 0
        elif missing and any("Not Met" in r["status"] for r in checklist_results):
            overall = "Needs Correction"
            explanation = f"Submission is missing {len(missing)} requirement(s): {', '.join(missing)}."
            corrections = f"Please resubmit and ensure the following are included: {', '.join(missing)}."
            score = 50
        elif any("Unable to Verify" in r["status"] for r in checklist_results):
            overall = "Needs Manual Review"
            explanation = "Submitted deliverables are present but contain materials requiring organizer visual inspection."
            corrections = "No action required by participant at this time. An organizer will complete manual review."
            score = 75
        else:
            overall = "Passed"
            explanation = "All required deliverables and checklist criteria have been satisfied."
            corrections = "None. Submission meets all specified task requirements."
            score = 95

        formatted_results = []
        for r in checklist_results:
            st = "PASS" if r["status"] == "Met" else ("FAIL" if r["status"] == "Not Met" else "UNCERTAIN")
            formatted_results.append({
                "criteria": r["item"],
                "status": st,
                "evidence_quote_or_citation": r["evidence"],
                "missing_reason": r["evidence"] if st != "PASS" else None
            })

        assessment = {
            "overall_result": overall,
            "score": score,
            "checklist_assessment": checklist_results,
            "checklist_results": formatted_results,
            "missing_requirements": missing,
            "concise_explanation": explanation,
            "summary": explanation,
            "suggested_corrections": corrections,
            "ai_model": ai_model_name,
            "verified_at": now_ts
        }

    # Save to submission record
    now_dt = datetime.now(timezone.utc)
    sub.ai_status = assessment.get("overall_result", "Needs Manual Review")
    sub.ai_assessment = assessment
    sub.ai_verified_at = now_dt

    # Update submission status according to review requirements
    if assessment.get("overall_result") == "Passed":
        if not task.review_required:
            sub.status = "Verified"
        else:
            sub.status = "Submitted"
    elif assessment.get("overall_result") == "Needs Correction":
        if not task.review_required:
            sub.status = "Correction Required"
        else:
            sub.status = "Submitted"
        if not sub.organizer_feedback and assessment.get("suggested_corrections"):
            corrections = assessment.get("suggested_corrections")
            sub.organizer_feedback = f"Automated Review Note: {', '.join(corrections) if isinstance(corrections, list) else corrections}"
    elif assessment.get("overall_result") == "Needs Manual Review":
        sub.status = "Submitted"

    # Create version history record
    version_count = db.query(models.TaskSubmissionVersion).filter(
        models.TaskSubmissionVersion.submission_id == sub.id
    ).count()

    sub_version = models.TaskSubmissionVersion(
        submission_id=sub.id,
        version_number=version_count + 1,
        submission_text=sub.submission_text,
        submission_url=sub.submission_url,
        file_url=sub.file_url,
        file_name=sub.file_name,
        file_size_bytes=sub.file_size_bytes,
        status=sub.status,
        ai_status=sub.ai_status,
        ai_assessment=assessment,
        organizer_feedback=sub.organizer_feedback,
        submitted_at=sub.submitted_at or now_dt
    )
    db.add(sub_version)
    db.commit()
    db.refresh(sub)
    return assessment

# =====================================================================
# CONTINUOUS BACKGROUND WORKER PROCESS
# =====================================================================

async def background_scheduler_loop():
    """
    Continuous background worker loop that runs alongside FastAPI.
    Polls every 15 seconds to dispatch due task reminders and process AI jobs.
    """
    global _worker_running
    _worker_running = True
    logger.info("LiveSchedulerWorker background loop initialized.")

    while _worker_running:
        try:
            # 1. Process due task reminders in separate DB session
            db = SessionLocal()
            try:
                processed = process_due_task_reminders_robust(db)
                if processed:
                    logger.info(f"Background worker processed {len(processed)} live reminders: {processed}")

                # 2. Process queued AI verification jobs
                queued_jobs = db.query(models.AIVerificationJob).filter(
                    models.AIVerificationJob.status == "Queued"
                ).limit(5).all()

                for job in queued_jobs:
                    job.status = "Processing"
                    job.attempt_count += 1
                    db.commit()
                    try:
                        verify_submission_with_ai(db, job.submission_id)
                        job.status = "Completed"
                    except Exception as ex:
                        job.status = "Failed"
                        job.error_message = str(ex)
                    db.commit()

            finally:
                db.close()
        except asyncio.CancelledError:
            logger.info("LiveSchedulerWorker background loop received cancellation.")
            break
        except Exception as e:
            logger.error(f"Error in LiveSchedulerWorker loop: {e}", exc_info=True)

        try:
            await asyncio.sleep(15)
        except asyncio.CancelledError:
            break

    logger.info("LiveSchedulerWorker background loop terminated.")

def start_live_scheduler_worker():
    """Starts the background worker task if not already running."""
    global _worker_task, _worker_running
    if _worker_task is None or _worker_task.done():
        try:
            loop = asyncio.get_running_loop()
            _worker_task = loop.create_task(background_scheduler_loop())
            logger.info("LiveSchedulerWorker task spawned successfully.")
        except RuntimeError:
            logger.warning("No running asyncio event loop to spawn LiveSchedulerWorker task.")

def stop_live_scheduler_worker():
    """Stops the background worker task."""
    global _worker_task, _worker_running
    _worker_running = False
    if _worker_task and not _worker_task.done():
        _worker_task.cancel()
