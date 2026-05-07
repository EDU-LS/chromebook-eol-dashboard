#!/usr/bin/env python3
"""
Quick CLI to add a tenant directly to the database.
Run once per customer when they grant DWD access.

Usage:
    python scripts/add_tenant.py \
        --name "Anytown Academy" \
        --domain "anytownacademy.org.uk" \
        --admin "admin@anytownacademy.org.uk"

Optional flags:
    --cost 349.00          (default 299.00)
    --customer-id C0abc123 (default: my_customer)
    --notes "Contact: IT dept"
"""

import argparse
import asyncio
import os
import sys
from decimal import Decimal

# Allow running from repo root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://chromebook_eol:change_me_strong_password@localhost:5432/chromebook_eol",
)


async def main(args):
    from backend.app.models import Base, Tenant  # noqa: import after path fix

    engine = create_async_engine(DATABASE_URL)
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        existing = await session.execute(select(Tenant).where(Tenant.domain == args.domain))
        if existing.scalar_one_or_none():
            print(f"Tenant {args.domain} already exists — use the web UI to update.")
            return

        tenant = Tenant(
            name=args.name,
            domain=args.domain,
            admin_email=args.admin,
            customer_id=args.customer_id,
            device_replacement_cost=Decimal(args.cost),
            notes=args.notes,
        )
        session.add(tenant)
        await session.commit()
        await session.refresh(tenant)
        print(f"Added tenant: {tenant.name} ({tenant.domain}) — id={tenant.id}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Add an Eduthing customer tenant")
    parser.add_argument("--name", required=True)
    parser.add_argument("--domain", required=True)
    parser.add_argument("--admin", required=True, dest="admin")
    parser.add_argument("--cost", default="299.00")
    parser.add_argument("--customer-id", default="my_customer", dest="customer_id")
    parser.add_argument("--notes", default=None)
    asyncio.run(main(parser.parse_args()))
