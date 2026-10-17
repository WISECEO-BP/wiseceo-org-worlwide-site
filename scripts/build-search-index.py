#!/usr/bin/env python3
"""Rebuild search-index.json from the site's HTML pages.

Run from the repo root after adding or editing a page:
    python3 scripts/build-search-index.py
"""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKIP_IDS = {"hero", "contactForm", "contactStatus", "apply-form", "apply-sub", "apply-title",
            "search-title", "search-status", "search-results", "search-input", "mobile-menu", "search-modal",
            # Generic page wrappers reused across pages; the page entry already covers them.
            "about", "programs", "contact", "newsletter", "articles"}


def text(fragment):
    fragment = re.sub(r"<(script|style)\b.*?</\1>", " ", fragment, flags=re.S | re.I)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def url_for(path):
    rel = path.relative_to(ROOT).as_posix()
    return "/" if rel == "index.html" else "/" + rel


def main_content(src):
    """The page body without the shared header, menu, search dialog and footer."""
    start = src.find('<div class="search-modal"')
    start = src.find("</ul></div></div>", start) + len("</ul></div></div>") if start > -1 else 0
    end = src.find('<footer class="site-footer">')
    return src[start:end if end > -1 else len(src)]


entries = []
for path in sorted(list(ROOT.glob("*.html")) + list(ROOT.glob("articles/*.html"))):
    src = path.read_text(encoding="utf-8")
    title = text(re.search(r"<title>(.*?)</title>", src, re.S).group(1))
    title = re.sub(r"\s*[—–-]\s*W\.I\.S\.E\.C\.E\.O\..*$", "", title) or "Home"
    if path.name == "index.html":
        title = "Home"
    desc = re.search(r'<meta name="description" content="([^"]*)"', src)
    body = main_content(src)
    entries.append({"title": title, "url": url_for(path),
                    "description": html.unescape(desc.group(1)) if desc else "",
                    "text": text(body)[:6000]})

    # Sections with their own anchor (e.g. each program card) get their own result.
    for m in re.finditer(r'<(section|div)\b[^>]*\bid="([^"]+)"[^>]*>', body):
        sid = m.group(2)
        if sid in SKIP_IDS:
            continue
        window = body[m.end():m.end() + 2500]
        h = re.search(r"<h[23][^>]*>(.*?)</h[23]>", window, re.S)
        if not h:
            continue
        p = re.search(r"<p\b[^>]*>(.*?)</p>", window[h.end():], re.S)
        heading = text(h.group(1))
        url = f"{url_for(path)}#{sid}"
        if heading.lower() == title.lower() or any(e["url"] == url for e in entries):
            continue
        entries.append({"title": f"{heading} · {title}", "url": url,
                        "description": text(p.group(1))[:220] if p else "",
                        "text": text(window)[:1200]})

out = ROOT / "search-index.json"
out.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Wrote {len(entries)} entries to {out.relative_to(ROOT)}")
