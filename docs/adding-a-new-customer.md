# Adding a New Customer to the Chromebook EOL Dashboard

> **Who is this for?** Anyone onboarding a new Google Workspace for Education customer onto the Eduthing Chromebook EOL Dashboard.
> **Time required:** ~10 minutes (plus waiting for the customer's IT admin to complete their step)

---

## Before You Start

Make sure you have the following information from the customer:

| Detail | Example |
|--------|---------|
| School / organisation name | Greenfield Academy |
| Google Workspace domain | greenfield.org.uk |
| Email of their Google Super Admin | admin@greenfield.org.uk |
| Google customer ID *(optional — leave blank if unsure)* | C03xyz123 |
| Agreed device replacement cost *(optional — defaults to £299)* | £349 |

> **What is a Super Admin?** A user in the customer's Google Workspace with full administrator access. If they're unsure who this is, they can check at **admin.google.com → Account → Admins**.

---

## Step 1 — Sign in to the Dashboard

1. Open your browser and go to **http://cbeol.eduthing.co.uk:8090**
2. Sign in with your Eduthing credentials

---

## Step 2 — Add the Customer

1. Click **⚙️ Customers** in the left sidebar
2. Click into the **Add customer** form at the top of the page
3. Fill in the fields:

   - **Customer name** — the school or organisation name
   - **Google Workspace domain** — their domain (e.g. `greenfield.org.uk`)
   - **Admin email for DWD** — the Super Admin's email address
   - **Google customer ID** — leave as `my_customer` if you don't have it
   - **Replacement cost per device (£)** — agreed cost, or leave as £299.00
   - **Notes** — any internal notes (optional)

4. Click **Add customer**

The customer will now appear in the list with a status of **Never synced**.

---

## Step 3 — Send Setup Instructions to the Customer's IT Admin

The customer's Google Super Admin needs to grant Eduthing permission to read their Chromebook data. This is called **Domain-Wide Delegation (DWD)** and takes about 2 minutes on their end.

Send them the following instructions:

---

> **Email template — copy and send to the customer's IT admin:**
>
> Hi [Name],
>
> To connect your Google Workspace to the Eduthing Chromebook EOL Dashboard, please follow these steps:
>
> 1. Sign in to **admin.google.com** as a Super Admin
> 2. Navigate to: **Security → Access and data control → API controls**
> 3. Click **Manage Domain Wide Delegation**
> 4. Click **Add new**
> 5. Enter the following details exactly:
>
>    **Client ID:**
>    ```
>    [Paste your service account Client ID here — found in GCP console]
>    ```
>
>    **OAuth Scopes:**
>    ```
>    https://www.googleapis.com/auth/admin.directory.device.chromeos.readonly,https://www.googleapis.com/auth/admin.directory.device.chromeos
>    ```
>
> 6. Click **Authorise**
>
> That's everything — please let me know once done and we'll run the first sync.
>
> Thanks,
> [Your name]

---

> **Where do I find the Client ID?**
> Go to **console.cloud.google.com → IAM & Admin → Service Accounts**, select the Eduthing service account, and copy the **Unique ID** (the long number). This is the Client ID.

---

## Step 4 — Wait for Confirmation

Once the customer's IT admin has completed Step 3, move on. You don't need to do anything else on their end.

---

## Step 5 — Run the First Sync

1. Go back to **⚙️ Customers** in the dashboard
2. Find the customer you just added
3. Click on their name to open their detail page
4. Click the **Sync customer** button in the top right

The sync will pull all their Chromebook devices from Google and calculate EOL dates. Depending on device count this takes anywhere from **a few seconds to around a minute**.

When complete the status will show as **success** with a green dot and the current timestamp.

---

## Step 6 — Verify the Data

Once synced, check the following on the customer's detail page:

- [ ] Device count looks roughly correct
- [ ] EOL dates are showing (if blank for all devices, DWD may not be set up correctly)
- [ ] No error message in the **Recent syncs** table at the bottom

If the sync shows **failed**, check the error message in Recent syncs — the most common cause is the IT admin entering the wrong Client ID or scopes.

---

## Troubleshooting

### Sync fails with "403" or "access denied"
The DWD hasn't been set up correctly. Ask the IT admin to double-check:
- They used the correct **Client ID** (the long numeric Unique ID, not the email address)
- They pasted the **OAuth Scopes** exactly as provided (comma-separated, no spaces)
- They clicked **Authorise** (not just closed the window)

### No devices showing after a successful sync
- The admin email entered may not be a Super Admin — DWD impersonation requires Super Admin privileges
- Try updating the customer's admin email to a confirmed Super Admin and syncing again

### "Domain already exists" error when adding
That domain has already been added. Use the search box on the Customers page to find it.

### Need to update customer details later?
Click **Edit** next to the customer on the Customers page. You can update the admin email, replacement cost, notes, or customer ID at any time.

---

## Bulk Adding Multiple Customers

If you have several customers to add at once, use the **📥 Import CSV** button on the Customers page instead of adding them one by one.

1. Click **Import CSV** → **⬇ Download template**
2. Open the template in Excel and fill in one row per customer
3. Save as CSV and upload it back using the same Import CSV button
4. The dashboard will report how many were added, skipped, or errored

---

*Guide written for Eduthing internal use · Last updated May 2026*
