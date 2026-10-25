import os
import smtplib
import logging
from typing import Optional, List, Dict, Any, Tuple
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger("eventiva_email")

# In-memory test store for automated testing without live SMTP dispatch
_mock_sent_emails: List[Dict[str, Any]] = []

def get_mock_sent_emails() -> List[Dict[str, Any]]:
    return _mock_sent_emails

def clear_mock_sent_emails():
    _mock_sent_emails.clear()

def is_mock_mode() -> bool:
    return os.getenv("MOCK_EMAIL", "0") == "1" or os.getenv("TESTING", "0") == "1"

def get_smtp_config():
    server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    port = os.getenv("SMTP_PORT", "587")
    email = os.getenv("SMTP_EMAIL")
    password = os.getenv("SMTP_APP_PASSWORD")
    
    if not email or not password:
        raise ValueError("SMTP_EMAIL or SMTP_APP_PASSWORD environment variables are missing.")
        
    return server, port, email, password

def build_branded_html(
    header_subtitle: str,
    headline: str,
    body_paragraphs: List[str],
    badge_text: Optional[str] = None,
    badge_color: str = "#4f46e5",
    action_button: Optional[Dict[str, str]] = None, # {"label": "...", "url": "..."}
    details_box: Optional[Dict[str, str]] = None, # {"Ticket Code": "EVT-...", ...}
    unsubscribe_url: Optional[str] = None
) -> str:
    """Builds a responsive, accessible, EVENTIVA-branded HTML email."""
    
    badge_html = ""
    if badge_text:
        badge_html = f"""
        <div style="display: inline-block; background-color: {badge_color}15; color: {badge_color}; border: 1px solid {badge_color}40; border-radius: 9999px; padding: 4px 14px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
            {badge_text}
        </div>
        """

    paragraphs_html = "".join([f'<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">{p}</p>' for p in body_paragraphs])

    details_html = ""
    if details_box:
        rows = "".join([
            f"""<tr>
                <td style="padding: 8px 12px; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; width: 38%;">{k}</td>
                <td style="padding: 8px 12px; font-size: 14px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #f1f5f9;">{v}</td>
            </tr>"""
            for k, v in details_box.items()
        ])
        details_html = f"""
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin: 20px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                {rows}
            </table>
        </div>
        """

    button_html = ""
    if action_button:
        button_html = f"""
        <div style="text-align: center; margin: 28px 0 16px 0;">
            <a href="{action_button['url']}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 10px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.25);">
                {action_button['label']}
            </a>
        </div>
        """

    unsub_html = ""
    if unsubscribe_url:
        unsub_html = f"""
        <p style="margin: 6px 0 0 0;">
            Don't want to receive non-essential event updates? 
            <a href="{unsubscribe_url}" style="color: #6366f1; text-decoration: underline;">Unsubscribe from announcements</a>
        </p>
        """

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{headline}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          <tr>
            <td style="background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%); padding: 30px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">EVENTIVA</h1>
              <p style="margin: 4px 0 0 0; color: #e0e7ff; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">{header_subtitle}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px;">
              {badge_html}
              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.3px;">{headline}</h2>
              {paragraphs_html}
              {details_html}
              {button_html}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.5;">
              <p style="margin: 0; font-weight: 600;">EVENTIVA — Smart Event Operations Platform</p>
              {unsub_html}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

