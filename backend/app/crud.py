from sqlalchemy.orm import Session
from . import models, schemas
from .core.security import get_password_hash
from typing import Optional, List

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name,
        organization=user.organization
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_events(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Event).offset(skip).limit(limit).all()

def get_event(db: Session, event_id: int):
    return db.query(models.Event).filter(models.Event.id == event_id).first()

def create_event(db: Session, event: schemas.EventCreate, organizer_id: int):
    db_event = models.Event(**event.dict(), organizer_id=organizer_id)
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

def update_event(db: Session, db_event: models.Event, event_update: schemas.EventUpdate):
    update_data = event_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_event, key, value)
    db.commit()
    db.refresh(db_event)
    return db_event

def delete_event(db: Session, db_event: models.Event):
    db.delete(db_event)
    db.commit()

def generate_unique_ticket_code(db: Session) -> str:
    import secrets
    while True:
        code = f"EVT-{secrets.token_hex(4).upper()}"
        existing = db.query(models.Registration).filter(models.Registration.ticket_code == code).first()
        if not existing:
            return code

def create_registration(db: Session, registration: schemas.RegistrationCreate, event_id: int):
    # Avoid issuing duplicate registrations or tickets if user with same email retries
    existing = db.query(models.Registration).filter(
        models.Registration.event_id == event_id,
        models.Registration.email == registration.email.strip()
    ).first()
    if existing:
        if not existing.ticket_code:
            existing.ticket_code = generate_unique_ticket_code(db)
            db.commit()
            db.refresh(existing)
        return existing

    import uuid
    ticket_code = generate_unique_ticket_code(db)
    reg_dict = registration.model_dump() if hasattr(registration, 'model_dump') else registration.dict()
    db_registration = models.Registration(
        **reg_dict,
        event_id=event_id,
        ticket_code=ticket_code,
        unsubscribe_token=str(uuid.uuid4()),
        checked_in=False,
        status="Registered"
    )
    db.add(db_registration)
    db.commit()
    db.refresh(db_registration)
    return db_registration

def get_registration_by_ticket_code(db: Session, ticket_code: str):
    if not ticket_code:
        return None
    return db.query(models.Registration).filter(models.Registration.ticket_code == ticket_code.strip()).first()

def get_registration(db: Session, registration_id: int):
    return db.query(models.Registration).filter(models.Registration.id == registration_id).first()

def update_registration(db: Session, db_registration: models.Registration, reg_update: schemas.RegistrationUpdate):
    update_data = reg_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            setattr(db_registration, key, value)
    db.commit()
    db.refresh(db_registration)
    return db_registration

def get_event_registration_stats(db: Session, event_id: int):
    regs = db.query(models.Registration).filter(models.Registration.event_id == event_id).all()
    total = len(regs)
    checked_in = sum(1 for r in regs if r.checked_in)
    pending = total - checked_in
    approved = sum(1 for r in regs if r.status.lower() in ["registered", "approved"])
    cancelled = sum(1 for r in regs if r.status.lower() == "cancelled")
    rejected = sum(1 for r in regs if r.status.lower() == "rejected")
    return {
        "total": total,
        "checked_in": checked_in,
        "pending": pending,
        "approved": approved,
        "cancelled": cancelled,
        "rejected": rejected
    }

def get_registrations_for_event(db: Session, event_id: int):
    return db.query(models.Registration).filter(models.Registration.event_id == event_id).all()

def generate_unique_team_invite_code(db: Session) -> str:
    import secrets
    while True:
        code = f"TEAM-{secrets.token_hex(4).upper()}"
        existing = db.query(models.Team).filter(models.Team.invite_code == code).first()
        if not existing:
            return code

def get_team_by_invite_code(db: Session, invite_code: str):
    if not invite_code:
        return None
    return db.query(models.Team).filter(models.Team.invite_code == invite_code.strip().upper()).first()

def get_team(db: Session, team_id: int):
    return db.query(models.Team).filter(models.Team.id == team_id).first()

def get_teams_for_event(db: Session, event_id: int):
    return db.query(models.Team).filter(models.Team.event_id == event_id).all()

