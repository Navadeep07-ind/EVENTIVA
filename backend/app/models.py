from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    organization = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    events = relationship("Event", back_populates="organizer")
    notification_campaigns = relationship("NotificationCampaign", back_populates="organizer")

class OTP(Base):
    __tablename__ = "otps"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True)
    hashed_otp = Column(String)
    purpose = Column(String) # 'verification' or 'reset'
    expires_at = Column(DateTime(timezone=True))
    attempts = Column(Integer, default=0)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    venue = Column(String, nullable=True)
    registration_start_date = Column(DateTime(timezone=True), nullable=True)
    registration_deadline = Column(DateTime(timezone=True), nullable=True)
    max_participants = Column(Integer, nullable=True)
    min_team_size = Column(Integer, default=1)
    max_team_size = Column(Integer, default=1)
    registration_mode = Column(String, default="individual") # "individual" or "team"
    status = Column(String, default="Draft") # Draft, Published, Completed, Cancelled
    poster_url = Column(String, nullable=True)
    form_schema = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    organizer_id = Column(Integer, ForeignKey("users.id"))
    organizer = relationship("User", back_populates="events")
    registrations = relationship("Registration", back_populates="event")
    teams = relationship("Team", back_populates="event", cascade="all, delete-orphan")
    notification_campaigns = relationship("NotificationCampaign", back_populates="event", cascade="all, delete-orphan")
    reminders = relationship("EventReminderConfig", back_populates="event", cascade="all, delete-orphan")
    live_tasks = relationship("LiveTask", back_populates="event", cascade="all, delete-orphan")
    timeline_entries = relationship("EventTimelineEntry", back_populates="event", cascade="all, delete-orphan")

class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), index=True)
    team_name = Column(String, index=True)
    leader_registration_id = Column(Integer, ForeignKey("registrations.id"), nullable=True)
    invite_code = Column(String, unique=True, index=True)
    status = Column(String, default="Active") # Active, Complete, Cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="teams")
    members = relationship("Registration", back_populates="team", foreign_keys="Registration.team_id")
    leader = relationship("Registration", foreign_keys=[leader_registration_id], post_update=True)

class Registration(Base):
    __tablename__ = "registrations"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    full_name = Column(String)
    email = Column(String, index=True)
    college = Column(String, nullable=True)
    custom_answers = Column(JSON, nullable=True)
    status = Column(String, default="Registered")
    ticket_code = Column(String, unique=True, index=True, nullable=True)
    checked_in = Column(Boolean, default=False)
    checked_in_at = Column(DateTime(timezone=True), nullable=True)
    
    # Team association
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True, index=True)
    is_team_leader = Column(Boolean, default=False)

    # Notification preferences
    unsubscribed_announcements = Column(Boolean, default=False)
    unsubscribe_token = Column(String, unique=True, index=True, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="registrations")
    team = relationship("Team", back_populates="members", foreign_keys=[team_id])
    notification_deliveries = relationship("NotificationDelivery", back_populates="registration")

    @property
    def ticket_url(self):
        return f"/tickets/{self.ticket_code}" if self.ticket_code else None

    @property
    def team_name(self):
        return self.team.team_name if self.team else None

class Institution(Base):
    __tablename__ = "institutions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True) # e.g. "TKRCET-HYD", "IIT-HYD"
    official_name = Column(String, index=True)
    common_name = Column(String, index=True, nullable=True)
    abbreviations = Column(String, index=True, nullable=True) # comma-separated: "TKRCET, TKR"
    category = Column(String, index=True, default="Engineering") # Engineering, University, Medical, Management, Arts & Science, Polytechnic, School, Other
    institution_type = Column(String, default="Autonomous Engineering College")
    state = Column(String, index=True)
    district = Column(String, index=True, nullable=True)
    city = Column(String, index=True)
    address = Column(Text, nullable=True)
    website = Column(String, nullable=True)
    established_year = Column(Integer, nullable=True)
    data_source = Column(String, default="AICTE / State Authority")
    last_verification_date = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    recognition_records = relationship("InstitutionRecognitionRecord", back_populates="institution", cascade="all, delete-orphan")
    branding_kits = relationship("BrandingKit", back_populates="institution")
    contributors = relationship("InstitutionContributor", back_populates="institution")

