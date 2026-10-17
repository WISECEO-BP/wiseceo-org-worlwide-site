// Shared helpers for the /api form endpoints. Files under api/_lib are not routes.
// Configuration comes from Vercel environment variables (see docs/AIRTABLE.md);
// the Airtable token never reaches the browser.

const API = 'https://api.airtable.com/v0';

function config() {
  return {
    token: process.env.AIRTABLE_TOKEN,
    baseId: process.env.AIRTABLE_BASE_ID,
    contactsTable: process.env.AIRTABLE_CONTACTS_TABLE || 'Website Contacts',
    messagesTable: process.env.AIRTABLE_MESSAGES_TABLE || 'Website Messages',
  };
}

function isConfigured() {
  const c = config();
  return Boolean(c.token && c.baseId);
}

async function airtable(method, table, body) {
  const c = config();
  const res = await fetch(`${API}/${c.baseId}/${encodeURIComponent(table)}`, {
    method,
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Airtable ${res.status}: ${(data.error && (data.error.message || data.error.type)) || data.error || 'request failed'}`);
    err.status = res.status;
    err.type = data.error && data.error.type;
    throw err;
  }
  return data;
}

// Create the contact if the email is new, otherwise update it. Returns the record id.
async function upsertContact(fields) {
  const data = await airtable('PATCH', config().contactsTable, {
    performUpsert: { fieldsToMergeOn: ['Email'] },
    records: [{ fields }],
    typecast: true,
  });
  return data.records[0].id;
}

async function createMessage(fields, contactId) {
  const table = config().messagesTable;
  try {
    const data = await airtable('POST', table, {
      records: [{ fields: contactId ? { ...fields, Contact: [contactId] } : fields }],
      typecast: true,
    });
    return data.records[0].id;
  } catch (err) {
    // The "Contact" link field is optional; save the message without it rather than lose it.
    if (contactId && err.status === 422) return createMessage(fields, null);
    throw err;
  }
}

// ---------- request helpers ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(value, max) {
  return typeof value === 'string' ? value.replace(/\u0000/g, '').trim().slice(0, max) : '';
}

function allowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin form posts from some browsers omit it
  try {
    const host = new URL(origin).hostname;
    return host === 'wiseceo.org' || host.endsWith('.wiseceo.org') || host.endsWith('.vercel.app') ||
      host === 'localhost' || host === '127.0.0.1';
  } catch (e) {
    return false;
  }
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}

function send(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(payload);
}

// Common checks for every form endpoint. Returns the parsed body, or null after responding.
function guard(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    send(res, 405, { ok: false, error: 'method_not_allowed' });
    return null;
  }
  if (!allowedOrigin(req)) {
    send(res, 403, { ok: false, error: 'forbidden' });
    return null;
  }
  const body = readBody(req);
  if (body.botcheck || body.website) {
    // Honeypot filled in: pretend success so bots learn nothing.
    send(res, 200, { ok: true });
    return null;
  }
  if (!isConfigured()) {
    console.error('Airtable is not configured: set AIRTABLE_TOKEN and AIRTABLE_BASE_ID');
    send(res, 503, { ok: false, error: 'not_configured' });
    return null;
  }
  return body;
}

module.exports = { upsertContact, createMessage, clean, guard, send, EMAIL_RE };
