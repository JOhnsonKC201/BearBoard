from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    DateTime,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


# Reason categories surfaced to the user. Kept lowercase + alphanumeric so the
# slugs can flow straight to/from the UI without a separate label table. New
# categories should be appended (never reordered) so historical reports
# remain readable.
REPORT_REASONS = (
    "spam",
    "harassment",
    "hate",
    "misinformation",
    "inappropriate",
    "other",
)

# Lifecycle of a report row:
#   pending   — filed, awaiting moderator review
#   dismissed — reviewed, no action taken (false alarm / not policy-violating)
#   actioned  — reviewed, post deleted or author warned
REPORT_STATUSES = ("pending", "dismissed", "actioned")


class Report(Base):
    """A user-filed complaint about a post.

    Why we keep these as their own table rather than a flag on Post:
      - Multiple users can independently report the same post; we want to
        surface that volume to mods (e.g. "5 reports for Hate") rather than
        collapse it.
      - We retain reporter_id for moderation context, but never expose it to
        non-mod viewers — public reads only see aggregate counts via the
        admin queue.
      - Actioned/dismissed rows stay in the table for audit. A separate
        retention job can prune older-than-N-days dismissed rows later.
    """
    __tablename__ = "post_reports"
    __table_args__ = (
        # One reporter, one report per post — prevents a single bad actor
        # from inflating the volume on a post they dislike.
        UniqueConstraint("post_id", "reporter_id", name="uq_post_reports_unique"),
        # Mods scan by status (pending first); index it for fast queue reads.
        Index("ix_post_reports_status_created", "status", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(
        Integer,
        ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    reason = Column(String(40), nullable=False)
    note = Column(Text, nullable=True)
    status = Column(
        String(20),
        nullable=False,
        default="pending",
        server_default="pending",
    )
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    # Free-form action tag set when the report is closed: 'dismissed',
    # 'post_deleted', 'warning_issued', etc. Lets the admin queue render a
    # short summary without joining other tables.
    resolution = Column(String(40), nullable=True)

    post = relationship("Post")
    reporter = relationship("User", foreign_keys=[reporter_id])
    resolver = relationship("User", foreign_keys=[resolved_by])
