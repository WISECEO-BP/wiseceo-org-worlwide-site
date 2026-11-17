// Vercel Routing Middleware (runs before the CDN cache, homepage only).
// AI agents that ask for Markdown (Accept: text/markdown) get the Knowledge Hub's
// main page as Markdown; everyone else gets the normal homepage, untouched.
// Uses the same response headers as @vercel/functions' rewrite()/next(), so the
// site needs no package.json or build step.

export const config = { matcher: '/' };

export default function middleware(request) {
  const accept = request.headers.get('accept') || '';
  if (/\btext\/markdown\b/i.test(accept)) {
    return new Response(null, {
      headers: { 'x-middleware-rewrite': new URL('/wiki/index.md', request.url).toString() },
    });
  }
  return new Response(null, { headers: { 'x-middleware-next': '1' } });
}
