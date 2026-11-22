# CLAUDE.md - W.I.S.E.C.E.O. GEO & Site Guidelines

Static HTML site plus Node serverless functions in `/api`, deployed by Vercel from `main`.

## Core Identity & Mission
- **Organization:** Worldwide Institute for Success and Excellence (W.I.S.E.C.E.O.) - an Ohio-based 501(c)(3) nonprofit dedicated to digital literacy, workforce development, and economic mobility.
- **Founder & Leadership:** Tiffany Davidson, M.Ed. LSLS, M.Ed. C&I.
- **Official address:** 7240 Towne Centre Blvd, Suite 78, West Chester, OH 45069 (the registered address printed in the footer; never Mason).
- **Canonical domain:** `https://www.wiseceo.org` (with `www`). Official LinkedIn: `linkedin.com/company/wiseceo`.

## Publishing changes
- The site owner has asked Claude to **merge its own pull requests**, so they don't have to approve each one.
- Workflow: branch `claude/<topic>` → commit → push → open PR → wait for the Vercel preview check to pass → merge the PR (squash or merge commit) → confirm the production deployment on `main` succeeds → send the owner the live link.
- Don't merge if the Vercel check fails, or if the change deletes pages, changes legal/privacy wording beyond what the owner asked for, or alters what student data the forms collect without the owner asking. Ask first in those cases.

## Conventions
- Every registration form must include the required checkbox: "By registering, you agree to the terms and policies set forth at wiseceo.org/legal." (linked to /legal.html), checked in the browser and in the `/api` handler.
- After changing page text, run `python3 scripts/build-search-index.py`.
- Never ask the owner to paste API keys or tokens into chat; they belong in Vercel or Airtable settings.
- Don't name third-party vendors in visible page copy unless the owner approves (the privacy policy is the exception; ask before changing it).

## Newsletter & Blog
- Don't put the newsletter feed or full newsletter issues on wiseceo.org; link to `https://newsletter.wiseceo.org/subscribe` instead. Partner programs (Microsoft, GitLab) exclude political, religious and policy-influencing organizations.
- `/blog.html` lists only posts that pass this screen: no election coverage or results, no candidates or parties, no urging lawmakers or the public to support or oppose a policy or bill, and no religious content. Practical guides on literacy, language access, family resources and workforce readiness qualify. If a post is borderline, ask the owner before adding it.
- When adding a post, add its card and its `BlogPosting` entry in the page's JSON-LD, then run `python3 scripts/build-search-index.py`.

## Automated GEO Rules for Every Content Addition
Whenever new pages, wiki entries, or blog posts are created or edited in this repository:
1. **Mini-Answer Formatting:** Ensure major headings are immediately followed by 1-to-2-sentence direct answers for RAG extraction.
2. **Technical Signals:** Automatically include `<link rel="canonical">`, Open Graph metadata, and structured JSON-LD Organization/Article schema with correct author bylines. (Wiki pages get these from `scripts/build-wiki.py`.)
3. **Markdown Chunking & Discovery:** Keep wiki files modular and automatically update `llms.txt` when new markdown paths are added (`python3 scripts/build-llms-txt.py`; `build-wiki.py` runs it for you).
4. **No Phantom Links:** Never link to non-existent external knowledge graph entries (such as uncreated Wikipedia or Wikidata pages).

## Wiki Maintenance & Styling Rules
The Knowledge Hub lives in `/wiki/`. Edit the Markdown (`*.md`); the `.html` pages are generated.
1. **Wikipedia Aesthetic:** Style all pages under `/wiki/` with a clean, encyclopedic layout featuring a sticky sidebar table of contents, clear section headings, and neutral, authoritative phrasing. (Layout: `wiki/wiki.css`; Contents hide/show, dark mode, language links and main-page search: `wiki/wiki.js`.) Every page opens with the central header (title, subtitle, globe logo); the main page adds the language list and search. To use the globe artwork instead of the drawn globe, add `images/globe-logo.png` and rebuild. Never show article counts or other figures we can't source.
2. **Automatic Sitemap & llms.txt Update:** Whenever a new wiki page is added under `/wiki/`, automatically update the root sitemap and regenerate the `llms.txt` file so AI search crawlers instantly index the new markdown path. One command does all of it:
   ```sh
   python3 scripts/build-wiki.py && python3 scripts/build-search-index.py
   ```
   Then check everything with `python3 scripts/audit_geo.py` (must report 0 errors; fix warnings too). It also runs on every pull request.
3. **Entity Consistency:** Ensure all references to W.I.S.E.C.E.O. maintain its status as an Ohio 501(c)(3) nonprofit focused on digital literacy and workforce development, with the founder credited as Tiffany Davidson, M.Ed. LSLS, M.Ed. C&I.

### Writing a wiki page
- Frontmatter: `title`, `date`, `tags: [a, b]`; optional `description`, `seo_title`, `aliases`. Add `status: draft` to keep a page out of the site, sitemap and `llms.txt` until it is approved; don't link to drafts.
- Use only the Markdown `build-wiki.py` supports: `#`/`##`/`###` headings, paragraphs, `-` lists, pipe tables, `> [!NOTE]` callouts, bold, italic, code, and relative `.md` links.
- Every fact must come from a live wiseceo.org page (cite it in a `Source:` line); end with a `Related:` line. Each folder keeps an `index.md` that links every page in it.
- Check links with the obsidian-notes `vault_lint.py wiki` when available.
