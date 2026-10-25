from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any, Dict
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    organization: Optional[str] = None

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_verified: bool
    created_at: datetime

    class Config:
        orm_mode = True

class OTPRequest(BaseModel):
    email: EmailStr
    purpose: str = "verification"

class OTPVerify(BaseModel):
    email: EmailStr
    otp: str
    purpose: str = "verification"

class PasswordReset(BaseModel):
    email: EmailStr
    otp: str
    new_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    venue: Optional[str] = None
    registration_start_date: Optional[datetime] = None
    registration_deadline: Optional[datetime] = None
    max_participants: Optional[int] = None
    min_team_size: Optional[int] = 1
    max_team_size: Optional[int] = 1
    registration_mode: Optional[str] = "individual" # "individual" or "team"
    status: Optional[str] = "Draft"
    poster_url: Optional[str] = None
    form_schema: Optional[List[dict]] = None

class EventCreate(EventBase):
    pass

class EventUpdate(EventBase):
    title: Optional[str] = None

class Event(EventBase):
    id: int
    organizer_id: int
    created_at: datetime

    class Config:
        orm_mode = True

class RegistrationBase(BaseModel):
    full_name: str
    email: EmailStr
    college: Optional[str] = None
    custom_answers: Optional[dict] = None

class RegistrationCreate(RegistrationBase):
    pass

class Registration(RegistrationBase):
    id: int
    event_id: int
    status: str
    ticket_code: Optional[str] = None
    ticket_url: Optional[str] = None
    checked_in: bool = False
    checked_in_at: Optional[datetime] = None
    team_id: Optional[int] = None
    is_team_leader: Optional[bool] = False
    team_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class RegistrationUpdate(BaseModel):
    status: Optional[str] = None # Registered, Approved, Rejected, Cancelled
    checked_in: Optional[bool] = None

class CheckInRequest(BaseModel):
    ticket_code: str

class CheckInResponse(BaseModel):
    status: str # "success", "already_checked_in", "error"
    message: str
    ticket_code: str
    attendee_name: str
    attendee_college: Optional[str] = None
    checked_in: bool
    checked_in_at: Optional[datetime] = None
    is_duplicate: bool = False

class RegistrationStats(BaseModel):
    total: int
    checked_in: int
    pending: int
    approved: int
    cancelled: int
    rejected: int

class TicketPublicResponse(BaseModel):
    ticket_code: str
    event_id: int
    event_title: str
    category: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    venue: Optional[str] = None
    poster_url: Optional[str] = None
    attendee_name: str
    attendee_college: Optional[str] = None
    status: str
    checked_in: bool = False
    checked_in_at: Optional[datetime] = None
    is_valid_for_admission: bool = True
    ticket_url: str
    team_name: Optional[str] = None
    is_team_leader: Optional[bool] = False

# --- TEAM REGISTRATION SCHEMAS ---
class TeamMemberInfo(BaseModel):
    id: int
    full_name: str
    college: Optional[str] = None
    status: str
    checked_in: bool = False
    is_team_leader: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

class TeamLeaderCreate(RegistrationBase):
    pass

class TeamCreate(BaseModel):
    team_name: str
    leader: TeamLeaderCreate

class TeamJoinRequest(RegistrationBase):
    pass

class TeamPublicInfo(BaseModel):
    id: int
    team_name: str
    event_id: int
    event_title: str
    category: Optional[str] = None
    venue: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    poster_url: Optional[str] = None
    leader_name: str
    current_member_count: int
    min_team_size: int
    max_team_size: int
    spots_remaining: int
    is_full: bool
    can_join: bool
    status: str
    invite_code: str
    form_schema: Optional[List[dict]] = None

class TeamDetailResponse(BaseModel):
    id: int
    team_name: str
    event_id: int
    event_title: str
    category: Optional[str] = None
    venue: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    poster_url: Optional[str] = None
    leader_name: str
    invite_code: str
    status: str
    min_team_size: int
    max_team_size: int
    current_member_count: int
    spots_remaining: int
    is_full: bool
    members: List[TeamMemberInfo]
    created_at: datetime

