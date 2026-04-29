"""professor rating overhaul: 5 sub-metrics + the intel + structured recommendation

The old ProfessorRating had a single 1-5 score plus difficulty plus a free-text
comment. That's not enough signal for students choosing a section. Modeled
roughly on RateMyProfessor + RateYourProf — every new column is nullable so
the existing reviews still load (and so users on the new form can skip
sections they don't have an opinion on).

5-axis breakdown (all 1-5 nullable):
  clarity, engagement, accessibility, fairness, exam_prep_quality

Course context:
  course_title, semester, grade_received

"The Intel" — practical stuff the next student needs to know:
  attendance_policy ('required' | 'not_required' | 'recommended')
  quiz_type         ('none' | 'scheduled' | 'pop' | 'both')
  exam_types        (TEXT JSON list — multi-select)
  curves            ('never' | 'as_needed' | 'always')

Class shape:
  workload     ('light' | 'moderate' | 'heavy')
  class_format ('in_person' | 'hybrid' | 'online')
  class_size   ('small' | 'medium' | 'large')

Recommendation (4-tier — preserves the boolean would_take_again on the model
since the aggregator already uses it; the new ENUM-shaped string column is
what the form binds to):
  recommendation ('absolutely_yes' | 'yes' | 'only_if_no_choice' | 'never')

Written review (split from the prior single `comment` field — RateYourProf
proved that asking three focused prompts gets better content than one open
"comments" textarea):
  best_aspects, areas_for_improvement, advice

Revision ID: i3c4d5e6f7g8
Revises: h2b3c4d5e6f7
Create Date: 2026-04-29 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'i3c4d5e6f7g8'
down_revision: Union[str, Sequence[str], None] = 'h2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_COLUMNS = [
    # 5-axis sub-metrics (1-5)
    ("clarity", sa.Integer()),
    ("engagement", sa.Integer()),
    ("accessibility", sa.Integer()),
    ("fairness", sa.Integer()),
    ("exam_prep_quality", sa.Integer()),
    # Course context
    ("course_title", sa.String(length=200)),
    ("semester", sa.String(length=30)),
    ("grade_received", sa.String(length=5)),
    # The intel
    ("attendance_policy", sa.String(length=20)),
    ("quiz_type", sa.String(length=20)),
    ("exam_types", sa.Text()),         # JSON list
    ("curves", sa.String(length=20)),
    # Class shape
    ("workload", sa.String(length=20)),
    ("class_format", sa.String(length=20)),
    ("class_size", sa.String(length=20)),
    # Recommendation
    ("recommendation", sa.String(length=30)),
    # Written review
    ("best_aspects", sa.Text()),
    ("areas_for_improvement", sa.Text()),
    ("advice", sa.Text()),
]


def upgrade() -> None:
    for name, col_type in NEW_COLUMNS:
        op.add_column("professor_ratings", sa.Column(name, col_type, nullable=True))


def downgrade() -> None:
    for name, _ in reversed(NEW_COLUMNS):
        op.drop_column("professor_ratings", name)
