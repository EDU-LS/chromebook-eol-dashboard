# Chromebook EOL Dashboard — Setup & Operations Guide

> **Internal tool built for Eduthing MSP**
> Tracks Chromebook Auto Update Expiration (AUE) dates across all Google Workspace for Education customers. Surfaces pipeline value for sales and flags devices approaching end-of-life.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Infrastructure](#infrastructure)
4. [Services](#services)
5. [Environment Variables](#environment-variables)
6. [User Accounts](#user-accounts)
7. [Accessing the Dashboard](#accessing-the-dashboard)
8. [CI/CD Pipeline](#cicd-pipeline)
9. [Deploying / Updating](#deploying--updating)
10. [Adding a New Customer](#adding-a-new-customer)
11. [How the Sync Works](#how-the-sync-works)
12. [Database](#database)
13. [Security Notes](#security-notes)
14. [Troubleshooting](#troubleshooting)

---

## Overview

The dashboard connects to each customer's Google Workspace via a **single Eduthing service account** using Domain-Wide Delegation (DWD). It calls the **Chrome Management API** to pull a list of all Chromebook devices, cross-references them against Google's AUE date database, and stores the results in PostgreSQL.

A nightly sync runs at **02:00 UTC** automatically. Manual syncs can be triggered from the dashboard at any time.

**What it shows:**
- Total active / expired / expiring devices per customer
- Pipeline value (expiring devices × replacement cost)
- Per-device detail (serial, model, EOL date, user, location, org unit)
- Sales team ideas board
- Admin audit log (LSpencer only)

---

## Architecture

```
Browser
  │
  ▼
Caddy (reverse proxy)          ← port 8090 on host
  ├── /api/*  →  FastAPI (Python)
  └── /*      →  React (Vite + Tailwind)
                    │
                    ├── PostgreSQL 16
                    └── Worker (APScheduler nightly sync)
```

All containers communicate over internal Docker networks. Only Caddy is exposed externally.

---

## Infrastructure

| Item | Value |
|------|-------|
| Host server | `10.10.8.88` (internal) |
| Host port | `8090` |
| Internal URL | `http://10.10.8.88:8090` |
| DNS record | `cbeol.eduthing.co.uk` → `10.10.8.88` |
| Access URL | `http://cbeol.eduthing.co.uk:8090` |
| Container manager | Portainer (web UI) |
| GCP project | `chromebook-eol-dashboard` |

> **Note:** Port 80 on the host is occupied by another service (OOH scheduler). The `:8090` suffix is required until that is moved.

---

## Services

Five Docker containers managed as a single Portainer stack:

| Service | Image | Purpose |
|---------|-------|---------|
| `caddy` | `ghcr.io/edu-ls/chromebook-eol-dashboard-caddy` | Reverse proxy — routes `/api/*` to backend, everything else to frontend |
| `frontend` | `ghcr.io/edu-ls/chromebook-eol-dashboard-frontend` | React SPA (Vite + Tailwind + React Query + Recharts) |
| `api` | `ghcr.io/edu-ls/chromebook-eol-dashboard-api` | FastAPI backend — REST API, JWT auth, Google API calls |
| `worker` | `ghcr.io/edu-ls/chromebook-eol-dashboard-worker` | APScheduler — runs nightly sync at 02:00 UTC |
| `db` | `postgres:16-alpine` | PostgreSQL database |

All images are hosted publicly on **GitHub Container Registry (ghcr.io)** under the `EDU-LS` organisation.

---

## Environment Variables

Set in **Portainer → Stack → Environment variables**.

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_USER` | ✅ | PostgreSQL username |
| `DB_PASSWORD` | ✅ | PostgreSQL password |
| `SECRET_KEY` | ✅ | JWT signing secret (long random string) |
| `SERVICE_ACCOUNT_B64` | ✅ | Eduthing GCP service account JSON, base64 encoded |
| `AUTH_USERNAME` | ✅ | Admin account username (default: `Eduthing`) |
| `AUTH_PASSWORD` | ✅ | Admin account password — changing this and redeploying updates the password |
| `SYNC_HOUR` | ❌ | Hour to run nightly sync in UTC (default: `2`) |
| `SYNC_MINUTE` | ❌ | Minute to run nightly sync (default: `0`) |

### Encoding the service account key

```powershell
# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\service-account.json"))
```

```bash
# Linux / Mac
base64 -w 0 service-account.json
```

Paste the output as the value of `SERVICE_ACCOUNT_B64`.

---

## User Accounts

Users are stored in the database and seeded automatically on container startup. Passwords are bcrypt hashed.

| Username | Notes |
|----------|-------|
| `Eduthing` | Primary admin. Password is read from `AUTH_PASSWORD` env var on every startup — change the env var and redeploy to update it |
| `LSpencer` | Standard user. Has access to the **Audit log** page |
| `HCripps` | Standard user |

> **LSpencer and HCripps passwords:** stored in `backend/app/main.py` as seeded values. To change them, update the `SEED_USERS` list in that file and redeploy.

---

## Accessing the Dashboard

1. Navigate to `http://cbeol.eduthing.co.uk:8090`
2. Sign in with your username and password
3. The **🔍 Audit log** sidebar link is only visible when signed in as `LSpencer`

---

## CI/CD Pipeline

**GitHub repository:** `https://github.com/EDU-LS/chromebook-eol-dashboard`
*(Repository is public — no secrets are stored in code)*

### Build workflow

Any push to `main` triggers **GitHub Actions** (`.github/workflows/build.yml`) which:

1. Builds 4 Docker images: `api`, `worker`, `frontend`, `caddy`
2. Pushes them to `ghcr.io/edu-ls/chromebook-eol-dashboard-*:latest`

Build takes approximately **2–4 minutes**.

### Deployment

Portainer is configured to pull from the GitHub repository for stack configuration. After a build completes:

1. Go to **Portainer → Stacks → chromebook-eol-dashboard**
2. Click **Update the stack**
3. Tick **Re-pull image**
4. Click **Update**

> If images appear to be cached and not updating, go to **Portainer → Images**, stop the stack first, remove the old image, then redeploy.

---

## Adding a New Customer

### Step 1 — Get details from the customer

You need:
- Customer / school name
- Google Workspace domain (e.g. `school.org.uk`)
- Email address of a **Super Admin** in their Workspace
- Their Google customer ID (usually leave as `my_customer`)
- Agreed device replacement cost (default £299)

### Step 2 — Add them in the dashboard

1. Go to **⚙️ Customers** in the sidebar
2. Fill in the form and click **Add customer**

### Step 3 — Customer sets up Domain-Wide Delegation

The customer's Google Super Admin needs to authorise Eduthing's service account in their Admin console:

1. Go to [admin.google.com](https://admin.google.com)
2. Navigate to: **Security → Access and data control → API controls → Domain-wide delegation**
3. Click **Add new**
4. Enter the following:

**Client ID:**
```
[Your service account Client ID — found in GCP console → Service accounts → Keys]
```

**OAuth Scopes:**
```
https://www.googleapis.com/auth/admin.directory.device.chromeos.readonly,https://www.googleapis.com/auth/admin.directory.device.chromeos
```

5. Click **Authorise**

### Step 4 — Trigger a sync

Back in the dashboard, go to the customer's row and click **Sync**. First sync typically takes 10–60 seconds depending on device count.

---

## How the Sync Works

```
Trigger (manual button or 02:00 UTC nightly)
  │
  ▼
For each active tenant (up to 5 concurrent):
  │
  ├── Load service account from SERVICE_ACCOUNT_B64
  ├── Impersonate customer's Super Admin via DWD
  ├── Call Google Chrome Management API → chromeosdevices.list (paginated)
  ├── Parse AUE date (handles epoch ms and ISO formats)
  └── Upsert devices to PostgreSQL (INSERT ON CONFLICT DO UPDATE)
       └── Updates: model, org unit, status, EOL date, user, location, OS version
```

### Sync statuses

| Status | Meaning |
|--------|---------|
| `never` | Customer added but never synced |
| `running` | Sync currently in progress (amber pulse) |
| `success` | Last sync completed successfully |
| `failed` | Last sync errored — check sync logs on the customer detail page |

---

## Database

**Engine:** PostgreSQL 16
**Database name:** `chromebook_eol`

### Tables

| Table | Description |
|-------|-------------|
| `tenants` | Customer records (name, domain, DWD config, replacement cost) |
| `devices` | All Chromebook devices, one row per device per tenant |
| `sync_logs` | History of every sync run with status and device count |
| `users` | Dashboard user accounts with bcrypt hashed passwords |
| `suggestions` | Ideas posted by the team on the Ideas board |
| `suggestion_comments` | Replies to ideas |
| `audit_logs` | All user activity (logins, customer changes, syncs) |

Data is persisted in a named Docker volume (`postgres_data`) and survives container restarts and redeployments.

### Backup

No automated backup is currently configured. To manually dump the database:

```bash
docker exec <db-container-id> pg_dump -U <DB_USER> chromebook_eol > backup.sql
```

---

## Security Notes

- All passwords are **bcrypt hashed** — never stored in plain text
- JWT tokens expire after **8 hours**
- The service account JSON is never stored on disk — passed as a base64 env var
- The Audit log endpoint (`/api/audit`) returns **403** for all users except `LSpencer`
- CORS is currently open (`*`) — acceptable for internal-only deployment
- The repo is **public on GitHub** but contains no secrets — all credentials are in Portainer env vars
- Rate limiting on the login endpoint is not currently implemented

### GCP Service Account

| Item | Value |
|------|-------|
| Project | `chromebook-eol-dashboard` |
| Key file | `chromebook-eol-dashboard-*.json` (stored locally, not in repo) |
| Required APIs | Admin SDK API, Chrome Management API |
| DWD scopes | `admin.directory.device.chromeos.readonly`, `admin.directory.device.chromeos` |

---

## Troubleshooting

### App won't start / startup error in API logs

Check for:
- Missing env vars (especially `AUTH_PASSWORD`, `SECRET_KEY`, `SERVICE_ACCOUNT_B64`)
- DB not healthy — the API waits for Postgres but if it never becomes healthy the stack fails

### Login says "Incorrect username or password"

- Confirm the latest image has been pulled (not a cached old version)
- Check API startup logs for `Seeded user: LSpencer` — if missing, seeding failed
- For the `Eduthing` account: verify `AUTH_PASSWORD` is set correctly in Portainer

### Sync fails for a customer

Go to **Customer detail → Recent syncs** and check the error message. Common causes:
- DWD not set up correctly → `403` from Google API
- Wrong admin email → impersonation fails
- Admin SDK API not enabled in GCP → `accessNotConfigured` error
- Customer's admin email is not a Super Admin

### Portainer not pulling new image

1. Stop the stack
2. Go to **Images** → remove the old `api`/`frontend` image
3. Start the stack — it will pull fresh from ghcr.io

### Check if new image is actually running

Look at the top of the API container logs. The new code logs:
```
Seeded user: LSpencer
Seeded user: HCripps
```
If you see `pwd_context.hash` in a traceback, the old image is still running.

---

*Last updated: May 2026 — Built by LS @ EDU*
