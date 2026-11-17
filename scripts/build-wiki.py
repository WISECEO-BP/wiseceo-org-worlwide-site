#!/usr/bin/env python3
"""Build the W.I.S.E.C.E.O. Knowledge Hub: wiki/**/*.md  ->  wiki/**/*.html

One command keeps the wiki, the sitemap and llms.txt in step:

    python3 scripts/build-wiki.py

For every Markdown file under wiki/ it writes a standalone, encyclopedic page
next to it (index.md -> index.html): a fixed left sidebar (navigation, the
page's own contents, quick links, dark-mode toggle) styled by wiki/wiki.css,
and per-page canonical, Open Graph and Article JSON-LD (author: the founder;
publisher: the organization). Optional frontmatter: description, seo_title. Then it rewrites the
wiki entries in sitemap.xml and regenerates llms.txt.

Pages whose frontmatter says `status: draft` are skipped everywhere.

Supported Markdown (keep wiki files to this): YAML frontmatter (title, date,
tags, status), # / ## / ### headings, paragraphs, "-" lists, pipe tables,
"> [!NOTE]" callouts, **bold**, *italic*, `code`, [links](path.md#anchor).
Standard library only, like the other scripts.
"""
import html
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WIKI = ROOT / "wiki"
SITE = "https://www.wiseceo.org"
ORG_ID = SITE + "/#organization"
FOUNDER_ID = SITE + "/tiffanydavidson#person"
# Languages the site's translator offers (same list as the site header), split around the logo.
LANGUAGES = [
    ("en", "English", "English"), ("es", "Español", "Spanish"), ("fr", "Français", "French"),
    ("pt", "Português", "Portuguese"), ("ht", "Kreyòl ayisyen", "Haitian Creole"),
    ("sw", "Kiswahili", "Swahili"), ("so", "Soomaali", "Somali"),
    ("ar", "العربية", "Arabic"), ("fa", "دری / فارسی", "Dari / Persian"), ("ps", "پښتو", "Pashto"),
    ("uk", "Українська", "Ukrainian"), ("ne", "नेपाली", "Nepali"), ("vi", "Tiếng Việt", "Vietnamese"),
    ("zh-CN", "中文 (简体)", "Chinese (Simplified)"),
]
RTL = {"ar", "fa", "ps"}
# Official terminology published as a schema.org DefinedTermSet on the brand page
# (every term and definition is taken from that page and the About page).
BRAND_TERMS = [
    ("W.I.S.E.C.E.O.", "Everyday name of Worldwide Institute For Success And Excellence, an Ohio 501(c)(3) nonprofit."),
    ("Worldwide Institute For Success And Excellence", "Legal name of the 501(c)(3) nonprofit that operates as W.I.S.E.C.E.O. (EIN 41-3404888)."),
    ("WISECEO®", "Registered trademark form of the name, U.S. Reg. No. 6,954,676, registered January 17, 2023."),
    ("WISECEO Academy", "The for-profit arm of WISECEO, operating under a distinct administrative structure."),
    ("Creating Equity & Opportunity", "The organization's tagline; also the meaning of the letters C.E.O. in W.I.S.E.C.E.O."),
]
SECTIONS = [  # sidebar "Knowledge Hub" list, in order
    ("index.md", "Main page"),
    ("01-organization/index.md", "Organization"),
    ("02-initiatives/index.md", "Initiatives"),
    ("03-resources/index.md", "Resources"),
    ("04-faq/index.md", "FAQ"),
]


# ---------- Markdown (small, predictable subset) ----------

def slugify(text):
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"[^a-z0-9]+", "-", html.unescape(text).lower()).strip("-")


def md_href(href):
    """Relative .md links become .html; external links are left alone."""
    if re.match(r"^[a-z]+:", href) or href.startswith("#"):
        return href
    path, _, frag = href.partition("#")
    if path.endswith(".md"):
        path = path[:-3] + ".html"
    return path + ("#" + frag if frag else "")