def create_team_with_leader(db: Session, event_id: int, team_name: str, leader_data: schemas.RegistrationBase):
    from sqlalchemy import func
    # Enforce unique team name per event
    existing_team = db.query(models.Team).filter(
        models.Team.event_id == event_id,
        func.lower(models.Team.team_name) == team_name.strip().lower()
    ).first()
    if existing_team:
        raise ValueError("A team with this name already exists for this event.")

    # Check if leader is already registered in a team for this event
    existing_reg = db.query(models.Registration).filter(
        models.Registration.event_id == event_id,
        models.Registration.email == leader_data.email.strip()
    ).first()
    if existing_reg and existing_reg.team_id:
        raise ValueError("This email is already registered in a team for this event.")

    invite_code = generate_unique_team_invite_code(db)
    new_team = models.Team(
        event_id=event_id,
        team_name=team_name.strip(),
        invite_code=invite_code,
        status="Active"
    )
    db.add(new_team)
    db.flush()

    ticket_code = generate_unique_ticket_code(db)
    if existing_reg:
        existing_reg.team_id = new_team.id
        existing_reg.is_team_leader = True
        if not existing_reg.ticket_code:
            existing_reg.ticket_code = ticket_code
        leader_reg = existing_reg
    else:
        import uuid
        leader_dict = leader_data.model_dump() if hasattr(leader_data, 'model_dump') else leader_data.dict()
        leader_reg = models.Registration(
            **leader_dict,
            event_id=event_id,
            team_id=new_team.id,
            is_team_leader=True,
            ticket_code=ticket_code,
            unsubscribe_token=str(uuid.uuid4()),
            checked_in=False,
            status="Registered"
        )
        db.add(leader_reg)
        db.flush()

    new_team.leader_registration_id = leader_reg.id

    # Check capacity: if max_team_size == 1, team is immediately complete
    evt = db.query(models.Event).filter(models.Event.id == event_id).first()
    if evt and evt.max_team_size == 1:
        new_team.status = "Complete"

    db.commit()
    db.refresh(new_team)
    db.refresh(leader_reg)
    return new_team, leader_reg

def join_team(db: Session, invite_code: str, member_data: schemas.RegistrationBase):
    team = get_team_by_invite_code(db, invite_code)
    if not team:
        return None, None, "Invalid invitation code"

    event = team.event
    if not event:
        return None, None, "Event not found"

    if event.status != "Published":
        return None, None, "Registration is not open for this event"

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    if event.registration_deadline:
        deadline = event.registration_deadline
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        if now > deadline:
            return None, None, "Registration deadline has passed"

    # Check if already joined (idempotent retry)
    existing_reg = db.query(models.Registration).filter(
        models.Registration.event_id == event.id,
        models.Registration.email == member_data.email.strip()
    ).first()

    if existing_reg:
        if existing_reg.team_id == team.id:
            return team, existing_reg, None
        else:
            return None, None, "This email is already registered for this event in another team or individually"

    # Enforce team capacity
    active_count = db.query(models.Registration).filter(
        models.Registration.team_id == team.id,
        models.Registration.status.notin_(["Cancelled", "Rejected"])
    ).count()

    if active_count >= event.max_team_size:
        team.status = "Complete"
        db.commit()
        return None, None, "Team has already reached maximum capacity"

    # Enforce overall event capacity if set
    if event.max_participants is not None:
        total_event = db.query(models.Registration).filter(
            models.Registration.event_id == event.id,
            models.Registration.status.notin_(["Cancelled", "Rejected"])
        ).count()
        if total_event >= event.max_participants:
            return None, None, "Event registration capacity has been reached"

    import uuid
    ticket_code = generate_unique_ticket_code(db)
    member_dict = member_data.model_dump() if hasattr(member_data, 'model_dump') else member_data.dict()
    new_member = models.Registration(
        **member_dict,
        event_id=event.id,
        team_id=team.id,
        is_team_leader=False,
        ticket_code=ticket_code,
        unsubscribe_token=str(uuid.uuid4()),
        checked_in=False,
        status="Registered"
    )
    db.add(new_member)
    db.flush()

    if active_count + 1 >= event.max_team_size:
        team.status = "Complete"

    db.commit()
    db.refresh(team)
    db.refresh(new_member)
    return team, new_member, None

def create_otp(db: Session, email: str, otp_hash: str, purpose: str, expires_at):
    # invalidate old ones
    db.query(models.OTP).filter(models.OTP.email == email, models.OTP.purpose == purpose).update({"is_used": True})
    db.commit()
    
    db_otp = models.OTP(email=email, hashed_otp=otp_hash, purpose=purpose, expires_at=expires_at)
    db.add(db_otp)
    db.commit()
    db.refresh(db_otp)
    return db_otp

def get_latest_otp(db: Session, email: str, purpose: str):
    return db.query(models.OTP).filter(
        models.OTP.email == email,
        models.OTP.purpose == purpose,
        models.OTP.is_used == False
    ).order_by(models.OTP.created_at.desc()).first()

def mark_otp_used(db: Session, otp_id: int):
    db.query(models.OTP).filter(models.OTP.id == otp_id).update({"is_used": True})
    db.commit()

def increment_otp_attempts(db: Session, otp_id: int):
    otp = db.query(models.OTP).filter(models.OTP.id == otp_id).first()
    if otp:
        otp.attempts += 1
        if otp.attempts >= 3:
            otp.is_used = True
        db.commit()

def get_branding_kits(db: Session, user_id: int = None, institution_id: int = None):
    query = db.query(models.BrandingKit)
    if institution_id:
        query = query.filter(models.BrandingKit.institution_id == institution_id)
    if user_id:
        return query.filter((models.BrandingKit.user_id == user_id) | (models.BrandingKit.user_id == None)).all()
    return query.all()

