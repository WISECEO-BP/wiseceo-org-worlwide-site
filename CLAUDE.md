# wiseceo.org — notes for Claude

Static HTML site plus Node serverless functions in `/api`, deployed by Vercel from `main`.

## Publishing changes
- The site owner has asked Claude to **merge its own pull requests**, so they don't have to approve each one.
- Workflow: branch `claude/<topic>` → commit → push → open PR → wait for the Vercel preview check to pass → merge the PR (squash or merge commit) → confirm the production deployment on `main` succeeds → send the owner the live link.
- Don't merge if the Vercel check fails, or if the change deletes pages, changes legal/privacy wording beyond what the owner asked for, or alters what student data the forms collect without the owner asking. Ask first in those cases.

## Conventions
- Every registration form must include the required checkbox: "By registering, you agree to the terms and policies set forth at wiseceo.org/legal." (linked to /legal.html), checked in the browser and in the `/api` handler.
- After changing page text, run `python3 scripts/build-search-index.py`.
- Never ask the owner to paste API keys or tokens into chat; they belong in Vercel or Airtable settings.