def send_email_sync(to_email: str, subject: str, plain_body: str, html_body: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    """Sends an email synchronously with multipart plain/html content.
    Returns (success: bool, error_msg: Optional[str]).
    Never leaks SMTP credentials in error strings.
    """
    if not to_email or "@" not in to_email:
        return False, "Invalid recipient email address"

    # If mock mode is active, record in memory and succeed
    if is_mock_mode():
        _mock_sent_emails.append({
            "to": to_email,
            "subject": subject,
            "plain_body": plain_body,
            "html_body": html_body
        })
        logger.info(f"[MOCK_EMAIL] Sent to {to_email}: {subject}")
        return True, None

    try:
        server_host, port, user_email, password = get_smtp_config()

        msg = MIMEMultipart("alternative")
        msg["From"] = f"EVENTIVA <{user_email}>"
        msg["To"] = to_email
        msg["Subject"] = subject

        # Attach plain text part first
        msg.attach(MIMEText(plain_body, "plain", "utf-8"))

        # Attach HTML part if available
        if html_body:
            msg.attach(MIMEText(html_body, "html", "utf-8"))

        server = smtplib.SMTP(server_host, int(port), timeout=12)
        server.starttls()
        server.login(user_email, password)
        server.send_message(msg)
        server.quit()
        return True, None
    except smtplib.SMTPAuthenticationError:
        logger.error("SMTP Authentication failure")
        return False, "SMTP Authentication Failed (Check App Password)"
    except smtplib.SMTPConnectError:
        logger.error("SMTP Connection error")
        return False, "Unable to establish connection with SMTP server"
    except Exception as e:
        sanitized_err = f"{type(e).__name__}: {str(e)}"
        # Strip any accidental secrets
        if "password" in sanitized_err.lower():
            sanitized_err = f"{type(e).__name__}: Authentication or connection failed"
        logger.warning(f"Email delivery error to {to_email}: {sanitized_err}")
        return False, sanitized_err

def send_email(to_email: str, subject: str, body: str, html_body: Optional[str] = None) -> dict:
    """Convenience wrapper returning a status dictionary."""
    success, err = send_email_sync(to_email=to_email, subject=subject, plain_body=body, html_body=html_body)
    return {
        "status": "sent" if success else "failed",
        "error": err
    }

# -------------------------------------------------------------------
# SPECIFIC NOTIFICATION TEMPLATES
# -------------------------------------------------------------------

def send_verification_otp(to_email: str, otp: str):
    subject = "EVENTIVA - Verify your email"
    body = f"Your verification code is: {otp}\nThis code expires in 5 minutes."
    send_email_sync(to_email, subject, body)

def send_password_reset_otp(to_email: str, otp: str):
    subject = "EVENTIVA - Password Reset"
    body = f"Your password reset code is: {otp}\nThis code expires in 5 minutes."
    send_email_sync(to_email, subject, body)

def send_ticket_confirmation(
    to_email: str,
    attendee_name: str,
    event_title: str,
    ticket_code: str,
    ticket_url: str,
    venue: Optional[str] = None,
    start_time_str: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """Sends digital ticket pass confirmation (Transactional)."""
    subject = f"Your Digital Ticket Pass: {event_title} — EVENTIVA"
    
    plain_body = f"""Hello {attendee_name},

Thank you for registering for {event_title}!
Your Digital Ticket Pass has been issued.

Ticket Code: {ticket_code}
{f"Venue: {venue}" if venue else ""}
{f"Schedule: {start_time_str}" if start_time_str else ""}

Access your QR ticket pass anytime here:
{ticket_url}

Please present your QR code pass at check-in for venue admission.

Best regards,
EVENTIVA Team
"""

    details = {
        "Ticket Code": ticket_code,
        "Attendee": attendee_name,
        "Event": event_title,
    }
    if venue:
        details["Venue"] = venue
    if start_time_str:
        details["Date & Time"] = start_time_str

    html_body = build_branded_html(
        header_subtitle="Digital Ticket & QR Pass",
        headline=f"You're registered for {event_title}!",
        body_paragraphs=[
            f"Hello {attendee_name},",
            f"Your registration is confirmed. Your unique digital pass and entry QR code are ready.",
            "Please present this pass at the gate for rapid contactless admission."
        ],
        badge_text="Registration Confirmed",
        badge_color="#10b981",
        action_button={"label": "View Digital Ticket Pass", "url": ticket_url},
        details_box=details
    )

    return send_email_sync(to_email, subject, plain_body, html_body)

def send_team_created_confirmation(
    to_email: str,
    leader_name: str,
    team_name: str,
    event_title: str,
    invite_code: str,
    team_hub_url: str,
    ticket_code: str,
    ticket_url: str
) -> Tuple[bool, Optional[str]]:
    """Sends team creation confirmation to leader (Transactional)."""
    subject = f"Team Created: {team_name} for {event_title} — EVENTIVA"
    
    plain_body = f"""Hello {leader_name},

Congratulations! You have successfully formed team "{team_name}" for {event_title}.

Your Team Invitation Passcode: {invite_code}
Share this code with your teammates so they can register and join your roster.

Manage your team roster & share links:
{team_hub_url}

Your Leader Ticket Code: {ticket_code}
View your individual pass:
{ticket_url}

Best regards,
EVENTIVA Team
"""

    html_body = build_branded_html(
        header_subtitle="Team Registration Engine",
        headline=f"Team \"{team_name}\" has been formed!",
        body_paragraphs=[
            f"Hello {leader_name},",
            f"You are officially registered as the Leader of <strong>{team_name}</strong> for <strong>{event_title}</strong>.",
            f"Share your team invitation code with teammates so they can join your roster:"
        ],
        badge_text="Team Leader Pass",
        badge_color="#8b5cf6",
        action_button={"label": "Open Team Management Hub", "url": team_hub_url},
        details_box={
            "Team Name": team_name,
            "Invitation Code": invite_code,
            "Leader Ticket": ticket_code,
            "Event": event_title
        }
    )

    return send_email_sync(to_email, subject, plain_body, html_body)

def send_team_member_joined_notification(
    to_email: str,
    recipient_name: str,
    member_name: str,
    team_name: str,
    event_title: str,
    team_hub_url: str,
    is_leader: bool = False,
    ticket_url: Optional[str] = None,
    ticket_code: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """Notifies either the leader or the joined member."""
    if is_leader:
        subject = f"New Teammate Alert: {member_name} joined {team_name} — EVENTIVA"
        plain_body = f"""Hello {recipient_name},

Good news! {member_name} has just joined your team "{team_name}" for {event_title}.

View your updated roster:
{team_hub_url}

Best regards,
EVENTIVA Team
"""
        html_body = build_branded_html(
            header_subtitle="Team Roster Update",
            headline=f"New Teammate Joined {team_name}!",
            body_paragraphs=[
                f"Hello {recipient_name},",
                f"<strong>{member_name}</strong> has successfully registered and joined your team roster for <strong>{event_title}</strong>.",
                "You can inspect your current team capacity and roster in your Team Hub."
            ],
            badge_text="Roster Updated",
            badge_color="#6366f1",
            action_button={"label": "View Team Roster", "url": team_hub_url},
            details_box={
                "Team Name": team_name,
                "New Member": member_name,
                "Event": event_title
            }
        )
    else:
        subject = f"Welcome to {team_name} for {event_title} — EVENTIVA"
        plain_body = f"""Hello {recipient_name},

You have successfully joined "{team_name}" for {event_title}!
Your individual Digital Ticket Pass has been generated.

Ticket Code: {ticket_code or 'Issued'}
View Ticket: {ticket_url or ''}

View your team roster:
{team_hub_url}

Best regards,
EVENTIVA Team
"""
        html_body = build_branded_html(
            header_subtitle="Team Registration Confirmed",
            headline=f"You're on team {team_name}!",
            body_paragraphs=[
                f"Hello {recipient_name},",
                f"You have officially joined <strong>{team_name}</strong> for <strong>{event_title}</strong>.",
                "Your individual ticket pass and QR code have been generated for entry."
            ],
            badge_text="Teammate Confirmed",
            badge_color="#10b981",
            action_button={"label": "View My Ticket Pass", "url": ticket_url or team_hub_url},
            details_box={
                "Team Name": team_name,
                "Ticket Code": ticket_code or "Issued",
                "Event": event_title
            }
        )

    return send_email_sync(to_email, subject, plain_body, html_body)

def send_announcement_email(
    to_email: str,
    recipient_name: str,
    event_title: str,
    title: str,
    message: str,
    priority: str = "normal",
    unsubscribe_url: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """Broadcast announcement from event organizer (Non-essential)."""
    priority_label = "Event Update"
    priority_color = "#4f46e5"
    if priority.lower() == "important":
        priority_label = "Important Announcement"
        priority_color = "#f59e0b"
    elif priority.lower() == "urgent":
        priority_label = "Urgent Notice"
        priority_color = "#ef4444"

    subject = f"[{priority_label}] {title} — {event_title}"

    plain_body = f"""Hello {recipient_name},

An announcement was published for {event_title}:

{title}
----------------------------------------
{message}

Best regards,
Organizer Team for {event_title}
"""

    html_body = build_branded_html(
        header_subtitle=f"Organizer Broadcast • {event_title}",
        headline=title,
        body_paragraphs=[
            f"Hello {recipient_name},",
            f"The organizer of <strong>{event_title}</strong> has sent the following announcement:",
            f"<div style='background-color: #f8fafc; border-left: 4px solid {priority_color}; padding: 14px 18px; margin: 16px 0; border-radius: 6px; font-size: 15px; color: #1e293b; white-space: pre-wrap;'>{message}</div>"
        ],
        badge_text=priority_label,
        badge_color=priority_color,
        unsubscribe_url=unsubscribe_url
    )

    return send_email_sync(to_email, subject, plain_body, html_body)

def send_schedule_venue_change_alert(
    to_email: str,
    recipient_name: str,
    event_title: str,
    change_summary: str,
    new_venue: Optional[str] = None,
    new_time: Optional[str] = None,
    ticket_url: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """Alerts attendees when event date, time, or venue is modified (Transactional)."""
    subject = f"Important Update: Venue or Schedule Change for {event_title}"

    plain_body = f"""Hello {recipient_name},

Please note an important update regarding {event_title}:

{change_summary}

{f"Updated Venue: {new_venue}" if new_venue else ""}
{f"Updated Schedule: {new_time}" if new_time else ""}

Your ticket pass remains valid. You can view your pass anytime:
{ticket_url or ''}

Best regards,
EVENTIVA Team
"""

    details = {"Event": event_title}
    if new_venue:
        details["Venue"] = new_venue
    if new_time:
        details["Date & Time"] = new_time

    html_body = build_branded_html(
        header_subtitle="Schedule & Venue Change Notice",
        headline=f"Important Updates for {event_title}",
        body_paragraphs=[
            f"Hello {recipient_name},",
            f"The organizer has updated the schedule or location for <strong>{event_title}</strong>:",
            f"<div style='background-color: #fffbeb; border: 1px solid #fef3c7; color: #92400e; padding: 14px 18px; border-radius: 8px; font-weight: 600; margin: 16px 0;'>⚠️ {change_summary}</div>",
            "Your digital ticket pass remains valid. Please arrive according to the updated schedule."
        ],
        badge_text="Schedule Update",
        badge_color="#f59e0b",
        action_button={"label": "Check My Ticket Pass", "url": ticket_url} if ticket_url else None,
        details_box=details
    )

    return send_email_sync(to_email, subject, plain_body, html_body)

def send_event_reminder_email(
    to_email: str,
    recipient_name: str,
    event_title: str,
    reminder_type: str,
    start_time_str: Optional[str] = None,
    venue: Optional[str] = None,
    ticket_url: Optional[str] = None,
    custom_message: Optional[str] = None,
    unsubscribe_url: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """Sends event reminder (e.g. 24h, 1h, custom) (Non-essential/respects opt-out)."""
    label = "Event Reminder"
    if reminder_type == "24h_before":
        label = "Starting Tomorrow"
    elif reminder_type == "1h_before":
        label = "Starting in 1 Hour"

    subject = f"Reminder: {event_title} is {label.lower()}!"

    plain_body = f"""Hello {recipient_name},

This is a reminder that {event_title} is {label.lower()}!

{f"Schedule: {start_time_str}" if start_time_str else ""}
{f"Venue: {venue}" if venue else ""}
{f"Note: {custom_message}" if custom_message else ""}

Have your digital QR ticket pass ready for admission:
{ticket_url or ''}

Best regards,
EVENTIVA Team
"""

    details = {"Event": event_title}
    if start_time_str:
        details["Date & Time"] = start_time_str
    if venue:
        details["Venue"] = venue

    body_list = [
        f"Hello {recipient_name},",
        f"We're excited to see you soon! <strong>{event_title}</strong> is {label.lower()}."
    ]
    if custom_message:
        body_list.append(f"<div style='background-color: #f1f5f9; padding: 12px 16px; border-radius: 8px; font-style: italic;'>\"{custom_message}\"</div>")
    body_list.append("Please make sure you have your digital ticket QR code ready on your phone when arriving.")

    html_body = build_branded_html(
        header_subtitle="Automated Event Reminder",
        headline=f"{event_title} is {label.lower()}!",
        body_paragraphs=body_list,
        badge_text=label,
        badge_color="#4f46e5",
        action_button={"label": "Open Ticket Pass", "url": ticket_url} if ticket_url else None,
        details_box=details,
        unsubscribe_url=unsubscribe_url
    )

    return send_email_sync(to_email, subject, plain_body, html_body)
