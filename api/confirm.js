// POST /api/confirm  { m: <record id>, t: <token> }
// Confirms a contact-form message from the link emailed to the sender. Uses POST from
// a button on /confirm.html (not a bare GET link) so email security scanners that
// pre-open links can't confirm messages on their own.
const { config, getRecord, updateRecord, guard, send, clean } = require('./_lib/airtable');
const { checkToken } = require('./_lib/confirm-token');

module.exports = async function handler(req, res) {
  const body = guard(req, res);
  if (!body) return;

  const id = clean(body.m, 32);
  const token = clean(body.t, 100);
  if (!/^rec[A-Za-z0-9]{14}$/.test(id)) return send(res, 400, { ok: false, error: 'invalid' });

  const verdict = checkToken(id, token);
  if (verdict !== 'ok') return send(res, 400, { ok: false, error: verdict });

  const table = config().messagesTable;
  try {
    const record = await getRecord(table, id);
    if (!record) return send(res, 404, { ok: false, error: 'not_found' });
    const status = record.fields && record.fields.Status;
    if (status === 'Awaiting confirmation') {
      await updateRecord(table, id, { Status: 'New', 'Confirmed At': new Date().toISOString() })
        .catch(() => updateRecord(table, id, { Status: 'New' })); // "Confirmed At" is optional
    }
    // Already confirmed (or already being handled by staff): still a success for the visitor.
    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('confirm: ' + err.message);
    return send(res, 502, { ok: false, error: 'save_failed' });
  }
};
