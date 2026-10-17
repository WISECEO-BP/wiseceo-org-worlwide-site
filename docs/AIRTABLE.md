# Website forms → Airtable

The contact form and the newsletter sign-up forms save to Airtable through two
Vercel serverless functions. The Airtable token lives only in Vercel's
environment variables; it is never sent to the browser.

| Form | Endpoint | What it writes |
|---|---|---|
| Contact (`/contact.html`) | `POST /api/contact` | Upserts the sender in **Website Contacts** (matched on Email), adds a row to **Website Messages** linked to them. Web3Forms still emails the team as before. |
| Newsletter (`/newsletter.html` ×2, `/contact.html`) | `POST /api/subscribe` | Upserts the subscriber in **Website Contacts** with **Newsletter** checked. Also subscribes them on beehiiv if beehiiv keys are set. |

Every record also captures the **Language** the visitor was reading the site in
(from the language selector), so staff can reply in that language.

## Which base

Add the two tables to the **Individual and corporate donations** base in the
*Funders & Grants* workspace. That base is already the supporter CRM, so
newsletter subscribers, volunteers, donors and partners land next to each other
and can be linked to gifts later. The *WISECEO Social Media Scheduler* is a
content calendar; contact records would not fit its tables.

Any base works: the code only needs the base ID and the two table names.

## One-time setup

1. **Create a token** at <https://airtable.com/create/tokens>
   - Scopes: `data.records:read`, `data.records:write` (add `schema.bases:read`
     and `schema.bases:write` only if you will run step 2's script)
   - Access: just the base you chose
2. **Create the tables** — either run the script from the repo root:
   ```sh
   AIRTABLE_TOKEN=pat... AIRTABLE_BASE_ID=app... node scripts/airtable-setup.mjs
   ```
   or build them by hand using the field list below. Field names must match exactly.
3. **Add environment variables in Vercel** (Project → Settings → Environment Variables),
   for Production and Preview, then redeploy:

   | Variable | Value |
   |---|---|
   | `AIRTABLE_TOKEN` | the token from step 1 |
   | `AIRTABLE_BASE_ID` | starts with `app…` (from the base URL) |
   | `AIRTABLE_CONTACTS_TABLE` | optional, default `Website Contacts` |
   | `AIRTABLE_MESSAGES_TABLE` | optional, default `Website Messages` |
   | `BEEHIIV_API_KEY` | optional — beehiiv Settings → API |
   | `BEEHIIV_PUBLICATION_ID` | optional — starts with `pub_` |

4. **Test** on the deployed site: send a contact message and sign up for the
   newsletter, then check both tables.

## Tables and fields

**Website Contacts** — one row per email address

| Field | Type | Set by |
|---|---|---|
| Email *(primary)* | Email | both forms (lower-cased; used to match existing rows) |
| Name | Single line text | contact form |
| Language | Single select | both forms |
| Newsletter | Checkbox | newsletter form |
| Newsletter Signup Date | Date | newsletter form |
| On beehiiv | Checkbox | newsletter form, when beehiiv sync succeeds |
| Source | Single select | both forms (`Contact form` / `Newsletter signup`, last one wins) |
| Last Interest | Single select | contact form |
| Last Activity | Date with time | both forms |
| Notes | Long text | staff only |

**Website Messages** — one row per contact-form submission

| Field | Type |
|---|---|
| Name *(primary)* | Single line text |
| Email | Email |
| Interest | Single select |
| Message | Long text |
| Language | Single select |
| Contact | Link to Website Contacts *(optional; messages still save without it)* |
| Page | Single line text |
| Submitted At | Date with time |
| Status | Single select: New / In progress / Replied / Closed |
| Assigned To | Single line text *(staff only)* |

Single-select options are created automatically the first time a new value
arrives (the API uses `typecast`).

## What visitors see

- **Contact:** success if Airtable *or* the email notification gets through. If
  both fail, their email app opens with the message filled in.
- **Newsletter:** with beehiiv keys set, "You're subscribed! Check your inbox."
  Without them, they're saved to Airtable and asked to confirm on the beehiiv
  page so newsletter emails actually reach them. If saving fails, they get a
  direct beehiiv link.
- Until the environment variables are set, `/api/*` answers `503 not_configured`:
  the contact form still emails the team, and newsletter visitors get the
  direct beehiiv link.

## Notes

- Spam: hidden honeypot fields, server-side validation and length limits, and an
  Origin check. There is no rate limiting; if spam becomes a problem, add Vercel
  Firewall rules or a CAPTCHA.
- Airtable allows 5 requests per second per base, which is far above this site's traffic.
- Staff email alerts for new messages still come from Web3Forms. You can also add
  an Airtable automation ("When record created" in Website Messages → send email).
