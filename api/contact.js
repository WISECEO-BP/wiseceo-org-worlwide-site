// POST /api/contact — save a contact-form message to Airtable, pending email confirmation.
// Upserts the sender into "Website Contacts" (matched on Email) and adds a row to
// "Website Messages" with Status "Awaiting confirmation" and a signed Confirm Link.
// An Airtable automation emails that link to the sender; /api/confirm flips the
// Status to "New" when they click it, and a second automation alerts the team.
// See docs/AIRTABLE.md.
const { config, upsertContact, createMessage, updateRecord, clean, guard, send, EMAIL_RE } = require('./_lib/airtable');
const { checkEmail } = require('./_lib/email-check');
const { confirmLink } = require('./_lib/confirm-token');

const INTERESTS = [
  'Receiving support / services',
  'Volunteering',
  'Donating',
  'Partnering / Collaborating',
  'Learning more about W.I.S.E.C.E.O.',
];

const AWAITING = 'Awaiting confirmation';

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

  // Only real, deliverable addresses: no throwaway inboxes, no domains that can't receive mail.
  const verdict = await checkEmail(email, { allowTypo: body.allowTypo === true });
  if (!verdict.ok) {
    return send(res, 400, { ok: false, error: 'email', reason: verdict.reason, suggestion: verdict.suggestion || '' });
  }

  const now = new Date().toISOString();
  const table = config().messagesTable;
  try {
    const contactFields = { Email: email, Name: name, Language: language, 'Last Activity': now, Source: 'Contact form' };
    if (interest) contactFields['Last Interest'] = interest;
    const contactId = await upsertContact(contactFields);

    const messageFields = {
      Name: name, Email: email, Message: message, Language: language,
      Page: page, 'Submitted At': now, Status: AWAITING,
    };
    if (interest) messageFields.Interest = interest;
    const id = await createMessage(messageFields, contactId);

    // The link is signed with the record id, so it is added once the row exists.
    // The sender's confirmation automation waits for this field to be filled in.
    try {
      await updateRecord(table, id, { 'Confirm Link': confirmLink(req, id) });
      return send(res, 200, { ok: true, confirm: true });
    } catch (err) {
      // "Confirm Link" field not set up yet: keep the message, treat it as unconfirmed-but-new
      // so the team still sees it, and tell the visitor it was received.
      console.error('contact: could not add Confirm Link (' + err.message + '); saving as New');
      await updateRecord(table, id, { Status: 'New' }).catch(() => {});
      return send(res, 200, { ok: true, confirm: false });
    }
  } catch (err) {
    console.error('contact: ' + err.message);
    return send(res, 502, { ok: false, error: 'save_failed' });
  }
};
