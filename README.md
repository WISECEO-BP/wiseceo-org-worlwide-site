# wiseceo-org-worlwide-site

Static site for [wiseceo.org](https://www.wiseceo.org), deployed on Vercel.

## Site search

The search dialog (magnifier icon, `/`, or Ctrl/Cmd+K) reads `search-index.json`.
After adding or editing a page, rebuild it from the repo root:

```sh
python3 scripts/build-search-index.py
```

## Shared header and footer

Every page carries the same utility bar (language selector, high-contrast switch),
main nav, mobile menu, search dialog and footer markup; `site.js` adds the behavior.
When adding a page, copy that markup from an existing page and set
`class="active" aria-current="page"` on its nav link.
