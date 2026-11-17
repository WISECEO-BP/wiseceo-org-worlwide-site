// Real-address check for form emails. Not a route (files under api/_lib are helpers).
//   1. Format: one @, a dotted domain, no spaces.
//   2. Typos: catches common slips like gmial.com or gmail.con and suggests the fix.
//   3. Disposable: blocks throwaway inbox services.
//   4. Mail server: the domain must publish MX records, i.e. it can actually receive email.
// DNS outages fail open, so a real person's message is never lost because a lookup timed out.

const dns = require('dns').promises;

const FORMAT_RE = /^[^\s@]+@([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)$/i;

const POPULAR = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com',
  'live.com', 'msn.com', 'comcast.net', 'att.net', 'sbcglobal.net', 'verizon.net',
  'protonmail.com', 'proton.me', 'ymail.com', 'charter.net', 'cox.net', 'bellsouth.net',
];

// Misspellings too far from the real domain for the edit-distance check below.
const KNOWN_TYPOS = {
  'gamil.com': 'gmail.com', 'gmial.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmaill.com': 'gmail.com',
  'gmail.co': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.om': 'gmail.com',
  'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yhoo.com': 'yahoo.com', 'yahoo.con': 'yahoo.com',
  'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'outlook.con': 'outlook.com',
  'iclod.com': 'icloud.com', 'icoud.com': 'icloud.com', 'icloud.con': 'icloud.com',
};

const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com',
  'grr.la', '10minutemail.com', '10minutemail.net', 'tempmail.com', 'temp-mail.org', 'temp-mail.io',
  'tempmailo.com', 'tempail.com', 'throwawaymail.com', 'yopmail.com', 'yopmail.net', 'getnada.com',
  'nada.email', 'dispostable.com', 'maildrop.cc', 'mailnesia.com', 'trashmail.com', 'trashmail.net',
  'fakeinbox.com', 'mohmal.com', 'emailondeck.com', 'mintemail.com', 'spamgourmet.com', 'mailcatch.com',
  'moakt.com', 'burnermail.io', 'inboxkitten.com', 'mail.tm', 'mailpoof.com', 'tmail.ws', 'tmpmail.org',
  'tmpmail.net', 'discard.email', 'spambox.us', 'getairmail.com', 'fakemail.net', 'emailfake.com',
  'mailsac.com', 'mytemp.email', '33mail.com', 'anonaddy.me', 'harakirimail.com', 'jetable.org',
]);

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

function suggestDomain(domain) {
  if (POPULAR.includes(domain)) return '';
  if (KNOWN_TYPOS[domain]) return KNOWN_TYPOS[domain];
  if (domain.length < 8) return ''; // short domains collide with real ones too easily
  for (const real of POPULAR) {
    if (Math.abs(real.length - domain.length) <= 1 && editDistance(domain, real) === 1) return real;
  }
  return '';
}

function withTimeout(promise, ms) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, reject) => { t = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), ms); }),
  ]).finally(() => clearTimeout(t));
}

// Returns { ok: true } or { ok: false, reason: 'format' | 'typo' | 'disposable' | 'no_mail', suggestion? }.
// Pass { allowTypo: true } once the sender has confirmed an address we flagged as a possible typo.
async function checkEmail(email, opts = {}) {
  const m = FORMAT_RE.exec(email || '');
  if (!m || email.length > 254) return { ok: false, reason: 'format' };
  const local = email.slice(0, email.lastIndexOf('@'));
  const domain = m[1].toLowerCase();

  if (DISPOSABLE.has(domain) || [...DISPOSABLE].some((d) => domain.endsWith('.' + d))) {
    return { ok: false, reason: 'disposable' };
  }
  const fix = suggestDomain(domain);
  if (fix && !opts.allowTypo) return { ok: false, reason: 'typo', suggestion: local + '@' + fix };

  try {
    const mx = await withTimeout(dns.resolveMx(domain), opts.timeoutMs || 4000);
    const usable = mx.filter((r) => r.exchange && r.exchange !== '.');
    if (!usable.length) return { ok: false, reason: 'no_mail' }; // "null MX": domain says it takes no mail
    return { ok: true };
  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA' || err.code === 'NXDOMAIN') {
      return { ok: false, reason: 'no_mail' };
    }
    console.error('email-check: DNS ' + (err.code || err.message) + ' for ' + domain + ', allowing');
    return { ok: true };
  }
}

module.exports = { checkEmail, suggestDomain };
