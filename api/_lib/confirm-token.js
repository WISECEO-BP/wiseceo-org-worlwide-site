// Signed, expiring confirmation links for contact-form messages.
// The signature is an HMAC of the Airtable record id and issue time, keyed with
// CONTACT_CONFIRM_SECRET if set, otherwise the server-only AIRTABLE_TOKEN, so no
// extra secret is required. Nothing secret is stored in Airtable.
const crypto = require('crypto');

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // links work for 7 days

function key() {
  return process.env.CONTACT_CONFIRM_SECRET || process.env.AIRTABLE_TOKEN || '';
}

function sign(id, issued) {
  return crypto.createHmac('sha256', key()).update(`contact-confirm:${id}:${issued}`).digest('base64url');
}

function makeToken(id, now = Date.now()) {
  const issued = Math.floor(now / 1000).toString(36);
  return `${issued}.${sign(id, issued)}`;
}

// Returns 'ok', 'expired' or 'invalid'.
function checkToken(id, token, now = Date.now()) {
  if (!key() || typeof id !== 'string' || typeof token !== 'string') return 'invalid';
  const [issued, sig] = token.split('.');
  if (!issued || !sig || !/^[0-9a-z]{1,10}$/.test(issued)) return 'invalid';
  const expected = Buffer.from(sign(id, issued));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return 'invalid';
  return now - parseInt(issued, 36) * 1000 > MAX_AGE_MS ? 'expired' : 'ok';
}

// Only our own domains (and Vercel previews) may appear in a link we email to someone.
function confirmLink(req, id) {
  const host = String(req.headers.host || '').toLowerCase();
  const ok = host === 'www.wiseceo.org' || host === 'wiseceo.org' || /^[a-z0-9-]+\.vercel\.app$/.test(host);
  const base = ok ? `https://${host}` : 'https://www.wiseceo.org';
  return `${base}/confirm.html?m=${encodeURIComponent(id)}&t=${encodeURIComponent(makeToken(id))}`;
}

module.exports = { makeToken, checkToken, confirmLink, MAX_AGE_MS };
