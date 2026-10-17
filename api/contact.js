// POST /api/contact — save a contact-form message to Airtable.
// Upserts the sender into "Website Contacts" (matched on Email) and adds a
// row to "Website Messages" linked to that contact.
const { upsertContact, createMessage, clean, guard, send, EMAIL_RE } = require('./_lib/airtable');

const INTERESTS = [
  'Receiving support / services',
  'Volunteering',
  'Donating',
  'Partnering / Collaborating',
  'Learning more about W.I.S.E.C.E.O.',
];

module.exports = async function handler(req, res) {
  const body = guard(req, res);
  if (!body) return;

  const name = clean(body.name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const message = clean(body.message, 5000);
  const interest = INTERESTS.includes(body.interest) ? body.interest : '';
  const language = clean(body.language, 40) || 'English';
  const page = clean(body.page, 200);

  if (!name || !EMAIL_RE.test(email) || !message) {
    return send(res, 400, { ok: false, error: 'invalid', fields: { name: !name, email: !EMAIL_RE.test(email), message: !message } });
  }

  const now = new Date().toISOString();
  try {
    const contactFields = { Email: email, Name: name, Language: language, 'Last Activity': now, Source: 'Contact form' };
    if (interest) contactFields['Last Interest'] = interest;
    const contactId = await upsertContact(contactFields);

    const messageFields = {
      Name: name, Email: email, Message: message, Language: language,
      Page: page, 'Submitted At': now, Status: 'New',
    };
    if (interest) messageFields.Interest = interest;
    await createMessage(messageFields, contactId);

    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('contact: ' + err.message);
    return send(res, 502, { ok: false, error: 'save_failed' });
  }
};