def get_branding_kit(db: Session, kit_id: int):
    return db.query(models.BrandingKit).filter(models.BrandingKit.id == kit_id).first()

def create_branding_kit(db: Session, kit: schemas.BrandingKitCreate, user_id: int = None):
    kit_data = kit.dict()
    db_kit = models.BrandingKit(**kit_data, user_id=user_id)
    db.add(db_kit)
    db.commit()
    db.refresh(db_kit)
    return db_kit

def update_branding_kit(db: Session, db_kit: models.BrandingKit, kit_update: schemas.BrandingKitUpdate):
    update_data = kit_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_kit, key, value)
    db.commit()
    db.refresh(db_kit)
    return db_kit

def delete_branding_kit(db: Session, db_kit: models.BrandingKit):
    db.delete(db_kit)
    db.commit()

def duplicate_branding_kit(db: Session, db_kit: models.BrandingKit, new_user_id: int):
    cloned_kit = models.BrandingKit(
        institution_id=db_kit.institution_id,
        user_id=new_user_id,
        name=f"{db_kit.name} (Custom Copy)",
        institution_type=db_kit.institution_type,
        short_name=db_kit.short_name,
        location=db_kit.location,
        department=db_kit.department,
        logo_url=db_kit.logo_url,
        badge_url=db_kit.badge_url,
        backdrop_url=db_kit.backdrop_url,
        primary_color=db_kit.primary_color,
        secondary_color=db_kit.secondary_color,
        dark_bg=db_kit.dark_bg,
        accent_color=db_kit.accent_color,
        preferred_font=db_kit.preferred_font,
        recommended_border=db_kit.recommended_border,
        signoff_text=db_kit.signoff_text,
        website=db_kit.website,
        status="Assets Collected",
        version=1,
        is_verified=False, # User copies are unverified custom kits
        is_public=False,
        description=f"Cloned copy from {db_kit.name}"
    )
    db.add(cloned_kit)
    db.commit()
    db.refresh(cloned_kit)
    return cloned_kit

# --- INSTITUTION DIRECTORY CRUD ---
def get_institutions(
    db: Session,
    query: str = None,
    category: str = None,
    state: str = None,
    district: str = None,
    has_kit: bool = None,
    skip: int = 0,
    limit: int = 50
):
    q = db.query(models.Institution).filter(models.Institution.is_active == True)

    if query and query.strip():
        term = f"%{query.strip()}%"
        q = q.filter(
            (models.Institution.official_name.ilike(term)) |
            (models.Institution.common_name.ilike(term)) |
            (models.Institution.abbreviations.ilike(term)) |
            (models.Institution.city.ilike(term)) |
            (models.Institution.state.ilike(term)) |
            (models.Institution.code.ilike(term))
        )

    if category and category.strip() and category != 'All':
        q = q.filter(models.Institution.category.ilike(f"%{category.strip()}%"))

    if state and state.strip() and state != 'All':
        q = q.filter(models.Institution.state.ilike(f"%{state.strip()}%"))

    if district and district.strip() and district != 'All':
        q = q.filter(models.Institution.district.ilike(f"%{district.strip()}%"))

    if has_kit is True:
        q = q.join(models.BrandingKit, models.BrandingKit.institution_id == models.Institution.id)
    elif has_kit is False:
        # Institutions without any branding kit
        sub = db.query(models.BrandingKit.institution_id).distinct().subquery()
        q = q.filter(models.Institution.id.not_in(sub))

    return q.offset(skip).limit(limit).all()

def get_institution_by_id(db: Session, institution_id: int):
    return db.query(models.Institution).filter(models.Institution.id == institution_id).first()

def get_institution_by_code(db: Session, code: str):
    return db.query(models.Institution).filter(models.Institution.code == code).first()

def find_duplicate_institution(db: Session, official_name: str, code: str = None, website: str = None):
    # Check exact code match
    if code:
        by_code = db.query(models.Institution).filter(models.Institution.code.ilike(code.strip())).first()
        if by_code:
            return by_code

    # Check exact official name match
    by_name = db.query(models.Institution).filter(models.Institution.official_name.ilike(official_name.strip())).first()
    if by_name:
        return by_name

    # Check website if given
    if website and website.strip():
        clean_web = website.strip().lower().replace("https://", "").replace("http://", "").replace("www.", "").rstrip("/")
        if clean_web:
            by_web = db.query(models.Institution).filter(models.Institution.website.ilike(f"%{clean_web}%")).first()
            if by_web:
                return by_web

    return None