def inline(text):
    out, pos = [], 0
    # Escape everything except our own markup, handled token by token.
    token = re.compile(r"`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*(.+?)\*")
    for m in token.finditer(text):
        out.append(html.escape(text[pos:m.start()], quote=False))
        code, label, href, bold, em = m.groups()
        if code is not None:
            out.append(f"<code>{html.escape(code)}</code>")
        elif label is not None:
            ext = re.match(r"^https?://", href) and not href.startswith(SITE)
            attrs = ' rel="noopener" target="_blank"' if ext else ""
            out.append(f'<a href="{html.escape(md_href(href))}"{attrs}>{inline(label)}</a>')
        elif bold is not None:
            out.append(f"<strong>{inline(bold)}</strong>")
        else:
            out.append(f"<em>{inline(em)}</em>")
        pos = m.end()
    out.append(html.escape(text[pos:], quote=False))
    return "".join(out)


def split_frontmatter(text):
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    if not m:
        return {}, text
    meta = {}
    for key, val in re.findall(r"^(\w+):\s*(.*)$", m.group(1), re.M):
        val = val.strip()
        if val.startswith("[") and val.endswith("]"):
            val = [v.strip() for v in val[1:-1].split(",") if v.strip()]
        meta[key] = val
    return meta, text[m.end():]


def render(body):
    """Return (title, lead paragraph text, html, [(level, heading text, id)])."""
    lines = body.strip("\n").split("\n")
    out, toc, title, lead, i = [], [], "", "", 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        h = re.match(r"^(#{1,3}) (.+)$", line)
        if h:
            level, text = len(h.group(1)), h.group(2).strip()
            if level == 1:
                title = text
            else:
                hid = slugify(text)
                toc.append((level, text, hid))
                out.append(f'<h{level} id="{hid}">{inline(text)}</h{level}>')
            i += 1
            continue
        if line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            head, body_rows = rows[0], [r for r in rows[2:]]
            has_head = any(c for c in head)
            t = ['<div class="wiki-table-wrap"><table class="wikitable">']
            if has_head:
                t.append("<thead><tr>" + "".join(f"<th scope=\"col\">{inline(c)}</th>" for c in head) + "</tr></thead>")
            t.append("<tbody>")
            for r in body_rows:
                cells = r + [""] * (len(head) - len(r))
                if not has_head and len(cells) == 2:  # key/value fact table
                    t.append(f'<tr><th scope="row">{inline(cells[0])}</th><td>{inline(cells[1])}</td></tr>')
                else:
                    t.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in cells) + "</tr>")
            t.append("</tbody></table></div>")
            out.append("".join(t))
            continue
        if line.startswith("- "):
            items = []
            while i < len(lines) and lines[i].startswith("- "):
                items.append(f"<li>{inline(lines[i][2:].strip())}</li>")
                i += 1
            out.append("<ul>" + "".join(items) + "</ul>")
            continue
        if line.startswith(">"):
            quote = []
            while i < len(lines) and lines[i].startswith(">"):
                quote.append(lines[i][1:].strip())
                i += 1
            kind = re.match(r"^\[!(\w+)\]$", quote[0] or "")
            text = " ".join(q for q in (quote[1:] if kind else quote) if q)
            label = kind.group(1).title() if kind else ""
            out.append(f'<aside class="wiki-callout"><p>{"<strong>" + label + ".</strong> " if label else ""}{inline(text)}</p></aside>')
            continue
        para = []
        while i < len(lines) and lines[i].strip() and not re.match(r"^(#{1,3} |\||- |>)", lines[i]):
            para.append(lines[i].strip())
            i += 1
        text = " ".join(para)
        if not lead and not toc:
            lead = text
        cls = ' class="wiki-related"' if re.match(r"^(Related|Sources?):", text) else ""
        out.append(f"<p{cls}>{inline(text)}</p>")
    return title, lead, "\n".join(out), toc


# ---------- page assembly ----------

def lang_button(code, native, english):
    d = ' dir="rtl"' if code in RTL else ""
    return (f'<li><button type="button" class="lang" data-lang="{code}" lang="{code}"{d}>'
            f'<span class="lang-native">{html.escape(native)}</span>'
            f'<span class="lang-en" lang="en" dir="ltr">{html.escape(english)}</span></button></li>')


GLOBE_IMAGE = ROOT / "images" / "globe-logo.png"  # drop the globe artwork here to replace the drawn globe