class TeamOrganizerView(BaseModel):
    id: int
    team_name: str
    event_id: int
    invite_code: str
    status: str
    leader_registration_id: Optional[int] = None
    leader_name: Optional[str] = None
    leader_email: Optional[str] = None
    leader_college: Optional[str] = None
    current_member_count: int
    min_team_size: int
    max_team_size: int
    is_complete: bool
    members: List[Registration]
    created_at: datetime

    class Config:
        from_attributes = True

# --- RECOGNITION RECORDS ---
class InstitutionRecognitionRecordBase(BaseModel):
    authority: str # AICTE, UGC, NMC, NAAC, NBA, NIRF, NCTE, State Board
    reference_number: Optional[str] = None
    recognition_status: str # Approved, Accredited (A++), Ranked #8
    valid_upto: Optional[str] = None
    verification_date: Optional[datetime] = None
    verified_by: Optional[str] = None
    notes: Optional[str] = None

class InstitutionRecognitionRecordCreate(InstitutionRecognitionRecordBase):
    institution_id: int

class InstitutionRecognitionRecord(InstitutionRecognitionRecordBase):
    id: int
    institution_id: int

    class Config:
        from_attributes = True

# --- BRANDING ASSETS ---
class BrandingAssetBase(BaseModel):
    asset_type: str # logo_primary, logo_secondary, badge, emblem, campus_backdrop, sponsor_logo, department_logo
    url: str
    title: Optional[str] = None
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    source_url: Optional[str] = None
    verification_status: Optional[str] = "Candidate" # Verified Official, Candidate, User Uploaded, Rejected
    usage_notes: Optional[str] = None

class BrandingAssetCreate(BrandingAssetBase):
    kit_id: int

class BrandingAsset(BrandingAssetBase):
    id: int
    kit_id: int
    retrieval_date: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- BRANDING COLORS ---
class BrandingColorBase(BaseModel):
    color_type: str # primary, secondary, accent, dark_bg, light_bg
    hex_code: str
    label: Optional[str] = None
    source_type: Optional[str] = "unverified" # officially_published, ai_suggested, user_provided, unverified

class BrandingColorCreate(BrandingColorBase):
    kit_id: int

class BrandingColor(BrandingColorBase):
    id: int
    kit_id: int

    class Config:
        from_attributes = True

# --- BRANDING TEMPLATES ---
class BrandingTemplateBase(BaseModel):
    template_name: str
    layout_type: Optional[str] = "standard_academic"
    preferred_font: Optional[str] = "Inter"
    recommended_border: Optional[str] = "academic-double-gold"
    signoff_text: Optional[str] = None
    sample_layers: Optional[Any] = None
    is_default: Optional[bool] = True

class BrandingTemplateCreate(BrandingTemplateBase):
    kit_id: int

class BrandingTemplate(BrandingTemplateBase):
    id: int
    kit_id: int

    class Config:
        from_attributes = True

# --- BRANDING VERIFICATIONS ---
class BrandingVerificationBase(BaseModel):
    previous_status: Optional[str] = None
    new_status: str
    verification_method: str
    reviewer_email: Optional[str] = None
    evidence_url: Optional[str] = None
    notes: Optional[str] = None

class BrandingVerificationCreate(BrandingVerificationBase):
    kit_id: int

class BrandingVerification(BrandingVerificationBase):
    id: int
    kit_id: int
    verified_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- INSTITUTION CONTRIBUTORS ---
class InstitutionContributorBase(BaseModel):
    email: str
    domain: str
    role: Optional[str] = "representative"
    verification_status: Optional[str] = "pending"

class InstitutionContributorCreate(InstitutionContributorBase):
    institution_id: int

class InstitutionContributor(InstitutionContributorBase):
    id: int
    institution_id: int
    user_id: int
    requested_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- BRANDING KITS ---