def create_institution(db: Session, inst_data: schemas.InstitutionCreate):
    record = models.Institution(
        code=inst_data.code,
        official_name=inst_data.official_name,
        common_name=inst_data.common_name,
        abbreviations=inst_data.abbreviations,
        category=inst_data.category or "Engineering",
        institution_type=inst_data.institution_type or "Autonomous Engineering College",
        state=inst_data.state,
        district=inst_data.district,
        city=inst_data.city,
        address=inst_data.address,
        website=inst_data.website,
        established_year=inst_data.established_year,
        data_source=inst_data.data_source or "AICTE / State Authority",
        is_active=inst_data.is_active if inst_data.is_active is not None else True
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    if inst_data.recognition_records:
        for rec in inst_data.recognition_records:
            rec_row = models.InstitutionRecognitionRecord(
                institution_id=record.id,
                authority=rec.authority,
                reference_number=rec.reference_number,
                recognition_status=rec.recognition_status,
                valid_upto=rec.valid_upto,
                verified_by=rec.verified_by,
                notes=rec.notes
            )
            db.add(rec_row)
        db.commit()
        db.refresh(record)

    return record

# -------------------------------------------------------------------
# FEATURE 4: NOTIFICATIONS & REMINDERS CRUD
# -------------------------------------------------------------------

def create_notification_campaign(
    db: Session,
    event_id: int,
    organizer_id: int,
    campaign_type: str,
    title: str,
    message: str,
    target_audience: str = "all",
    target_filter: Optional[dict] = None,
    priority: str = "normal"
) -> models.NotificationCampaign:
    campaign = models.NotificationCampaign(
        event_id=event_id,
        organizer_id=organizer_id,
        campaign_type=campaign_type,
        title=title.strip(),
        message=message.strip(),
        target_audience=target_audience,
        target_filter=target_filter,
        priority=priority,
        status="Pending",
        total_recipients=0,
        sent_count=0,
        failed_count=0
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign

def get_notification_campaign(db: Session, campaign_id: int) -> Optional[models.NotificationCampaign]:
    return db.query(models.NotificationCampaign).filter(models.NotificationCampaign.id == campaign_id).first()

def get_notification_campaigns_for_event(db: Session, event_id: int) -> List[models.NotificationCampaign]:
    return (
        db.query(models.NotificationCampaign)
        .filter(models.NotificationCampaign.event_id == event_id)
        .order_by(models.NotificationCampaign.created_at.desc())
        .all()
    )

def resolve_campaign_recipients(
    db: Session,
    event_id: int,
    target_audience: str = "all",
    target_filter: Optional[dict] = None
) -> List[models.Registration]:
    # Strictly query eligible registrations: status Registered or Approved; exclude Cancelled and Rejected
    query = db.query(models.Registration).filter(
        models.Registration.event_id == event_id,
        models.Registration.status.notin_(["Cancelled", "Rejected"])
    )
    if target_audience == "teams" and target_filter and target_filter.get("team_ids"):
        team_ids = target_filter.get("team_ids")
        query = query.filter(models.Registration.team_id.in_(team_ids))
    elif target_audience == "participants" and target_filter and target_filter.get("registration_ids"):
        reg_ids = target_filter.get("registration_ids")
        query = query.filter(models.Registration.id.in_(reg_ids))
    return query.all()

def queue_campaign_deliveries(
    db: Session,
    campaign: models.NotificationCampaign,
    recipients: List[models.Registration]
) -> int:
    import hashlib
    count = 0
    for reg in recipients:
        raw_key = f"{campaign.id}_{reg.id}_{reg.email.strip().lower()}"
        idempotency_key = hashlib.sha256(raw_key.encode()).hexdigest()[:32]

        existing = db.query(models.NotificationDelivery).filter(
            models.NotificationDelivery.idempotency_key == idempotency_key
        ).first()
        if not existing:
            delivery = models.NotificationDelivery(
                campaign_id=campaign.id,
                registration_id=reg.id,
                recipient_email=reg.email.strip(),
                recipient_name=reg.full_name,
                status="queued",
                idempotency_key=idempotency_key,
                attempt_count=0
            )
            db.add(delivery)
            count += 1
    campaign.total_recipients = count
    db.commit()
    db.refresh(campaign)
    return count

def execute_campaign_deliveries(db: Session, campaign_id: int):
    from datetime import datetime, timezone
    from .core import email as email_core

    campaign = get_notification_campaign(db, campaign_id)
    if not campaign:
        return

    campaign.status = "Sending"
    db.commit()

    deliveries = db.query(models.NotificationDelivery).filter(
        models.NotificationDelivery.campaign_id == campaign_id,
        models.NotificationDelivery.status.in_(["queued", "failed"])
    ).all()

    db_event = campaign.event
    event_title = db_event.title if db_event else "EVENTIVA Event"

    for d in deliveries:
        if d.attempt_count >= 3:
            continue

        reg = d.registration
        d.attempt_count += 1
        d.last_attempt_at = datetime.now(timezone.utc)

        # Check notification preferences: if non-essential, respect unsubscribe
        is_essential = campaign.campaign_type in ["schedule_change", "venue_change", "ticket_confirmation", "team_alert"]
        if not is_essential and reg and reg.unsubscribed_announcements:
            d.status = "skipped_unsubscribed"
            d.error_message = "Recipient opted out of non-essential announcements"
            continue

        unsub_url = f"/notifications/unsubscribe/{reg.unsubscribe_token}" if reg and reg.unsubscribe_token else None
        ticket_url = reg.ticket_url if reg else None

        if campaign.campaign_type in ["schedule_change", "venue_change"]:
            new_time_str = db_event.start_time.strftime("%B %d, %Y at %I:%M %p") if db_event and db_event.start_time else None
            success, err = email_core.send_schedule_venue_change_alert(
                to_email=d.recipient_email,
                recipient_name=d.recipient_name,
                event_title=event_title,
                change_summary=campaign.message,
                new_venue=db_event.venue if db_event else None,
                new_time=new_time_str,
                ticket_url=ticket_url
            )
        elif campaign.campaign_type == "reminder":
            start_str = db_event.start_time.strftime("%B %d, %Y at %I:%M %p") if db_event and db_event.start_time else None
            success, err = email_core.send_event_reminder_email(
                to_email=d.recipient_email,
                recipient_name=d.recipient_name,
                event_title=event_title,
                reminder_type="custom",
                start_time_str=start_str,
                venue=db_event.venue if db_event else None,
                ticket_url=ticket_url,
                custom_message=campaign.message,
                unsubscribe_url=unsub_url
            )
        else:
            success, err = email_core.send_announcement_email(
                to_email=d.recipient_email,
                recipient_name=d.recipient_name,
                event_title=event_title,
                title=campaign.title,
                message=campaign.message,
                priority=campaign.priority,
                unsubscribe_url=unsub_url
            )

        if success:
            d.status = "sent"
            d.error_message = None
        else:
            d.status = "failed"
            d.error_message = err or "Delivery attempt failed"

    # Recalculate campaign statistics
    all_deliveries = db.query(models.NotificationDelivery).filter(
        models.NotificationDelivery.campaign_id == campaign_id
    ).all()
    actual_sent = sum(1 for x in all_deliveries if x.status == "sent")
    actual_failed = sum(1 for x in all_deliveries if x.status == "failed")
    actual_skipped = sum(1 for x in all_deliveries if x.status == "skipped_unsubscribed")

    campaign.sent_count = actual_sent
    campaign.failed_count = actual_failed
    campaign.completed_at = datetime.now(timezone.utc)

    if actual_failed == 0:
        campaign.status = "Completed"
    elif actual_sent > 0:
        campaign.status = "Partial"
    else:
        campaign.status = "Failed"

    db.commit()
    db.refresh(campaign)

def retry_failed_deliveries(db: Session, campaign_id: int):
    failed_deliveries = db.query(models.NotificationDelivery).filter(
        models.NotificationDelivery.campaign_id == campaign_id,
        models.NotificationDelivery.status == "failed",
        models.NotificationDelivery.attempt_count < 3
    ).all()

    for d in failed_deliveries:
        d.status = "queued"
    db.commit()

    execute_campaign_deliveries(db, campaign_id)
    return get_notification_campaign(db, campaign_id)

def save_event_reminders(db: Session, event_id: int, reminder_items: List[schemas.EventReminderConfigItem]):
    db.query(models.EventReminderConfig).filter(
        models.EventReminderConfig.event_id == event_id,
        models.EventReminderConfig.is_sent == False
    ).delete()

    created = []
    for item in reminder_items:
        cfg = models.EventReminderConfig(
            event_id=event_id,
            reminder_type=item.reminder_type,
            scheduled_time=item.scheduled_time,
            custom_message=item.custom_message,
            is_enabled=item.is_enabled,
            is_sent=False
        )
        db.add(cfg)
        created.append(cfg)
    db.commit()
    return created

def get_event_reminders(db: Session, event_id: int):
    return (
        db.query(models.EventReminderConfig)
        .filter(models.EventReminderConfig.event_id == event_id)
        .order_by(models.EventReminderConfig.scheduled_time.asc())
        .all()
    )

def process_due_reminders(db: Session, event_id: int = None):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    query = db.query(models.EventReminderConfig).filter(
        models.EventReminderConfig.is_enabled == True,
        models.EventReminderConfig.is_sent == False,
        models.EventReminderConfig.scheduled_time <= now
    )
    if event_id:
        query = query.filter(models.EventReminderConfig.event_id == event_id)
    due_configs = query.all()

    processed_campaigns = []
    for cfg in due_configs:
        event = cfg.event
        if not event or event.status != "Published":
            continue

        cfg.is_sent = True
        cfg.sent_at = now

        title = f"Reminder: {event.title} is coming up!"
        msg = cfg.custom_message or f"Your registered event {event.title} is scheduled soon. Don't forget to have your ticket pass ready!"
        campaign = create_notification_campaign(
            db=db,
            event_id=event.id,
            organizer_id=event.organizer_id,
            campaign_type="reminder",
            title=title,
            message=msg,
            target_audience="all",
            priority="normal"
        )
        cfg.campaign_id = campaign.id

        recipients = resolve_campaign_recipients(db, event.id, "all")
        if recipients:
            queue_campaign_deliveries(db, campaign, recipients)
            execute_campaign_deliveries(db, campaign.id)
            processed_campaigns.append(campaign.id)

    db.commit()
    return processed_campaigns

def get_registration_by_unsubscribe_token(db: Session, token: str):
    if not token or not token.strip():
        return None
    return db.query(models.Registration).filter(models.Registration.unsubscribe_token == token.strip()).first()

def unsubscribe_registration(db: Session, token: str):
    reg = get_registration_by_unsubscribe_token(db, token)
    if not reg:
        return None
    reg.unsubscribed_announcements = True
    db.commit()
    db.refresh(reg)
    return reg




# ==========================================
# LIVE EVENT CONTROL CENTER CRUD
# ==========================================

def create_live_task(db: Session, event_id: int, task_in: schemas.LiveTaskCreate):
    from datetime import datetime, timezone
    from app import live_scheduler
    
    # Ensure deadline timezone awareness
    dl = task_in.deadline
    if dl.tzinfo is None:
        dl = dl.replace(tzinfo=timezone.utc)
        
    db_task = models.LiveTask(
        event_id=event_id,
        title=task_in.title.strip(),
        instructions=task_in.instructions.strip(),
        description=task_in.description.strip() if task_in.description else None,
        deadline=dl,
        timezone=task_in.timezone or "UTC",
        target_audience=task_in.target_audience or "all",
        target_filter=task_in.target_filter,
        submission_method=task_in.submission_method or "file",
        allowed_file_types=task_in.allowed_file_types or ".pdf,.ppt,.pptx,.zip,.png,.jpg,.jpeg",
        max_file_size_mb=task_in.max_file_size_mb or 25,
        review_required=task_in.review_required if task_in.review_required is not None else True,
        ai_verification_enabled=task_in.ai_verification_enabled if task_in.ai_verification_enabled is not None else True,
        require_url=task_in.require_url if task_in.require_url is not None else False,
        deliverable_checklist=task_in.deliverable_checklist,
        scoring_rubric=task_in.scoring_rubric,
        status="Active"
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    # Schedule reminders reliably via live_scheduler
    offsets = task_in.reminder_offsets if task_in.reminder_offsets is not None else [30, 10]
    live_scheduler.calculate_and_schedule_task_reminders(db, db_task, offsets)
    db.refresh(db_task)
    return db_task

def get_live_tasks(db: Session, event_id: int):
    tasks = db.query(models.LiveTask).filter(models.LiveTask.event_id == event_id).order_by(models.LiveTask.deadline.asc()).all()
    for t in tasks:
        t.submissions_count = db.query(models.TaskSubmission).filter(models.TaskSubmission.task_id == t.id).count()
        t.pending_reviews_count = db.query(models.TaskSubmission).filter(
            models.TaskSubmission.task_id == t.id,
            models.TaskSubmission.status.in_(["Submitted", "Correction Required"])
        ).count()
    return tasks

def get_live_task(db: Session, task_id: int):
    t = db.query(models.LiveTask).filter(models.LiveTask.id == task_id).first()
    if t:
        t.submissions_count = db.query(models.TaskSubmission).filter(models.TaskSubmission.task_id == t.id).count()
        t.pending_reviews_count = db.query(models.TaskSubmission).filter(
            models.TaskSubmission.task_id == t.id,
            models.TaskSubmission.status.in_(["Submitted", "Correction Required"])
        ).count()
    return t

def update_live_task(db: Session, task_id: int, task_update: schemas.LiveTaskUpdate):
    from datetime import datetime, timezone
    from app import live_scheduler
    db_task = db.query(models.LiveTask).filter(models.LiveTask.id == task_id).first()
    if not db_task:
        return None

    update_data = task_update.model_dump(exclude_unset=True)
    reminder_offsets = update_data.pop("reminder_offsets", None)

    for field, val in update_data.items():
        if field == "deadline" and val:
            if val.tzinfo is None:
                val = val.replace(tzinfo=timezone.utc)
            setattr(db_task, field, val)
        else:
            setattr(db_task, field, val)

    # If task is cancelled, cancel unsent reminders
    if db_task.status == "Cancelled":
        db.query(models.TaskReminder).filter(
            models.TaskReminder.task_id == db_task.id,
            models.TaskReminder.is_sent == False
        ).update({"status": "Cancelled"})
    elif reminder_offsets is not None or "deadline" in update_data:
        # Re-sync reminders reliably
        offsets = reminder_offsets if (reminder_offsets is not None and len(reminder_offsets) > 0) else [r.reminder_offset_minutes for r in db_task.reminders]
        if not offsets:
            offsets = [30, 10]
        live_scheduler.calculate_and_schedule_task_reminders(db, db_task, offsets)

    db.commit()
    db.refresh(db_task)
    return db_task

def delete_live_task(db: Session, task_id: int):
    db_task = db.query(models.LiveTask).filter(models.LiveTask.id == task_id).first()
    if db_task:
        db_task.status = "Cancelled"
        db.query(models.TaskReminder).filter(
            models.TaskReminder.task_id == db_task.id,
            models.TaskReminder.is_sent == False
        ).update({"status": "Cancelled"})
        db.commit()
        return True
    return False

def process_due_task_reminders(db: Session, now_override=None):
    from app import live_scheduler
    return live_scheduler.process_due_task_reminders_robust(db, now_override=now_override)

def create_or_update_task_submission(
    db: Session,
    task_id: int,
    registration_id: int,
    submission_text: str = None,
    submission_url: str = None,
    file_url: str = None,
    file_name: str = None,
    file_size_bytes: int = None
):
    from datetime import datetime, timezone
    from app import live_scheduler
    now = datetime.now(timezone.utc)

    task = db.query(models.LiveTask).filter(models.LiveTask.id == task_id).first()
    if not task:
        raise ValueError("Task not found")

    reg = db.query(models.Registration).filter(models.Registration.id == registration_id).first()
    if not reg:
        raise ValueError("Registration not found")

    # URL Requirement Validation
    if task.require_url and not (submission_url and submission_url.strip()):
        raise ValueError("A project repository or demo URL is required for this task.")

    # Deadline & late detection
    deadline = task.deadline
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    is_late = now > deadline

    # Determine team vs individual scope
    existing_sub = None
    if reg.team_id:
        existing_sub = db.query(models.TaskSubmission).filter(
            models.TaskSubmission.task_id == task_id,
            models.TaskSubmission.team_id == reg.team_id
        ).first()
    else:
        existing_sub = db.query(models.TaskSubmission).filter(
            models.TaskSubmission.task_id == task_id,
            models.TaskSubmission.registration_id == registration_id
        ).first()

    target_sub = None
    if existing_sub:
        existing_sub.registration_id = registration_id
        if submission_text is not None:
            existing_sub.submission_text = submission_text
        if submission_url is not None:
            existing_sub.submission_url = submission_url
        if file_url is not None:
            existing_sub.file_url = file_url
            existing_sub.file_name = file_name
            existing_sub.file_size_bytes = file_size_bytes
        existing_sub.version = (existing_sub.version or 1) + 1
        existing_sub.status = "Late" if is_late and existing_sub.status not in ["Completed", "Verified"] else "Submitted"
        existing_sub.is_late = is_late
        existing_sub.submitted_at = now
        if task.ai_verification_enabled:
            existing_sub.ai_status = "Pending"
        db.commit()
        db.refresh(existing_sub)
        target_sub = existing_sub
    else:
        new_sub = models.TaskSubmission(
            task_id=task_id,
            event_id=task.event_id,
            team_id=reg.team_id,
            registration_id=registration_id,
            submission_text=submission_text,
            submission_url=submission_url,
            file_url=file_url,
            file_name=file_name,
            file_size_bytes=file_size_bytes,
            status="Late" if is_late else "Submitted",
            is_late=is_late,
            version=1,
            ai_status="Pending" if task.ai_verification_enabled else "None",
            submitted_at=now
        )
        db.add(new_sub)
        db.commit()
        db.refresh(new_sub)
        target_sub = new_sub

    # Run AI verification if enabled
    if task.ai_verification_enabled and target_sub:
        try:
            live_scheduler.verify_submission_with_ai(db, target_sub.id)
            db.refresh(target_sub)
        except Exception as e:
            # Fallback will have run or job can be retried
            pass

    return target_sub

def get_task_submissions(db: Session, task_id: int):
    subs = db.query(models.TaskSubmission).filter(models.TaskSubmission.task_id == task_id).order_by(models.TaskSubmission.submitted_at.desc()).all()
    for s in subs:
        if s.registration:
            s.submitter_name = s.registration.full_name
            s.submitter_email = s.registration.email
        if s.team:
            s.team_name = s.team.team_name
    return subs

def get_participant_task_submission(db: Session, task_id: int, registration_id: int, team_id: int = None):
    query = db.query(models.TaskSubmission).filter(models.TaskSubmission.task_id == task_id)
    if team_id:
        sub = query.filter(models.TaskSubmission.team_id == team_id).first()
        if sub:
            return sub
    return query.filter(models.TaskSubmission.registration_id == registration_id).first()

def review_task_submission(db: Session, submission_id: int, reviewer_id: int, status: str, organizer_feedback: str = None):
    from datetime import datetime, timezone
    sub = db.query(models.TaskSubmission).filter(models.TaskSubmission.id == submission_id).first()
    if not sub:
        return None
    sub.status = status
    if organizer_feedback is not None:
        sub.organizer_feedback = organizer_feedback
    sub.reviewed_by_id = reviewer_id
    sub.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sub)
    return sub

def override_submission_ai_result(
    db: Session,
    submission_id: int,
    reviewer_id: int,
    decision: str,
    reason: str,
    feedback: str = None
):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    sub = db.query(models.TaskSubmission).filter(models.TaskSubmission.id == submission_id).first()
    if not sub:
        return None

    sub.organizer_decision = decision
    sub.organizer_override_reason = reason
    sub.organizer_override_by = reviewer_id
    sub.reviewed_by_id = reviewer_id
    sub.reviewed_at = now
    if feedback:
        sub.organizer_feedback = feedback

    if decision in ["Approved", "Verified", "Passed"]:
        sub.status = "Verified"
    elif decision == "Correction Required":
        sub.status = "Correction Required"
    elif decision == "Reopened":
        sub.status = "In Progress"

    # Save audit version
    version_count = db.query(models.TaskSubmissionVersion).filter(
        models.TaskSubmissionVersion.submission_id == sub.id
    ).count()
    ver = models.TaskSubmissionVersion(
        submission_id=sub.id,
        version_number=version_count + 1,
        submission_text=sub.submission_text,
        submission_url=sub.submission_url,
        file_url=sub.file_url,
        file_name=sub.file_name,
        file_size_bytes=sub.file_size_bytes,
        status=sub.status,
        ai_status=sub.ai_status,
        ai_assessment=sub.ai_assessment,
        organizer_feedback=f"Organizer Override ({decision}): {reason}" + (f" - Feedback: {feedback}" if feedback else ""),
        submitted_at=now
    )
    db.add(ver)
    db.commit()
    db.refresh(sub)
    return sub

def create_timeline_entry(db: Session, event_id: int, entry_in: schemas.EventTimelineCreate):
    from datetime import timezone
    sched = entry_in.scheduled_time
    if sched.tzinfo is None:
        sched = sched.replace(tzinfo=timezone.utc)
    end = entry_in.end_time
    if end and end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)

    db_entry = models.EventTimelineEntry(
        event_id=event_id,
        title=entry_in.title.strip(),
        description=entry_in.description.strip() if entry_in.description else None,
        scheduled_time=sched,
        end_time=end,
        entry_type=entry_in.entry_type or "activity",
        task_id=entry_in.task_id,
        status=entry_in.status or "Scheduled",
        order=entry_in.order or 0
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

def get_timeline_entries(db: Session, event_id: int):
    return db.query(models.EventTimelineEntry).filter(
        models.EventTimelineEntry.event_id == event_id
    ).order_by(models.EventTimelineEntry.scheduled_time.asc(), models.EventTimelineEntry.order.asc()).all()

def update_timeline_entry(db: Session, entry_id: int, entry_update: schemas.EventTimelineUpdate):
    from datetime import timezone
    entry = db.query(models.EventTimelineEntry).filter(models.EventTimelineEntry.id == entry_id).first()
    if not entry:
        return None
    update_data = entry_update.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if field in ["scheduled_time", "end_time"] and val:
            if val.tzinfo is None:
                val = val.replace(tzinfo=timezone.utc)
            setattr(entry, field, val)
        else:
            setattr(entry, field, val)
    db.commit()
    db.refresh(entry)
    return entry

def delete_timeline_entry(db: Session, entry_id: int):
    entry = db.query(models.EventTimelineEntry).filter(models.EventTimelineEntry.id == entry_id).first()
    if entry:
        db.delete(entry)
        db.commit()
        return True
    return False

def get_live_overview(db: Session, event_id: int):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        return None

    total_registered = db.query(models.Registration).filter(
        models.Registration.event_id == event_id,
        models.Registration.status.notin_(["Cancelled", "Rejected"])
    ).count()

    total_checked_in = db.query(models.Registration).filter(
        models.Registration.event_id == event_id,
        models.Registration.checked_in == True
    ).count()

    total_teams = db.query(models.Team).filter(models.Team.event_id == event_id).count()
    active_tasks = db.query(models.LiveTask).filter(
        models.LiveTask.event_id == event_id,
        models.LiveTask.status == "Active"
    ).count()

    total_submissions = db.query(models.TaskSubmission).filter(models.TaskSubmission.event_id == event_id).count()
    pending_reviews = db.query(models.TaskSubmission).filter(
        models.TaskSubmission.event_id == event_id,
        models.TaskSubmission.status.in_(["Submitted", "Correction Required"])
    ).count()

    recent_announcements = db.query(models.NotificationCampaign).filter(
        models.NotificationCampaign.event_id == event_id
    ).order_by(models.NotificationCampaign.created_at.desc()).limit(5).all()

    timeline = db.query(models.EventTimelineEntry).filter(
        models.EventTimelineEntry.event_id == event_id
    ).order_by(models.EventTimelineEntry.scheduled_time.asc()).limit(6).all()

    return {
        "event_id": event.id,
        "event_title": event.title,
        "event_status": event.status,
        "total_registered": total_registered,
        "total_checked_in": total_checked_in,
        "total_teams": total_teams,
        "active_tasks_count": active_tasks,
        "total_submissions_count": total_submissions,
        "pending_reviews_count": pending_reviews,
        "recent_announcements": recent_announcements,
        "upcoming_timeline": timeline
    }
