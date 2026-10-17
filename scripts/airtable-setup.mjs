#!/usr/bin/env node
// Creates the "Website Contacts" and "Website Messages" tables the site's forms write to.
// Safe to re-run: tables that already exist are left alone.
//
//   AIRTABLE_TOKEN=pat... AIRTABLE_BASE_ID=app... node scripts/airtable-setup.mjs
//
// The token needs the scopes schema.bases:read and schema.bases:write for this one-time
// setup. The token you give Vercel afterwards only needs data.records:read/write.

const token = process.env.AIRTABLE_TOKEN;
const baseId = process.env.AIRTABLE_BASE_ID;
const CONTACTS = process.env.AIRTABLE_CONTACTS_TABLE || 'Website Contacts';
const MESSAGES = process.env.AIRTABLE_MESSAGES_TABLE || 'Website Messages';
if (!token || !baseId) {
  console.error('Set AIRTABLE_TOKEN and AIRTABLE_BASE_ID first.');
  process.exit(1);
}

const api = async (method, path, body) => {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data.error)}`);
  return data;
};

const select = (...names) => ({ choices: names.map((name) => ({ name })) });
const LANGUAGES = select('English', 'Spanish', 'Arabic', 'French', 'Haitian Creole', 'Pashto', 'Dari / Persian',
  'Ukrainian', 'Swahili', 'Somali', 'Nepali', 'Vietnamese', 'Portuguese', 'Chinese (Simplified)');
const INTERESTS = select('Receiving support / services', 'Volunteering', 'Donating',
  'Partnering / Collaborating', 'Learning more about W.I.S.E.C.E.O.');
const DATETIME = { dateFormat: { name: 'us' }, timeFormat: { name: '12hour' }, timeZone: 'America/New_York' };

const { tables } = await api('GET', '/tables');
const existing = Object.fromEntries(tables.map((t) => [t.name, t]));

let contacts = existing[CONTACTS];
if (contacts) {
  console.log(`✓ "${CONTACTS}" already exists`);
} else {
  contacts = await api('POST', '/tables', {
    name: CONTACTS,
    description: 'People who contacted us or joined the newsletter on wiseceo.org (one row per email).',
    fields: [
      { name: 'Email', type: 'email' },
      { name: 'Name', type: 'singleLineText' },
      { name: 'Language', type: 'singleSelect', options: LANGUAGES },
      { name: 'Newsletter', type: 'checkbox', options: { icon: 'check', color: 'greenBright' } },
      { name: 'Newsletter Signup Date', type: 'date', options: { dateFormat: { name: 'us' } } },
      { name: 'On beehiiv', type: 'checkbox', options: { icon: 'check', color: 'blueBright' } },
      { name: 'Source', type: 'singleSelect', options: select('Contact form', 'Newsletter signup') },
      { name: 'Last Interest', type: 'singleSelect', options: INTERESTS },
      { name: 'Last Activity', type: 'dateTime', options: DATETIME },
      { name: 'Notes', type: 'multilineText' },
    ],
  });
  console.log(`+ created "${CONTACTS}"`);
}

if (existing[MESSAGES]) {
  console.log(`✓ "${MESSAGES}" already exists`);
} else {
  await api('POST', '/tables', {
    name: MESSAGES,
    description: 'Messages sent through the wiseceo.org contact form.',
    fields: [
      { name: 'Name', type: 'singleLineText' },
      { name: 'Email', type: 'email' },
      { name: 'Interest', type: 'singleSelect', options: INTERESTS },
      { name: 'Message', type: 'multilineText' },
      { name: 'Language', type: 'singleSelect', options: LANGUAGES },
      { name: 'Contact', type: 'multipleRecordLinks', options: { linkedTableId: contacts.id } },
      { name: 'Page', type: 'singleLineText' },
      { name: 'Submitted At', type: 'dateTime', options: DATETIME },
      { name: 'Status', type: 'singleSelect', options: select('New', 'In progress', 'Replied', 'Closed') },
      { name: 'Assigned To', type: 'singleLineText' },
    ],
  });
  console.log(`+ created "${MESSAGES}"`);
}
console.log('Done. Now add AIRTABLE_TOKEN and AIRTABLE_BASE_ID in Vercel (see docs/AIRTABLE.md).');
