# Website forms → Airtable

The contact form and the newsletter sign-up forms save to Airtable through two
Vercel serverless functions. The Airtable token lives only in Vercel's
environment variables; it is never sent to the browser.

| Form | Endpoint | What it writes |
|---|---|---|
| Contact (`/contact.html`) | `POST /api/contact` | Checks the email is real, upserts the sender in **Website Contacts** (matched on Email), and adds a row to **Website Messages** with Status **Awaiting confirmation** and a **Confirm Link**. See *Contact-form email confirmation* below. |
| Confirm page (`/confirm.html`) | `POST /api/confirm` | Verifies the signed link and changes the message's Status to **New**. |
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
| Status | Single select: Awaiting confirmation / New / In progress / Replied / Closed |
| Assigned To | Single line text *(staff only)* |
| Confirm Link | URL *(set by the site; emailed to the sender)* |
| Confirmed At | Date with time *(set when the sender confirms)* |

Single-select options are created automatically the first time a new value
arrives (the API uses `typecast`).

## Contact-form email confirmation

Messages reach the team only after the sender proves they own their email address.
Everything runs from Airtable, so staff can change the wording, recipients or
on/off state without touching the website.

```
Visitor sends form ─► Airtable row: Status = Awaiting confirmation, Confirm Link filled in
                       └─ Automation 1 emails the sender the Confirm Link
Sender clicks link ─► /confirm.html ─► "Confirm my message" button ─► Status = New
                       └─ Automation 2 emails the team
```

Links are signed and expire after 7 days. The confirm page uses a button rather
than confirming on page load, because email security scanners open links
automatically. Unconfirmed rows stay as *Awaiting confirmation*; filter them out of
staff views and delete old ones whenever you like.

### Turn it on (about 10 minutes, all in Airtable)

Do these together. The site starts sending "check your email" messages as soon as
the **Confirm Link** field exists.

1. **Add two fields** to **Website Messages**: `Confirm Link` (URL) and
   `Confirmed At` (Date, include time). Names must match exactly. Or re-run
   `scripts/airtable-setup.mjs`, which adds them if missing.
2. **Automation 1: "Confirm contact message"**
   - Trigger: *When a record matches conditions*, table **Website Messages**:
     `Status` is `Awaiting confirmation` **and** `Confirm Link` is not empty.
   - Action: *Send email*
     - To: the record's **Email**
     - Subject: `Please confirm your message to W.I.S.E.C.E.O.`
     - Message:
       ```
       Hi {Name},

       Thank you for contacting W.I.S.E.C.E.O. To make sure your message reaches
       our team, please confirm your email address:

       {Confirm Link}

       This link works for 7 days. If you didn't contact us, you can ignore this
       email and nothing will be sent.

       W.I.S.E.C.E.O. · Worldwide Institute for Success and Excellence
       ```
3. **Automation 2: "New confirmed message → team"**
   - Trigger: *When a record matches conditions*, table **Website Messages**:
     `Status` is `New`.
   - Action: *Send email* to `admin@wiseceo.org` (or a team list) with
     Name, Email, Interest, Language and Message. Set **Reply-to** to the record's Email.
4. Turn both automations **on**, then send yourself a test message from `/contact.html`.

To switch confirmation off, delete or rename the **Confirm Link** field. The form
then saves messages as **New** and emails the team directly, as before.

Airtable automation runs count toward your plan's monthly limit (each message uses
about two runs).

## What visitors see

- **Contact:** a real-address check first (typos like `gmial.com` get a "Did you
  mean…?" prompt; throwaway inboxes and domains that can't receive mail are
  refused). Then "Almost done! Please check your email" with the confirm-link
  step. Without the **Confirm Link** field it says "Thank you!" and emails the team
  directly as before. If the server can't be reached, their email app opens with
  the message filled in.
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
- Staff alerts for contact messages come from Airtable Automation 2 once
  confirmation is on (Web3Forms only while it's off). The program application
  form still alerts the team through Web3Forms.
