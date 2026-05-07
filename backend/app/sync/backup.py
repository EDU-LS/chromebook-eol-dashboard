"""Weekly database backup — runs pg_dump, gzips, keeps last N copies."""

import gzip
import logging
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

BACKUP_DIR    = Path(os.getenv("BACKUP_DIR", "/backups"))
RETAIN_COUNT  = int(os.getenv("BACKUP_RETAIN_COUNT", "4"))


def _pg_url(database_url: str) -> str:
    """Strip asyncpg dialect so pg_dump accepts the URL."""
    return database_url.replace("postgresql+asyncpg://", "postgresql://")


async def run_backup(database_url: str) -> None:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M")
    dest = BACKUP_DIR / f"chromebook_eol_{timestamp}.sql.gz"

    logger.info("Starting weekly database backup → %s", dest)
    try:
        result = subprocess.run(
            ["pg_dump", "--no-password", _pg_url(database_url)],
            capture_output=True,
            check=True,
        )
        with gzip.open(dest, "wb") as fh:
            fh.write(result.stdout)

        size_kb = dest.stat().st_size // 1024
        logger.info("Backup complete: %s (%d KB)", dest.name, size_kb)

        # Prune old backups — keep newest RETAIN_COUNT files
        backups = sorted(BACKUP_DIR.glob("chromebook_eol_*.sql.gz"))
        for old in backups[:-RETAIN_COUNT]:
            old.unlink()
            logger.info("Pruned old backup: %s", old.name)

    except subprocess.CalledProcessError as exc:
        logger.error("pg_dump failed: %s", exc.stderr.decode(errors="replace"))
    except Exception as exc:
        logger.error("Backup error: %s", exc)