class InstitutionRecognitionRecord(Base):
    __tablename__ = "institution_recognition_records"

    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id"))
    authority = Column(String, index=True) # AICTE, UGC, NMC, NAAC, NBA, NIRF, NCTE, State Board
    reference_number = Column(String, nullable=True)
    recognition_status = Column(String) # Approved, Accredited (A++), Ranked #8, Recognized
    valid_upto = Column(String, nullable=True)
    verification_date = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    institution = relationship("Institution", back_populates="recognition_records")

class BrandingKit(Base):
    __tablename__ = "branding_kits"

    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # None for system/public kits
    name = Column(String, index=True)
    institution_type = Column(String, default="College / University")
    short_name = Column(String, nullable=True)
    location = Column(String, nullable=True)
    department = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    badge_url = Column(String, nullable=True)
    backdrop_url = Column(String, nullable=True)
    primary_color = Column(String, default="#1e3a8a")
    secondary_color = Column(String, default="#f59e0b")
    dark_bg = Column(String, default="#030712")
    accent_color = Column(String, default="#38bdf8")
    preferred_font = Column(String, default="Inter")
    recommended_border = Column(String, default="academic-double-gold")
    signoff_text = Column(Text, nullable=True)
    website = Column(String, nullable=True)
    status = Column(String, default="Discovered") # Discovered, Identity Verified, Assets Collected, Assets Verified, Institution Confirmed
    version = Column(Integer, default=1)
    is_verified = Column(Boolean, default=False)
    is_public = Column(Boolean, default=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    institution = relationship("Institution", back_populates="branding_kits")
    assets = relationship("BrandingAsset", back_populates="kit", cascade="all, delete-orphan")
    colors = relationship("BrandingColor", back_populates="kit", cascade="all, delete-orphan")
    templates = relationship("BrandingTemplate", back_populates="kit", cascade="all, delete-orphan")
    verifications = relationship("BrandingVerification", back_populates="kit", cascade="all, delete-orphan")

class BrandingAsset(Base):
    __tablename__ = "branding_assets"

    id = Column(Integer, primary_key=True, index=True)
    kit_id = Column(Integer, ForeignKey("branding_kits.id"))
    asset_type = Column(String) # logo_primary, logo_secondary, badge, emblem, campus_backdrop, sponsor_logo, department_logo
    url = Column(String)
    title = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String, nullable=True)
    source_url = Column(String, nullable=True)
    retrieval_date = Column(DateTime(timezone=True), server_default=func.now())
    verification_status = Column(String, default="Candidate") # Verified Official, Candidate, User Uploaded, Rejected
    usage_notes = Column(Text, nullable=True)

    kit = relationship("BrandingKit", back_populates="assets")

class BrandingColor(Base):
    __tablename__ = "branding_colors"

    id = Column(Integer, primary_key=True, index=True)
    kit_id = Column(Integer, ForeignKey("branding_kits.id"))
    color_type = Column(String) # primary, secondary, accent, dark_bg, light_bg
    hex_code = Column(String)
    label = Column(String, nullable=True)
    source_type = Column(String, default="unverified") # officially_published, ai_suggested, user_provided, unverified

    kit = relationship("BrandingKit", back_populates="colors")

class BrandingTemplate(Base):
    __tablename__ = "branding_templates"

    id = Column(Integer, primary_key=True, index=True)
    kit_id = Column(Integer, ForeignKey("branding_kits.id"))
    template_name = Column(String)
    layout_type = Column(String, default="standard_academic") # standard_academic, conference_summit, hackathon_modern, cultural_celebration
    preferred_font = Column(String, default="Inter")
    recommended_border = Column(String, default="academic-double-gold")
    signoff_text = Column(Text, nullable=True)
    sample_layers = Column(JSON, nullable=True)
    is_default = Column(Boolean, default=True)

    kit = relationship("BrandingKit", back_populates="templates")

class BrandingVerification(Base):
    __tablename__ = "branding_verifications"

    id = Column(Integer, primary_key=True, index=True)
    kit_id = Column(Integer, ForeignKey("branding_kits.id"))
    previous_status = Column(String, nullable=True)
    new_status = Column(String) # Discovered, Identity Verified, Assets Collected, Assets Verified, Institution Confirmed
    verification_method = Column(String) # official_domain, regulatory_record, admin_review, institution_rep_authorized
    reviewer_email = Column(String, nullable=True)
    evidence_url = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    verified_at = Column(DateTime(timezone=True), server_default=func.now())

    kit = relationship("BrandingKit", back_populates="verifications")