class BrandingKitBase(BaseModel):
    name: str
    institution_id: Optional[int] = None
    institution_type: Optional[str] = "College / University"
    short_name: Optional[str] = None
    location: Optional[str] = None
    department: Optional[str] = None
    logo_url: Optional[str] = None
    badge_url: Optional[str] = None
    backdrop_url: Optional[str] = None
    primary_color: Optional[str] = "#1e3a8a"
    secondary_color: Optional[str] = "#f59e0b"
    dark_bg: Optional[str] = "#030712"
    accent_color: Optional[str] = "#38bdf8"
    preferred_font: Optional[str] = "Inter"
    recommended_border: Optional[str] = "academic-double-gold"
    signoff_text: Optional[str] = None
    website: Optional[str] = None
    status: Optional[str] = "Discovered" # Discovered, Identity Verified, Assets Collected, Assets Verified, Institution Confirmed
    version: Optional[int] = 1
    is_verified: Optional[bool] = False
    is_public: Optional[bool] = True
    description: Optional[str] = None

class BrandingKitCreate(BrandingKitBase):
    pass

class BrandingKitUpdate(BaseModel):
    name: Optional[str] = None
    institution_id: Optional[int] = None
    institution_type: Optional[str] = None
    short_name: Optional[str] = None
    location: Optional[str] = None
    department: Optional[str] = None
    logo_url: Optional[str] = None
    badge_url: Optional[str] = None
    backdrop_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    dark_bg: Optional[str] = None
    accent_color: Optional[str] = None
    preferred_font: Optional[str] = None
    recommended_border: Optional[str] = None
    signoff_text: Optional[str] = None
    website: Optional[str] = None
    status: Optional[str] = None
    is_verified: Optional[bool] = None
    is_public: Optional[bool] = None
    description: Optional[str] = None

class BrandingKit(BrandingKitBase):
    id: int
    user_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    assets: List[BrandingAsset] = []
    colors: List[BrandingColor] = []
    templates: List[BrandingTemplate] = []
    verifications: List[BrandingVerification] = []

    class Config:
        from_attributes = True

# --- INSTITUTIONS ---
class InstitutionBase(BaseModel):
    code: str
    official_name: str
    common_name: Optional[str] = None
    abbreviations: Optional[str] = None
    category: Optional[str] = "Engineering" # Engineering, University, Medical, Management, Arts & Science, Polytechnic, School, Other
    institution_type: Optional[str] = "Autonomous Engineering College"
    state: str
    district: Optional[str] = None
    city: str
    address: Optional[str] = None
    website: Optional[str] = None
    established_year: Optional[int] = None
    data_source: Optional[str] = "AICTE / State Authority"
    is_active: Optional[bool] = True

class InstitutionCreate(InstitutionBase):
    recognition_records: Optional[List[InstitutionRecognitionRecordBase]] = []

class InstitutionUpdate(BaseModel):
    code: Optional[str] = None
    official_name: Optional[str] = None
    common_name: Optional[str] = None
    abbreviations: Optional[str] = None
    category: Optional[str] = None
    institution_type: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    established_year: Optional[int] = None
    data_source: Optional[str] = None
    is_active: Optional[bool] = None

class InstitutionSummary(BaseModel):
    id: int
    code: str
    official_name: str
    common_name: Optional[str] = None
    abbreviations: Optional[str] = None
    category: str
    institution_type: str
    state: str
    district: Optional[str] = None
    city: str
    website: Optional[str] = None
    established_year: Optional[int] = None
    has_branding_kit: bool = False
    branding_kit_id: Optional[int] = None
    branding_status: Optional[str] = None # Discovered, Identity Verified, Assets Collected, Assets Verified, Institution Confirmed
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    recognition_summary: List[str] = []

    class Config:
        from_attributes = True

class InstitutionDetail(InstitutionBase):
    id: int
    last_verification_date: Optional[datetime] = None
    created_at: datetime
    recognition_records: List[InstitutionRecognitionRecord] = []
    branding_kits: List[BrandingKit] = []

    class Config:
        from_attributes = True

class BrandingDiscoveryResult(BaseModel):
    institution_id: int
    institution_name: str
    official_website: Optional[str] = None
    candidate_logo_url: Optional[str] = None
    candidate_badge_url: Optional[str] = None
    candidate_backdrop_url: Optional[str] = None
    extracted_colors: List[dict] = []
    recommended_font: str = "Inter"
    recommended_border: str = "academic-double-gold"
    discovery_source: str = "Official Institution Website & State Registry"
    status: str = "Assets Collected"
    draft_kit: BrandingKit

