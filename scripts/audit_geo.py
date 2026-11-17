#!/usr/bin/env python3
"""GEO / AI-search readiness audit for wiseceo.org (runs offline against the repo).

    python3 scripts/audit_geo.py          # report; exit 1 if any ERROR
    python3 scripts/audit_geo.py --quiet  # only problems

Checks the rules in CLAUDE.md:
  * robots.txt lets AI crawlers in and points to the sitemap
  * llms.txt exists and lists every published wiki page
  * sitemap.xml lists every indexable page and every published wiki page
  * every published wiki page is built, with canonical, Open Graph and JSON-LD
    (Article by Tiffany Davidson, published by the organization)
  * every ## heading in a wiki page opens with a short direct answer (1-2 sentences)
  * relative links in the wiki resolve; no links to drafts
  * entity consistency: no "Mason", founder credited with credentials
  * main site pages: canonical / Open Graph present (warnings; older pages predate the rule)

Standard library only, like the other scripts.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WIKI = ROOT / "wiki"
SITE = "https://www.wiseceo.org"
AI_BOTS = ["GPTBot", "ClaudeBot", "Claude-Web", "anthropic-ai", "PerplexityBot", "Google-Extended",
           "CCBot", "OAI-SearchBot", "ChatGPT-User", "Applebot-Extended", "Bingbot"]
CREDENTIALS = "M.Ed. LSLS, M.Ed. C&I"

errors, warnings, passes = [], [], []
quiet = "--quiet" in sys.argv


def err(msg): errors.append(msg)
def warn(msg): warnings.append(msg)
def ok(msg): passes.append(msg)


def frontmatter(text):
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    return (dict(re.findall(r"^(\w+):\s*(.*)$", m.group(1), re.M)), text[m.end():]) if m else ({}, text)


def sentences(text):
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\b(e\.g|i\.e|M\.Ed|B\.S|U\.S|Reg|No|vs|etc)\.", r"\1", text)
    text = text.replace("W.I.S.E.C.E.O.", "WISECEO")
    return [s for s in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"“(])", text.strip()) if s]


# ---------- robots.txt ----------
robots = (ROOT / "robots.txt").read_text(encoding="utf-8") if (ROOT / "robots.txt").exists() else ""
if not robots:
    err("robots.txt is missing")
else:
    groups, current = {}, []
    for line in robots.splitlines():
        line = line.split("#")[0].strip()
        if not line:
            current = []
            continue
        key, _, val = line.partition(":")
        key, val = key.strip().lower(), val.strip()
        if key == "user-agent":
            current = current + [val.lower()]
            groups.setdefault(val.lower(), [])
        elif key in ("disallow", "allow"):
            for ua in current:
                groups.setdefault(ua, []).append((key, val))
    blocked = []
    for bot in AI_BOTS:
        rules = groups.get(bot.lower(), groups.get("*", []))
        if any(k == "disallow" and v == "/" for k, v in rules):
            blocked.append(bot)
    if blocked:
        err("robots.txt blocks AI crawlers: " + ", ".join(blocked))
    else:
        ok(f"robots.txt allows {len(AI_BOTS)} AI crawlers")
    if "sitemap:" not in robots.lower():
        warn("robots.txt has no Sitemap: line")

# ---------- wiki pages ----------
published, drafts = [], set()
for md in sorted(WIKI.rglob("*.md")):
    meta, _ = frontmatter(md.read_text(encoding="utf-8"))
    (drafts.add(md) if meta.get("status", "").strip() == "draft" else published.append(md))

llms = (ROOT / "llms.txt").read_text(encoding="utf-8") if (ROOT / "llms.txt").exists() else ""
sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8") if (ROOT / "sitemap.xml").exists() else ""
if not llms:
    err("llms.txt is missing (run python3 scripts/build-wiki.py)")
if not sitemap:
    err("sitemap.xml is missing")

for md in published:
    rel = md.relative_to(ROOT).as_posix()
    text = md.read_text(encoding="utf-8")
    meta, body = frontmatter(text)
    page = rel[len("wiki/"):]

    for key in ("title", "date"):
        if not meta.get(key):
            err(f"{rel}: frontmatter is missing '{key}'")

    # discovery
    if f"{SITE}/{rel}" not in llms:
        err(f"{rel}: not listed in llms.txt (run python3 scripts/build-wiki.py)")
    url = f"{SITE}/wiki/" if page == "index.md" else f"{SITE}/wiki/{page[:-3]}.html"
    if f"<loc>{url}</loc>" not in sitemap:
        err(f"{rel}: {url} not in sitemap.xml (run python3 scripts/build-wiki.py)")

    # built page + technical signals
    html_path = md.with_suffix(".html")
    if not html_path.exists():
        err(f"{rel}: no generated .html (run python3 scripts/build-wiki.py)")
    else:
        html = html_path.read_text(encoding="utf-8")
        if html_path.stat().st_mtime + 1 < md.stat().st_mtime:
            warn(f"{rel}: edited after its .html was built (run python3 scripts/build-wiki.py)")
        if f'<link rel="canonical" href="{url}"/>' not in html:
            err(f"{rel}: canonical missing or not {url}")
        for prop in ("og:title", "og:description", "og:url", "og:type"):
            if f'property="{prop}"' not in html:
                err(f"{rel}: missing Open Graph {prop}")
        m = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
        try:
            data = json.loads(m.group(1)) if m else None
        except json.JSONDecodeError as e:
            data = None
            err(f"{rel}: JSON-LD does not parse ({e})")
        if data is None and m is None:
            err(f"{rel}: no JSON-LD")
        elif data:
            nodes = data.get("@graph", [data])
            art = next((n for n in nodes if n.get("@type") in ("Article", "TechArticle")), None)
            if not art:
                err(f"{rel}: JSON-LD has no Article")
            else:
                if (art.get("author") or {}).get("name") != "Tiffany Davidson":
                    err(f"{rel}: Article author byline is not Tiffany Davidson")
                if not (art.get("publisher") or {}).get("@id", "").endswith("/#organization"):
                    err(f"{rel}: Article publisher is not the organization @id")
            if not any(n.get("@type") == "BreadcrumbList" for n in nodes):
                warn(f"{rel}: no BreadcrumbList")

    # mini-answers: every ## heading opens with a 1-2 sentence paragraph
    blocks = re.split(r"\n(?=## )", body)
    for block in blocks[1:]:
        heading, _, rest = block.partition("\n")
        first = rest.strip().split("\n\n")[0] if rest.strip() else ""
        h = heading[3:].strip()
        if not first or first.startswith(("|", "- ", ">", "#")):
            warn(f"{rel}: '## {h}' opens with a list/table, not a 1-2 sentence answer")
        elif len(sentences(first)) > 2:
            warn(f"{rel}: '## {h}' opening runs {len(sentences(first))} sentences (aim for 1-2)")

    # links
    for href in re.findall(r"\]\(([^)\s]+)\)", body):
        if re.match(r"^[a-z]+:", href) or href.startswith("#"):
            continue
        target = (md.parent / href.split("#")[0]).resolve()
        if not target.exists():
            err(f"{rel}: broken link {href}")
        elif target in {d.resolve() for d in drafts}:
            err(f"{rel}: links to draft {href}")

    # entity consistency
    if re.search(r"\bMason\b", text):
        err(f"{rel}: mentions Mason (official location is West Chester, OH)")
    if "Tiffany Davidson" in text and CREDENTIALS not in text and "Tiffany A. Davidson" not in text:
        warn(f"{rel}: names Tiffany Davidson without '{CREDENTIALS}' anywhere on the page")

ok(f"{len(published)} published wiki pages checked ({len(drafts)} draft skipped)")

# ---------- main site pages (older pages: warnings only) ----------
site_pages = sorted(list(ROOT.glob("*.html")) + list(ROOT.glob("articles/*.html")) + list(ROOT.glob("about/**/*.html")))
missing_canon, missing_og, missing_map = [], [], []
for p in site_pages:
    src = p.read_text(encoding="utf-8")
    if re.search(r'<meta name="robots" content="[^"]*noindex', src):
        continue
    rel = p.relative_to(ROOT).as_posix()
    if 'rel="canonical"' not in src:
        missing_canon.append(rel)
    if 'property="og:title"' not in src:
        missing_og.append(rel)
    loc = f"{SITE}/" if rel == "index.html" else f"{SITE}/" + (rel[:-len("index.html")] if rel.endswith("/index.html") else rel)
    if f"<loc>{loc}</loc>" not in sitemap:
        missing_map.append(rel)
    if re.search(r"\bMason\b", re.sub(r"<[^>]+>", " ", src)):
        err(f"{rel}: mentions Mason (official location is West Chester, OH)")
if missing_canon:
    warn(f"{len(missing_canon)} site pages have no canonical: " + ", ".join(missing_canon))
if missing_og:
    warn(f"{len(missing_og)} site pages have no Open Graph tags: " + ", ".join(missing_og))
if missing_map:
    warn(f"{len(missing_map)} indexable site pages missing from sitemap.xml: " + ", ".join(missing_map))

# ---------- report ----------
if not quiet:
    for m in passes:
        print(f"PASS  {m}")
for m in errors:
    print(f"ERROR {m}")
for m in warnings:
    print(f"WARN  {m}")
print(f"\n{len(errors)} errors, {len(warnings)} warnings")
sys.exit(1 if errors else 0)