class InstitutionContributor(Base):
    __tablename__ = "institution_contributors"

    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    email = Column(String, index=True)
    domain = Column(String, index=True)
    role = Column(String, default="representative") # representative, faculty_coordinator, student_lead
    verification_status = Column(String, default="pending") # pending, approved, rejected
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    approved_at = Column(DateTime(timezone=True), nullable=True)

    institution = relationship("Institution", back_populates="contributors")

class NotificationCampaign(Base):
    __tablename__ = "notification_campaigns"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), index=True)
    organizer_id = Column(Integer, ForeignKey("users.id"), index=True)
    campaign_type = Column(String, default="announcement") # announcement, reminder, schedule_change, venue_change, team_alert
    title = Column(String)
    message = Column(Text)
    target_audience = Column(String, default="all") # all, teams, participants
    target_filter = Column(JSON, nullable=True) # {"team_ids": [...]}, {"registration_ids": [...]}
    priority = Column(String, default="normal") # normal, important, urgent
    status = Column(String, default="Pending") # Pending, Sending, Completed, Partial, Failed
    total_recipients = Column(Integer, default=0)
    sent_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    event = relationship("Event", back_populates="notification_campaigns")
    organizer = relationship("User", back_populates="notification_campaigns")
    deliveries = relationship("NotificationDelivery", back_populates="campaign", cascade="all, delete-orphan")

class NotificationDelivery(Base):
    __tablename__ = "notification_deliveries"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("notification_campaigns.id"), index=True)
    registration_id = Column(Integer, ForeignKey("registrations.id"), nullable=True, index=True)
    recipient_email = Column(String, index=True)
    recipient_name = Column(String)
    status = Column(String, default="queued") # queued, sent, failed, skipped_unsubscribed
    error_message = Column(Text, nullable=True)
    idempotency_key = Column(String, unique=True, index=True)
    attempt_count = Column(Integer, default=0)
    last_attempt_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    campaign = relationship("NotificationCampaign", back_populates="deliveries")
    registration = relationship("Registration", back_populates="notification_deliveries")

class EventReminderConfig(Base):
    __tablename__ = "event_reminder_configs"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), index=True)
    reminder_type = Column(String) # 24h_before, 1h_before, custom
    scheduled_time = Column(DateTime(timezone=True))
    custom_message = Column(Text, nullable=True)
    is_enabled = Column(Boolean, default=True)
    is_sent = Column(Boolean, default=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    campaign_id = Column(Integer, ForeignKey("notification_campaigns.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="reminders")
    campaign = relationship("NotificationCampaign")

class LiveTask(Base):
    __tablename__ = "live_tasks"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), index=True)
    title = Column(String, index=True)
    instructions = Column(Text)
    description = Column(Text, nullable=True)
    deadline = Column(DateTime(timezone=True), index=True)
    timezone = Column(String, default="UTC")
    target_audience = Column(String, default="all")  # all, teams, participants
    target_filter = Column(JSON, nullable=True)
    submission_method = Column(String, default="file")  # file, url, text, file_url, all
    allowed_file_types = Column(String, default=".pdf,.ppt,.pptx,.zip,.png,.jpg,.jpeg")
    max_file_size_mb = Column(Integer, default=25)
    review_required = Column(Boolean, default=True)
    ai_verification_enabled = Column(Boolean, default=True)
    require_url = Column(Boolean, default=False)
    deliverable_checklist = Column(JSON, nullable=True)
    scoring_rubric = Column(JSON, nullable=True)
    status = Column(String, default="Active")  # Active, Completed, Cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    event = relationship("Event", back_populates="live_tasks")
    reminders = relationship("TaskReminder", back_populates="task", cascade="all, delete-orphan")
    submissions = relationship("TaskSubmission", back_populates="task", cascade="all, delete-orphan")

class TaskReminder(Base):
    __tablename__ = "task_reminders"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("live_tasks.id"), index=True)
    event_id = Column(Integer, ForeignKey("events.id"), index=True)
    reminder_offset_minutes = Column(Integer)  # 1440, 60, 30, 10, or custom
    scheduled_time = Column(DateTime(timezone=True), index=True)
    custom_message = Column(Text, nullable=True)
    is_sent = Column(Boolean, default=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="Scheduled")  # Scheduled, Processing, Sent, Cancelled, Skipped, Expired, Failed
    campaign_id = Column(Integer, ForeignKey("notification_campaigns.id"), nullable=True)
    retry_count = Column(Integer, default=0)
    last_attempt_at = Column(DateTime(timezone=True), nullable=True)
    failure_reason = Column(Text, nullable=True)
    idempotency_key = Column(String, unique=True, index=True, nullable=True)
    delivery_result = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("LiveTask", back_populates="reminders")
    campaign = relationship("NotificationCampaign")

