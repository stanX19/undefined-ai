"""add document_filename to topics

Revision ID: g001_add_document_filename
Revises: f6fd255228f7
Create Date: 2026-04-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'g001_add_document_filename'
down_revision: Union[str, Sequence[str], None] = 'f6fd255228f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'sqlite':
        existing = {
            row[1]
            for row in bind.execute(sa.text("PRAGMA table_info(topics)")).fetchall()
        }
        if 'document_filename' not in existing:
            op.add_column(
                'topics',
                sa.Column('document_filename', sa.String(), nullable=True),
            )
    else:
        op.add_column(
            'topics',
            sa.Column('document_filename', sa.String(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'sqlite':
        with op.batch_alter_table('topics') as batch_op:
            batch_op.drop_column('document_filename')
    else:
        op.drop_column('topics', 'document_filename')
