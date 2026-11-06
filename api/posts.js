// GET /api/posts — latest published newsletter posts from beehiiv, for the article
// grids on /newsletter.html and the homepage (news.js). Needs BEEHIIV_API_KEY; without
// it, or if beehiiv is down, it answers 503 and the pages keep their hand-written cards.
// Responses are cached at Vercel's edge, so beehiiv is asked at most every 10 minutes.

const PUBLICATION = process.env.BEEHIIV_PUBLICATION_ID || 'pub_6225d8de-3b78-4eff-8fb7-237edc8425ed';

// Posts that also live on wiseceo.org: link to the site's copy and use its photo.
const LOCAL = {
  'six-siop-moves-every-teacher-can-use-tomorrow-with-english-learners': 'siop-moves-for-teachers',
  'reading-is-the-first-job-skill-why-literacy-is-workforce-development': 'reading-is-the-first-job-skill',
  'your-child-s-iep-explained-a-family-guide-to-the-meeting-table': 'iep-family-guide',
  'taxing-the-unbanked-why-ohio-should-protect-check-cashing-and-payday-borrowers': 'taxing-the-unbanked',
};

function send(res, status, payload, cache) {
  res.setHeader('Cache-Control', cache || 'no-store');
  res.status(status).json(payload);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  const key = process.env.BEEHIIV_API_KEY;
  if (!key) return send(res, 503, { ok: false, error: 'not_configured' }, 'public, s-maxage=300');

  const query = 'status=confirmed&platform=all&audience=free&hidden_from_feed=false' +
    '&order_by=publish_date&direction=desc&limit=24';
  try {
    const r = await fetch(`https://api.beehiiv.com/v2/publications/${PUBLICATION}/posts?${query}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) throw new Error(`beehiiv ${r.status}`);
    const { data = [] } = await r.json();
    const now = Date.now() / 1000;

    const posts = data
      // "confirmed" includes scheduled posts; only show ones already published on the web.
      .filter((p) => p.web_url && p.platform !== 'email' && (p.publish_date || 0) <= now)
      .slice(0, 12)
      .map((p) => {
        const local = LOCAL[p.slug];
        // beehiiv falls back to the publication logo when a post has no thumbnail; skip that.
        const thumb = p.thumbnail_url && !/\/publication\/logo\//.test(p.thumbnail_url) ? p.thumbnail_url : null;
        return {
          title: p.title,
          subtitle: p.subtitle || p.preview_text || '',
          tag: (p.content_tags && p.content_tags[0]) || 'Newsletter',
          date: p.displayed_date || p.publish_date || null,
          url: local ? `/articles/${local}.html` : p.web_url,
          image: local ? `/images/news/${local}` : null,
          thumbnail: local ? null : thumb,
        };
      });

    return send(res, 200, { ok: true, posts }, 'public, s-maxage=600, stale-while-revalidate=86400');
  } catch (err) {
    console.error('posts: ' + err.message);
    return send(res, 502, { ok: false, error: 'fetch_failed' }, 'public, s-maxage=60');
  }
};
