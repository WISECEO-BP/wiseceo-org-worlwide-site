// POST /api/apply — program application from /apply.html.
// Upserts the applicant into "Website Contacts" and saves the application as a
// row in "Website Messages" (Interest = "Program application: <program>"),
// so it needs no extra Airtable table.
const { upsertContact, createMessage, clean, guard, send, EMAIL_RE } = require('./_lib/airtable');

const PROGRAMS = {
  'youth-leadership': 'Youth Leadership Academy',
  'education-access': 'Education Access & Equity',
  'digital-literacy': 'Digital Literacy & Coding',
  'workforce': 'Workforce Development',
  'entrepreneurship': 'Entrepreneurship & Innovation',
  'community-resilience': 'Community Economic Resilience',
};
const APPLICANTS = {
  adult: 'Adult (18+) applying for myself',
  parent: 'Parent or guardian applying for my child',
  youth: 'Youth 13–17 with parent or guardian permission',
};

module.exports = async function handler(req, res) {
  const body = guard(req, res);
  if (!body) return;

  const program = PROGRAMS[body.program];
  const applicant = APPLICANTS[body.applicant];
  const name = clean(body.name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const goals = clean(body.goals, 3000);
  const guardian = clean(body.guardian, 120);
  const phone = clean(body.phone, 40);
  const location = clean(body.location, 120);
  const language = clean(body.language, 40) || 'English';
  const page = clean(body.page, 200);

  const invalid = {
    program: !program, applicant: !applicant, name: !name, email: !EMAIL_RE.test(email), goals: !goals,
    guardian: body.applicant !== 'adult' && !guardian,
  };
  if (Object.values(invalid).some(Boolean)) return send(res, 400, { ok: false, error: 'invalid', fields: invalid });

  const interest = `Program application: ${program}`;
  const details = [
    `Program: ${program}`,
    `Applicant: ${applicant}`,
    guardian ? `Parent/guardian: ${guardian}` : null,
    phone ? `Phone: ${phone}` : null,
    location ? `City/state: ${location}` : null,
    `Preferred language: ${language}`,
    '',
    goals,
  ].filter((line) => line !== null).join('\n');

  const now = new Date().toISOString();
  try {
    const contactId = await upsertContact({
      Email: email, Name: guardian && body.applicant === 'parent' ? guardian : name, Language: language,
      'Last Activity': now, Source: 'Program application', 'Last Interest': interest,
    });
    await createMessage({
      Name: name, Email: email, Interest: interest, Message: details, Language: language,
      Page: page, 'Submitted At': now, Status: 'New',
    }, contactId);
    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('apply: ' + err.message);
    return send(res, 502, { ok: false, error: 'save_failed' });
  }
};