def globe_html():
    if GLOBE_IMAGE.exists():
        return '<img class="globe-art" src="/images/globe-logo.png" alt="W.I.S.E.C.E.O. globe logo" width="220" height="220"/>'
    svg = (
        '<svg class="globe" viewBox="0 0 200 200" aria-hidden="true" focusable="false">'
        '<defs><radialGradient id="gl" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#2b6cb0" stop-opacity=".28"/>'
        '<stop offset="1" stop-color="#2b6cb0" stop-opacity="0"/></radialGradient>'
        '<linearGradient id="gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8fe0"/><stop offset="1" stop-color="#c99a3c"/></linearGradient></defs>'
        '<circle cx="100" cy="100" r="96" fill="url(#gl)"/>'
        '<g fill="none" stroke="url(#gr)" stroke-width=".8" opacity=".85">'
        '<circle cx="100" cy="100" r="96" stroke-width="1.5"/>'
        '<ellipse cx="100" cy="100" rx="96" ry="30"/><ellipse cx="100" cy="100" rx="96" ry="62"/>'
        '<path d="M4 100h192M100 4v192"/>'
        '<ellipse cx="100" cy="100" rx="30" ry="96"/><ellipse cx="100" cy="100" rx="62" ry="96"/>'
        '</g></svg>'
    )
    return svg + '<img src="/logo.webp" alt="W.I.S.E.C.E.O. logo" width="110" height="110"/>'


def header_html(main_page):
    """Wikipedia-style central header on every page; languages flank the globe on the main page."""
    center = (
        '<div class="wiki-header-center">'
        '<p class="wiki-title">W.I.S.E.C.E.O.</p>'
        '<p class="wiki-subtitle">Worldwide Institute for Success and Excellence</p>'
        f'<div class="wiki-logo-wrapper">{globe_html()}</div>'
        '</div>'
    )
    if not main_page:
        return f'<header class="wiki-header-container">{center}</header><!--/wiki-header-->'
    left, right = LANGUAGES[:7], LANGUAGES[7:]
    return (
        '<header class="wiki-header-container portal">'
        '<div class="portal-grid">'
        f'<ul class="portal-langs" aria-label="Read in another language">{"".join(lang_button(*l) for l in left)}</ul>'
        f'{center}'
        f'<ul class="portal-langs" aria-label="More languages">{"".join(lang_button(*l) for l in right)}</ul>'
        '</div>'
        '<form class="portal-search" role="search" data-wiki-search>'
        '<label class="sr-only" for="portal-q">Search</label>'
        '<input id="portal-q" type="search" name="q" autocomplete="off" placeholder="Search the Knowledge Hub"/>'
        '<label class="sr-only" for="portal-scope">Search in</label>'
        '<select id="portal-scope" name="scope"><option value="wiki">W.I.S.E.C.E.O.</option><option value="site">Whole website</option></select>'
        '<button type="submit" aria-label="Search"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button>'
        '</form>'
        '<div class="portal-results" role="status" aria-live="polite" data-wiki-results></div>'
        '<div class="portal-read"><button type="button" class="portal-read-btn" aria-expanded="false" aria-controls="portal-all-langs">'
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>'
        'Read W.I.S.E.C.E.O. in your language</button></div>'
        f'<div class="portal-all" id="portal-all-langs" hidden><ul>{"".join(lang_button(*l) for l in LANGUAGES)}</ul>'
        '<p class="portal-note">Pages are translated automatically, so wording may not be perfect.</p></div>'
        '</header><!--/wiki-header-->'
    )


def plain(md_text):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", inline(md_text)))).strip()


def page_url(rel_md):
    rel = rel_md[:-3] + ".html"
    return f"{SITE}/wiki/" if rel == "index.html" else f"{SITE}/wiki/{rel}"


