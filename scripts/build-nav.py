#!/usr/bin/env python3
"""Write the site's main menu (desktop dropdown lists + mobile accordion) into every page.

Edit MENU below, then run from the repo root:
    python3 scripts/build-nav.py && python3 scripts/build-search-index.py

Each page's <div class="nav-links"> / <ul class="nav-links"> block and its
<ul class="mm-links"> block are replaced. The section that contains the current
page is marked as active.
"""
import html
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent

MENU = [
    {
        "id": "about", "label": "About Us", "href": "/about.html",
        "intro": "An Ohio-based 501(c)(3) nonprofit creating equity and opportunity through "
                 "digital literacy, workforce development, and economic mobility.",
        "more": ("Our Mission", "/about.html"),
        "groups": [
            ("Who we are", [
                ("Our Mission", "/about.html"),
                ("Our Founder", "/tiffanydavidson.html"),
                ("Where We Serve", "/about.html#where-we-serve"),
                ("Our Impact", "/#impact"),
            ]),
            ("Organization", [
                ("Organization Information", "/about.html#organization"),
                ("Partners & Collaborations", "/about.html#partners"),
                ("Newsroom", "/about/newsroom/"),
                ("FAQ", "/faq.html"),
            ]),
        ],
        "pages": ["about.html", "tiffanydavidson.html", "faq.html", "about/"],
    },
    {
        "id": "programs", "label": "Programs", "href": "/programs.html",
        "intro": "Skills, credentials and wrap-around support that help learners build careers "
                 "and lasting economic mobility.",
        "more": ("All programs", "/programs.html"),
        "groups": [
            ("Our programs", [
                ("Digital Literacy & Coding", "/programs.html#digital-literacy"),
                ("Workforce Development", "/programs.html#workforce"),
                ("Entrepreneurship & Innovation", "/programs.html#entrepreneurship"),
                ("Youth Career & Tech Initiative", "/programs.html#youth-leadership"),
                ("Community Economic Resilience", "/programs.html#community-resilience"),
            ]),
            ("Learning & access", [
                ("Literacy & Language", "/literacy.html"),
                ("Education Access & Equity", "/programs.html#education-access"),
                ("Apply to a program", "/apply.html"),
            ]),
        ],
        "pages": ["programs.html", "literacy.html", "apply.html", "register.html",
                  "student-signup.html", "studentregistration.html"],
    },
    {
        "id": "news", "label": "News & Resources", "href": "/blog.html",
        "intro": "Free, practical guides for families, educators and job seekers.",
        "more": ("Blog", "/blog.html"),
        "groups": [
            ("Read", [
                ("Blog", "/blog.html"),
                ("News & Resources", "/newsletter.html"),
                ("Knowledge Hub", "/wiki/"),
                ("Subscribe to the newsletter", "https://newsletter.wiseceo.org/subscribe"),
            ]),
            ("Family & educator guides", [
                ("IEP Family Guide", "/articles/iep-family-guide.html"),
                ("SIOP Moves for Teachers", "/articles/siop-moves-for-teachers.html"),
                ("Reading Is the First Job Skill", "/articles/reading-is-the-first-job-skill.html"),
            ]),
        ],
        "pages": ["blog.html", "newsletter.html", "articles/"],
    },
    {
        "id": "involved", "label": "Get Involved", "href": "/give.html",
        "intro": "Help us open more doors: give, volunteer, or partner with us.",
        "more": ("Ways to give", "/give.html"),
        "groups": [
            ("Give", [
                ("Give once", "/give.html#give-once"),
                ("Become a Member", "/give.html#membership"),
            ]),
            ("Join us", [
                ("Volunteer", "/contact.html"),
                ("Start a chapter", "/contact.html"),
                ("Become a partner", "/contact.html"),
            ]),
        ],
        "pages": ["give.html"],
    },
]
CONTACT = ("Contact", "/contact.html", ["contact.html"])

CHEVRON = ('<svg class="mega-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" '
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>')


def e(s):
    return html.escape(s, quote=True)


def in_section(rel, pages):
    return any(rel == p or (p.endswith("/") and rel.startswith(p)) for p in pages)


def link(label, href, rel):
    cur = href.split("#")[0]
    here = "/" + rel if rel != "index.html" else "/"
    aria = ' aria-current="page"' if cur == here and "#" not in href else ""
    return f'<li><a href="{e(href)}"{aria}>{e(label)}</a></li>'


def section_links(sec):
    """Overview link first, then every grouped link once, in order."""
    seen, out = set(), []
    for label, href in [sec["more"]] + [x for _, g in sec["groups"] for x in g]:
        if (label, href) not in seen and not (href == sec["more"][1] and (label, href) != sec["more"]):
            seen.add((label, href))
            out.append((label, href))
    return out


def desktop(rel):
    out = ['<ul class="nav-links mega-nav">']
    for sec in MENU:
        active = " active" if in_section(rel, sec["pages"]) else ""
        items = "".join(link(l, u, rel) for l, u in section_links(sec))
        out.append(
            f'<li class="mega-item"><button type="button" class="mega-btn{active}" aria-expanded="false" '
            f'aria-controls="mega-{sec["id"]}" data-mega>{e(sec["label"])}{CHEVRON}</button>'
            f'<div class="mega-panel" id="mega-{sec["id"]}" hidden><ul class="drop-list">{items}</ul></div></li>')
    label, href, pages = CONTACT
    active = ' class="mega-link active" aria-current="page"' if in_section(rel, pages) else ' class="mega-link"'
    out.append(f'<li class="mega-item"><a href="{href}"{active}>{label}</a></li></ul>')
    return "".join(out)


def mobile(rel):
    out = ['<ul class="mm-links">']
    for sec in MENU:
        open_ = " open" if in_section(rel, sec["pages"]) else ""
        items = [link(l, u, rel) for l, u in section_links(sec)]
        out.append(f'<li><details class="mm-group"{open_}><summary>{e(sec["label"])}</summary>'
                   f'<ul class="mm-sub">{"".join(items)}</ul></details></li>')
    label, href, pages = CONTACT
    aria = ' aria-current="page"' if in_section(rel, pages) else ""
    out.append(f'<li><a href="{href}"{aria}>{label}</a></li></ul>')
    return "".join(out)


DESKTOP_RE = re.compile(r'<div class="nav-links">.*?</div>|<ul class="nav-links mega-nav">.*?<a href="/contact\.html"[^>]*>Contact</a></li></ul>', re.S)
MOBILE_RE = re.compile(r'<ul class="mm-links">.*?</ul>(?=</div><a href="/give\.html#membership")', re.S)

pages = sorted(list(ROOT.glob("*.html")) + list(ROOT.glob("articles/*.html")) + list(ROOT.glob("about/**/*.html")))
changed = 0
for path in pages:
    rel = path.relative_to(ROOT).as_posix()
    src = path.read_text(encoding="utf-8")
    if not DESKTOP_RE.search(src):
        continue
    new, n1 = DESKTOP_RE.subn(lambda m: desktop(rel), src, count=1)
    new, n2 = MOBILE_RE.subn(lambda m: mobile(rel), new, count=1)
    if n2 != 1:
        raise SystemExit(f"{rel}: mobile menu block not found")
    if new != src:
        path.write_text(new, encoding="utf-8")
        changed += 1
print(f"Menu written to {changed} pages")
