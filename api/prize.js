// POST /api/prize — ELL Prize Drawing winner shipping details from /ellstudentregistration.html.
// Saves one row in "Website Messages" (Interest = "ELL prize shipping") with the
// mailing label in the message. Winners may be minors, so they are not added to
// "Website Contacts" (the supporter / newsletter list).
const { createMessage, clean, guard, send, EMAIL_RE } = require('./_lib/airtable');

// The 50 states and Washington, D.C. No territories or international addresses.
const STATES = new Set(('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ ' +
  'NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY').split(' '));
const ZIP_RE = /^\d{5}(-\d{4})?$/;

module.exports = async function handler(req, res) {
  const body = guard(req, res);
  if (!body) return;

  const name = clean(body.name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const digits = clean(body.phone, 20).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  const adult = body.adult === 'yes' ? true : body.adult === 'no' ? false : null;
  const guardian = adult === false ? clean(body.guardian, 120) : '';
  const street = clean(body.street, 150);
  const street2 = clean(body.street2, 80);
  const city = clean(body.city, 80);
  const state = clean(body.state, 2).toUpperCase();
  const zip = clean(body.zip, 10);
  const page = clean(body.page, 200);

  const invalid = {
    name: !name, email: !EMAIL_RE.test(email), phone: digits.length !== 10, adult: adult === null,
    guardian: adult === false && !guardian, street: !street, city: !city, state: !STATES.has(state),
    zip: !ZIP_RE.test(zip), confirm: body.confirm !== 'yes',
  };
  if (Object.values(invalid).some(Boolean)) return send(res, 400, { ok: false, error: 'invalid', fields: invalid });

  const phone = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  const label = [
    guardian ? `${name} c/o ${guardian}` : name,
    street2 ? `${street}, ${street2}` : street,
    `${city}, ${state} ${zip}`,
  ].join('\n');
  const details = [
    'SHIP TO:',
    label,
    '',
    `Winner: ${name}`,
    `Age: ${adult ? '18 or older' : 'Under 18'}`,
    guardian ? `Parent/guardian: ${guardian}` : null,
    `Email: ${email}`,
    `Phone: ${phone}`,
  ].filter((line) => line !== null).join('\n');

  try {
    await createMessage({
      Name: name, Email: email, Interest: 'ELL prize shipping', Message: details, Language: 'English',
      Page: page, 'Submitted At': new Date().toISOString(), Status: 'New',
    }, null);
    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('prize: ' + err.message);
    return send(res, 502, { ok: false, error: 'save_failed' });
  }
};