# -------------------------------------------------------------
# FEATURE 4: NOTIFICATIONS & AUTOMATED REMINDERS SCHEMAS
# -------------------------------------------------------------

class NotificationDeliveryOut(BaseModel):
    id: int
    recipient_email: str
    recipient_name: str
    status: str
    error_message: Optional[str] = None
    attempt_count: int = 0
    last_attempt_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationCampaignOut(BaseModel):
    id: int
    event_id: int
    organizer_id: int
    campaign_type: str
    title: str
    message: str
    target_audience: str
    priority: str
    status: str
    total_recipients: int
    sent_count: int
    failed_count: int
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class NotificationCampaignDetail(NotificationCampaignOut):
    deliveries: List[NotificationDeliveryOut] = []

class NotificationBroadcastRequest(BaseModel):
    title: str
    message: str
    target_audience: str = "all" # all, teams, participants
    target_ids: Optional[List[int]] = None # team ids or registration ids
    priority: str = "normal" # normal, important, urgent

class EventChangeDetectRequest(BaseModel):
    venue: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

class EventChangeDetectResponse(BaseModel):
    has_changes: bool
    changed_fields: dict
    summary: str
    eligible_attendees_count: int

class EventChangeNotifyRequest(BaseModel):
    custom_note: Optional[str] = None

class EventReminderConfigItem(BaseModel):
    reminder_type: str # 24h_before, 1h_before, custom
    scheduled_time: datetime
    custom_message: Optional[str] = None
    is_enabled: bool = True

class EventReminderConfigOut(BaseModel):
    id: int
    event_id: int
    reminder_type: str
    scheduled_time: datetime
    custom_message: Optional[str] = None
    is_enabled: bool
    is_sent: bool
    sent_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EventRemindersSaveRequest(BaseModel):
    reminders: List[EventReminderConfigItem]

class UnsubscribeInfoResponse(BaseModel):
    event_title: str
    attendee_name: str
    email: str
    unsubscribed_announcements: bool




# --- LIVE EVENT CONTROL CENTER SCHEMAS ---

class LiveTaskBase(BaseModel):
    title: str
    instructions: str
    description: Optional[str] = None
    deadline: datetime
    timezone: Optional[str] = 'UTC'
    target_audience: Optional[str] = 'all' # all, teams, participants
    target_filter: Optional[dict] = None
    submission_method: Optional[str] = 'file' # file, url, text, file_url, all
    allowed_file_types: Optional[str] = '.pdf,.ppt,.pptx,.zip,.png,.jpg,.jpeg'
    max_file_size_mb: Optional[int] = 25
    review_required: Optional[bool] = True
    ai_verification_enabled: Optional[bool] = True
    require_url: Optional[bool] = False
    deliverable_checklist: Optional[List[str]] = None
    scoring_rubric: Optional[Dict[str, Any]] = None

class LiveTaskCreate(LiveTaskBase):
    reminder_offsets: Optional[List[int]] = [30, 10]

class LiveTaskUpdate(BaseModel):
    title: Optional[str] = None
    instructions: Optional[str] = None
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    timezone: Optional[str] = None
    target_audience: Optional[str] = None
    target_filter: Optional[dict] = None
    submission_method: Optional[str] = None
    allowed_file_types: Optional[str] = None
    max_file_size_mb: Optional[int] = None
    review_required: Optional[bool] = None
    ai_verification_enabled: Optional[bool] = None
    require_url: Optional[bool] = None
    deliverable_checklist: Optional[List[str]] = None
    scoring_rubric: Optional[Dict[str, Any]] = None
    status: Optional[str] = None
    reminder_offsets: Optional[List[int]] = None

class TaskReminderOut(BaseModel):
    id: int
    task_id: int
    reminder_offset_minutes: int
    scheduled_time: datetime
    is_sent: bool
    status: str
    retry_count: Optional[int] = 0
    failure_reason: Optional[str] = None
    delivery_result: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class LiveTaskOut(LiveTaskBase):
    id: int
    event_id: int
    status: str
    created_at: datetime
    updated_at: datetime
    reminders: List[TaskReminderOut] = []
    submissions_count: Optional[int] = 0
    pending_reviews_count: Optional[int] = 0
    direct_submit_url: Optional[str] = None

    class Config:
        from_attributes = True

