"""Google Admin SDK client with domain-wide delegation support."""

import logging
from datetime import datetime, timezone
from typing import Optional

from google.auth.exceptions import GoogleAuthError
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/admin.directory.device.chromeos.readonly",
]


def get_delegated_credentials(
    service_account_file: str,
    subject: str,
) -> service_account.Credentials:
    """
    Load the Eduthing service account and delegate to `subject` (a Super Admin
    in the target Workspace). The customer's Google Admin must have granted
    DWD access to this service account's client ID.
    """
    creds = service_account.Credentials.from_service_account_file(
        service_account_file,
        scopes=SCOPES,
    )
    return creds.with_subject(subject)


def list_chrome_devices(
    credentials: service_account.Credentials,
    customer_id: str = "my_customer",
) -> list[dict]:
    """
    Fetch all Chrome OS devices for a customer via the Admin SDK Directory API.
    Handles pagination automatically.

    Raises GoogleAuthError / HttpError on failure — caller should catch and log.
    """
    service = build(
        "admin", "directory_v1",
        credentials=credentials,
        cache_discovery=False,  # avoid file-system cache issues in containers
    )

    devices: list[dict] = []
    page_token: Optional[str] = None

    while True:
        response = (
            service.chromeosdevices()
            .list(
                customerId=customer_id,
                projection="FULL",
                maxResults=200,
                pageToken=page_token,
            )
            .execute()
        )
        batch = response.get("chromeosdevices", [])
        devices.extend(batch)
        logger.debug("Fetched %d devices (total so far: %d)", len(batch), len(devices))

        page_token = response.get("nextPageToken")
        if not page_token:
            break

    return devices


def parse_aue_date(raw: Optional[str]) -> Optional[datetime]:
    """
    Parse the autoUpdateExpiration value from the API.

    Google returns this as either:
      - epoch milliseconds as a string (older API behaviour)
      - ISO 8601 timestamp string (newer behaviour)
      - "0" or empty when unknown
    """
    if not raw or raw in ("0", ""):
        return None

    # Epoch ms — distinguishable by being a long digit string
    if raw.isdigit() and len(raw) > 10:
        try:
            return datetime.fromtimestamp(int(raw) / 1000, tz=timezone.utc)
        except (ValueError, OSError):
            return None

    # ISO 8601 variants
    for fmt in (
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S.%f+00:00",
        "%Y-%m-%d",
    ):
        try:
            dt = datetime.strptime(raw, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    logger.warning("Could not parse AUE date: %r", raw)
    return None


def parse_google_datetime(raw: Optional[str]) -> Optional[datetime]:
    """Parse standard Google API datetime strings (RFC 3339)."""
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None