def build_page(md_path, published):
    rel = md_path.relative_to(WIKI).as_posix()
    meta, body = split_frontmatter(md_path.read_text(encoding="utf-8"))
    title, lead, content, toc = render(body)
    title = meta.get("title") or title
    h1 = title
    desc = plain(lead)[:300]
    url = page_url(rel)
    depth = rel.count("/")
    up = "../" * depth
    date = meta.get("date", "")

    crumbs = [f'<a href="{up}index.html">Knowledge Hub</a>']
    if depth and not rel.endswith("/index.md"):
        section = rel.split("/")[0]
        sec_title = next((t for p, t in SECTIONS if p.startswith(section + "/")), section)
        crumbs.append(f'<a href="{up}{section}/index.html">{html.escape(sec_title)}</a>')
    if rel != "index.md":
        crumbs.append(f"<span aria-current=\"page\">{inline(h1)}</span>")

    side_toc = '<li><a href="#top">(Top)</a></li>' + "".join(
        f'<li{" class=\"sub-item\"" if lvl == 3 else ""}><a href="#{hid}">{inline(t)}</a></li>'
        for lvl, t, hid in toc)
    side_hub = "".join(
        f'<li><a href="{up}{p[:-3]}.html"{" aria-current=\"page\"" if p == rel else ""}>{html.escape(t)}</a></li>'
        for p, t in SECTIONS if p in published
    )

    ld = {
        "@context": "https://schema.org",
        "@type": "Article",
        "@id": url + "#article",
        "headline": plain(h1),
        "description": desc,
        "url": url,
        "mainEntityOfPage": url,
        "inLanguage": "en",
        "isPartOf": {"@id": SITE + "/#website"},
        "about": {"@id": ORG_ID},
        "author": {"@type": "Person", "@id": FOUNDER_ID, "name": "Tiffany Davidson",
                   "honorificSuffix": "M.Ed. LSLS, M.Ed. C&I", "url": SITE + "/tiffanydavidson"},
        "publisher": {"@type": "NGO", "@id": ORG_ID, "name": "Worldwide Institute For Success And Excellence",
                      "logo": SITE + "/logo.webp"},
    }
    if date:
        ld["datePublished"] = ld["dateModified"] = date
    graph = [ld]
    # Breadcrumbs: Knowledge Hub > section > page
    trail = [("Knowledge Hub", page_url("index.md"))]
    if depth and not rel.endswith("/index.md"):
        section = rel.split("/")[0]
        trail.append((next((t for p, t in SECTIONS if p.startswith(section + "/")), section),
                      page_url(section + "/index.md")))
    if rel != "index.md":
        trail.append((plain(h1), url))
    graph.append({"@type": "BreadcrumbList", "@id": url + "#breadcrumb",
                  "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": u}
                                      for i, (n, u) in enumerate(trail)]})
    ld["breadcrumb"] = {"@id": url + "#breadcrumb"}
    if rel == "01-organization/branding.md":
        graph.append({"@type": "DefinedTermSet", "@id": url + "#terms",
                      "name": "W.I.S.E.C.E.O. official terminology", "url": url,
                      "hasDefinedTerm": [{"@type": "DefinedTerm", "name": n, "description": d,
                                          "inDefinedTermSet": {"@id": url + "#terms"}} for n, d in BRAND_TERMS]})
    if isinstance(meta.get("tags"), list):
        ld["keywords"] = ", ".join(t for t in meta["tags"] if t not in ("index", "draft"))

    if meta.get("description"):
        desc = meta["description"]
        ld["description"] = desc
    page_title = meta.get("seo_title") or f"{plain(h1)} | W.I.S.E.C.E.O. Wiki"
    esc_t, esc_d = html.escape(plain(h1)), html.escape(desc)
    css = f"{up}wiki.css"
    head = (
        '<!DOCTYPE html><html lang="en"><head>'
        # "/wiki" (no slash) is served by a rewrite; move to "/wiki/" so relative links resolve.
        + ('<script>if(location.pathname==="/wiki")location.replace("/wiki/"+location.search+location.hash)</script>'
           if rel == "index.md" else "")
        +
        # Apply the saved theme before first paint so dark mode doesn't flash.
        '<script>try{if(localStorage.getItem("theme")==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}</script>'
        '<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>'
        f"<title>{html.escape(page_title)}</title>"
        f'<meta name="description" content="{esc_d}"/>'
        f'<link rel="canonical" href="{url}"/>'
        '<meta property="og:type" content="article"/>'
        '<meta property="og:site_name" content="W.I.S.E.C.E.O."/>'
        f'<meta property="og:title" content="{esc_t}"/>'
        f'<meta property="og:description" content="{esc_d}"/>'
        f'<meta property="og:url" content="{url}"/>'
        f'<meta property="og:image" content="{SITE}/logo.webp"/>'
        '<meta name="author" content="Tiffany Davidson"/>'
        '<link rel="icon" type="image/webp" href="/logo.webp"/>'
        '<link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml"/>'
        f'<link rel="stylesheet" href="{css}"/>'
        f'<link rel="alternate" type="text/markdown" href="{md_path.name}"/>'
        f'<script type="application/ld+json">{json.dumps({"@context": "https://schema.org", "@graph": [{k: v for k, v in n.items() if k != "@context"} for n in graph]}, ensure_ascii=False)}</script>'
        '</head>'
    )
    body = (
        '<body><a class="skip-link" href="#top">Skip to content</a>'
        '<aside aria-label="Wiki navigation"><div>'
        f'<a class="logo-area" href="{up}index.html"><strong>W.I.S.E.C.E.O.</strong> Wiki</a>'
        '<div class="toc-box" role="navigation" aria-label="Contents">'
        '<div class="toc-title">Contents '
        '<button type="button" class="toc-toggle" aria-expanded="true" aria-controls="toc-list">hide</button></div>'
        f'<ul id="toc-list">{side_toc}</ul></div>'
        f'<p class="side-h">Knowledge Hub</p><ul class="quick-links">{side_hub}</ul>'
        '<p class="side-h">Quick Links</p><ul class="quick-links">'
        '<li><a href="/">Official Website</a></li>'
        '<li><a href="/llms.txt">llms.txt Index</a></li>'
        '<li><a href="/sitemap.xml">Sitemap</a></li>'
        f'<li><a href="{md_path.name}">View as Markdown</a></li>'
        '<li><a href="/contact.html">Suggest a correction</a></li></ul>'
        '</div><div class="theme-toggle-container">'
        '<button type="button" id="theme-toggle" aria-pressed="false">Dark Mode</button>'
        '</div></aside>'
        '<main id="top">'
        + header_html(rel == "index.md")
        + f'<div class="crumbs" role="navigation" aria-label="Breadcrumb">{" › ".join(crumbs)}</div><!--/crumbs-->'
        f"<h1>{inline(h1)}</h1>"
        '<p class="wiki-from">From the W.I.S.E.C.E.O. Knowledge Hub</p>'
        f'<div class="wiki-body">{content}</div>'
        '<footer class="wiki-foot">'
        + (f"Last updated {html.escape(date)}. " if date else "")
        + 'Published by <a href="/">Worldwide Institute For Success And Excellence (W.I.S.E.C.E.O.)</a>, '
        'a 501(c)(3) nonprofit · West Chester, Ohio.</footer>'
        f'</main><script src="{up}wiki.js" defer></script></body></html>'
    )
    out = md_path.with_suffix(".html")
    out.write_text(head + body, encoding="utf-8")
    return out


def update_sitemap(published):
    path = ROOT / "sitemap.xml"
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"  <url><loc>https://www\.wiseceo\.org/wiki/[^<]*</loc></url>\n", "", text)
    order = [p for p, _ in SECTIONS if p in published] + sorted(p for p in published if p not in dict(SECTIONS))
    lines = "".join(f"  <url><loc>{page_url(p)}</loc></url>\n" for p in order)
    text = text.replace("</urlset>", lines + "</urlset>")
    path.write_text(text, encoding="utf-8")


def main():
    published, built = [], []
    for md in sorted(WIKI.rglob("*.md")):
        meta, _ = split_frontmatter(md.read_text(encoding="utf-8"))
        if str(meta.get("status", "")).strip() == "draft":
            stale = md.with_suffix(".html")
            if stale.exists():
                stale.unlink()
            continue
        published.append(md.relative_to(WIKI).as_posix())
    for rel in published:
        built.append(build_page(WIKI / rel, set(published)))
    update_sitemap(published)
    print(f"Built {len(built)} wiki pages; sitemap updated")
    subprocess.run([sys.executable, str(ROOT / "scripts" / "build-llms-txt.py")], check=True)


if __name__ == "__main__":
    main()