class TaskSubmissionVersionOut(BaseModel):
    id: int
    version_number: int
    submission_text: Optional[str] = None
    submission_url: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size_bytes: Optional[int] = None
    status: str
    ai_status: Optional[str] = "None"
    ai_assessment: Optional[Dict[str, Any]] = None
    organizer_feedback: Optional[str] = None
    submitted_at: datetime

    class Config:
        from_attributes = True

class TaskSubmissionCreate(BaseModel):
    submission_text: Optional[str] = None
    submission_url: Optional[str] = None
    ticket_code: Optional[str] = None

class TaskSubmissionReview(BaseModel):
    status: str # Verified, Correction Required, Completed
    organizer_feedback: Optional[str] = None

class TaskSubmissionOverrideRequest(BaseModel):
    decision: str # Approved, Correction Required, Overridden, Reopened
    reason: str
    feedback: Optional[str] = None

class TaskSubmissionOut(BaseModel):
    id: int
    task_id: int
    event_id: int
    team_id: Optional[int] = None
    team_name: Optional[str] = None
    registration_id: int
    submitter_name: Optional[str] = None
    submitter_email: Optional[str] = None
    submission_text: Optional[str] = None
    submission_url: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size_bytes: Optional[int] = None
    status: str
    is_late: bool
    version: Optional[int] = 1
    ai_status: Optional[str] = "None"
    ai_assessment: Optional[Dict[str, Any]] = None
    ai_verified_at: Optional[datetime] = None
    organizer_feedback: Optional[str] = None
    organizer_decision: Optional[str] = None
    organizer_override_reason: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    submitted_at: datetime
    versions: Optional[List[TaskSubmissionVersionOut]] = []

    class Config:
        from_attributes = True

class DirectTaskPortalResponse(BaseModel):
    task: LiveTaskOut
    event_id: int
    event_title: str
    event_status: str
    my_submission: Optional[TaskSubmissionOut] = None
    time_remaining_seconds: int
    is_expired: bool
    is_registered: bool = False
    participant_name: Optional[str] = None
    team_name: Optional[str] = None
    ticket_code: Optional[str] = None

class EventTimelineCreate(BaseModel):
    title: str
    description: Optional[str] = None
    scheduled_time: datetime
    end_time: Optional[datetime] = None
    entry_type: Optional[str] = 'activity'
    task_id: Optional[int] = None
    status: Optional[str] = 'Scheduled'
    order: Optional[int] = 0

class EventTimelineUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    entry_type: Optional[str] = None
    task_id: Optional[int] = None
    status: Optional[str] = None
    order: Optional[int] = None

class EventTimelineOut(BaseModel):
    id: int
    event_id: int
    title: str
    description: Optional[str] = None
    scheduled_time: datetime
    end_time: Optional[datetime] = None
    entry_type: str
    task_id: Optional[int] = None
    status: str
    order: int
    created_at: datetime

    class Config:
        from_attributes = True

class AIPolishInstructionsRequest(BaseModel):
    raw_text: str
    context_info: Optional[str] = None

class AIPolishInstructionsResponse(BaseModel):
    task_title: str
    instructions: str
    description: Optional[str] = None
    suggested_submission_method: str = 'file'
    is_ai_generated: bool = True

class ParticipantTaskView(BaseModel):
    task: LiveTaskOut
    my_submission: Optional[TaskSubmissionOut] = None
    time_remaining_seconds: int
    is_expired: bool

class ParticipantLivePortalResponse(BaseModel):
    event_id: int
    event_title: str
    event_status: str
    announcements: List[NotificationCampaignOut] = []
    urgent_update: Optional[NotificationCampaignOut] = None
    tasks: List[ParticipantTaskView] = []
    timeline: List[EventTimelineOut] = []
    is_registered: bool = False
    participant_name: Optional[str] = None
    team_name: Optional[str] = None
    ticket_code: Optional[str] = None
