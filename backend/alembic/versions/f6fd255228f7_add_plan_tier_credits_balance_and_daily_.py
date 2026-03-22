"""add plan_tier credits_balance and daily_usage

Revision ID: f6fd255228f7
Revises: a001_baseline
Create Date: 2026-03-20 23:23:44.578590

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f6fd255228f7'
down_revision: Union[str, Sequence[str], None] = 'a001_baseline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add rate-limiting columns to users and create daily_usage table."""
    op.create_table(
        'daily_usage',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('bucket_start_utc', sa.DateTime(timezone=True), nullable=False),
        sa.Column('units_used', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'bucket_start_utc', name='uq_daily_usage_user_bucket'),
    )
    op.create_index(op.f('ix_daily_usage_user_id'), 'daily_usage', ['user_id'], unique=False)

    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'sqlite':
        existing = {
            row[1]
            for row in bind.execute(sa.text("PRAGMA table_info(users)")).fetchall()
        }
        if 'plan_tier' not in existing:
            op.add_column(
                'users',
                sa.Column('plan_tier', sa.String(), server_default='free', nullable=False),
            )
        if 'credits_balance' not in existing:
            op.add_column(
                'users',
                sa.Column('credits_balance', sa.Integer(), server_default='0', nullable=False),
            )
    else:
        op.add_column(
            'users',
            sa.Column('plan_tier', sa.String(), server_default='free', nullable=False),
        )
        op.add_column(
            'users',
            sa.Column('credits_balance', sa.Integer(), server_default='0', nullable=False),
        )


def downgrade() -> None:
    """Remove rate-limiting columns and table."""
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect != 'sqlite':
        op.drop_column('users', 'credits_balance')
        op.drop_column('users', 'plan_tier')

    op.drop_index(op.f('ix_daily_usage_user_id'), table_name='daily_usage')
    op.drop_table('daily_usage')
