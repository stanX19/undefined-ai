"""baseline schema — all tables before rate-limiting additions.

Revision ID: a001_baseline
Revises: (none)
Create Date: 2026-03-20 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a001_baseline'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the original application schema (pre-rate-limiting)."""
    op.create_table(
        'users',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('username', sa.String(), nullable=True),
        sa.Column('education_level', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('user_id'),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # topics is created WITHOUT the current_scene_id FK — that FK is
    # added after scenes exists (circular dependency via use_alter).
    op.create_table(
        'topics',
        sa.Column('topic_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('difficulty_level', sa.Integer(), nullable=True),
        sa.Column('document_text', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('current_scene_id', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id']),
        sa.PrimaryKeyConstraint('topic_id'),
    )

    op.create_table(
        'scenes',
        sa.Column('scene_id', sa.String(), nullable=False),
        sa.Column('topic_id', sa.String(), nullable=False),
        sa.Column('parent_scene_id', sa.String(), nullable=True),
        sa.Column('ui_markdown', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['parent_scene_id'], ['scenes.scene_id']),
        sa.ForeignKeyConstraint(['topic_id'], ['topics.topic_id']),
        sa.PrimaryKeyConstraint('scene_id'),
    )
    op.create_index(op.f('ix_scenes_topic_id'), 'scenes', ['topic_id'], unique=False)

    # Deferred FK: topics.current_scene_id → scenes.scene_id
    # SQLite does not support ALTER TABLE … ADD CONSTRAINT; the FK is
    # already declared in the ORM model and enforced at app level.
    bind = op.get_bind()
    if bind.dialect.name != 'sqlite':
        op.create_foreign_key(
            'fk_topic_scene', 'topics', 'scenes',
            ['current_scene_id'], ['scene_id'],
        )

    op.create_table(
        'atomic_facts',
        sa.Column('fact_id', sa.String(), nullable=False),
        sa.Column('topic_id', sa.String(), nullable=False),
        sa.Column('parent_fact_id', sa.String(), nullable=True),
        sa.Column('level', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('source_chunk_id', sa.String(), nullable=True),
        sa.Column('source_start', sa.Integer(), nullable=True),
        sa.Column('source_end', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['parent_fact_id'], ['atomic_facts.fact_id']),
        sa.ForeignKeyConstraint(['source_chunk_id'], ['atomic_facts.fact_id']),
        sa.ForeignKeyConstraint(['topic_id'], ['topics.topic_id']),
        sa.PrimaryKeyConstraint('fact_id'),
    )

    op.create_table(
        'chat_history',
        sa.Column('message_id', sa.String(), nullable=False),
        sa.Column('topic_id', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['topic_id'], ['topics.topic_id']),
        sa.PrimaryKeyConstraint('message_id'),
    )

    op.create_table(
        'shares',
        sa.Column('share_id', sa.String(), nullable=False),
        sa.Column('scene_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['scene_id'], ['scenes.scene_id']),
        sa.PrimaryKeyConstraint('share_id'),
    )
    op.create_index(op.f('ix_shares_scene_id'), 'shares', ['scene_id'], unique=True)

    op.create_table(
        'topic_progress',
        sa.Column('progress_id', sa.String(), nullable=False),
        sa.Column('topic_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('last_fact_id', sa.String(), nullable=True),
        sa.Column('last_accessed', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['last_fact_id'], ['atomic_facts.fact_id']),
        sa.ForeignKeyConstraint(['topic_id'], ['topics.topic_id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id']),
        sa.PrimaryKeyConstraint('progress_id'),
    )


def downgrade() -> None:
    """Drop all baseline tables."""
    # Drop deferred FK first
    bind = op.get_bind()
    if bind.dialect.name != 'sqlite':
        op.drop_constraint('fk_topic_scene', 'topics', type_='foreignkey')

    op.drop_index(op.f('ix_shares_scene_id'), table_name='shares')
    op.drop_table('shares')
    op.drop_table('topic_progress')
    op.drop_table('chat_history')
    op.drop_table('atomic_facts')
    op.drop_index(op.f('ix_scenes_topic_id'), table_name='scenes')
    op.drop_table('scenes')
    op.drop_table('topics')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
