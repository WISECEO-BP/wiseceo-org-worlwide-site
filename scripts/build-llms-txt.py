#!/usr/bin/env python3
"""Write /llms.txt: a plain-text map of wiseceo.org for AI tools (https://llmstxt.org).

Lists the main site pages and every wiki page under wiki/. Wiki pages whose
frontmatter says `status: draft` are left out until they are published.
Run after adding or renaming a page or a wiki file:

    python3 scripts/build-llms-txt.py
"""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://www.wiseceo.org"

# Main site pages, in reading order. Titles and descriptions come from each page's <head>.
PAGES = [
    "index.html", "about.html", "tiffanydavidson.html", "programs.html", "literacy.html",
    "faq.html", "give.html", "contact.html", "newsletter.html",
]
POLICIES = ["privacy.html", "legal.html", "ip-policy.html", "accessibility.html"]


def page_entry(name):
    src = (ROOT / name).read_text(encoding="utf-8")
    title = re.search(r"<title>(.*?)</title>", src, re.S).group(1)
    title = re.sub(r"\s*[—–-]\s*W\.I\.S\.E\.C\.E\.O\..*$", "", title).strip() or "Home"
    desc = re.search(r'<meta name="description" content="([^"]*)"', src)
    url = SITE + "/" if name == "index.html" else f"{SITE}/{name}"
    title = html.unescape(title)
    return f"- [{title}]({url})" + (f": {html.unescape(desc.group(1))}" if desc else "")


def frontmatter(text):
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    return dict(re.findall(r"^(\w+):\s*(.*)$", m.group(1), re.M)) if m else {}


def wiki_entries():
    out = []
    # Hub first, then each section's index before its pages.
    paths = sorted((ROOT / "wiki").rglob("*.md"),
                   key=lambda p: (p.parent != ROOT / "wiki", p.parent.as_posix(), p.name != "index.md", p.name))
    for path in paths:
        text = path.read_text(encoding="utf-8")
        meta = frontmatter(text)
        if meta.get("status", "").strip() == "draft":
            continue
        body = re.sub(r"^---\n.*?\n---\n", "", text, flags=re.S)
        title = meta.get("title") or re.search(r"^# (.+)$", body, re.M).group(1)
        # First paragraph after the H1 is the page's direct answer.
        para = re.search(r"^# .+?\n\n(.+?)(?:\n\n|$)", body, re.S | re.M)
        summary = " ".join(para.group(1).split()) if para else ""
        summary = re.sub(r"\*\*(.+?)\*\*", r"\1", re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", summary))
        rel = path.relative_to(ROOT).as_posix()
        out.append(f"- [{title.strip()}]({SITE}/{rel})" + (f": {summary}" if summary else ""))
    return out


lines = [
    "# W.I.S.E.C.E.O.",
    "",
    "> Worldwide Institute for Success and Excellence (W.I.S.E.C.E.O.) is an Ohio-based 501(c)(3) "
    "nonprofit (EIN 41-3404888) advancing digital literacy, workforce development and economic mobility "
    "for underserved communities. Founded by Tiffany Davidson, M.Ed. LSLS, M.Ed. C&I. Headquartered in "
    "West Chester, Ohio.",
    "",
    "The wiki pages below are short, sourced Markdown files intended for quoting; "
    f"{SITE}/llms-full.txt has all of them in one file. "
    "If anything here differs from the website, the website is authoritative.",
    "",
    "## Website",
    "",
    *[page_entry(p) for p in PAGES],
    "",
    "## Knowledge Hub (wiki)",
    "",
    *wiki_entries(),
    "",
    "## Optional",
    "",
    *[page_entry(p) for p in POLICIES],
    f"- [Machine-readable summary]({SITE}/ai/summary.json)",
    f"- [FAQ (JSON)]({SITE}/ai/faq.json)",
    f"- [Services (JSON)]({SITE}/ai/service.json)",
    f"- [RSS feed]({SITE}/feed.xml)",
    "",
]
(ROOT / "llms.txt").write_text("\n".join(lines), encoding="utf-8")

# llms-full.txt: the full text of every published wiki page in one file, so an AI tool
# can read the whole Knowledge Hub in a single request.
full = [
    "# W.I.S.E.C.E.O. Knowledge Hub (full text)",
    "",
    "> " + lines[2][2:],
    "",
    f"Source index: {SITE}/llms.txt. Each section below is one wiki page; the URL after its title is the",
    "page to cite. If anything here differs from the website, the website is authoritative.",
    "",
]
for path in sorted((ROOT / "wiki").rglob("*.md"),
                   key=lambda p: (p.parent != ROOT / "wiki", p.parent.as_posix(), p.name != "index.md", p.name)):
    text = path.read_text(encoding="utf-8")
    meta = frontmatter(text)
    if meta.get("status", "").strip() == "draft":
        continue
    body = re.sub(r"^---\n.*?\n---\n", "", text, flags=re.S).strip()
    # Shift every heading down one level so each page title is an H2 under the file's H1.
    body = re.sub(r"^(#{1,5}) ", lambda m: "#" + m.group(1) + " ", body, flags=re.M)
    rel = path.relative_to(ROOT).as_posix()
    full += ["---", "", body, "", f"URL: {SITE}/{rel}", ""]
(ROOT / "llms-full.txt").write_text("\n".join(full), encoding="utf-8")
print(f"Wrote llms-full.txt ({sum(len(l.split()) for l in full)} words)")
print(f"Wrote llms.txt ({sum(1 for l in lines if l.startswith('- '))} links)")