class TaskSubmission(Base):
    __tablename__ = "task_submissions"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("live_tasks.id"), index=True)
    event_id = Column(Integer, ForeignKey("events.id"), index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True, index=True)
    registration_id = Column(Integer, ForeignKey("registrations.id"), index=True)
    submission_text = Column(Text, nullable=True)
    submission_url = Column(String, nullable=True)
    file_url = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    status = Column(String, default="Submitted")  # Not Started, In Progress, Submitted, Verified, Correction Required, Completed, Late, Manual Review Required
    is_late = Column(Boolean, default=False)
    version = Column(Integer, default=1)
    ai_status = Column(String, default="None")  # None, Pending, Passed, Needs Correction, Needs Manual Review, Error
    ai_assessment = Column(JSON, nullable=True)
    ai_verified_at = Column(DateTime(timezone=True), nullable=True)
    organizer_feedback = Column(Text, nullable=True)
    organizer_decision = Column(String, nullable=True)  # Approved, Correction Required, Overridden, Reopened
    organizer_override_reason = Column(Text, nullable=True)
    organizer_override_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    task = relationship("LiveTask", back_populates="submissions")
    registration = relationship("Registration")
    team = relationship("Team")
    reviewer = relationship("User", foreign_keys=[reviewed_by_id])
    override_reviewer = relationship("User", foreign_keys=[organizer_override_by])
    versions = relationship("TaskSubmissionVersion", back_populates="submission", cascade="all, delete-orphan", order_by="TaskSubmissionVersion.version_number.desc()")

    @property
    def team_name(self):
        return getattr(self, '_team_name', None) or (self.team.team_name if self.team else None)

    @team_name.setter
    def team_name(self, val):
        self._team_name = val

    @property
    def submitter_name(self):
        return getattr(self, '_submitter_name', None) or (self.registration.full_name if self.registration else None)

    @submitter_name.setter
    def submitter_name(self, val):
        self._submitter_name = val

    @property
    def submitter_email(self):
        return getattr(self, '_submitter_email', None) or (self.registration.email if self.registration else None)

    @submitter_email.setter
    def submitter_email(self, val):
        self._submitter_email = val

class TaskSubmissionVersion(Base):
    __tablename__ = "task_submission_versions"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("task_submissions.id"), index=True)
    version_number = Column(Integer, default=1)
    submission_text = Column(Text, nullable=True)
    submission_url = Column(String, nullable=True)
    file_url = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    status = Column(String, default="Submitted")
    ai_status = Column(String, default="None")
    ai_assessment = Column(JSON, nullable=True)
    organizer_feedback = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())

    submission = relationship("TaskSubmission", back_populates="versions")

class AIVerificationJob(Base):
    __tablename__ = "ai_verification_jobs"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("task_submissions.id"), index=True)
    task_id = Column(Integer, ForeignKey("live_tasks.id"), index=True)
    status = Column(String, default="Queued")  # Queued, Processing, Completed, Failed
    attempt_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

class EventTimelineEntry(Base):
    __tablename__ = "event_timeline_entries"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), index=True)
    title = Column(String, index=True)
    description = Column(Text, nullable=True)
    scheduled_time = Column(DateTime(timezone=True), index=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    entry_type = Column(String, default="activity")  # activity, deadline, announcement, submission_window, results
    task_id = Column(Integer, ForeignKey("live_tasks.id"), nullable=True)
    status = Column(String, default="Scheduled")  # Scheduled, In Progress, Completed, Cancelled
    order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="timeline_entries")
    task = relationship("LiveTask")

