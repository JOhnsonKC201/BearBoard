import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from core.config import SMTP_FROM, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER

logger = logging.getLogger("bearboard.email")


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning(
            "SMTP not configured — skipping email to %s. Reset link: %s",
            to_email,
            reset_link,
        )
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your BearBoard password"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email

    text = (
        f"Hi,\n\n"
        f"Click the link below to reset your BearBoard password. "
        f"It expires in 1 hour.\n\n"
        f"{reset_link}\n\n"
        f"If you didn't request this, you can safely ignore this email.\n\n"
        f"— The BearBoard Team"
    )
    html = f"""<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #ddd;padding:32px">
    <div style="font-size:1.4rem;font-weight:900;letter-spacing:-0.5px;margin-bottom:24px">
      <span style="background:#0B1D34;color:#fff;padding:4px 10px">BEAR</span><span style="background:#FFD66B;color:#0B1D34;padding:4px 10px">BOARD</span>
    </div>
    <h2 style="margin:0 0 12px;color:#0B1D34;font-size:1.2rem">Reset your password</h2>
    <p style="color:#555;font-size:0.9rem;line-height:1.6;margin-bottom:24px">
      Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
    </p>
    <a href="{reset_link}"
       style="display:inline-block;background:#0B1D34;color:#fff;text-decoration:none;
              font-weight:700;font-size:0.85rem;letter-spacing:0.05em;text-transform:uppercase;
              padding:14px 28px">
      Reset Password
    </a>
    <p style="color:#999;font-size:0.75rem;margin-top:28px">
      If you didn't request this, you can safely ignore this email.
    </p>
  </div>
</body>
</html>"""

    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM, to_email, msg.as_string())
    logger.info("Password reset email sent to %s", to_email)
