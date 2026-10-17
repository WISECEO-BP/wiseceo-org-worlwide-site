// POST /api/subscribe — newsletter sign-up.
// Upserts the subscriber into "Website Contacts" (matched on Email) with
// Newsletter checked. If BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID are set,
// also subscribes them on beehiiv so newsletter emails actually reach them.
const { upsertContact, clean, guard, send, EMAIL_RE } = require('./_lib/airtable');

async function subscribeOnBeehiiv(email, page) {
  const key = process.env.BEEHIIV_API_KEY;
  const pub = process.env.BEEHIIV_PUBLICATION_ID;
  if (!key || !pub) return false;
  const res = await fetch(`https://api.beehiiv.com/v2/publications/${pub}/subscriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      reactivate_existing: true,
      send_welcome_email: true,
      utm_source: 'wiseceo.org',
      referring_site: page ? `https://www.wiseceo.org${page}` : 'https://www.wiseceo.org',
    }),
  });
  if (!res.ok) throw new Error(`beehiiv ${res.status}`);
  return true;
}

module.exports = async function handler(req, res) {
  const body = guard(req, res);
  if (!body) return;

  const email = clean(body.email, 254).toLowerCase();
  const name = clean(body.name, 120);
  const language = clean(body.language, 40) || 'English';
  const page = clean(body.page, 200);

  if (!EMAIL_RE.test(email)) {
    return send(res, 400, { ok: false, error: 'invalid', fields: { email: true } });
  }

  const now = new Date().toISOString();
  let beehiiv = false;
  try {
    beehiiv = await subscribeOnBeehiiv(email, page);
  } catch (err) {
    console.error('subscribe: ' + err.message); // still record them in Airtable below
  }

  try {
    const fields = {
      Email: email, Language: language, Newsletter: true,
      'Newsletter Signup Date': now.slice(0, 10), 'Last Activity': now,
      Source: 'Newsletter signup',
    };
    if (name) fields.Name = name;
    if (beehiiv) fields['On beehiiv'] = true; // never un-check it on a later failed sync
    await upsertContact(fields);
    return send(res, 200, { ok: true, beehiiv });
  } catch (err) {
    console.error('subscribe: ' + err.message);
    // If beehiiv took the subscription, the person is subscribed; don't show them an error.
    if (beehiiv) return send(res, 200, { ok: true, beehiiv, airtable: false });
    return send(res, 502, { ok: false, error: 'save_failed' });
  }
};
