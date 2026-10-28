// POST /api/prize — prize-drawing winner shipping details from /studentregistration.html.
// Adds a row to the "Students" table in the Student Job Search base (the same table the
// HSS Registration form fills), with Collecting Prize = Yes and the mailing address.
// Winners may be minors, so they are not added to "Website Contacts" (the supporter list).
const { createRecord, clean, guard, send, EMAIL_RE } = require('./_lib/airtable');

const STUDENTS_BASE = process.env.AIRTABLE_STUDENTS_BASE_ID || 'app8FS9UOOqy9PITH';
const STUDENTS_TABLE = process.env.AIRTABLE_STUDENTS_TABLE || 'Students';

// The 50 states and Washington, D.C. No territories or international addresses.
const STATES = new Set(('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ ' +
  'NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY').split(' '));
const ZIP_RE = /^\d{5}(-\d{4})?$/;

module.exports = async function handler(req, res) {
  const body = guard(req, res);
  if (!body) return;

  const first = clean(body.first, 60);
  const last = clean(body.last, 60);
  const byText = body.contact === 'text';
  const email = byText ? '' : clean(body.email, 254).toLowerCase();
  const email2 = byText ? '' : clean(body.email2, 254).toLowerCase();
  const digits = clean(body.phone, 20).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  const adult = body.adult === 'yes' ? true : body.adult === 'no' ? false : null;
  const guardian = adult === false ? clean(body.guardian, 120) : '';
  const guardianEmail = adult === false ? clean(body.guardianEmail, 254).toLowerCase() : '';
  const guardianDigits = adult === false ? clean(body.guardianPhone, 20).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '') : '';
  const street = clean(body.street, 150);
  const street2 = clean(body.street2, 80);
  const city = clean(body.city, 80);
  const state = clean(body.state, 2).toUpperCase();
  const zip = clean(body.zip, 10);

  const invalid = {
    first: !first, last: !last, email: !byText && !EMAIL_RE.test(email), email2: email2 !== email,
    phone: digits.length !== 10, adult: adult === null, guardian: adult === false && !guardian,
    guardianEmail: Boolean(guardianEmail) && !EMAIL_RE.test(guardianEmail),
    guardianPhone: Boolean(guardianDigits) && guardianDigits.length !== 10,
    permission: adult === false && body.permission !== 'yes',
    street: !street, city: !city, state: !STATES.has(state), zip: !ZIP_RE.test(zip), confirm: body.confirm !== 'yes',
  };
  if (Object.values(invalid).some(Boolean)) return send(res, 400, { ok: false, error: 'invalid', fields: invalid });

  const area = digits.slice(0, 3), prefix = digits.slice(3, 6), line = digits.slice(6);
  const usPhone = (d) => `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  const fields = {
    'First Name': first,
    'Last Name': last,
    'Preferred Contact': byText ? 'Text message' : 'Email',
    'Phone Number': usPhone(digits),
    'Phone Area Code': area,
    'Phone Prefix': prefix,
    'Phone Line Number': line,
    'Street Address': street,
    'City': city,
    'State': state,
    'ZIP Code': zip,
    'Prize Drawing Entry': true,
    'Collecting Prize': 'Yes',
  };
  if (email) {
    // Student's own email or a parent's; checked against the retyped copy above.
    fields['Email Address'] = email;
    fields['Confirm Email Address'] = email2;
  }
  if (street2) fields['Apt/Unit'] = street2;
  if (guardian) {
    // Under 18: ship as "Student c/o Parent". The student ticked the permission box.
    fields['Parent/Guardian Name'] = guardian;
    fields['Parent/Guardian Permission'] = true;
    if (guardianDigits) fields['Parent/Guardian Phone'] = usPhone(guardianDigits);
    if (guardianEmail) fields['Parent/Guardian Email'] = guardianEmail;
  }

  try {
    await createRecord(STUDENTS_TABLE, fields, STUDENTS_BASE);
    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('prize: ' + err.message);
    return send(res, 502, { ok: false, error: 'save_failed' });
  }
};
